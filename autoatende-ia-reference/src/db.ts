import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import * as schema from "./drizzle/schema.ts";

const DATABASE_URL = process.env.DATABASE_URL;

type Database = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  if (!DATABASE_URL) {
    // Para evitar quebrar o servidor no início caso o usuário ainda não tenha configurado
    console.warn("DATABASE_URL não configurada! O DB não funcionará.");
    return null as any;
  }
  dbInstance = drizzle(postgres(DATABASE_URL, { ssl: "require", max: 10 }), { schema });
  return dbInstance;
}

const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) {
      throw new Error("Conexão com o banco de dados não disponível. Verifique o DATABASE_URL nas configurações.");
    }
    const value = instance[prop as keyof Database];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { db };

export async function getSessaoByEmpresaId(empresaId: number) {
  const results = await db.select().from(schema.sessoesWhatsapp).where(eq(schema.sessoesWhatsapp.empresaId, empresaId)).limit(1);
  return results[0] || null;
}

export async function getEmpresaById(empresaId: number) {
  const results = await db.select().from(schema.empresas).where(eq(schema.empresas.id, empresaId)).limit(1);
  return results[0] || null;
}

export async function getClienteByWhatsapp(empresaId: number, whatsappNumber: string) {
  const results = await db.select().from(schema.clientesWhatsapp)
    .where(and(eq(schema.clientesWhatsapp.empresaId, empresaId), eq(schema.clientesWhatsapp.whatsappNumber, whatsappNumber)))
    .limit(1);
  return results[0] || null;
}

export async function getCardapioByEmpresaId(empresaId: number) {
  return await db.select().from(schema.cardapioItens)
    .where(eq(schema.cardapioItens.empresaId, empresaId));
}

export async function getHorariosByEmpresaId(empresaId: number) {
  return await db.select().from(schema.horariosAtendimento)
    .where(eq(schema.horariosAtendimento.empresaId, empresaId));
}
