import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc.ts";
import { db } from "../../db.ts";
import { pedidos, agendamentos, cardapioItens, clientesWhatsapp, empresas } from "../../drizzle/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../../drizzle/schema.ts";

export const empresaRouter = router({
  getPublicEmpresa: publicProcedure
    .input(z.string())
    .query(async ({ input: slug }) => {
      const results = await db.select().from(empresas).where(eq(empresas.slug, slug)).limit(1);
      return results[0] || null;
    }),

  getPublicCatalog: publicProcedure
    .input(z.number())
    .query(async ({ input: empresaId }) => {
      return await db.select().from(cardapioItens).where(eq(cardapioItens.empresaId, empresaId));
    }),

  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return null;

    const totalPedidos = await db.select().from(schema.pedidos).where(eq(schema.pedidos.empresaId, empresaId)).limit(100);
    const totalAgendamentos = await db.select().from(schema.agendamentos).where(eq(schema.agendamentos.empresaId, empresaId)).limit(100);

    return {
      pedidosHoje: totalPedidos.length,
      agendamentosPendentes: totalAgendamentos.filter(a => a.status === 'agendado').length,
      faturamentoHoje: totalPedidos.reduce((acc, p) => acc + p.valorTotal, 0),
    };
  }),

  getPedidos: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];

    return await db.select().from(schema.pedidos)
      .where(eq(schema.pedidos.empresaId, empresaId))
      .orderBy(desc(schema.pedidos.createdAt));
  }),

  getClientes: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];

    return await db.select().from(schema.clientesWhatsapp)
      .where(eq(schema.clientesWhatsapp.empresaId, empresaId))
      .orderBy(desc(schema.clientesWhatsapp.createdAt));
  }),

  getCatalogItems: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];

    return await db.select().from(schema.cardapioItens)
      .where(eq(schema.cardapioItens.empresaId, empresaId));
  }),

  getConversas: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];

    // Buscar clientes com última interação recente (legacy)
    const legacy = await db.select().from(schema.clientesWhatsapp)
      .where(eq(schema.clientesWhatsapp.empresaId, empresaId))
      .orderBy(desc(schema.clientesWhatsapp.ultimaInteracao))
      .limit(20);

    // Buscar conversas omnichannel
    const omnipath = await db.select().from(schema.conversas)
      .where(eq(schema.conversas.empresaId, empresaId))
      .orderBy(desc(schema.conversas.ultimaInteracao))
      .limit(50);

    const combined = [
      ...omnipath.map(c => ({
        ...c,
        nome: c.nomeCliente || c.username || c.canalContatoId,
        tags: (c as any).tags || [], // Caso a tabela conversas venha a ter tags
      })),
      ...legacy.map(c => ({
        id: c.id,
        empresaId: c.empresaId,
        canal: "whatsapp",
        canalContatoId: c.whatsappNumber,
        nomeCliente: c.nome,
        nome: c.nome,
        username: "",
        telefone: c.whatsappNumber,
        statusAtendimento: c.statusAtendimento || "ia",
        iaAtiva: true,
        atendenteId: null,
        ultimaMensagem: "",
        ultimaInteracao: c.ultimaInteracao,
        createdAt: c.createdAt,
        updatedAt: c.ultimaInteracao || c.createdAt,
        tags: c.tags || [],
      }))
    ];

    return combined.sort((a, b) => {
      const dateA = a.ultimaInteracao ? new Date(a.ultimaInteracao).getTime() : 0;
      const dateB = b.ultimaInteracao ? new Date(b.ultimaInteracao).getTime() : 0;
      return dateB - dateA;
    });
  }),

  // OMNICHANNEL PROCEDURES
  getCanais: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];
    return await db.select().from(schema.canaisEmpresa).where(eq(schema.canaisEmpresa.empresaId, empresaId));
  }),

  getMensagensOmni: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: conversaId }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) return [];

      return await db.select().from(schema.mensagens)
        .where(and(eq(schema.mensagens.empresaId, empresaId), eq(schema.mensagens.conversaId, conversaId)))
        .orderBy(schema.mensagens.createdAt);
    }),

  enviarMensagemOmni: protectedProcedure
    .input(z.object({
      conversaId: z.number(),
      texto: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const conversa = (await db.select().from(schema.conversas).where(eq(schema.conversas.id, input.conversaId)).limit(1))[0];
      if (!conversa) throw new Error("Conversa não encontrada");

      // Logar mensagem
      await db.insert(schema.mensagens).values({
        empresaId,
        conversaId: input.conversaId,
        canal: conversa.canal,
        direcao: "saida",
        conteudo: input.texto,
        autor: "humano",
        status: "pendente",
      } as any);

      // Atualizar status
      await db.update(schema.conversas).set({ 
        statusAtendimento: "humano",
        iaAtiva: false, 
        ultimaInteracao: new Date() 
      }).where(eq(schema.conversas.id, input.conversaId));

      // Se for WhatsApp, envia via Baileys
      if (conversa.canal === "whatsapp") {
        const { sendMessage } = await import("../services/baileys.service.ts");
        await sendMessage(empresaId, conversa.canalContatoId, input.texto);
      }
      
      // TODO: Implementar envio para Instagram/Messenger

      return { success: true };
    }),

  // AGENDAMENTOS PROCEDURES
  getAgendamentosList: protectedProcedure.query(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) return [];
    
    // Buscar agendamentos locais
    return await db.select().from(schema.agendamentos)
      .where(eq(schema.agendamentos.empresaId, empresaId))
      .orderBy(desc(schema.agendamentos.inicio));
  }),

  sincronizarGoogle: protectedProcedure.mutation(async ({ ctx }) => {
    const empresaId = ctx.user.empresaId;
    if (!empresaId) throw new Error("Não autorizado");

    const { CalendarioService } = await import("../services/calendario.ts");
    const now = new Date();
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(now.getDate() + 30);
    const fifteenDaysBack = new Date();
    fifteenDaysBack.setDate(now.getDate() - 15);

    const googleEvents = await CalendarioService.listEvents(empresaId, fifteenDaysBack, thirtyDaysAhead);

    for (const event of googleEvents) {
      if (!event.id || !event.start?.dateTime || !event.end?.dateTime) continue;

      const data = {
        empresaId,
        titulo: event.summary || "Sem título",
        descricao: event.description,
        inicio: new Date(event.start.dateTime),
        fim: new Date(event.end.dateTime),
        calendarEventId: event.id,
        status: "agendado",
        updatedAt: new Date(),
      };

      const existing = await db.select().from(schema.agendamentos)
        .where(and(eq(schema.agendamentos.empresaId, empresaId), eq(schema.agendamentos.calendarEventId, event.id)))
        .limit(1);

      if (existing[0]) {
        await db.update(schema.agendamentos).set(data).where(eq(schema.agendamentos.id, existing[0].id));
      } else {
        await db.insert(schema.agendamentos).values(data as any);
      }
    }

    return { success: true, count: googleEvents.length };
  }),

  saveAgendamento: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      conversaId: z.number().optional(),
      titulo: z.string(),
      descricao: z.string().optional(),
      inicio: z.string(), // ISO String
      fim: z.string(), // ISO String
      servico: z.string().optional(),
      status: z.string().default("agendado"),
      syncGoogle: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const data: any = {
        ...input,
        empresaId,
        inicio: new Date(input.inicio),
        fim: new Date(input.fim),
        updatedAt: new Date(),
      };
      delete data.syncGoogle;

      let savedId = input.id;
      let calendarEventId = null;

      if (input.syncGoogle) {
        try {
          const { CalendarioService } = await import("../services/calendario.ts");
          const gEvent = await CalendarioService.createEvent(empresaId, {
            summary: input.titulo,
            description: input.descricao,
            start: new Date(input.inicio),
            end: new Date(input.fim),
          });
          calendarEventId = gEvent.id;
          data.calendarEventId = calendarEventId;
        } catch (err) {
          console.error("Erro ao sincronizar com Google:", err);
        }
      }

      if (input.id) {
        await db.update(schema.agendamentos).set(data).where(eq(schema.agendamentos.id, input.id));
      } else {
        const res = await db.insert(schema.agendamentos).values(data as any).returning({ id: schema.agendamentos.id });
        savedId = res[0].id;
      }

      return { success: true, id: savedId };
    }),

  getMensagens: protectedProcedure
    .input(z.number())
    .query(async ({ ctx, input: clienteId }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) return [];

      return await db.select().from(schema.mensagensLog)
        .where(and(eq(schema.mensagensLog.empresaId, empresaId), eq(schema.mensagensLog.clienteId, clienteId)))
        .orderBy(schema.mensagensLog.createdAt);
    }),

  enviarMensagem: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      texto: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      // Buscar número do cliente
      const cliente = await db.select().from(schema.clientesWhatsapp).where(eq(schema.clientesWhatsapp.id, input.clienteId)).limit(1);
      if (!cliente[0]) throw new Error("Cliente não encontrado");

      // Aqui chamamos o serviço Baileys para enviar de fato
      const { sendMessage } = await import("../services/baileys.service.ts");
      await sendMessage(empresaId, cliente[0].whatsappNumber, input.texto);

      // Marcar conversa como humana
      await db.update(schema.clientesWhatsapp).set({ statusAtendimento: "humano" }).where(eq(schema.clientesWhatsapp.id, input.clienteId));

      // Logar
      await db.insert(schema.mensagensLog).values({
        empresaId,
        clienteId: input.clienteId,
        direcao: "saida",
        conteudo: input.texto,
        tipo: "texto",
      } as any);

      return { success: true };
    }),

  devolverConversaIA: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input: clienteId }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      await db.update(schema.clientesWhatsapp).set({ statusAtendimento: "ia" }).where(eq(schema.clientesWhatsapp.id, clienteId));
      return { success: true };
    }),

  dispararCampanha: protectedProcedure
    .input(z.object({
      mensagem: z.string(),
      tag: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const { sendMessage } = await import("../services/baileys.service.ts");
      
      let query = db.select().from(schema.clientesWhatsapp).where(eq(schema.clientesWhatsapp.empresaId, empresaId));
      
      const clientes = await query;
      const filtrados = input.tag 
        ? clientes.filter(c => (c.tags as string[])?.includes(input.tag!)) 
        : clientes;

      for (const cliente of filtrados) {
        try {
          await sendMessage(empresaId, cliente.whatsappNumber, input.mensagem);
          await db.insert(schema.mensagensLog).values({
            empresaId,
            clienteId: cliente.id,
            direcao: "saida",
            conteudo: input.mensagem,
            tipo: "campanha",
          } as any);
        } catch (err) {
          console.error(`Erro ao disparar campanha para ${cliente.whatsappNumber}:`, err);
        }
      }

      return { success: true, total: filtrados.length };
    }),

  testarIA: protectedProcedure
    .input(z.object({
      msg: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const { handleIncomingMessage } = await import("../services/ia.service.ts");
      const resposta = await handleIncomingMessage(empresaId, "teste-user", "Testador", input.msg);
      
      return { resposta: resposta || "A IA não gerou uma resposta para esta mensagem." };
    }),

  enviarMensagemInterna: protectedProcedure
    .input(z.object({
      pergunta: z.string(),
      contexto: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const { invokeLLM } = await import("../_core/llm.ts");
      const empresa = await db.select().from(schema.empresas).where(eq(schema.empresas.id, empresaId)).limit(1);
      
      const systemPrompt = `Você é um assistente de gestão inteligente para o dono da empresa "${empresa[0]?.nome}". 
      Seu objetivo é ajudar em tarefas administrativas, criação de promoções, melhoria de descrições de produtos e análise de dados.
      Seja profissional, direto e criativo.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.pergunta }
        ]
      });

      return { resposta: response.choices[0].message.content };
    }),

  updateSettings: protectedProcedure
    .input(z.object({
      nome: z.string().optional(),
      configIa: z.any().optional(),
      configBot: z.any().optional(),
      ramo: z.string().optional(),
      slug: z.string().optional(),
      materiais: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      const updateData: any = { ...input, updatedAt: new Date() };
      return await db.update(schema.empresas)
        .set(updateData)
        .where(eq(schema.empresas.id, empresaId));
    }),

  saveCatalogItem: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      nome: z.string(),
      categoria: z.string(),
      descricao: z.string().optional(),
      preco: z.number(),
      disponivel: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      if (input.id) {
        return await db.update(schema.cardapioItens)
          .set({ ...input, empresaId })
          .where(and(eq(schema.cardapioItens.id, input.id), eq(schema.cardapioItens.empresaId, empresaId)));
      } else {
        return await db.insert(schema.cardapioItens).values({ ...input, empresaId } as any);
      }
    }),

  deleteCatalogItem: protectedProcedure
    .input(z.number())
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      return await db.delete(schema.cardapioItens)
        .where(and(eq(schema.cardapioItens.id, input), eq(schema.cardapioItens.empresaId, empresaId)));
    }),

  updatePedidoStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = ctx.user.empresaId;
      if (!empresaId) throw new Error("Não autorizado");

      return await db.update(schema.pedidos)
        .set({ status: input.status, updatedAt: new Date() })
        .where(and(eq(schema.pedidos.id, input.id), eq(schema.pedidos.empresaId, empresaId)));
    }),
});
