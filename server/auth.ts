import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ENV } from "./_core/env";
import { getDb, getUsuarioByEmail } from "./db";
import { usuarios, type InsertUsuario } from "../drizzle/schema";
import type { Request, Response } from "express";
import { getOrCreateAdminUser, getUsuarioByEmail } from "./db";

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

    const usuario = await getUsuarioByEmail(email);
    if (!usuario) {
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

    // Set cookie
    res.cookie("app_session_token", token, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
export async function handleLogout(_req: Request, res: Response) {
  res.clearCookie("app_session_token");
  return res.json({ success: true });
}

/**
 * GET /api/auth/me
 * Retorna dados do usuário logado
 */
export async function handleMe(req: Request, res: Response) {
  const token =
    req.cookies?.app_session_token ||
    req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token inválido" });
  }

  const usuario = await getUsuarioByEmail(payload.email);
  if (!usuario) {
    return res.status(401).json({ error: "Usuário não encontrado" });
  }

  return res.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    role: usuario.role,
    empresaId: usuario.empresaId,
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

    // Set cookie for convenience
    res.cookie("app_session_token", token, {
      httpOnly: true,
      secure: ENV.isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
