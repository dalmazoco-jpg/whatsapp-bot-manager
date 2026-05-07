import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, empresaProcedure, router } from "./_core/trpc";
import { generateDelegatedToken } from "./auth";
import { notificarEntregador, notificarContatos, templateEntregaSaindo } from "./services/notificacoes.service";
import { invokeLLM } from "./_core/llm";
import {
  getDb,
  getAllEmpresas,
  getEmpresaById,
  getClientesByEmpresaId,
  getClienteById,
  getPedidosByEmpresaId,
  getPedidoById,
  getAgendamentosByEmpresaId,
  getAgendamentoById,
  getCardapioByEmpresaId,
  getApresentacaoConfigByEmpresaId,
  getApresentacaoConfigBySlug,
  getPublicApresentacaoDataBySlug,
  getPublicPlatformApresentacaoDataBySlug,
  getHorariosByEmpresaId,
  getMensagensByClienteId,
  getMensagensByEmpresaId,
  getNotificacoesByEmpresaId,
  getSessaoByEmpresaId,
  getPlatformSettings,
  upsertApresentacaoConfig,
  updatePlatformSettings,
} from "./db";
import {
  empresas,
  usuarios,
  cardapioItens,
  apresentacaoConfig,
  horariosAtendimento,
  clientesWhatsapp,
  pedidos,
  agendamentos,
  mensagensLog,
  sessoesWhatsapp,
  notificacoes,
  type InsertEmpresa,
  type InsertCardapioItem,
  type InsertApresentacaoConfig,
  type InsertHorarioAtendimento,
} from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  createFallbackEmpresa,
  createFallbackCardapioItem,
  deleteFallbackCardapioItem,
  getFallbackApresentacaoConfigByEmpresaId,
  getFallbackApresentacaoConfigBySlug,
  getFallbackPublicApresentacaoDataBySlug,
  getFallbackPublicPlatformApresentacaoDataBySlug,
  getFallbackEmpresaById,
  getFallbackPlatformSettings,
  isFallbackAuthEnabled,
  listFallbackCardapioByEmpresaId,
  listFallbackEmpresas,
  updateFallbackCardapioItem,
  updateFallbackEmpresaConfig,
  upsertFallbackApresentacaoConfig,
  updateFallbackPlatformSettings,
  updateFallbackEmpresaModules,
  updateFallbackEmpresaLicenca,
} from "./fallback-store";
import { PLATFORM_SETTINGS_ID } from "../shared/platform";
import { getPlanoSaas } from "../shared/billing";

const masterAdminEmail = "dalmazo.co@gmail.com";
const moduleIds = [
  "dashboard",
  "whatsapp",
  "cardapio",
  "apresentacao",
  "clientes",
  "pedidos",
  "agendamentos",
  "financeiro",
  "configuracoes",
] as const;
const requiredModules = ["dashboard", "whatsapp", "configuracoes"] as const;
const moduleSchema = z.enum(moduleIds);
const normalizeModules = (modules?: string[]) => {
  const selected = new Set<string>([...requiredModules, ...(modules ?? moduleIds)]);
  return moduleIds.filter((module) => selected.has(module));
};

const requireMasterAdmin = (email?: string | null) => {
  if (email?.toLowerCase() !== masterAdminEmail) {
    throw new Error("Acesso restrito ao administrador master");
  }
};

const formatCurrency = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const renderContract = (template: string, data: Record<string, string>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => data[key] ?? "");

const buildContractData = (empresa: any, settings: any) => {
  const configBot = ((empresa?.configBot as any) ?? {}) as Record<string, any>;
  const responsavel = (configBot.responsavelLegal ?? {}) as Record<string, any>;
  const plano = getPlanoSaas(String(configBot.planoId || "inicial"));
  const modulos = Array.isArray(configBot.modules) ? configBot.modules.join(", ") : plano.modules.join(", ");
  const documentoTipo = responsavel.documentoTipo || (responsavel.documentoNumero?.replace(/\D/g, "").length > 11 ? "CNPJ" : "CPF/CNPJ");
  const clienteNome =
    responsavel.nomeCompleto ||
    responsavel.razaoSocial ||
    responsavel.responsavelNome ||
    empresa?.nome ||
    "Contratante";

  return {
    cliente_nome: clienteNome,
    cliente_documento: `${documentoTipo} ${responsavel.documentoNumero || "não informado"}`.trim(),
    responsavel_nome: responsavel.responsavelNome || responsavel.nomeCompleto || clienteNome,
    responsavel_email: responsavel.email || "",
    responsavel_telefone: responsavel.telefone || "",
    responsavel_whatsapp: empresa?.whatsappNumero || responsavel.whatsapp || "",
    responsavel_endereco: responsavel.endereco || "",
    responsavel_cidade: responsavel.cidade || "",
    responsavel_estado: responsavel.estado || "",
    responsavel_cep: responsavel.cep || "",
    plano_nome: plano.nome,
    modulos_liberados: modulos,
    valor_licenca: formatCurrency(plano.licencaCentavos),
    valor_mensalidade: formatCurrency(plano.mensalidadeCentavos),
    contratada_nome: settings?.razaoSocial || settings?.nome || "DALMAZO & CO.",
    contratada_cnpj: settings?.cnpj || "",
    contratada_endereco: settings?.endereco || "",
    data: new Date().toLocaleDateString("pt-BR"),
  };
};

