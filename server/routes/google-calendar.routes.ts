import type { Express, Request, Response } from "express";
import { verifyToken } from "../auth";
import {
  getAuthUrl,
  getGoogleLoginAuthUrl,
  getGoogleRedirectUri,
  saveTokens,
  validarGoogleCalendar,
  buscarHorariosLivres,
  verificarDisponibilidade,
  listarEventosProximos,
} from "../services/google-calendar.service";
import { handleGoogleLoginCallback } from "../auth";
import { getDb } from "../db";
import { MASTER_ADMIN_EMAIL } from "../../shared/platform";

function getEmpresaIdFromRequest(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.app_session_token;
  const payload = token ? verifyToken(token) : null;
  const delegatedOrEmpresaId = payload?.delegatedEmpresaId || payload?.empresaId;
  const platformMasterId = payload?.role === "admin" && payload.email?.toLowerCase() === MASTER_ADMIN_EMAIL ? 0 : null;
  return {
    payload,
    empresaId: delegatedOrEmpresaId ?? platformMasterId,
  };
}

export function registerGoogleCalendarRoutes(app: Express) {
  // GET /api/auth/google-url — login com Google + consentimento do Calendar
  app.get("/api/auth/google-url", async (_req: Request, res: Response) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        error: "Login com Google ainda não configurado no servidor",
        setupRequired: true,
        redirectUri: getGoogleRedirectUri(),
      });
    }
    return res.json({ url: getGoogleLoginAuthUrl(), redirectUri: getGoogleRedirectUri() });
  });

  // GET /api/google/auth-url — gera URL para conectar Google Calendar
  app.get("/api/google/auth-url", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload) return res.status(401).json({ error: "Não autenticado" });
    if (empresaId == null) return res.status(400).json({ error: "Sem empresa associada" });
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return res.status(503).json({
        error: "Google Calendar ainda não configurado no servidor",
        setupRequired: true,
        redirectUri: getGoogleRedirectUri(),
      });
    }
    const url = getAuthUrl(empresaId);
    return res.json({ url });
  });

  // GET /api/google/callback — callback OAuth2 do Google
  app.get("/api/google/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send("Parâmetros inválidos");
    if (state === "login") return handleGoogleLoginCallback(req, res);
    try {
      const empresaId = parseInt(state as string);
      await saveTokens(empresaId, code as string);
      return res.redirect("/agendamentos?google=conectado");
    } catch (err) {
      console.error("[GoogleCalendar] Erro no callback:", err);
      return res.redirect("/agendamentos?google=erro");
    }
  });

  // GET /api/google/status — verifica se empresa tem Google Calendar conectado
  app.get("/api/google/status", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const status = await validarGoogleCalendar(empresaId);
    return res.json({
      conectado: status.conectado,
      calendarId: status.calendarId,
      error: status.error,
      configurado: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: getGoogleRedirectUri(),
    });
  });

  // GET /api/google/horarios-livres — busca horários disponíveis
  app.get("/api/google/horarios-livres", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const { data, duracao } = req.query;
    if (!data) return res.status(400).json({ error: "Data obrigatória" });
    const horarios = await buscarHorariosLivres(empresaId, new Date(data as string), parseInt(duracao as string) || 60);
    return res.json({ horarios });
  });

  // GET /api/google/eventos — lista eventos próximos do Google Calendar
  app.get("/api/google/eventos", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const maxResults = parseInt(req.query.maxResults as string) || 250;
    const dias = parseInt(req.query.dias as string) || 30;
    const startDate = req.query.start ? new Date(req.query.start as string) : undefined;
    const endDate = req.query.end ? new Date(req.query.end as string) : undefined;
    const eventos = await listarEventosProximos(empresaId, maxResults, dias, startDate, endDate);
    return res.json({ eventos });
  });

  // POST /api/google/eventos — cria novo evento no Google Calendar
  app.post("/api/google/eventos", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const { titulo, descricao, dataHoraInicio, duracaoMinutos, emailConvidado, criarMeet } = req.body;
    if (!titulo || !dataHoraInicio) return res.status(400).json({ error: "Título e dataHoraInicio obrigatórios" });
    const evento = await criarEvento(empresaId, titulo, descricao || "", new Date(dataHoraInicio), duracaoMinutos || 60, emailConvidado, criarMeet);
    if (!evento) return res.status(500).json({ error: "Erro ao criar evento" });
    return res.json(evento);
  });

  // PUT /api/google/eventos/:id — atualiza evento no Google Calendar
  app.put("/api/google/eventos/:id", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const eventId = req.params.id;
    const { titulo, descricao, dataHoraInicio, duracaoMinutos } = req.body;
    const sucesso = await atualizarEvento(empresaId, eventId, { titulo, descricao, dataHoraInicio: dataHoraInicio ? new Date(dataHoraInicio) : undefined, duracaoMinutos });
    if (!sucesso) return res.status(500).json({ error: "Erro ao atualizar evento" });
    return res.json({ success: true });
  });

  // DELETE /api/google/eventos/:id — deleta evento no Google Calendar
  app.delete("/api/google/eventos/:id", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const eventId = req.params.id;
    const sucesso = await cancelarEvento(empresaId, eventId);
    if (!sucesso) return res.status(500).json({ error: "Erro ao deletar evento" });
    return res.json({ success: true });
  });

  // POST /api/google/verificar-disponibilidade
  app.post("/api/google/verificar-disponibilidade", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const { dataHora, duracao } = req.body;
    if (!dataHora) return res.status(400).json({ error: "dataHora obrigatória" });
    const resultado = await verificarDisponibilidade(empresaId, new Date(dataHora), duracao || 60);
    return res.json(resultado);
  });

  // GET /api/notificacoes/contatos — lista contatos de notificação
  app.get("/api/notificacoes/contatos", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const db = getDb();
    const rows = await db.execute(`SELECT * FROM contatos_notificacao WHERE empresa_id = ${empresaId} ORDER BY created_at`) as unknown[];
    return res.json(Array.isArray(rows) ? rows : []);
  });

  // POST /api/notificacoes/contatos — adiciona contato de notificação
  app.post("/api/notificacoes/contatos", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const { nome, whatsapp, tipo, eventos } = req.body;
    if (!nome || !whatsapp) return res.status(400).json({ error: "Nome e WhatsApp obrigatórios" });
    const eventosArr = eventos || ["agendamento", "pedido", "cancelamento", "novo_cliente", "entrega"];
    const db = getDb();
    await db.execute(`
      INSERT INTO contatos_notificacao (empresa_id, nome, whatsapp, tipo, eventos)
      VALUES (${empresaId}, '${nome}', '${whatsapp}', '${tipo || "proprietario"}', ARRAY[${eventosArr.map((e: string) => `'${e}'`).join(",")}])
    `);
    return res.status(201).json({ success: true });
  });

  // DELETE /api/notificacoes/contatos/:id
  app.delete("/api/notificacoes/contatos/:id", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });
    const id = parseInt(req.params.id);
    const db = getDb();
    await db.execute(`DELETE FROM contatos_notificacao WHERE id = ${id} AND empresa_id = ${empresaId}`);
    return res.json({ success: true });
  });
}
