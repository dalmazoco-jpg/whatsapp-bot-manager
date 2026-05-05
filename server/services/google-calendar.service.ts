import { google } from "googleapis";
import { getDb } from "../db";
import { eq } from "drizzle-orm";

// ── OAuth2 Client ─────────────────────────────────────────────
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || "http://localhost:3000"}/api/google/callback`
  );
}

// ── Gera URL de autorização ───────────────────────────────────
export function getAuthUrl(empresaId: number): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state: String(empresaId),
  });
}

// ── Salva tokens no banco ─────────────────────────────────────
export async function saveTokens(empresaId: number, code: string): Promise<void> {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  const db = getDb();
  await db.execute(`
    INSERT INTO google_calendar_tokens (empresa_id, access_token, refresh_token, token_expiry)
    VALUES (${empresaId}, '${tokens.access_token}', '${tokens.refresh_token}', '${new Date(tokens.expiry_date!).toISOString()}')
    ON CONFLICT (empresa_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      token_expiry = EXCLUDED.token_expiry,
      updated_at = NOW()
  `);
}

// ── Carrega cliente autenticado para uma empresa ──────────────
export async function getAuthenticatedClient(empresaId: number) {
  const db = getDb();
  const rows = await db.execute(
    `SELECT * FROM google_calendar_tokens WHERE empresa_id = ${empresaId} LIMIT 1`
  ) as unknown[];

  if (!Array.isArray(rows) || rows.length === 0) return null;
  const token = rows[0] as {
    access_token: string;
    refresh_token: string;
    token_expiry: string;
    calendar_id: string;
  };

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: new Date(token.token_expiry).getTime(),
  });

  // Auto-refresh se expirado
  oauth2.on("tokens", async (newTokens) => {
    if (newTokens.access_token) {
      await db.execute(`
        UPDATE google_calendar_tokens
        SET access_token = '${newTokens.access_token}',
            token_expiry = '${new Date(newTokens.expiry_date!).toISOString()}',
            updated_at = NOW()
        WHERE empresa_id = ${empresaId}
      `);
    }
  });

  return { oauth2, calendarId: token.calendar_id || "primary" };
}

// ── Verifica disponibilidade ──────────────────────────────────
export async function verificarDisponibilidade(
  empresaId: number,
  dataHoraInicio: Date,
  duracaoMinutos: number = 60
): Promise<{ disponivel: boolean; conflitos: string[] }> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return { disponivel: true, conflitos: [] };

  const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
  const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60000);

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: dataHoraInicio.toISOString(),
        timeMax: dataFim.toISOString(),
        items: [{ id: auth.calendarId }],
      },
    });

    const busy = response.data.calendars?.[auth.calendarId]?.busy || [];
    if (busy.length === 0) return { disponivel: true, conflitos: [] };

    const conflitos = busy.map(
      (b) => `${new Date(b.start!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} - ${new Date(b.end!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    );
    return { disponivel: false, conflitos };
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao verificar disponibilidade:", err);
    return { disponivel: true, conflitos: [] };
  }
}

// ── Busca próximos horários livres ────────────────────────────
export async function buscarHorariosLivres(
  empresaId: number,
  data: Date,
  duracaoMinutos: number = 60,
  horaInicio: number = 8,
  horaFim: number = 18
): Promise<string[]> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return [];

  const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
  const inicioDia = new Date(data);
  inicioDia.setHours(horaInicio, 0, 0, 0);
  const fimDia = new Date(data);
  fimDia.setHours(horaFim, 0, 0, 0);

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: inicioDia.toISOString(),
        timeMax: fimDia.toISOString(),
        items: [{ id: auth.calendarId }],
      },
    });

    const busy = response.data.calendars?.[auth.calendarId]?.busy || [];
    const livres: string[] = [];
    let cursor = new Date(inicioDia);

    while (cursor < fimDia) {
      const slotFim = new Date(cursor.getTime() + duracaoMinutos * 60000);
      if (slotFim > fimDia) break;

      const ocupado = busy.some(
        (b) => new Date(b.start!) < slotFim && new Date(b.end!) > cursor
      );

      if (!ocupado) {
        livres.push(cursor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
      cursor = new Date(cursor.getTime() + duracaoMinutos * 60000);
    }

    return livres.slice(0, 6); // max 6 horários sugeridos
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao buscar horários:", err);
    return [];
  }
}

// ── Cria evento no Google Calendar ───────────────────────────
export async function criarEvento(
  empresaId: number,
  titulo: string,
  descricao: string,
  dataHoraInicio: Date,
  duracaoMinutos: number = 60,
  emailConvidado?: string,
  criarMeet: boolean = false
): Promise<{ eventId: string; meetLink?: string; htmlLink?: string } | null> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
  const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60000);

  const eventBody: any = {
    summary: titulo,
    description: descricao,
    start: { dateTime: dataHoraInicio.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: dataFim.toISOString(), timeZone: "America/Sao_Paulo" },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 60 },
        { method: "popup", minutes: 15 },
      ],
    },
  };

  if (emailConvidado) {
    eventBody.attendees = [{ email: emailConvidado }];
  }

  if (criarMeet) {
    eventBody.conferenceData = {
      createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }

  try {
    const response = await calendar.events.insert({
      calendarId: auth.calendarId,
      requestBody: eventBody,
      conferenceDataVersion: criarMeet ? 1 : 0,
    });

    return {
      eventId: response.data.id!,
      meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri,
      htmlLink: response.data.htmlLink || undefined,
    };
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao criar evento:", err);
    return null;
  }
}

// ── Atualiza evento ───────────────────────────────────────────
export async function atualizarEvento(
  empresaId: number,
  eventId: string,
  dados: { titulo?: string; descricao?: string; dataHoraInicio?: Date; duracaoMinutos?: number }
): Promise<boolean> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return false;

  const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
  try {
    const { data: evento } = await calendar.events.get({ calendarId: auth.calendarId, eventId });
    const patch: any = {};
    if (dados.titulo) patch.summary = dados.titulo;
    if (dados.descricao) patch.description = dados.descricao;
    if (dados.dataHoraInicio) {
      const fim = new Date(dados.dataHoraInicio.getTime() + (dados.duracaoMinutos || 60) * 60000);
      patch.start = { dateTime: dados.dataHoraInicio.toISOString(), timeZone: "America/Sao_Paulo" };
      patch.end = { dateTime: fim.toISOString(), timeZone: "America/Sao_Paulo" };
    }
    await calendar.events.patch({ calendarId: auth.calendarId, eventId, requestBody: patch });
    return true;
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao atualizar evento:", err);
    return false;
  }
}

// ── Cancela/deleta evento ─────────────────────────────────────
export async function cancelarEvento(empresaId: number, eventId: string): Promise<boolean> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return false;

  const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
  try {
    await calendar.events.delete({ calendarId: auth.calendarId, eventId });
    return true;
  } catch (err) {
    console.error("[GoogleCalendar] Erro ao cancelar evento:", err);
    return false;
  }
}

// ── Verifica se empresa tem Google Calendar conectado ─────────
export async function temGoogleCalendar(empresaId: number): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(
    `SELECT id FROM google_calendar_tokens WHERE empresa_id = ${empresaId} LIMIT 1`
  ) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}