// ============================================================
// ADMIN — Gerenciamento de Empresas (apenas admin)
// ============================================================
export const adminRouter = router({
  plataforma: adminProcedure.query(async ({ ctx }) => {
    requireMasterAdmin(ctx.user.email);
    if (isFallbackAuthEnabled()) return getFallbackPlatformSettings();
    return getPlatformSettings();
  }),

  atualizarPlataforma: adminProcedure
    .input(
      z.object({
        nome: z.string().optional(),
        razaoSocial: z.string().optional(),
        cnpj: z.string().optional(),
        naturezaJuridica: z.string().optional(),
        endereco: z.string().optional(),
        telefone: z.string().optional(),
        whatsappNumero: z.string().optional(),
        email: z.string().optional(),
        cnae: z.string().optional(),
        contratoTemplate: z.string().optional(),
        planosCustom: z.array(z.any()).optional(),
        configIa: z
          .object({
            systemPrompt: z.string().optional(),
            nomeBot: z.string().optional(),
            regras: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      if (isFallbackAuthEnabled()) {
        return updateFallbackPlatformSettings(input as any);
      }
      return updatePlatformSettings(input as any);
    }),

  // Listar todas as empresas
  empresas: adminProcedure.query(async ({ ctx }) => {
    requireMasterAdmin(ctx.user.email);
    if (isFallbackAuthEnabled()) return listFallbackEmpresas();
    return getAllEmpresas();
  }),

  // Buscar empresa por ID
  empresa: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      if (isFallbackAuthEnabled()) return getFallbackEmpresaById(input.id);
      return getEmpresaById(input.id);
    }),

  // Criar nova empresa
  criarEmpresa: adminProcedure
    .input(
      z.object({
        nome: z.string().min(2),
        tipo: z.enum(["pizzaria", "adega", "consultorio", "loja", "outro"]),
        whatsappNumero: z.string().optional(),
        // Dados do primeiro usuário da empresa
        emailUsuario: z.string().email(),
        senhaUsuario: z.string().min(6),
        nomeUsuario: z.string(),
        modules: z.array(moduleSchema).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      const modules = normalizeModules(input.modules);

      if (isFallbackAuthEnabled()) {
        return createFallbackEmpresa({ ...input, modules });
      }

      const db = getDb();

      // Criar empresa
      const [novaEmpresa] = await db
        .insert(empresas)
        .values({
          nome: input.nome,
          tipo: input.tipo,
          ramo: input.tipo,
          whatsappNumero: input.whatsappNumero,
          ativo: true,
          configBot: { modules },
        } as InsertEmpresa)
        .returning();

      // Criar usuário da empresa
      const senhaHash = await bcrypt.hash(input.senhaUsuario, 10);
      await db.insert(usuarios).values({
        email: input.emailUsuario,
        senhaHash,
        nome: input.nomeUsuario,
        role: "empresa",
        empresaId: novaEmpresa.id,
      });

      return novaEmpresa;
    }),

  // Ativar/desativar licença
  toggleLicenca: adminProcedure
    .input(
      z.object({
        empresaId: z.number(),
        ativo: z.boolean(),
        diasLicenca: z.number().optional(), // dias a partir de agora
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      if (isFallbackAuthEnabled()) {
        updateFallbackEmpresaLicenca(input.empresaId, input.ativo, input.diasLicenca);
        return { success: true };
      }

      const db = getDb();

      const licencaExpira = input.ativo && input.diasLicenca
        ? new Date(Date.now() + input.diasLicenca * 24 * 60 * 60 * 1000)
        : null;

      await db
        .update(empresas)
        .set({
          ativo: input.ativo,
          licencaExpira,
          updatedAt: new Date(),
        })
        .where(eq(empresas.id, input.empresaId));

      return { success: true };
    }),

  // Atualizar empresa
  atualizarEmpresa: adminProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().optional(),
        tipo: z.enum(["pizzaria", "adega", "consultorio", "loja", "outro"]).optional(),
        whatsappNumero: z.string().optional(),
        modules: z.array(moduleSchema).optional(),
        configIa: z
          .object({
            systemPrompt: z.string().optional(),
            nomeBot: z.string().optional(),
            regras: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      if (isFallbackAuthEnabled()) {
        if (input.modules) updateFallbackEmpresaModules(input.id, normalizeModules(input.modules));
        return { success: true };
      }

      const db = getDb();
      const { id, modules, ...data } = input;
      const updateData = {
        ...data,
        ...(modules ? { configBot: { modules: normalizeModules(modules) } } : {}),
      };

      await db
        .update(empresas)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(empresas.id, id));

      return { success: true };
    }),

  // Acessar dashboard de uma empresa (delegated access)
  acessarEmpresa: adminProcedure
    .input(z.object({ empresaId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      requireMasterAdmin(ctx.user.email);
      if (!ctx.user) throw new Error("Usuário não autenticado");

      const empresa = isFallbackAuthEnabled()
        ? getFallbackEmpresaById(input.empresaId)
        : await getEmpresaById(input.empresaId);
      if (!empresa) throw new Error("Empresa não encontrada");

      const token = generateDelegatedToken(ctx.user.id, ctx.user.email, input.empresaId);

      return {
        token,
        empresa: {
          id: empresa.id,
          nome: empresa.nome,
          tipo: empresa.tipo,
        },
      };
    }),
});

// ============================================================
// CLIENTES — filtrados por empresa_id
// ============================================================
export const clientesRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) {
      return []; // Admin sem empresa selecionada
    }
    return getClientesByEmpresaId(ctx.empresaId!);
  }),

  create: empresaProcedure
    .input(
      z.object({
        nome: z.string().min(2),
        whatsappNumber: z.string().min(8),
        endereco: z.string().optional(),
        preferencias: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.empresaId) throw new Error("Selecione uma empresa para cadastrar cliente final");
      const db = getDb();
      const [cliente] = await db
        .insert(clientesWhatsapp)
        .values({
          empresaId: ctx.empresaId,
          nome: input.nome,
          whatsappNumber: input.whatsappNumber.replace(/\D/g, ""),
          endereco: input.endereco || null,
          preferencias: input.preferencias || {},
          ultimaInteracao: new Date(),
        })
        .returning();
      return cliente;
    }),

  get: empresaProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getClienteById(input.id);
    }),
});

