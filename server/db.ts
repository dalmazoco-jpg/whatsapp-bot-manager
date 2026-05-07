import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import {
  users, usuarios, empresas, sessoesWhatsapp, clientesWhatsapp,
  pedidos, agendamentos, cardapioItens, apresentacaoConfig, horariosAtendimento,
  mensagensLog, notificacoes, planos, platformSettings,
} from "../drizzle/schema";
import type { InsertUser, InsertUsuario, InsertApresentacaoConfig } from "../drizzle/schema";
import { PLANOS_SAAS } from "../shared/billing";
import { DEFAULT_CONTRACT_TEMPLATE, DEFAULT_PLATFORM_COMPANY, PLATFORM_SETTINGS_ID } from "../shared/platform";

const DATABASE_URL = process.env.DATABASE_URL;
const CLOUD_SQL_CONNECTION_NAME = process.env.CLOUD_SQL_CONNECTION_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

type Database = ReturnType<typeof drizzle>;

let dbInstance: Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  if (CLOUD_SQL_CONNECTION_NAME && DB_USER && DB_PASSWORD && DB_NAME) {
    dbInstance = drizzle(postgres({
      host: `/cloudsql/${CLOUD_SQL_CONNECTION_NAME}`,
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      ssl: false,
      max: 10,
    }));
    return dbInstance;
  }

  if (!DATABASE_URL) throw new Error("DATABASE_URL não configurada!");
  dbInstance = drizzle(postgres(DATABASE_URL, { ssl: "require", max: 10 }));
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

