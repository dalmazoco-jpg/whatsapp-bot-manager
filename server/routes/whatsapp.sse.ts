import type { Express, Request, Response } from "express";
import { baileysEvents, startBaileysSession, stopBaileysSession, getSessionStatus } from "../services/baileys.service";
import { verifyToken } from "../auth";
import { getSessaoByEmpresaId } from "../db";

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
      req.cookies?.app_session_token ||
      req.headers.authorization?.replace("Bearer ", "") ||
      (req.query.token as string);

    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Token inválido" });
    }

    // Verificar permissão: admin ou dono da empresa
    if (payload.role !== "admin" && payload.empresaId !== empresaId) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    // Configurar SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Enviar status inicial
    const sessao = await getSessaoByEmpresaId(empresaId);
    if (sessao) {
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
      req.cookies?.app_session_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: "Token inválido" });
    }

    if (payload.role !== "admin" && payload.empresaId !== empresaId) {
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
      req.cookies?.app_session_token ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: "Token inválido" });

    if (payload.role !== "admin" && payload.empresaId !== empresaId) {
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

    const sessao = await getSessaoByEmpresaId(empresaId);
    const liveStatus = getSessionStatus(empresaId);

    return res.json({
      status: liveStatus,
      dbStatus: sessao?.status || "desconectado",
      connectedAt: sessao?.connectedAt,
    });
  });
}