// ============================================================
// PEDIDOS — filtrados por empresa_id
// ============================================================
export const pedidosRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    return getPedidosByEmpresaId(ctx.empresaId!);
  }),

  get: empresaProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getPedidoById(input.id);
    }),

  updateStatus: empresaProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["recebido", "confirmado", "em_preparo", "saiu_entrega", "entregue", "cancelado"]),
        valorTotal: z.number().optional(), // permitir atualizar o valor se necessário
        statusPagamento: z.enum(["pendente", "pago", "estornado"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db
        .update(pedidos)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pedidos.id, id));

      // ── Notifica entregador quando saiu para entrega ──────
      if (input.status === "saiu_entrega") {
        try {
          const empresaId = ctx.empresaId!;
          const pedido = await getPedidoById(id);
          const cliente = pedido?.clienteId ? await getClienteById(pedido.clienteId) : null;
          const clienteNome = cliente?.nome || "Cliente";
          const endereco = (pedido as any)?.enderecoEntrega || (pedido as any)?.endereco_entrega || "Endereço não informado";
          const itens = Array.isArray((pedido as any)?.itens)
            ? (pedido as any).itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(", ")
            : "Itens do pedido";
          const valor = pedido?.valorTotal
            ? (pedido.valorTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
            : "—";

          const msgEntregador = templateEntregaSaindo({ clienteNome, endereco, pedidoId: id, itens, valor });
          notificarEntregador(empresaId, msgEntregador).catch(console.error);

          // Também notifica proprietário
          notificarContatos(empresaId, "entrega", `🚚 *Pedido #${id} saiu para entrega!*\n👤 ${clienteNome}\n📍 ${endereco}`).catch(console.error);
        } catch (err) {
          console.error("[Entregador] Erro ao notificar:", err);
        }
      }

      return { success: true };
    }),

  // ── Chama entregador manualmente (sem mudar status) ────────
  chamarEntregador: empresaProcedure
    .input(z.object({ pedidoId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.empresaId!;
      const pedido = await getPedidoById(input.pedidoId);
      if (!pedido) throw new Error("Pedido não encontrado");
      const cliente = pedido.clienteId ? await getClienteById(pedido.clienteId) : null;
      const clienteNome = cliente?.nome || "Cliente";
      const endereco = (pedido as any)?.enderecoEntrega || (pedido as any)?.endereco_entrega || "Endereço não informado";
      const itens = Array.isArray((pedido as any)?.itens)
        ? (pedido as any).itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(", ")
        : "Ver pedido no sistema";
      const valor = pedido.valorTotal
        ? (pedido.valorTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "—";
      const msg = templateEntregaSaindo({ clienteNome, endereco, pedidoId: input.pedidoId, itens, valor });
      await notificarEntregador(empresaId, msg);
      return { success: true };
    }),
});

// ============================================================
// FINANCEIRO — Estatísticas e Relatórios
// ============================================================
export const financeiroRouter = router({
  stats: empresaProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.empresaId!;
    if (ctx.user.role === "admin" && !empresaId) {
      return {
        faturamentoTotal: 0,
        faturamentoHoje: 0,
        pedidosTotal: 0,
        pedidosPendentes: 0,
        vendasPorMes: [
          { mes: "Jan", valor: 0 },
          { mes: "Fev", valor: 0 },
          { mes: "Mar", valor: 0 },
          { mes: "Abr", valor: 0 },
          { mes: "Mai", valor: 0 },
          { mes: "Jun", valor: 0 },
        ],
      };
    }

    const allPedidos = await getPedidosByEmpresaId(empresaId);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const faturamentoTotal = allPedidos
      .filter(p => p.statusPagamento === "pago")
      .reduce((acc, p) => acc + p.valorTotal, 0);

    const faturamentoHoje = allPedidos
      .filter(p => p.statusPagamento === "pago" && p.dataPagamento && p.dataPagamento >= hoje)
      .reduce((acc, p) => acc + p.valorTotal, 0);

    const pedidosPendentes = allPedidos.filter(p => p.status !== "entregue" && p.status !== "cancelado").length;

    return {
      faturamentoTotal,
      faturamentoHoje,
      pedidosTotal: allPedidos.length,
      pedidosPendentes,
      vendasPorMes: [
        { mes: "Jan", valor: 0 },
        { mes: "Fev", valor: 0 },
        { mes: "Mar", valor: 0 },
        { mes: "Abr", valor: 0 },
        { mes: "Mai", valor: 0 },
        { mes: "Jun", valor: 0 },
      ], // TODO: Implementar lógica real de agrupamento por mês
    };
  }),
});


// ============================================================
// AGENDAMENTOS — filtrados por empresa_id
// ============================================================
export const agendamentosRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    return getAgendamentosByEmpresaId(ctx.empresaId!);
  }),

  get: empresaProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getAgendamentoById(input.id);
    }),

  updateStatus: empresaProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["agendado", "confirmado", "cancelado", "realizado"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(agendamentos)
        .set({ status: input.status })
        .where(eq(agendamentos.id, input.id));
      return { success: true };
    }),
});

// ============================================================
// CARDÁPIO — CRUD por empresa
// ============================================================
type PlatformCatalogItem = {
  id: number;
  empresaId: number;
  categoria: string;
  nome: string;
  descricao: string | null;
  preco: number;
  disponivel: boolean;
  createdAt: Date;
};

const getPlatformCatalogItems = async (): Promise<PlatformCatalogItem[]> => {
  const settings = isFallbackAuthEnabled()
    ? getFallbackPlatformSettings()
    : await getPlatformSettings();
  const items = Array.isArray((settings as any)?.planosCustom) ? (settings as any).planosCustom : [];
  return items.map((item: any, index: number) => ({
    id: Number(item.id || index + 1),
    empresaId: 0,
    categoria: item.categoria || "Planos",
    nome: item.nome || "Plano",
    descricao: item.descricao || null,
    preco: Number(item.preco || 0),
    disponivel: item.disponivel ?? true,
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
  }));
};

const savePlatformCatalogItems = async (items: PlatformCatalogItem[]) => {
  const payload = items.map((item) => ({
    ...item,
    empresaId: 0,
    createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
  }));
  if (isFallbackAuthEnabled()) {
    return updateFallbackPlatformSettings({ planosCustom: payload } as any);
  }
  return updatePlatformSettings({ planosCustom: payload } as any);
};

const isPlatformCatalogContext = (ctx: { user: { role: string; email?: string | null }; empresaId: number | null }) =>
  ctx.user.role === "admin" && !ctx.empresaId && ctx.user.email?.toLowerCase() === masterAdminEmail;

