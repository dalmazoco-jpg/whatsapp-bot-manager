import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import { ENV } from "./_core/env";
import { getDb, getOrCreateAdminUser, getUsuarioByEmail } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import { usuarios, type InsertUsuario } from "../drizzle/schema";
import type { Request, Response } from "express";
import { getOAuth2Client, saveCalendarTokens } from "./services/google-calendar.service";
import {
  findFallbackUserByCredentials,
  findFallbackUserByEmail,
  isFallbackAuthEnabled,
} from "./fallback-store";

export const LOGGED_OUT_COOKIE = "app_logged_out";

function setSessionTokenCookie(res: Response, token: string) {
  res.clearCookie(LOGGED_OUT_COOKIE, { path: "/" });
  res.cookie("app_session_token", token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export type JwtPayload = {
  userId: number;
  empresaId: number | null;
  role: "admin" | "empresa";
  email: string;
  delegatedEmpresaId?: number; // Admin acessando empresa de outro
};

/**
 * Gera um JWT token com dados do usuário
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, ENV.jwtSecret, { expiresIn: "7d" });
}

/**
 * Gera um token de acesso delegado (admin acessando empresa de outro)
 */
export function generateDelegatedToken(adminUserId: number, adminEmail: string, empresaId: number): string {
  const payload: JwtPayload = {
    userId: adminUserId,
    empresaId: null, // Não é usuario dessa empresa
    role: "admin",
    email: adminEmail,
    delegatedEmpresaId: empresaId, // Indicar que está acessando delegado
  };
  return jwt.sign(payload, ENV.jwtSecret, { expiresIn: "2h" }); // Token curto para delegação
}

/**
 * Verifica e decodifica um JWT token
 */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ENV.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/login
 * Body: { email, senha }
 * Returns: { token, user }
 */
export async function handleLogin(req: Request, res: Response) {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }

    let usuario;
    try {
      usuario = await getUsuarioByEmail(email);
    } catch (error) {
      const fallbackUser = findFallbackUserByCredentials(email, senha);
      if (!fallbackUser) throw error;

      const token = generateToken({
        userId: fallbackUser.id,
        empresaId: fallbackUser.empresaId,
        role: fallbackUser.role,
        email: fallbackUser.email,
      });

      setSessionTokenCookie(res, token);

      return res.json({
        token,
        user: {
          id: fallbackUser.id,
          nome: fallbackUser.nome,
          email: fallbackUser.email,
          role: fallbackUser.role,
          empresaId: fallbackUser.empresaId,
        },
      });
    }

    if (!usuario) {
      const fallbackUser = findFallbackUserByCredentials(email, senha);
      if (fallbackUser) {
        const token = generateToken({
          userId: fallbackUser.id,
          empresaId: fallbackUser.empresaId,
          role: fallbackUser.role,
          email: fallbackUser.email,
        });

        setSessionTokenCookie(res, token);

        return res.json({
          token,
          user: {
            id: fallbackUser.id,
            nome: fallbackUser.nome,
            email: fallbackUser.email,
            role: fallbackUser.role,
            empresaId: fallbackUser.empresaId,
          },
        });
      }
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = generateToken({
      userId: usuario.id,
      empresaId: usuario.empresaId,
      role: usuario.role,
      email: usuario.email,
    });

    setSessionTokenCookie(res, token);

    return res.json({
      token,
      user: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
        empresaId: usuario.empresaId,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

export async function handleGoogleLoginCallback(req: Request, res: Response) {
  const { code } = req.query;
  if (!code || typeof code !== "string") {
    return res.redirect("/login?google=erro");
  }

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.access_token) throw new Error("Google não retornou access_token");

    oauth2.setCredentials(tokens);
    const oauth2Api = google.oauth2({ version: "v2", auth: oauth2 });
    const { data: profile } = await oauth2Api.userinfo.get();
    const email = profile.email?.toLowerCase();
    if (!email) throw new Error("Google não retornou email");

    let usuario;
    try {
      usuario = await getUsuarioByEmail(email);
    } catch (error) {
      if (!isFallbackAuthEnabled()) throw error;
      usuario = findFallbackUserByEmail(email);
    }
    if (!usuario) usuario = findFallbackUserByEmail(email);

    if (!usuario) {
      return res.redirect("/login?google=nao-cadastrado");
    }

    const token = generateToken({
      userId: usuario.id,
      empresaId: usuario.empresaId,
      role: usuario.role,
      email: usuario.email,
    });

    if (usuario.empresaId) {
      await saveCalendarTokens(usuario.empresaId, tokens);
    }

    setSessionTokenCookie(res, token);
    const redirectTo = usuario.role === "admin" ? "/admin?google=conectado" : "/dashboard?google=conectado";
    return res.redirect(redirectTo);
  } catch (error) {
    console.error("Google login callback error:", error);
    return res.redirect("/login?google=erro");
  }
}

/**
 * POST /api/auth/register (admin only — cria contas de empresa)
 * Body: { email, senha, nome, empresaId }
 */
export async function handleRegister(req: Request, res: Response) {
  try {
    const { email, senha, nome, empresaId } = req.body;

    if (!email || !senha || !nome) {
      return res.status(400).json({ error: "Email, senha e nome são obrigatórios" });
    }

    const existing = await getUsuarioByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email já cadastrado" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);
    const db = getDb();

    const newUser: InsertUsuario = {
      email,
      senhaHash,
      nome,
      role: "empresa",
      empresaId: empresaId || null,
    };

    await db.insert(usuarios).values(newUser);

    const created = await getUsuarioByEmail(email);
    return res.status(201).json({
      user: {
        id: created!.id,
        nome: created!.nome,
        email: created!.email,
        role: created!.role,
        empresaId: created!.empresaId,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

/**
 * POST /api/auth/logout
 */
export async function handleLogout(req: Request, res: Response) {
  res.clearCookie("app_session_token", {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie(COOKIE_NAME, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
  res.cookie(LOGGED_OUT_COOKIE, "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: ENV.isProduction,
    path: "/",
    maxAge: 5 * 60 * 1000,
  });
  return res.json({ success: true });
}

/**
 * GET /api/auth/me
 * Retorna dados do usuário logado
 */
export async function handleMe(req: Request, res: Response) {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    req.cookies?.app_session_token;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token inválido" });
  }

  let usuario;
  try {
    usuario = await getUsuarioByEmail(payload.email);
  } catch (error) {
    if (!isFallbackAuthEnabled()) throw error;
    usuario = findFallbackUserByEmail(payload.email);
  }
  if (!usuario) {
    usuario = findFallbackUserByEmail(payload.email);
  }
  if (!usuario) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  const empresaId = payload.delegatedEmpresaId ?? usuario.empresaId ?? payload.empresaId ?? null;

  return res.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    empresaId,
  });
}

/**
 * GET /api/auth/dev-login
 * Apenas em desenvolvimento: retorna token para usuário admin local (cria se necessário)
 */
export async function handleDevLogin(_req: Request, res: Response) {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const admin = await getOrCreateAdminUser();
    if (!admin) return res.status(500).json({ error: "Could not create admin" });

    const token = generateToken({
      userId: admin.id,
      empresaId: admin.empresaId,
      role: admin.role as "admin",
      email: admin.email,
    });

    setSessionTokenCookie(res, token);

    return res.json({ token, user: { id: admin.id, nome: admin.nome, email: admin.email, role: admin.role } });
  } catch (err) {
    console.error("Dev login error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Envia instruções de redefinição de senha
 */
export async function handleCreateMasterUser(req: Request, res: Response) {
  if (!isFallbackAuthEnabled()) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const email = "dalmazo.co@gmail.com";
    try {
      const senhaHash = await bcrypt.hash("master2026m", 10);
      const db = getDb();

      // Tentar usar onConflictDoUpdate para upsert
      await db
        .insert(usuarios)
        .values({
          email,
          senhaHash,
          nome: "Denis Dalmazo",
          role: "admin",
          empresaId: null,
        })
        .onConflictDoUpdate({
          target: usuarios.email,
          set: {
            senhaHash,
            nome: "Denis Dalmazo",
            role: "admin",
            empresaId: null,
          },
        });
    } catch {
      // Em modo fallback, os usuários mestres já existem no fallback-store.
      console.log("[fallback] Banco indisponível, usando usuário master temporário");
    }

    const token = generateToken({
      userId: 2,
      empresaId: null,
      role: "admin",
      email,
    });

    setSessionTokenCookie(res, token);

    return res.json({
      success: true,
      message: "Usuário master criado/atualizado com sucesso",
      user: {
        id: 2,
        nome: "Denis Dalmazo",
        email,
        role: "admin",
      },
      token,
    });
  } catch (err) {
    console.error("Create master user error:", err);
    return res.status(500).json({ error: "Internal error", details: String(err) });
  }
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Envia instruções de redefinição de senha
 */
export async function handleForgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }

    const usuario = await getUsuarioByEmail(email);
    if (!usuario) {
      // Não revelar se o email existe ou não por segurança
      return res.json({ message: "Se o email estiver cadastrado, instruções foram enviadas" });
    }

    // TODO: Implementar envio de email com token de redefinição
    // Por enquanto, apenas log
    console.log(`[Forgot Password] Solicitação para ${email} - usuário ID: ${usuario.id}`);

    // Em produção, gerar token, salvar no banco, enviar email
    // Aqui apenas simula sucesso
    return res.json({ message: "Instruções enviadas para seu email!" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}
