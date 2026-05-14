import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../trpc.ts";
import { db } from "../../db.ts";
import { usuarios, empresas } from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const authRouter = router({
  me: publicProcedure.query(async ({ ctx }) => {
    // Se o contexto tiver usuário (via middleware no express), retornamos ele
    if (ctx.user) {
      try {
        // Buscar detalhes da empresa se houver
        let empresaData = null;
        if (ctx.user.empresaId) {
          const results = await db.select().from(empresas).where(eq(empresas.id, ctx.user.empresaId));
          empresaData = results[0] || null;
        }

        return {
          ...ctx.user,
          empresa: empresaData
        };
      } catch (err) {
        console.error("Erro ao buscar empresa no auth.me:", err);
        // Fallback para não quebrar o login se o DB estiver offline/vazio
        return {
          ...ctx.user,
          empresa: { nome: "Empresa (DB Offline)", ativo: true }
        };
      }
    }

    // Fallback Mock para desenvolvimento enquanto não temos o session middleware completo
    return {
      id: 1,
      nome: "Admin",
      email: "admin@sistema.com",
      role: "admin",
      empresaId: null,
      empresa: { nome: "Sistema Global", ativo: true }
    };
  }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      // Aqui ficaria a lógica de validação de senha e criação de JWT/Session
      // Por enquanto vamos apenas simular sucesso
      const user = await db.query.usuarios.findFirst({
        where: eq(usuarios.email, input.email)
      });

      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      const isValid = await bcrypt.compare(input.password, user.senhaHash);
      if (!isValid) {
        throw new Error("Senha incorreta");
      }

      return { success: true, user };
    }),
});