export const cardapioRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (isPlatformCatalogContext(ctx)) return getPlatformCatalogItems();
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    if (isFallbackAuthEnabled()) return listFallbackCardapioByEmpresaId(ctx.empresaId!);
    return getCardapioByEmpresaId(ctx.empresaId!);
  }),

  create: empresaProcedure
    .input(
      z.object({
        categoria: z.string(),
        nome: z.string(),
        descricao: z.string().optional(),
        preco: z.number(), // centavos
        disponivel: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        const items = await getPlatformCatalogItems();
        const nextId = Math.max(0, ...items.map((item) => item.id)) + 1;
        const item: PlatformCatalogItem = {
          id: nextId,
          empresaId: 0,
          categoria: input.categoria || "Planos",
          nome: input.nome,
          descricao: input.descricao || null,
          preco: input.preco,
          disponivel: input.disponivel ?? true,
          createdAt: new Date(),
        };
        await savePlatformCatalogItems([...items, item]);
        return item;
      }

      const empresaId = ctx.empresaId!;
      if (!empresaId) throw new Error("Empresa não selecionada");

      if (isFallbackAuthEnabled()) {
        return createFallbackCardapioItem({
          empresaId,
          categoria: input.categoria,
          nome: input.nome,
          descricao: input.descricao || null,
          preco: input.preco,
          disponivel: input.disponivel ?? true,
        });
      }

      const db = getDb();

      const [item] = await db
        .insert(cardapioItens)
        .values({
          empresaId,
          categoria: input.categoria,
          nome: input.nome,
          descricao: input.descricao,
          preco: input.preco,
          disponivel: input.disponivel ?? true,
        } as InsertCardapioItem)
        .returning();

      return item;
    }),

  update: empresaProcedure
    .input(
      z.object({
        id: z.number(),
        nome: z.string().optional(),
        descricao: z.string().optional(),
        preco: z.number().optional(),
        disponivel: z.boolean().optional(),
        categoria: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        const items = await getPlatformCatalogItems();
        const next = items.map((item) => item.id === input.id ? { ...item, ...input } : item);
        await savePlatformCatalogItems(next);
        return { success: true };
      }

      if (isFallbackAuthEnabled()) {
        updateFallbackCardapioItem(input.id, input);
        return { success: true };
      }

      const db = getDb();
      const { id, ...data } = input;
      await db.update(cardapioItens).set(data).where(eq(cardapioItens.id, id));
      return { success: true };
    }),

  delete: empresaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        const items = await getPlatformCatalogItems();
        await savePlatformCatalogItems(items.filter((item) => item.id !== input.id));
        return { success: true };
      }

      if (isFallbackAuthEnabled()) {
        deleteFallbackCardapioItem(input.id);
        return { success: true };
      }

      const db = getDb();
      await db.delete(cardapioItens).where(eq(cardapioItens.id, input.id));
      return { success: true };
    }),
});

// ============================================================
// APRESENTAÇÃO COMERCIAL
// ============================================================
const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "empresa";

const defaultApresentacaoDescricao = (tipo?: string | null) => {
  const ramo = tipo || "outro";
  if (["consultorio", "clinica", "salao", "barbearia"].includes(ramo)) {
    return "Conheça nossos serviços, tire dúvidas e agende seu atendimento pelo WhatsApp.";
  }
  if (["loja", "adega"].includes(ramo)) {
    return "Veja nossos produtos, condições e fale com a equipe pelo WhatsApp.";
  }
  if (["pizzaria", "restaurante"].includes(ramo)) {
    return "Confira nossas opções e faça seu pedido pelo WhatsApp.";
  }
  return "Conheça nossa empresa e fale conosco pelo WhatsApp.";
};

type ApresentacaoTipo = "cardapio" | "landing" | "folder";

type GeneratedPresentation = {
  tipo: ApresentacaoTipo;
  headline: string;
  subtitulo: string;
  descricao: string;
  cta: string;
  secoes: Array<{ titulo: string; texto: string; itens?: string[] }>;
  destaques: string[];
  recomendacoesFotos: string[];
  corPrimaria: string;
};

const inferApresentacaoTipo = (ramo?: string | null, requested?: ApresentacaoTipo): ApresentacaoTipo => {
  const type = ramo || "outro";
  if (["consultorio", "clinica", "salao", "barbearia"].includes(type)) return "landing";
  if (["loja", "mercearia"].includes(type)) return requested === "landing" ? "landing" : "folder";
  if (["adega"].includes(type)) return requested === "landing" ? "landing" : "folder";
  if (["pizzaria", "restaurante"].includes(type)) return requested === "folder" ? "folder" : "cardapio";
  return requested || "landing";
};

const ramoDisplay = (ramo?: string | null) => {
  const map: Record<string, string> = {
    pizzaria: "pizzaria",
    restaurante: "restaurante",
    adega: "adega",
    consultorio: "consultório",
    clinica: "clínica",
    salao: "salão",
    barbearia: "barbearia",
    loja: "loja",
    mercearia: "mercearia",
  };
  return map[ramo || ""] || "empresa";
};

const sanitizeGeneratedPresentation = (
  raw: Partial<GeneratedPresentation> | null | undefined,
  fallback: GeneratedPresentation
): GeneratedPresentation => ({
  tipo: raw?.tipo || fallback.tipo,
  headline: String(raw?.headline || fallback.headline).slice(0, 120),
  subtitulo: String(raw?.subtitulo || fallback.subtitulo).slice(0, 220),
  descricao: String(raw?.descricao || fallback.descricao).slice(0, 1200),
  cta: String(raw?.cta || fallback.cta).slice(0, 80),
  secoes: Array.isArray(raw?.secoes) && raw!.secoes.length > 0
    ? raw!.secoes.slice(0, 5).map((secao) => ({
        titulo: String(secao?.titulo || "Destaque").slice(0, 80),
        texto: String(secao?.texto || "").slice(0, 320),
        itens: Array.isArray(secao?.itens) ? secao!.itens.slice(0, 8).map((item) => String(item).slice(0, 120)) : [],
      }))
    : fallback.secoes,
  destaques: Array.isArray(raw?.destaques) && raw!.destaques.length > 0
    ? raw!.destaques.slice(0, 6).map((item) => String(item).slice(0, 120))
    : fallback.destaques,
  recomendacoesFotos: Array.isArray(raw?.recomendacoesFotos) && raw!.recomendacoesFotos.length > 0
    ? raw!.recomendacoesFotos.slice(0, 6).map((item) => String(item).slice(0, 140))
    : fallback.recomendacoesFotos,
  corPrimaria: /^#[0-9a-f]{6}$/i.test(String(raw?.corPrimaria || "")) ? String(raw?.corPrimaria) : fallback.corPrimaria,
});

