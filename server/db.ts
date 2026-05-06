import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import {
  users, usuarios, empresas, sessoesWhatsapp, clientesWhatsapp,
  pedidos, agendamentos, cardapioItens, apresentacaoConfig, horariosAtendimento,
  mensagensLog, notificacoes,
} from "../drizzle/schema";
import type { InsertUser, InsertUsuario, InsertApresentacaoConfig } from "../drizzle/schema";

const DATABASE_URL = process.env.DATABASE_URL;

type Database = ReturnType<typeof drizzle>;

let dbInstance: Database | null = null;

export function getDb() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada!");
  dbInstance ??= drizzle(postgres(DATABASE_URL, { ssl: "require", max: 10 }));
  return dbInstance;
}

const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export async function ensureApresentacaoConfigTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS apresentacao_config (
      id serial PRIMARY KEY,
      empresa_id integer NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
      slug text NOT NULL UNIQUE,
      nome_empresa text NOT NULL DEFAULT 'Minha Empresa',
      descricao text,
      logo_url text,
      cor_primaria text NOT NULL DEFAULT '#10b981',
      whatsapp text,
      endereco text,
      instagram text,
      ativo boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
}

export async function ensureDefaultAdminUser() {
  const email = "admin@sistema.com";
  const senhaHash = await bcrypt.hash("admin123", 10);
  await db
    .insert(usuarios)
    .values({
      email,
      senhaHash,
      nome: "Admin Sistema",
      role: "admin",
      empresaId: null,
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: {
        senhaHash,
        nome: "Admin Sistema",
        role: "admin",
        empresaId: null,
      },
    });
}

// ── users (tRPC compat) ──────────────────────────────────────
export async function upsertUser(user: InsertUser) {
  const existing = await db.select().from(users).where(eq(users.openId, user.openId!)).limit(1);
  if (existing.length > 0) {
    await db.update(users).set({ name: user.name, email: user.email, lastSignedIn: new Date() }).where(eq(users.openId, user.openId!));
  } else {
    await db.insert(users).values({ ...user, lastSignedIn: new Date() });
  }
}
export async function getUserByOpenId(openId: string) {
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}
export async function getOrCreateLocalUser() {
  const LOCAL_OPEN_ID = "local-admin";
  let r = await db.select().from(users).where(eq(users.openId, LOCAL_OPEN_ID)).limit(1);
  if (r.length === 0) {
    await db.insert(users).values({ openId: LOCAL_OPEN_ID, name: "Admin Local", email: "admin@local.com", role: "admin", loginMethod: "local" });
    r = await db.select().from(users).where(eq(users.openId, LOCAL_OPEN_ID)).limit(1);
  }
  return r[0];
}
export const getOrCreateAdminUser = getOrCreateLocalUser;

// ── usuarios ─────────────────────────────────────────────────
export async function getUsuarioByEmail(email: string) {
  const r = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  return r[0];
}
export async function getUsuarioById(id: number) {
  const r = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
  return r[0];
}

// ── empresas ─────────────────────────────────────────────────
export async function getAllEmpresas() {
  return db.select().from(empresas).orderBy(empresas.createdAt);
}
export async function getEmpresaById(id: number) {
  const r = await db.select().from(empresas).where(eq(empresas.id, id)).limit(1);
  return r[0];
}

// ── sessoes whatsapp ─────────────────────────────────────────
export async function getSessaoByEmpresaId(empresaId: number) {
  const r = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.empresaId, empresaId)).limit(1);
  return r[0];
}

// ── clientes ─────────────────────────────────────────────────
export async function getClientesByEmpresaId(empresaId: number) {
  return db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.empresaId, empresaId));
}
export async function getClienteById(id: number) {
  const r = await db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.id, id)).limit(1);
  return r[0];
}
export async function getClienteByWhatsapp(empresaId: number, number: string) {
  const r = await db.select().from(clientesWhatsapp).where(and(eq(clientesWhatsapp.empresaId, empresaId), eq(clientesWhatsapp.whatsappNumber, number))).limit(1);
  return r[0];
}
export const getClientesByUserId = getClientesByEmpresaId;

