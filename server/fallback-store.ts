import { ENV } from "./_core/env";
import type { Empresa, Usuario } from "../drizzle/schema";

type FallbackUser = {
  id: number;
  empresaId: number | null;
  email: string;
  nome: string;
  role: "admin" | "empresa";
  senhas: string[];
};

type FallbackEmpresa = Empresa;

let nextEmpresaId = 1;
let nextUserId = 10;

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
}) {
  const now = new Date();
  const empresa: FallbackEmpresa = {
    id: nextEmpresaId++,
    nome: input.nome,
    tipo: input.tipo,
    ramo: input.tipo,
    whatsappNumero: input.whatsappNumero || null,
    ativo: false,
    licencaExpira: null,
    configIa: null,
    configBot: null,
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