export async function ensureBillingTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS planos (
      id text PRIMARY KEY,
      nome text NOT NULL,
      valor_licenca integer NOT NULL,
      valor_mensalidade integer NOT NULL,
      recursos jsonb,
      modules jsonb,
      ativo boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS faturas (
      id serial PRIMARY KEY,
      empresa_id integer REFERENCES empresas(id) ON DELETE CASCADE,
      plano_id text REFERENCES planos(id),
      tipo text NOT NULL DEFAULT 'mensalidade',
      valor integer NOT NULL,
      status text NOT NULL DEFAULT 'pendente',
      data_vencimento timestamp,
      data_pagamento timestamp,
      gateway text NOT NULL DEFAULT 'infinitepay',
      order_nsu text,
      slug text,
      transaction_id text,
      payment_link text,
      receipt_url text,
      nf_status text NOT NULL DEFAULT 'pendente',
      nf_url text,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id serial PRIMARY KEY,
      fatura_id integer REFERENCES faturas(id) ON DELETE CASCADE,
      empresa_id integer REFERENCES empresas(id) ON DELETE CASCADE,
      valor integer NOT NULL,
      status text NOT NULL DEFAULT 'pendente',
      gateway text NOT NULL DEFAULT 'infinitepay',
      order_nsu text,
      transaction_id text,
      slug text,
      capture_method text,
      paid_amount integer,
      receipt_url text,
      payload jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS licencas (
      id serial PRIMARY KEY,
      empresa_id integer NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
      plano_id text REFERENCES planos(id),
      licenca_ativa boolean NOT NULL DEFAULT false,
      licenca_expira timestamp,
      ultimo_pagamento_id integer,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  for (const plano of PLANOS_SAAS) {
    await db
      .insert(planos)
      .values({
        id: plano.id,
        nome: plano.nome,
        valorLicenca: plano.licencaCentavos,
        valorMensalidade: plano.mensalidadeCentavos,
        recursos: [...plano.recursos],
        modules: [...plano.modules],
        ativo: true,
      })
      .onConflictDoUpdate({
        target: planos.id,
        set: {
          nome: plano.nome,
          valorLicenca: plano.licencaCentavos,
          valorMensalidade: plano.mensalidadeCentavos,
          recursos: [...plano.recursos],
          modules: [...plano.modules],
          ativo: true,
        },
      });
  }
}

export async function ensureIntegrationTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id text PRIMARY KEY,
      nome text NOT NULL,
      razao_social text,
      cnpj text,
      natureza_juridica text,
      endereco text,
      telefone text,
      whatsapp_numero text,
      email text,
      cnae text,
      config_ia jsonb,
      contrato_template text,
      planos_custom jsonb,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS google_calendar_tokens (
      id serial PRIMARY KEY,
      empresa_id integer NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
      access_token text,
      refresh_token text,
      token_expiry timestamp,
      calendar_id text NOT NULL DEFAULT 'primary',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contatos_notificacao (
      id serial PRIMARY KEY,
      empresa_id integer NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
      nome text NOT NULL,
      whatsapp text NOT NULL,
      tipo text NOT NULL DEFAULT 'proprietario',
      eventos text[] NOT NULL,
      ativo boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db
    .insert(platformSettings)
    .values({
      id: PLATFORM_SETTINGS_ID,
      ...DEFAULT_PLATFORM_COMPANY,
      configIa: { nomeBot: "Dalmazo IA", systemPrompt: "" },
      contratoTemplate: DEFAULT_CONTRACT_TEMPLATE,
      planosCustom: [],
    })
    .onConflictDoNothing();
}

export async function getPlatformSettings() {
  const rows = await db.select().from(platformSettings).where(eq(platformSettings.id, PLATFORM_SETTINGS_ID)).limit(1);
  if (rows[0]) return rows[0];
  await ensureIntegrationTables();
  const created = await db.select().from(platformSettings).where(eq(platformSettings.id, PLATFORM_SETTINGS_ID)).limit(1);
  return created[0];
}

export async function updatePlatformSettings(input: Partial<typeof platformSettings.$inferInsert>) {
  await db
    .update(platformSettings)
    .set({ ...input, id: PLATFORM_SETTINGS_ID, updatedAt: new Date() })
    .where(eq(platformSettings.id, PLATFORM_SETTINGS_ID));
  return getPlatformSettings();
}

export async function getPublicPlatformApresentacaoDataBySlug(slug: string) {
  if (slug !== PLATFORM_SETTINGS_ID) return null;
  const settings = await getPlatformSettings();
  const configIa = ((settings?.configIa as any) ?? {}) as Record<string, any>;
  const apresentacao = configIa.apresentacao ?? {};
  const itens = Array.isArray(settings?.planosCustom)
    ? (settings.planosCustom as any[]).filter((item) => item.disponivel !== false)
    : [];
  const categorias = Array.from(new Set(itens.map((item) => item.categoria || "Planos")));

  return {
    empresa: {
      id: 0,
      nome: settings?.nome || "DALMAZO & CO.",
      tipo: "loja",
      ramo: "loja",
      whatsappNumero: settings?.whatsappNumero,
    },
    config: {
      id: 0,
      empresaId: 0,
      slug: PLATFORM_SETTINGS_ID,
      nomeEmpresa: apresentacao.nomeEmpresa || settings?.nome || "DALMAZO & CO.",
      descricao: apresentacao.descricao || "Conheça os planos da Dalmazo & Co. e fale conosco pelo WhatsApp.",
      logoUrl: apresentacao.logoUrl || "",
      corPrimaria: apresentacao.corPrimaria || "#10b981",
      whatsapp: apresentacao.whatsapp || settings?.whatsappNumero || "",
      endereco: apresentacao.endereco || settings?.endereco || "",
      instagram: apresentacao.instagram || "",
      ativo: apresentacao.ativo ?? true,
      createdAt: settings?.createdAt,
      updatedAt: settings?.updatedAt,
    },
    itens,
    categorias,
    links: {
      whatsapp: apresentacao.whatsapp || settings?.whatsappNumero,
      instagram: apresentacao.instagram || "",
      site: `/public/${PLATFORM_SETTINGS_ID}`,
    },
  };
}

export async function ensureDefaultAdminUser() {
  const admins = [
    { email: "admin@sistema.com", senha: "admin123", nome: "Admin Sistema" },
    { email: "dalmazo.co@gmail.com", senha: "master2026m", nome: "Denis Dalmazo" },
  ];

  for (const admin of admins) {
    const senhaHash = await bcrypt.hash(admin.senha, 10);
    await db
      .insert(usuarios)
      .values({
        email: admin.email,
        senhaHash,
        nome: admin.nome,
        role: "admin",
        empresaId: null,
      })
      .onConflictDoUpdate({
        target: usuarios.email,
        set: {
          senhaHash,
          nome: admin.nome,
          role: "admin",
          empresaId: null,
        },
      });
  }
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

  const row = r[0];
  if (!row) return undefined;

  return {
    id: row.id,
    empresaId: null,
    email: row.email ?? "",
    senhaHash: "",
    nome: row.name ?? "Admin Local",
    role: row.role as "admin",
    createdAt: row.createdAt,
    lastSignedIn: row.lastSignedIn,
  };
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
  return await db.select().from(empresas).orderBy(empresas.createdAt);
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
  return await db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.empresaId, empresaId));
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
  return await db.select().from(pedidos).where(eq(pedidos.empresaId, empresaId));
}
export async function getPedidoById(id: number) {
  const r = await db.select().from(pedidos).where(eq(pedidos.id, id)).limit(1);
  return r[0];
}
export const getPedidosByUserId = getPedidosByEmpresaId;

// ── agendamentos ─────────────────────────────────────────────
export async function getAgendamentosByEmpresaId(empresaId: number) {
  return await db.select().from(agendamentos).where(eq(agendamentos.empresaId, empresaId));
}
export async function getAgendamentoById(id: number) {
  const r = await db.select().from(agendamentos).where(eq(agendamentos.id, id)).limit(1);
  return r[0];
}
export const getAgendamentosByUserId = getAgendamentosByEmpresaId;

// ── cardapio ─────────────────────────────────────────────────
export async function getCardapioByEmpresaId(empresaId: number) {
  return await db.select().from(cardapioItens).where(eq(cardapioItens.empresaId, empresaId));
}

export async function getCardapioDisponivelByEmpresaId(empresaId: number) {
  return await db.select().from(cardapioItens).where(and(eq(cardapioItens.empresaId, empresaId), eq(cardapioItens.disponivel, true))).orderBy(cardapioItens.categoria, cardapioItens.nome);
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
  const categorias = Array.from(new Set(itens.map((item) => item.categoria || "Geral")));

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
  return await db.select().from(horariosAtendimento).where(eq(horariosAtendimento.empresaId, empresaId));
}

// ── mensagens ────────────────────────────────────────────────
export async function getMensagensByClienteId(clienteId: number) {
  return await db.select().from(mensagensLog).where(eq(mensagensLog.clienteId, clienteId));
}
export async function getMensagensByEmpresaId(empresaId: number) {
  return await db.select().from(mensagensLog).where(eq(mensagensLog.empresaId, empresaId));
}

// ── notificacoes ─────────────────────────────────────────────
export async function getNotificacoesByEmpresaId(empresaId: number) {
  return await db.select().from(notificacoes).where(eq(notificacoes.empresaId, empresaId));
}
export const getNotificacoesByUserId = getNotificacoesByEmpresaId;