// ── pedidos ──────────────────────────────────────────────────
export async function getPedidosByEmpresaId(empresaId: number) {
  return db.select().from(pedidos).where(eq(pedidos.empresaId, empresaId));
}
export async function getPedidoById(id: number) {
  const r = await db.select().from(pedidos).where(eq(pedidos.id, id)).limit(1);
  return r[0];
}
export const getPedidosByUserId = getPedidosByEmpresaId;

// ── agendamentos ─────────────────────────────────────────────
export async function getAgendamentosByEmpresaId(empresaId: number) {
  return db.select().from(agendamentos).where(eq(agendamentos.empresaId, empresaId));
}
export async function getAgendamentoById(id: number) {
  const r = await db.select().from(agendamentos).where(eq(agendamentos.id, id)).limit(1);
  return r[0];
}
export const getAgendamentosByUserId = getAgendamentosByEmpresaId;

// ── cardapio ─────────────────────────────────────────────────
export async function getCardapioByEmpresaId(empresaId: number) {
  return db.select().from(cardapioItens).where(eq(cardapioItens.empresaId, empresaId));
}

export async function getCardapioDisponivelByEmpresaId(empresaId: number) {
  return db.select().from(cardapioItens).where(and(eq(cardapioItens.empresaId, empresaId), eq(cardapioItens.disponivel, true))).orderBy(cardapioItens.categoria, cardapioItens.nome);
}

// ── apresentação comercial ───────────────────────────────────────
export async function getApresentacaoConfigByEmpresaId(empresaId: number) {
  const r = await db.select().from(apresentacaoConfig).where(eq(apresentacaoConfig.empresaId, empresaId)).limit(1);
  return r[0];
}

export async function getApresentacaoConfigBySlug(slug: string) {
  const r = await db.select().from(apresentacaoConfig).where(eq(apresentacaoConfig.slug, slug)).limit(1);
  return r[0];
}

export async function upsertApresentacaoConfig(input: InsertApresentacaoConfig) {
  const existing = await db.select().from(apresentacaoConfig).where(eq(apresentacaoConfig.empresaId, input.empresaId)).limit(1);
  if (existing.length > 0) {
    await db.update(apresentacaoConfig).set({
      ...input,
      updatedAt: new Date(),
    }).where(eq(apresentacaoConfig.empresaId, input.empresaId));
    const updated = await getApresentacaoConfigByEmpresaId(input.empresaId);
    return updated;
  }
  const [created] = await db.insert(apresentacaoConfig).values(input).returning();
  return created;
}

export async function getPublicApresentacaoDataBySlug(slug: string) {
  const config = await getApresentacaoConfigBySlug(slug);
  if (!config) return null;

  const empresa = await getEmpresaById(config.empresaId);
  const itens = await getCardapioDisponivelByEmpresaId(config.empresaId);
  const categorias = [...new Set(itens.map((item) => item.categoria || "Geral"))];

  return {
    empresa: empresa ? {
      id: empresa.id,
      nome: empresa.nome,
      tipo: empresa.tipo,
      ramo: empresa.ramo,
      whatsappNumero: empresa.whatsappNumero,
    } : null,
    config,
    itens,
    categorias,
    links: {
      whatsapp: config.whatsapp,
      instagram: config.instagram,
      site: `/public/${slug}`,
    },
  };
}

// ── horarios ─────────────────────────────────────────────────
export async function getHorariosByEmpresaId(empresaId: number) {
  return db.select().from(horariosAtendimento).where(eq(horariosAtendimento.empresaId, empresaId));
}

// ── mensagens ────────────────────────────────────────────────
export async function getMensagensByClienteId(clienteId: number) {
  return db.select().from(mensagensLog).where(eq(mensagensLog.clienteId, clienteId));
}
export async function getMensagensByEmpresaId(empresaId: number) {
  return db.select().from(mensagensLog).where(eq(mensagensLog.empresaId, empresaId));
}

// ── notificacoes ─────────────────────────────────────────────
export async function getNotificacoesByEmpresaId(empresaId: number) {
  return db.select().from(notificacoes).where(eq(notificacoes.empresaId, empresaId));
}
export const getNotificacoesByUserId = getNotificacoesByEmpresaId;
