import { z } from "zod";
import { publicProcedure, protectedProcedure, adminProcedure, empresaProcedure, router } from "./_core/trpc";
import { generateDelegatedToken } from "./auth";
import { notificarEntregador, notificarContatos, templateEntregaSaindo } from "./services/notificacoes.service";
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
  getPublicApresentacaoDataBySlug,
  getHorariosByEmpresaId,
  getMensagensByClienteId,
  getMensagensByEmpresaId,
  getNotificacoesByEmpresaId,
  getSessaoByEmpresaId,
  upsertApresentacaoConfig,
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
  getFallbackEmpresaById,
  isFallbackAuthEnabled,
  listFallbackEmpresas,
  updateFallbackEmpresaLicenca,
} from "./fallback-store";

// ============================================================
// ADMIN — Gerenciamento de Empresas (apenas admin)
// ============================================================
export const adminRouter = router({
  // Listar todas as empresas
  empresas: adminProcedure.query(async () => {
    if (isFallbackAuthEnabled()) return listFallbackEmpresas();
    return getAllEmpresas();
  }),

  // Buscar empresa por ID
  empresa: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
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
      })
    )
    .mutation(async ({ input }) => {
      if (isFallbackAuthEnabled()) {
        return createFallbackEmpresa(input);
      }

      const db = getDb();

      // Criar empresa
      const [novaEmpresa] = await db
        .insert(empresas)
        .values({
          nome: input.nome,
          tipo: input.tipo,
          whatsappNumero: input.whatsappNumero,
          ativo: false,
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
    .mutation(async ({ input }) => {
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
        configIa: z
          .object({
            systemPrompt: z.string().optional(),
            nomeBot: z.string().optional(),
            regras: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;

      await db
        .update(empresas)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(empresas.id, id));

      return { success: true };
    }),

  // Acessar dashboard de uma empresa (delegated access)
  acessarEmpresa: adminProcedure
    .input(z.object({ empresaId: z.number() }))
    .mutation(async ({ input, ctx }) => {
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
export const cardapioRouter = router({
  list: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return [];
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
      const db = getDb();
      const empresaId = ctx.empresaId!;

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
    .mutation(async ({ input }) => {
      const db = getDb();
      const { id, ...data } = input;
      await db.update(cardapioItens).set(data).where(eq(cardapioItens.id, id));
      return { success: true };
    }),

  delete: empresaProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
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
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "empresa";

const buildUniqueSlug = async (base: string) => {
  let slug = normalizeSlug(base);
  let counter = 1;
  let exists = await getApresentacaoConfigBySlug(slug);
  while (exists) {
    slug = `${normalizeSlug(base)}-${counter}`.slice(0, 60);
    exists = await getApresentacaoConfigBySlug(slug);
    counter += 1;
  }
  return slug;
};

export const apresentacaoRouter = router({
  getConfig: empresaProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin" && !ctx.empresaId) return null;
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
      const empresaId = ctx.empresaId!;
      const existing = await getApresentacaoConfigByEmpresaId(empresaId);
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

      return upsertApresentacaoConfig(values as InsertApresentacaoConfig);
    }),

  gerarLinkPublico: empresaProcedure.mutation(async ({ ctx }) => {
    const empresaId = ctx.empresaId!;
    const existing = await getApresentacaoConfigByEmpresaId(empresaId);
    if (existing?.slug) {
      return { slug: existing.slug };
    }

    const empresa = await getEmpresaById(empresaId);
    const base = empresa?.nome || "empresa";
    const slug = await buildUniqueSlug(base);

    const config: InsertApresentacaoConfig = {
      empresaId,
      slug,
      nomeEmpresa: existing?.nomeEmpresa || empresa?.nome || "Minha Empresa",
      descricao: existing?.descricao || "",
      logoUrl: existing?.logoUrl || "",
      corPrimaria: existing?.corPrimaria || "#10b981",
      whatsapp: existing?.whatsapp || empresa?.whatsappNumero || "",
      endereco: existing?.endereco || "",
      instagram: existing?.instagram || "",
      ativo: existing?.ativo ?? true,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    return upsertApresentacaoConfig(config as InsertApresentacaoConfig);
  }),

  getPublicData: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
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
    if (!ctx.empresaId) return null;
    return getEmpresaById(ctx.empresaId);
  }),

  update: empresaProcedure
    .input(
      z.object({
        nome: z.string().optional(),
        whatsappNumero: z.string().optional(),
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
      if (!ctx.empresaId) return { success: false };
      const db = getDb();
      await db
        .update(empresas)
        .set({ ...input, updatedAt: new Date() })
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
    .input(z.object({ imageBase64: z.string() }))
    .mutation(async ({ input }) => {
      const { extractProductsFromImage } = await import("./services/ocr.service");
      const products = await extractProductsFromImage(input.imageBase64);
      return products;
    }),

  bulkInsert: empresaProcedure
    .input(z.array(z.object({
      nome: z.string(),
      descricao: z.string().optional(),
      preco: z.number(),
      categoria: z.string(),
    })))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const empresaId = ctx.empresaId!;

      const items = input.map(item => ({
        ...item,
        empresaId,
      }));

      await db.insert(cardapioItens).values(items as InsertCardapioItem[]);
      return { success: true, count: items.length };
    }),
});
