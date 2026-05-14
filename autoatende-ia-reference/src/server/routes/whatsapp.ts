import type { Express, Request, Response } from "express";
import { baileysEvents, startBaileysSession, stopBaileysSession, getSessionStatus, getSessionSnapshot } from "../services/baileys.service.ts";
import { verifyToken } from "../auth.ts";
import { getSessaoByEmpresaId } from "../../db.ts";
import { MASTER_ADMIN_EMAIL, PLATFORM_WHATSAPP_EMPRESA_ID } from "../../shared/platform.ts";

function canAccessWhatsAppSession(payload: ReturnType<typeof verifyToken>, empresaId: number) {
  if (!payload) return false;
  const isMasterPlatform = empresaId === PLATFORM_WHATSAPP_EMPRESA_ID
    && payload.role === "admin"
    && payload.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
  return isMasterPlatform || payload.role === "admin" || payload.empresaId === empresaId;
}

/**
 * Registra as rotas do WhatsApp (SSE + REST)
 */
export function registerWhatsAppRoutes(app: Express) {
  /**
   * GET /api/whatsapp/qr-stream/:empresaId
   * Server-Sent Events — transmite QR code em tempo real
   */
  app.get("/api/whatsapp/qr-stream/:empresaId", async (req: Request, res: Response) => {
    const empresaId = parseInt(req.params.empresaId);

    if (isNaN(empresaId)) {
      return res.status(400).json({ error: "empresaId inválido" });
    }

    // Verificar autenticação
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      (req as any).cookies?.app_session_token ||
      (req.query.token as string);

    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // Verificar permissão: admin ou dono da empresa
    if (!canAccessWhatsAppSession(payload, empresaId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    // Configurar SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Enviar status inicial
    const snapshot = getSessionSnapshot(empresaId);
    const sessao = empresaId === PLATFORM_WHATSAPP_EMPRESA_ID ? null : await getSessaoByEmpresaId(empresaId);
    if (snapshot.status !== "desconectado") {
      res.write(`data: ${JSON.stringify({ type: "status", status: snapshot.status })}\n\n`);
      if (snapshot.status === "qr_pendente" && snapshot.qr) {
        res.write(`data: ${JSON.stringify({ type: "qr", qr: snapshot.qr })}\n\n`);
      }
    } else if (sessao) {
      res.write(`data: ${JSON.stringify({ type: "status", status: sessao.status })}\n\n`);

      // Se já tem QR pendente, enviar imediatamente
      if (sessao.status === "qr_pendente" && sessao.ultimoQr) {
        res.write(`data: ${JSON.stringify({ type: "qr", qr: sessao.ultimoQr })}\n\n`);
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: "status", status: "desconectado" })}\n\n`);
    }

    // Listener para eventos do Baileys
    const eventName = `qr:${empresaId}`;
    const listener = (data: { type: string; qr?: string }) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    baileysEvents.on(eventName, listener);

    // Heartbeat para manter a conexão
    const heartbeat = setInterval(() => {
      res.write(`:heartbeat\n\n`);
    }, 30000);

    // Cleanup quando o cliente desconecta
    req.on("close", () => {
      baileysEvents.off(eventName, listener);
      clearInterval(heartbeat);
    });
  });

  /**
   * POST /api/whatsapp/connect/:empresaId
   * Inicia sessão Baileys
   */
  app.post("/api/whatsapp/connect/:empresaId", async (req: Request, res: Response) => {
    const empresaId = parseInt(req.params.empresaId);

    if (isNaN(empresaId)) {
      return res.status(400).json({ error: "empresaId inválido" });
    }

    // Verificar autenticação
    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      (req as any).cookies?.app_session_token;

    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Token inválido" });
    }

    if (!canAccessWhatsAppSession(payload, empresaId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    try {
      await startBaileysSession(empresaId);
      return res.json({ status: "connecting", message: "Sessão iniciada, aguarde o QR code" });
    } catch (error) {
      console.error("Erro ao conectar WhatsApp:", error);
      return res.status(500).json({ error: "Erro ao iniciar conexão" });
    }
  });

  /**
   * POST /api/whatsapp/disconnect/:empresaId
   * Desconecta sessão Baileys
   */
  app.post("/api/whatsapp/disconnect/:empresaId", async (req: Request, res: Response) => {
    const empresaId = parseInt(req.params.empresaId);

    if (isNaN(empresaId)) {
      return res.status(400).json({ error: "empresaId inválido" });
    }

    const token =
      req.headers.authorization?.replace("Bearer ", "") ||
      (req as any).cookies?.app_session_token;

    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Token inválido" });

    if (!canAccessWhatsAppSession(payload, empresaId)) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    try {
      await stopBaileysSession(empresaId);
      return res.json({ status: "disconnected" });
    } catch (error) {
      console.error("Erro ao desconectar WhatsApp:", error);
      return res.status(500).json({ error: "Erro ao desconectar" });
    }
  });

  /**
   * GET /api/whatsapp/status/:empresaId
   * Retorna status da sessão
   */
  app.get("/api/whatsapp/status/:empresaId", async (req: Request, res: Response) => {
    const empresaId = parseInt(req.params.empresaId);
    if (isNaN(empresaId)) return res.status(400).json({ error: "empresaId inválido" });

    const sessao = empresaId === PLATFORM_WHATSAPP_EMPRESA_ID ? null : await getSessaoByEmpresaId(empresaId);
    const liveStatus = getSessionStatus(empresaId);
    const snapshot = getSessionSnapshot(empresaId);

    return res.json({
      status: liveStatus,
      dbStatus: sessao?.status || snapshot.status,
      connectedAt: sessao?.connectedAt || snapshot.connectedAt,
    });
  });
}
