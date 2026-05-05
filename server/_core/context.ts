import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Usuario } from "../../drizzle/schema";
import { getOrCreateAdminUser, getUsuarioById } from "../db";
import { verifyToken } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: Usuario | null;
  empresaId: number | null;
  isDelegated?: boolean;
};

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
      const user = await getUsuarioById(payload.userId);
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
  if (process.env.NODE_ENV === "development" && !token) {
    const adminUser = await getOrCreateAdminUser();
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