const buildFallbackPresentation = (params: {
  tipo: ApresentacaoTipo;
  empresaNome: string;
  ramo?: string | null;
  itens: Array<{ nome: string; categoria?: string | null; descricao?: string | null; preco?: number | null }>;
  instrucoes?: string;
}): GeneratedPresentation => {
  const ramo = ramoDisplay(params.ramo);
  const itensDisponiveis = params.itens.slice(0, 12);
  const nomesItens = itensDisponiveis.map((item) => item.nome).filter(Boolean);
  const categorias = Array.from(new Set(itensDisponiveis.map((item) => item.categoria || "Destaques"))).slice(0, 5);
  const isServico = ["consultorio", "clinica", "salao", "barbearia"].includes(params.ramo || "");
  const isFood = ["pizzaria", "restaurante", "adega"].includes(params.ramo || "");
  const cta = isServico ? "Agendar pelo WhatsApp" : isFood ? "Pedir pelo WhatsApp" : "Comprar pelo WhatsApp";
  const descricao = isServico
    ? `${params.empresaNome} apresenta seus serviços de forma clara para transformar visitantes em agendamentos pelo WhatsApp.`
    : `${params.empresaNome} reúne seus principais produtos e ofertas em uma apresentação pronta para compartilhar e vender pelo WhatsApp.`;

  return {
    tipo: params.tipo,
    headline: isServico
      ? `${params.empresaNome}: atendimento profissional para você`
      : `${params.empresaNome}: ${params.tipo === "folder" ? "folder digital" : "cardápio"} pronto para vender`,
    subtitulo: isServico
      ? `Uma landing page objetiva para explicar os serviços da ${ramo}, criar confiança e levar o cliente para o agendamento.`
      : `Uma vitrine automática com os itens cadastrados, organizada por categoria e com chamada direta para o WhatsApp.`,
    descricao,
    cta,
    secoes: [
      {
        titulo: isServico ? "Serviços em destaque" : "Produtos em destaque",
        texto: nomesItens.length
          ? `Usar como destaque inicial: ${nomesItens.slice(0, 6).join(", ")}.`
          : isServico
            ? "Cadastre os serviços na aba Itens para a IA preencher esta seção automaticamente."
            : "Cadastre produtos na aba Itens para a IA preencher esta seção automaticamente.",
        itens: nomesItens.slice(0, 6),
      },
      {
        titulo: "Categorias",
        texto: categorias.length ? `Organização sugerida: ${categorias.join(", ")}.` : "A apresentação será enriquecida conforme novas categorias forem cadastradas.",
        itens: categorias,
      },
      {
        titulo: "Próximo passo",
        texto: `A chamada principal deve levar o visitante para o WhatsApp com a ação "${cta}".`,
      },
    ],
    destaques: nomesItens.length
      ? nomesItens.slice(0, 6)
      : [isServico ? "Atendimento personalizado" : "Produtos selecionados", "Contato rápido pelo WhatsApp", "Apresentação pronta para compartilhar"],
    recomendacoesFotos: isServico
      ? ["Foto da fachada ou recepção", "Foto da equipe ou profissional responsável", "Foto de uma sala de atendimento", "Imagem com resultado/benefício do serviço"]
      : ["Foto da fachada", "Foto dos produtos campeões de venda", "Foto de prateleiras, balcão ou preparo", "Imagem de oferta para redes sociais"],
    corPrimaria: isServico ? "#0ea5e9" : isFood ? "#f97316" : "#10b981",
  };
};

const generatedDescriptionToText = (content: GeneratedPresentation) => {
  const sections = content.secoes
    .map((secao) => {
      const itens = secao.itens?.length ? `\n${secao.itens.map((item) => `- ${item}`).join("\n")}` : "";
      return `${secao.titulo}\n${secao.texto}${itens}`;
    })
    .join("\n\n");
  return `${content.headline}\n\n${content.subtitulo}\n\n${content.descricao}\n\n${sections}\n\nChamada: ${content.cta}`;
};

async function generatePresentationWithAi(params: {
  fallback: GeneratedPresentation;
  empresaNome: string;
  ramo?: string | null;
  tipo: ApresentacaoTipo;
  itens: Array<{ nome: string; categoria?: string | null; descricao?: string | null; preco?: number | null }>;
  instrucoes?: string;
}) {
  const itensResumo = params.itens.slice(0, 25).map((item) => ({
    nome: item.nome,
    categoria: item.categoria || "Geral",
    descricao: item.descricao || "",
    precoCentavos: item.preco || 0,
  }));
  const result = await invokeLLM({
    temperature: 0.45,
    maxTokens: 1400,
    messages: [
      {
        role: "system",
        content:
          "Você é um estrategista comercial para pequenos negócios brasileiros. Gere conteúdo pronto para uma página dentro de um CRM SaaS. Responda somente JSON válido, sem markdown.",
      },
      {
        role: "user",
        content: JSON.stringify({
          tarefa: "Gerar apresentação comercial automática",
          formatoObrigatorio: {
            tipo: "cardapio|landing|folder",
            headline: "string curta",
            subtitulo: "string",
            descricao: "string",
            cta: "string",
            secoes: [{ titulo: "string", texto: "string", itens: ["string"] }],
            destaques: ["string"],
            recomendacoesFotos: ["string"],
            corPrimaria: "#RRGGBB",
          },
          regras: [
            "Se for clínica, consultório, salão ou barbearia, não chame de cardápio; gere landing page de serviços e agendamento.",
            "Se for pizzaria, restaurante ou adega, use itens como cardápio/ofertas.",
            "Se for loja ou mercearia, use itens como folder/catálogo.",
            "Não invente endereço, telefone, preço ou promessa médica.",
            "Sugira fotos que o cliente pode enviar para melhorar a peça.",
          ],
          empresa: params.empresaNome,
          ramo: params.ramo || "outro",
          tipoSolicitado: params.tipo,
          itens: itensResumo,
          instrucoes: params.instrucoes || "",
        }),
      },
    ],
  });

  const text = result.choices?.[0]?.message?.content || "{}";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return sanitizeGeneratedPresentation(JSON.parse(cleaned), params.fallback);
}

