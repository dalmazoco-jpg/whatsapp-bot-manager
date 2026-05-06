import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "../shared/const";
import { LOGGED_OUT_COOKIE } from "./auth";
import {
  adminRouter,
  clientesRouter,
  pedidosRouter,
  agendamentosRouter,
  cardapioRouter,
  apresentacaoRouter,
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
import { getFallbackEmpresaById, isFallbackAuthEnabled } from "./fallback-store";

export const appRouter = router({

  system: systemRouter,

  // Auth via tRPC (básico)
  auth: router({
    me: publicProcedure.query(async (opts) => {
      if (!opts.ctx.user) return null;
      
      let empresa = null;
      if (opts.ctx.user.empresaId) {
        empresa = isFallbackAuthEnabled()
          ? getFallbackEmpresaById(opts.ctx.user.empresaId)
          : await getEmpresaById(opts.ctx.user.empresaId);
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
    logout: publicProcedure.mutation(async ({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        ...getSessionCookieOptions(ctx.req),
        maxAge: -1,
      });
      ctx.res.clearCookie("app_session_token", {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: ENV.isProduction,
      });
      ctx.res.cookie?.(LOGGED_OUT_COOKIE, "true", {
        httpOnly: true,
        sameSite: "lax",
        secure: ENV.isProduction,
        path: "/",
        maxAge: 5 * 60 * 1000,
      });

      return { success: true };
    }),
  }),

  // Admin
  admin: adminRouter,

  // Empresa features
  clientes: clientesRouter,
  pedidos: pedidosRouter,
  agendamentos: agendamentosRouter,
  cardapio: cardapioRouter,
  apresentacao: apresentacaoRouter,
  horarios: horariosRouter,
  mensagens: mensagensRouter,
  notificacoes: notificacoesRouter,
  configuracoes: configuracoesRouter,
  whatsapp: whatsappRouter,
  financeiro: financeiroRouter,
  import: importRouter,
});

export type AppRouter = typeof appRouter;
