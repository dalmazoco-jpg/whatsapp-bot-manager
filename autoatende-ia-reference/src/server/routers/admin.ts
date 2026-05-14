import { router, adminProcedure } from "../trpc.ts";
import { db } from "../../db.ts";
import { empresas } from "../../drizzle/schema.ts";
import { desc } from "drizzle-orm";

export const adminRouter = router({
  empresas: adminProcedure.query(async () => {
    return await db.select().from(empresas).orderBy(desc(empresas.createdAt));
  }),
});
