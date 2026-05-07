import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware: requer usuário autenticado
 */
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Middleware: requer admin global
 */
export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

/**
 * Middleware: requer usuário de empresa (com empresa_id válido)
 * Garante que o empresa_id existe no contexto
 */
export const empresaProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    // Admin pode acessar tudo — empresa_id pode ser null para admin
    if (ctx.user.role === 'admin') {
      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
          empresaId: ctx.empresaId,
        },
      });
    }

    const empresaId = ctx.empresaId ?? ctx.user.empresaId;

    // Usuário de empresa precisa ter empresa_id
    if (!empresaId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Usuário não está vinculado a nenhuma empresa",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: {
          ...ctx.user,
          empresaId,
        },
        empresaId,
      },
    });
  }),
);
