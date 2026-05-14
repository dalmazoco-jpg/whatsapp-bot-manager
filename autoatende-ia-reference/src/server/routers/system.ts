import { z } from "zod";
import { notifyOwner } from "../notification.ts";
import { adminProcedure, publicProcedure, router } from "../trpc.ts";
import { db } from "../../db.ts";
import { empresas, usuarios } from "../../drizzle/schema.ts";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  seed: publicProcedure.mutation(async () => {
    // 1. Verificar se já existe admin
    const adminExists = await db.select().from(usuarios).where(eq(usuarios.role, 'admin')).limit(1);
    
    if (adminExists.length > 0) {
      return { success: false, message: "Sistema já inicializado." };
    }

    // 2. Criar Empresa Sistema
    const [empresaSistema] = await db.insert(empresas).values({
      nome: "Sistema Global",
      tipo: "outro",
      ativo: true,
    }).returning();

    // 3. Criar Usuário Admin
    const passHash = await bcrypt.hash("admin123", 10);
    await db.insert(usuarios).values({
      nome: "Admin Master",
      email: "admin@sistema.com",
      senhaHash: passHash,
      role: "admin",
      empresaId: empresaSistema.id,
    });

    return { success: true, message: "Admin criado com sucesso (senha: admin123)." };
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
