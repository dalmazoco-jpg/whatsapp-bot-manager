import { MASTER_ADMIN_EMAIL } from "../../shared/platform.ts";

interface TokenPayload {
  id: number;
  email: string;
  role: "admin" | "empresa";
  empresaId: number | null;
}

/**
 * Mock de verificação de token. 
 * Em produção, você usaria jwt.verify(token, process.env.JWT_SECRET)
 */
export function verifyToken(token: string): TokenPayload | null {
  if (!token) return null;

  // Para o protótipo, aceitamos qualquer token "valido_admin" como o admin master
  if (token === "valido_admin" || token.length > 10) {
    return {
      id: 1,
      email: MASTER_ADMIN_EMAIL,
      role: "admin",
      empresaId: null,
    };
  }

  return null;
}