const buildUniqueSlug = async (base: string) => {
  let slug = normalizeSlug(base);
  let counter = 1;
  let exists = isFallbackAuthEnabled()
    ? getFallbackApresentacaoConfigBySlug(slug)
    : await getApresentacaoConfigBySlug(slug);
  while (exists) {
    slug = `${normalizeSlug(base)}-${counter}`.slice(0, 60);
    exists = isFallbackAuthEnabled()
      ? getFallbackApresentacaoConfigBySlug(slug)
      : await getApresentacaoConfigBySlug(slug);
    counter += 1;
  }
  return slug;
};

const getPlatformPresentationConfig = async () => {
  const settings = isFallbackAuthEnabled()
    ? getFallbackPlatformSettings()
    : await getPlatformSettings();
  const configIa = (((settings as any)?.configIa as any) ?? {}) as Record<string, any>;
  const apresentacao = configIa.apresentacao ?? {};
  return {
    id: 0,
    empresaId: 0,
    slug: PLATFORM_SETTINGS_ID,
    nomeEmpresa: apresentacao.nomeEmpresa || (settings as any)?.nome || "DALMAZO & CO.",
    descricao: apresentacao.descricao || "Conheça os planos da Dalmazo & Co. e fale conosco pelo WhatsApp.",
    logoUrl: apresentacao.logoUrl || "",
    corPrimaria: apresentacao.corPrimaria || "#10b981",
    whatsapp: apresentacao.whatsapp || (settings as any)?.whatsappNumero || "",
    endereco: apresentacao.endereco || (settings as any)?.endereco || "",
    instagram: apresentacao.instagram || "",
    ativo: apresentacao.ativo ?? true,
    createdAt: (settings as any)?.createdAt || new Date(),
    updatedAt: (settings as any)?.updatedAt || new Date(),
  };
};

const savePlatformPresentationConfig = async (input: any) => {
  const settings = isFallbackAuthEnabled()
    ? getFallbackPlatformSettings()
    : await getPlatformSettings();
  const currentConfigIa = (((settings as any)?.configIa as any) ?? {}) as Record<string, any>;
  const nextConfigIa = {
    ...currentConfigIa,
    apresentacao: {
      ...currentConfigIa.apresentacao,
      ...input,
      slug: PLATFORM_SETTINGS_ID,
      updatedAt: new Date().toISOString(),
    },
  };
  if (isFallbackAuthEnabled()) {
    updateFallbackPlatformSettings({ configIa: nextConfigIa } as any);
    return getPlatformPresentationConfig();
  }
  await updatePlatformSettings({ configIa: nextConfigIa } as any);
  return getPlatformPresentationConfig();
};

