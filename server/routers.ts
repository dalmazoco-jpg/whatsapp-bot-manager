import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  adminRouter,
  clientesRouter,
  pedidosRouter,
  agendamentosRouter,
  cardapioRouter,
  horariosRouter,
  mensagensRouter,
  notificacoesRouter,
  configuracoesRouter,
  whatsappRouter,
  financeiroRouter,
  importRouter,
} from "./features";

import { getEmpresaById } from "./db";
import type { TrpcContext } from "./_core/context";

export const appRouter = router({

  system: systemRouter,

  // Auth via tRPC (básico)
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      
      let empresa = null;
      if (opts.ctx.user.empresaId) {
        empresa = await getEmpresaById(opts.ctx.user.empresaId);
      }

      // Detectar se está em modo delegado (admin acessando outra empresa)
      const isDelegated = (opts.ctx as TrpcContext).isDelegated || false;

      return {
        id: opts.ctx.user.id,
        nome: opts.ctx.user.nome || "Usuário",
        email: opts.ctx.user.email,
        role: opts.ctx.user.role,
        empresaId: opts.ctx.user.empresaId,
        isDelegated,
        empresa: empresa ? {
          id: empresa.id,
          nome: empresa.nome || "Empresa",
          tipo: empresa.tipo || "outro",
          ramo: (empresa as any).ramo || empresa.tipo || "outro",
        } : null,
      };

    }),
  }),

  // Admin
  admin: adminRouter,

  // Empresa features
  clientes: clientesRouter,
  pedidos: pedidosRouter,
  agendamentos: agendamentosRouter,
  cardapio: cardapioRouter,
  horarios: horariosRouter,
  mensagens: mensagensRouter,
  notificacoes: notificacoesRouter,
  configuracoes: configuracoesRouter,
  whatsapp: whatsappRouter,
  financeiro: financeiroRouter,
  import: importRouter,
});

export type AppRouter = typeof appRouter;
