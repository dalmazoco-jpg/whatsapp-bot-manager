import { ENV } from "./_core/env";
import type { ApresentacaoConfig, CardapioItem, Empresa, Usuario } from "../drizzle/schema";
import { DEFAULT_CONTRACT_TEMPLATE, DEFAULT_PLATFORM_COMPANY, PLATFORM_SETTINGS_ID } from "../shared/platform";

type FallbackUser = {
  id: number;
  empresaId: number | null;
  email: string;
  nome: string;
  role: "admin" | "empresa";
  senhas: string[];
};

type FallbackEmpresa = Empresa;
type FallbackCardapioItem = CardapioItem;
type FallbackApresentacaoConfig = ApresentacaoConfig;

let nextEmpresaId = 1;
let nextUserId = 10;
let nextCardapioId = 1;

const fallbackUsers: FallbackUser[] = [
  {
    id: 1,
    empresaId: null,
    email: "admin@sistema.com",
    nome: "Admin Sistema",
    role: "admin",
    senhas: ["admin123"],
  },
  {
    id: 2,
    empresaId: null,
    email: "dalmazo.co@gmail.com",
    nome: "Denis Dalmazo",
    role: "admin",
    senhas: ["master2026", "master2026m", "admin123"],
  },
];

const fallbackEmpresas: FallbackEmpresa[] = [];
const fallbackCardapio: FallbackCardapioItem[] = [];
const fallbackApresentacoes: FallbackApresentacaoConfig[] = [];
const fallbackPlatformSettings = {
  id: PLATFORM_SETTINGS_ID,
  ...DEFAULT_PLATFORM_COMPANY,
  configIa: { nomeBot: "Dalmazo IA", systemPrompt: "" },
  contratoTemplate: DEFAULT_CONTRACT_TEMPLATE,
  planosCustom: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function isFallbackAuthEnabled() {
  return process.env.NODE_ENV === "development" || ENV.localAuthFallback;
}

function toUsuario(user: FallbackUser): Usuario {
  const now = new Date();
  return {
    id: user.id,
    empresaId: user.empresaId,
    email: user.email,
    senhaHash: "",
    nome: user.nome,
    role: user.role,
    createdAt: now,
    lastSignedIn: now,
  };
}

export function findFallbackUserByCredentials(email: string, senha: string) {
  if (!isFallbackAuthEnabled()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = fallbackUsers.find(
    (item) => item.email.toLowerCase() === normalizedEmail && item.senhas.includes(senha)
  );
  return user ? toUsuario(user) : null;
}

export function findFallbackUserByEmail(email: string) {
  if (!isFallbackAuthEnabled()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const user = fallbackUsers.find((item) => item.email.toLowerCase() === normalizedEmail);
  return user ? toUsuario(user) : null;
}

export function findFallbackUserById(id: number, email?: string) {
  if (!isFallbackAuthEnabled()) return null;
  const normalizedEmail = email?.trim().toLowerCase();
  const user = fallbackUsers.find(
    (item) => item.id === id || (normalizedEmail && item.email.toLowerCase() === normalizedEmail)
  );
  return user ? toUsuario(user) : null;
}

export function listFallbackEmpresas() {
  return fallbackEmpresas;
}

export function getFallbackEmpresaById(id: number) {
  return fallbackEmpresas.find((empresa) => empresa.id === id) ?? null;
}

export function createFallbackEmpresa(input: {
  nome: string;
  tipo: string;
  whatsappNumero?: string;
  emailUsuario: string;
  senhaUsuario: string;
  nomeUsuario: string;
  modules?: string[];
}) {
  const now = new Date();
  const empresa: FallbackEmpresa = {
    id: nextEmpresaId++,
    nome: input.nome,
    tipo: input.tipo,
    ramo: input.tipo,
    whatsappNumero: input.whatsappNumero || null,
    ativo: true,
    licencaExpira: null,
    configIa: null,
    configBot: { modules: input.modules ?? ["dashboard", "whatsapp", "configuracoes"] },
    createdAt: now,
    updatedAt: now,
  };

  fallbackEmpresas.push(empresa);

  fallbackUsers.push({
    id: nextUserId++,
    empresaId: empresa.id,
    email: input.emailUsuario,
    nome: input.nomeUsuario,
    role: "empresa",
    senhas: [input.senhaUsuario],
  });

  return empresa;
}

export function updateFallbackEmpresaModules(empresaId: number, modules: string[]) {
  const empresa = getFallbackEmpresaById(empresaId);
  if (!empresa) return false;

  empresa.configBot = { ...((empresa.configBot as object | null) ?? {}), modules };
  empresa.updatedAt = new Date();
  return true;
}

export function updateFallbackEmpresaLicenca(empresaId: number, ativo: boolean, diasLicenca?: number) {
  const empresa = getFallbackEmpresaById(empresaId);
  if (!empresa) return false;

  empresa.ativo = ativo;
  empresa.licencaExpira = ativo && diasLicenca
    ? new Date(Date.now() + diasLicenca * 24 * 60 * 60 * 1000)
    : null;
  empresa.updatedAt = new Date();
  return true;
}

export function updateFallbackEmpresaConfig(empresaId: number, data: Partial<Pick<FallbackEmpresa, "nome" | "whatsappNumero" | "configIa">>) {
  const empresa = getFallbackEmpresaById(empresaId);
  if (!empresa) return null;

  if (data.nome !== undefined) empresa.nome = data.nome;
  if (data.whatsappNumero !== undefined) empresa.whatsappNumero = data.whatsappNumero || null;
  if (data.configIa !== undefined) empresa.configIa = data.configIa;
  empresa.updatedAt = new Date();
  return empresa;
}

export function getFallbackPlatformSettings() {
  return fallbackPlatformSettings;
}

export function updateFallbackPlatformSettings(data: Partial<typeof fallbackPlatformSettings>) {
  Object.assign(fallbackPlatformSettings, data, { id: PLATFORM_SETTINGS_ID, updatedAt: new Date() });
  return fallbackPlatformSettings;
}

export function getFallbackPublicPlatformApresentacaoDataBySlug(slug: string) {
  if (slug !== PLATFORM_SETTINGS_ID) return null;
  const settings = getFallbackPlatformSettings();
  const configIa = ((settings.configIa as any) ?? {}) as Record<string, any>;
  const apresentacao = configIa.apresentacao ?? {};
  const itens = Array.isArray(settings.planosCustom)
    ? (settings.planosCustom as any[]).filter((item) => item.disponivel !== false)
    : [];
  const categorias = Array.from(new Set(itens.map((item) => item.categoria || "Planos")));

  return {
    empresa: {
      id: 0,
      nome: settings.nome,
      tipo: "loja",
      ramo: "loja",
      whatsappNumero: settings.whatsappNumero,
    },
    config: {
      id: 0,
      empresaId: 0,
      slug: PLATFORM_SETTINGS_ID,
      nomeEmpresa: apresentacao.nomeEmpresa || settings.nome,
      descricao: apresentacao.descricao || "Conheça os planos da Dalmazo & Co. e fale conosco pelo WhatsApp.",
      logoUrl: apresentacao.logoUrl || "",
      corPrimaria: apresentacao.corPrimaria || "#10b981",
      whatsapp: apresentacao.whatsapp || settings.whatsappNumero || "",
      endereco: apresentacao.endereco || settings.endereco || "",
      instagram: apresentacao.instagram || "",
      ativo: apresentacao.ativo ?? true,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    },
    itens,
    categorias,
    links: {
      whatsapp: apresentacao.whatsapp || settings.whatsappNumero,
      instagram: apresentacao.instagram || "",
      site: `/public/${PLATFORM_SETTINGS_ID}`,
    },
  };
}

export function listFallbackCardapioByEmpresaId(empresaId: number) {
  return fallbackCardapio.filter((item) => item.empresaId === empresaId);
}

export function createFallbackCardapioItem(input: {
  empresaId: number;
  categoria: string;
  nome: string;
  descricao?: string | null;
  preco: number;
  disponivel?: boolean;
}) {
  const item: FallbackCardapioItem = {
    id: nextCardapioId++,
    empresaId: input.empresaId,
    categoria: input.categoria,
    nome: input.nome,
    descricao: input.descricao || null,
    preco: input.preco,
    disponivel: input.disponivel ?? true,
    createdAt: new Date(),
  };
  fallbackCardapio.push(item);
  return item;
}

export function updateFallbackCardapioItem(id: number, data: Partial<{
  nome: string;
  descricao: string | null;
  preco: number;
  disponivel: boolean;
  categoria: string;
}>) {
  const item = fallbackCardapio.find((entry) => entry.id === id);
  if (!item) return false;
  Object.assign(item, data);
  return true;
}

export function deleteFallbackCardapioItem(id: number) {
  const index = fallbackCardapio.findIndex((entry) => entry.id === id);
  if (index < 0) return false;
  fallbackCardapio.splice(index, 1);
  return true;
}

export function getFallbackApresentacaoConfigByEmpresaId(empresaId: number) {
  return fallbackApresentacoes.find((config) => config.empresaId === empresaId) ?? null;
}

export function getFallbackApresentacaoConfigBySlug(slug: string) {
  return fallbackApresentacoes.find((config) => config.slug === slug) ?? null;
}

export function upsertFallbackApresentacaoConfig(input: Omit<FallbackApresentacaoConfig, "id"> & { id?: number }) {
  const existing = getFallbackApresentacaoConfigByEmpresaId(input.empresaId);
  if (existing) {
    Object.assign(existing, input, { id: existing.id, updatedAt: new Date() });
    return existing;
  }

  const config: FallbackApresentacaoConfig = {
    id: fallbackApresentacoes.length + 1,
    empresaId: input.empresaId,
    slug: input.slug,
    nomeEmpresa: input.nomeEmpresa,
    descricao: input.descricao ?? null,
    logoUrl: input.logoUrl ?? null,
    corPrimaria: input.corPrimaria,
    whatsapp: input.whatsapp ?? null,
    endereco: input.endereco ?? null,
    instagram: input.instagram ?? null,
    ativo: input.ativo,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
  fallbackApresentacoes.push(config);
  return config;
}

export function getFallbackPublicApresentacaoDataBySlug(slug: string) {
  const config = getFallbackApresentacaoConfigBySlug(slug);
  if (!config || !config.ativo) return null;

  const empresa = getFallbackEmpresaById(config.empresaId);
  const itens = listFallbackCardapioByEmpresaId(config.empresaId).filter((item) => item.disponivel);
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