export const apresentacaoRouter = router({
  getConfig: empresaProcedure.query(async ({ ctx }) => {
    if (isPlatformCatalogContext(ctx)) return getPlatformPresentationConfig();
    if (ctx.user.role === "admin" && !ctx.empresaId) return null;
    if (isFallbackAuthEnabled()) return getFallbackApresentacaoConfigByEmpresaId(ctx.empresaId!);
    return getApresentacaoConfigByEmpresaId(ctx.empresaId!);
  }),

  updateConfig: empresaProcedure
    .input(
      z.object({
        nomeEmpresa: z.string().min(1),
        descricao: z.string().optional(),
        logoUrl: z.string().optional(),
        corPrimaria: z.string().min(3).optional(),
        whatsapp: z.string().optional(),
        endereco: z.string().optional(),
        instagram: z.string().optional(),
        ativo: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        return savePlatformPresentationConfig({
          nomeEmpresa: input.nomeEmpresa,
          descricao: input.descricao || "",
          logoUrl: input.logoUrl || "",
          corPrimaria: input.corPrimaria || "#10b981",
          whatsapp: input.whatsapp || "",
          endereco: input.endereco || "",
          instagram: input.instagram || "",
          ativo: input.ativo ?? true,
        });
      }

      const empresaId = ctx.empresaId!;
      const existing = isFallbackAuthEnabled()
        ? getFallbackApresentacaoConfigByEmpresaId(empresaId)
        : await getApresentacaoConfigByEmpresaId(empresaId);
      const values: InsertApresentacaoConfig = {
        empresaId,
        slug: existing?.slug || normalizeSlug(input.nomeEmpresa),
        nomeEmpresa: input.nomeEmpresa,
        descricao: input.descricao || "",
        logoUrl: input.logoUrl || "",
        corPrimaria: input.corPrimaria || "#10b981",
        whatsapp: input.whatsapp || "",
        endereco: input.endereco || "",
        instagram: input.instagram || "",
        ativo: input.ativo ?? true,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      if (!existing) {
        values.slug = await buildUniqueSlug(input.nomeEmpresa);
      }

      if (isFallbackAuthEnabled()) return upsertFallbackApresentacaoConfig(values as any);
      return upsertApresentacaoConfig(values as InsertApresentacaoConfig);
    }),

  gerarLinkPublico: empresaProcedure.mutation(async ({ ctx }) => {
    if (isPlatformCatalogContext(ctx)) {
      const existing = await getPlatformPresentationConfig();
      return { ...existing, slug: PLATFORM_SETTINGS_ID };
    }

    const empresaId = ctx.empresaId!;
    const existing = isFallbackAuthEnabled()
      ? getFallbackApresentacaoConfigByEmpresaId(empresaId)
      : await getApresentacaoConfigByEmpresaId(empresaId);
    if (existing?.slug) {
      return { slug: existing.slug };
    }

    const empresa = isFallbackAuthEnabled()
      ? getFallbackEmpresaById(empresaId)
      : await getEmpresaById(empresaId);
    const base = empresa?.nome || "empresa";
    const slug = await buildUniqueSlug(base);

    const config: InsertApresentacaoConfig = {
      empresaId,
      slug,
      nomeEmpresa: existing?.nomeEmpresa || empresa?.nome || "Minha Empresa",
      descricao: existing?.descricao || defaultApresentacaoDescricao((empresa as any)?.ramo || empresa?.tipo),
      logoUrl: existing?.logoUrl || "",
      corPrimaria: existing?.corPrimaria || "#10b981",
      whatsapp: existing?.whatsapp || empresa?.whatsappNumero || "",
      endereco: existing?.endereco || "",
      instagram: existing?.instagram || "",
      ativo: existing?.ativo ?? true,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (isFallbackAuthEnabled()) return upsertFallbackApresentacaoConfig(config as any);
    return upsertApresentacaoConfig(config as InsertApresentacaoConfig);
  }),

  gerarAutomatico: empresaProcedure
    .input(
      z.object({
        tipo: z.enum(["cardapio", "landing", "folder"]).optional(),
        instrucoes: z.string().max(800).optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        const settings = isFallbackAuthEnabled()
          ? getFallbackPlatformSettings()
          : await getPlatformSettings();
        const existing = await getPlatformPresentationConfig();
        const itens = (await getPlatformCatalogItems()).filter((item) => item.disponivel);
        const ramo = "loja";
        const tipo = inferApresentacaoTipo(ramo, input?.tipo);
        const empresaNome = existing?.nomeEmpresa || (settings as any)?.nome || "DALMAZO & CO.";
        const fallback = buildFallbackPresentation({
          tipo,
          empresaNome,
          ramo,
          itens,
          instrucoes: input?.instrucoes,
        });

        let conteudo = fallback;
        let fonte: "ia" | "fallback" = "fallback";
        try {
          conteudo = await generatePresentationWithAi({
            fallback,
            empresaNome,
            ramo,
            tipo,
            itens,
            instrucoes: input?.instrucoes,
          });
          fonte = "ia";
        } catch (error) {
          console.warn("[apresentacao-platform] IA indisponível, usando geração local:", error);
        }

        const saved = await savePlatformPresentationConfig({
          nomeEmpresa: empresaNome,
          descricao: generatedDescriptionToText(conteudo),
          logoUrl: existing.logoUrl || "",
          corPrimaria: existing.corPrimaria || conteudo.corPrimaria || "#10b981",
          whatsapp: existing.whatsapp || (settings as any)?.whatsappNumero || "",
          endereco: existing.endereco || (settings as any)?.endereco || "",
          instagram: existing.instagram || "",
          ativo: existing.ativo ?? true,
        });

        return { config: saved, conteudo, fonte, itensUsados: itens.length };
      }

      const empresaId = ctx.empresaId!;
      if (!empresaId) throw new Error("Selecione uma empresa para gerar a apresentação");

      const empresa = isFallbackAuthEnabled()
        ? getFallbackEmpresaById(empresaId)
        : await getEmpresaById(empresaId);
      if (!empresa) throw new Error("Empresa não encontrada");

      const existing = isFallbackAuthEnabled()
        ? getFallbackApresentacaoConfigByEmpresaId(empresaId)
        : await getApresentacaoConfigByEmpresaId(empresaId);
      const itens = (isFallbackAuthEnabled()
        ? listFallbackCardapioByEmpresaId(empresaId)
        : await getCardapioByEmpresaId(empresaId)
      ).filter((item) => item.disponivel);
      const ramo = (empresa as any).ramo || empresa.tipo || "outro";
      const tipo = inferApresentacaoTipo(ramo, input?.tipo);
      const empresaNome = existing?.nomeEmpresa || empresa.nome || "Minha Empresa";
      const fallback = buildFallbackPresentation({
        tipo,
        empresaNome,
        ramo,
        itens,
        instrucoes: input?.instrucoes,
      });

      let conteudo = fallback;
      let fonte: "ia" | "fallback" = "fallback";
      try {
        conteudo = await generatePresentationWithAi({
          fallback,
          empresaNome,
          ramo,
          tipo,
          itens,
          instrucoes: input?.instrucoes,
        });
        fonte = "ia";
      } catch (error) {
        console.warn("[apresentacao] IA indisponível, usando geração local:", error);
      }

      const config: InsertApresentacaoConfig = {
        empresaId,
        slug: existing?.slug || await buildUniqueSlug(empresaNome),
        nomeEmpresa: empresaNome,
        descricao: generatedDescriptionToText(conteudo),
        logoUrl: existing?.logoUrl || "",
        corPrimaria: existing?.corPrimaria || conteudo.corPrimaria || "#10b981",
        whatsapp: existing?.whatsapp || empresa.whatsappNumero || "",
        endereco: existing?.endereco || "",
        instagram: existing?.instagram || "",
        ativo: existing?.ativo ?? true,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };

      const saved = isFallbackAuthEnabled()
        ? upsertFallbackApresentacaoConfig(config as any)
        : await upsertApresentacaoConfig(config as InsertApresentacaoConfig);

      return {
        config: saved,
        conteudo,
        fonte,
        itensUsados: itens.length,
      };
    }),

  getPublicData: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      if (input.slug === PLATFORM_SETTINGS_ID) {
        return isFallbackAuthEnabled()
          ? getFallbackPublicPlatformApresentacaoDataBySlug(input.slug)
          : await getPublicPlatformApresentacaoDataBySlug(input.slug);
      }
      if (isFallbackAuthEnabled()) return getFallbackPublicApresentacaoDataBySlug(input.slug);
      return getPublicApresentacaoDataBySlug(input.slug);
    }),
});

