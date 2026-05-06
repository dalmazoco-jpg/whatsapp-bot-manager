import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Usuario } from "../../drizzle/schema";
import { getOrCreateAdminUser, getUsuarioById } from "../db";
import { LOGGED_OUT_COOKIE, verifyToken } from "../auth";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: Usuario | null;
  empresaId: number | null;
  isDelegated?: boolean;
};

function createDevelopmentAdminUser(): Usuario {
  const now = new Date();
  return {
    id: 1,
    empresaId: null,
    email: "admin@sistema.com",
    senhaHash: "",
    nome: "Admin Sistema",
    role: "admin",
    createdAt: now,
    lastSignedIn: now,
  };
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const { req, res } = opts;

  // Tentar extrair JWT do cookie ou header
  const token =
    req.cookies?.app_session_token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      let user: Usuario | undefined;
      try {
        user = await getUsuarioById(payload.userId);
      } catch (error) {
        if (
          process.env.NODE_ENV !== "development" &&
          (!ENV.localAuthFallback || payload.role !== "admin")
        ) {
          throw error;
        }
        user = createDevelopmentAdminUser();
      }
      if (user) {
        // Se tem delegatedEmpresaId, usar esse contexto
        const isDelegated = !!payload.delegatedEmpresaId;
        const empresaId = payload.delegatedEmpresaId || user.empresaId;
        return {
          req,
          res,
          user,
          empresaId,
          isDelegated,
        };
      }
    }
  }

  // Modo desenvolvimento: auto-login como admin local
  if (
    process.env.NODE_ENV === "development" &&
    !token &&
    req.cookies?.[LOGGED_OUT_COOKIE] !== "true"
  ) {
    let adminUser: Usuario | null | undefined;
    try {
      adminUser = await getOrCreateAdminUser();
    } catch (error) {
      adminUser = createDevelopmentAdminUser();
    }
    return {
      req,
      res,
      user: adminUser ?? null,
      empresaId: null,
    };
  }

  return {
    req,
    res,
    user: null,
    empresaId: null,
  };
}
