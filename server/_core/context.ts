import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Usuario } from "../../drizzle/schema";
import { getOrCreateAdminUser, getUsuarioById } from "../db";
import { LOGGED_OUT_COOKIE, verifyToken } from "../auth";
import { ENV } from "./env";
import { findFallbackUserById } from "../fallback-store";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: Usuario | null;
  empresaId: number | null;
  isDelegated?: boolean;
};

function createDevelopmentAdminUser(email = "admin@sistema.com"): Usuario {
  const now = new Date();
  return {
    id: 1,
    empresaId: null,
    email,
    senhaHash: "",
    nome: email === "dalmazo.co@gmail.com" ? "Denis Dalmazo" : "Admin Sistema",
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
    req.headers.authorization?.replace("Bearer ", "") ||
    req.cookies?.app_session_token;

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
        user = findFallbackUserById(payload.userId, payload.email) ?? createDevelopmentAdminUser(payload.email);
      }
      if (user) {
        const isDelegated = !!payload.delegatedEmpresaId;
        const empresaId = payload.delegatedEmpresaId ?? user.empresaId ?? payload.empresaId ?? null;
        return {
          req,
          res,
          user: {
            ...user,
            empresaId,
          },
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