// ============================================================
// HORÁRIOS DE ATENDIMENTO
// ============================================================
export const horariosRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    return getHorariosByEmpresaId(ctx.empresaId!);
  }),

  upsert: empresaProcedure
    .input(
      z.object({
        diaSemana: z.number().min(0).max(6),
        horaInicio: z.string(),
        horaFim: z.string(),
        ativo: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const empresaId = ctx.empresaId!;

      // Verificar se já existe
      const existing = await db
        .select()
        .from(horariosAtendimento)
        .where(
          eq(horariosAtendimento.empresaId, empresaId)
        )
        .then(rows => rows.find(r => r.diaSemana === input.diaSemana));

      if (existing) {
        await db
          .update(horariosAtendimento)
          .set({ horaInicio: input.horaInicio, horaFim: input.horaFim, ativo: input.ativo })
          .where(eq(horariosAtendimento.id, existing.id));
      } else {
        await db.insert(horariosAtendimento).values({
          empresaId,
          diaSemana: input.diaSemana,
          horaInicio: input.horaInicio,
          horaFim: input.horaFim,
          ativo: input.ativo,
        } as InsertHorarioAtendimento);
      }

      return { success: true };
    }),
});

// ============================================================
// MENSAGENS LOG
// ============================================================
export const mensagensRouter = router({
  listByCliente: empresaProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      return getMensagensByClienteId(input.clienteId);
    }),

  listByEmpresa: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    return getMensagensByEmpresaId(ctx.empresaId!);
  }),
});

// ============================================================
// NOTIFICAÇÕES
// ============================================================
export const notificacoesRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
    return getNotificacoesByEmpresaId(ctx.empresaId!);
  }),

  markAsRead: empresaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(notificacoes).set({ lida: true }).where(eq(notificacoes.id, input.id));
      return { success: true };
    }),
});

// ============================================================
// CONFIGURAÇÕES DA EMPRESA
// ============================================================
export const configuracoesRouter = router({
  get: empresaProcedure.query(async ({ ctx }) => {
    if (!ctx.empresaId) {
      requireMasterAdmin(ctx.user.email);
      if (isFallbackAuthEnabled()) return getFallbackPlatformSettings();
      return getPlatformSettings();
    }
    if (isFallbackAuthEnabled()) return getFallbackEmpresaById(ctx.empresaId);
    return getEmpresaById(ctx.empresaId);
  }),

  contrato: protectedProcedure.query(async ({ ctx }) => {
    const settings = isFallbackAuthEnabled()
      ? getFallbackPlatformSettings()
      : await getPlatformSettings();
    const empresa = ctx.empresaId
      ? (isFallbackAuthEnabled() ? getFallbackEmpresaById(ctx.empresaId) : await getEmpresaById(ctx.empresaId))
      : null;
    const contratoTemplate = (settings as any)?.contratoTemplate || "";
    const contratoDados = buildContractData(empresa, settings);
    return {
      empresa: settings,
      cliente: empresa,
      responsavelLegal: ((empresa?.configBot as any)?.responsavelLegal ?? null),
      contratoTemplate,
      contratoDados,
      contratoPreenchido: contratoTemplate ? renderContract(contratoTemplate, contratoDados) : "",
    };
  }),

  update: empresaProcedure
    .input(
      z.object({
        nome: z.string().optional(),
        whatsappNumero: z.string().optional(),
        configBot: z.record(z.string(), z.any()).optional(),
        configIa: z
          .object({
            systemPrompt: z.string().optional(),
            nomeBot: z.string().optional(),
            regras: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.empresaId) {
        requireMasterAdmin(ctx.user.email);
        if (isFallbackAuthEnabled()) {
          updateFallbackPlatformSettings(input as any);
          return { success: true, plataforma: getFallbackPlatformSettings() };
        }
        const plataforma = await updatePlatformSettings(input as any);
        return { success: true, plataforma };
      }
      if (isFallbackAuthEnabled()) {
        const updated = updateFallbackEmpresaConfig(ctx.empresaId, input);
        return { success: !!updated, empresa: updated };
      }
      const db = getDb();
      const existing = await getEmpresaById(ctx.empresaId);
      const mergedInput = {
        ...input,
        configBot: input.configBot
          ? { ...(((existing?.configBot as any) ?? {}) as Record<string, any>), ...input.configBot }
          : undefined,
      };
      await db
        .update(empresas)
        .set({ ...mergedInput, updatedAt: new Date() })
        .where(eq(empresas.id, ctx.empresaId));
      return { success: true };
    }),
});

// ============================================================
// WHATSAPP SESSION (via tRPC para status)
// ============================================================
export const whatsappRouter = router({
  status: empresaProcedure.query(async ({ ctx }) => {
    if (!ctx.empresaId) return { status: "desconectado" };
    const sessao = await getSessaoByEmpresaId(ctx.empresaId);
    return sessao || { status: "desconectado" };
  }),
});

// ============================================================
// IMPORTAÇÃO — Produtos/Serviços
// ============================================================
export const importRouter = router({
  ocr: empresaProcedure
    .input(z.object({ imageBase64: z.string(), mimeType: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { extractProductsFromImage } = await import("./services/ocr.service");
      const products = await extractProductsFromImage(input.imageBase64, input.mimeType);
      return products;
    }),

  bulkInsert: empresaProcedure
    .input(z.array(z.object({
      nome: z.string(),
      descricao: z.string().nullable().optional(),
      preco: z.number(),
      categoria: z.string(),
    })))
    .mutation(async ({ ctx, input }) => {
      if (isPlatformCatalogContext(ctx)) {
        const items = await getPlatformCatalogItems();
        const startId = Math.max(0, ...items.map((item) => item.id));
        const nextItems = input.map((item, index) => ({
          id: startId + index + 1,
          empresaId: 0,
          categoria: item.categoria || "Planos",
          nome: item.nome,
          descricao: item.descricao || null,
          preco: item.preco,
          disponivel: true,
          createdAt: new Date(),
        }));
        await savePlatformCatalogItems([...items, ...nextItems]);
        return { success: true, count: nextItems.length };
      }

      const empresaId = ctx.empresaId!;
      if (!empresaId) throw new Error("Empresa não selecionada");

      const items = input.map(item => ({
        ...item,
        descricao: item.descricao || undefined,
        empresaId,
      }));

      if (isFallbackAuthEnabled()) {
        items.forEach((item) => createFallbackCardapioItem(item));
        return { success: true, count: items.length };
      }

      const db = getDb();
      await db.insert(cardapioItens).values(items as InsertCardapioItem[]);
      return { success: true, count: items.length };
    }),
});
