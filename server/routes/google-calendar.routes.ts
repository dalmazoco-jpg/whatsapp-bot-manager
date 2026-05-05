import type { Express, Request, Response } from "express";
import { verifyToken } from "../auth";
import { getAuthUrl, saveTokens, temGoogleCalendar, buscarHorariosLivres, verificarDisponibilidade } from "../services/google-calendar.service";
import { getDb } from "../db";

export function registerGoogleCalendarRoutes(app: Express) {
  // GET /api/google/auth-url — gera URL para conectar Google Calendar
  app.get("/api/google/auth-url", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload) return res.status(401).json({ error: "Não autenticado" });
    const empresaId = payload.empresaId;
    if (!empresaId) return res.status(400).json({ error: "Sem empresa associada" });
    const url = getAuthUrl(empresaId);
    return res.json({ url });
  });

  // GET /api/google/callback — callback OAuth2 do Google
  app.get("/api/google/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Parâmetros inválidos");
    try {
      const empresaId = parseInt(state as string);
      await saveTokens(empresaId, code as string);
      return res.redirect("/?google=conectado");
    } catch (err) {
      console.error("[GoogleCalendar] Erro no callback:", err);
      return res.redirect("/?google=erro");
    }
  });

  // GET /api/google/status — verifica se empresa tem Google Calendar conectado
  app.get("/api/google/status", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const conectado = await temGoogleCalendar(payload.empresaId);
    return res.json({ conectado });
  });

  // GET /api/google/horarios-livres — busca horários disponíveis
  app.get("/api/google/horarios-livres", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const { data, duracao } = req.query;
    if (!data) return res.status(400).json({ error: "Data obrigatória" });
    const horarios = await buscarHorariosLivres(payload.empresaId, new Date(data as string), parseInt(duracao as string) || 60);
    return res.json({ horarios });
  });

  // POST /api/google/verificar-disponibilidade
  app.post("/api/google/verificar-disponibilidade", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const { dataHora, duracao } = req.body;
    if (!dataHora) return res.status(400).json({ error: "dataHora obrigatória" });
    const resultado = await verificarDisponibilidade(payload.empresaId, new Date(dataHora), duracao || 60);
    return res.json(resultado);
  });

  // GET /api/notificacoes/contatos — lista contatos de notificação
  app.get("/api/notificacoes/contatos", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const db = getDb();
    const rows = await db.execute(`SELECT * FROM contatos_notificacao WHERE empresa_id = ${payload.empresaId} ORDER BY created_at`) as unknown[];
    return res.json(Array.isArray(rows) ? rows : []);
  });

  // POST /api/notificacoes/contatos — adiciona contato de notificação
  app.post("/api/notificacoes/contatos", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const { nome, whatsapp, tipo, eventos } = req.body;
    if (!nome || !whatsapp) return res.status(400).json({ error: "Nome e WhatsApp obrigatórios" });
    const eventosArr = eventos || ["agendamento", "pedido", "cancelamento"];
    const db = getDb();
    await db.execute(`
      INSERT INTO contatos_notificacao (empresa_id, nome, whatsapp, tipo, eventos)
      VALUES (${payload.empresaId}, '${nome}', '${whatsapp}', '${tipo || "proprietario"}', ARRAY[${eventosArr.map((e: string) => `'${e}'`).join(",")}])
    `);
    return res.status(201).json({ success: true });
  });

  // DELETE /api/notificacoes/contatos/:id
  app.delete("/api/notificacoes/contatos/:id", async (req: Request, res: Response) => {
    const token = req.cookies?.app_session_token || req.headers.authorization?.replace("Bearer ", "");
    const payload = token ? verifyToken(token) : null;
    if (!payload?.empresaId) return res.status(401).json({ error: "Não autenticado" });
    const id = parseInt(req.params.id);
    const db = getDb();
    await db.execute(`DELETE FROM contatos_notificacao WHERE id = ${id} AND empresa_id = ${payload.empresaId}`);
    return res.json({ success: true });
  });
}
