import { google } from "googleapis";
import { getDb, getPlatformSettings, updatePlatformSettings } from "../db";
import { eq } from "drizzle-orm";
import { getFallbackPlatformSettings, isFallbackAuthEnabled, updateFallbackPlatformSettings } from "../fallback-store";
import { googleCalendarTokens } from "../../drizzle/schema";
import { ENV } from "../_core/env";

const DEFAULT_CALENDAR_ID = "primary";
type CalendarOAuthTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
};

function getRedirectUri() {
  return process.env.GOOGLE_REDIRECT_URI
    || `${ENV.publicAppUrl.replace(/\/$/, "")}/api/google/callback`;
}

// ── OAuth2 Client ─────────────────────────────────────────────
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri()
  );
}

export function getGoogleRedirectUri() {
  return getRedirectUri();
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

export function getGoogleLoginAuthUrl(): string {
  const oauth2 = getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state: "login",
  });
}

function isPlatformCalendar(empresaId: number) {
  return empresaId === 0;
}

async function getPlatformCalendarToken() {
  const settings = isFallbackAuthEnabled()
    ? getFallbackPlatformSettings()
    : await getPlatformSettings();
  return (((settings as any)?.configIa as any)?.googleCalendar ?? null) as {
    access_token?: string;
    refresh_token?: string;
    token_expiry?: string;
    calendar_id?: string;
  } | null;
}

async function savePlatformCalendarToken(token: {
  access_token?: string | null;
  refresh_token?: string | null;
  token_expiry?: string | null;
  calendar_id?: string | null;
}) {
  const settings = isFallbackAuthEnabled()
    ? getFallbackPlatformSettings()
    : await getPlatformSettings();
  const configIa = (((settings as any)?.configIa as any) ?? {}) as Record<string, any>;
  const current = configIa.googleCalendar ?? {};
  const nextConfigIa = {
    ...configIa,
    googleCalendar: {
      ...current,
      ...token,
      calendar_id: token.calendar_id || current.calendar_id || DEFAULT_CALENDAR_ID,
      updated_at: new Date().toISOString(),
    },
  };
  if (isFallbackAuthEnabled()) {
    updateFallbackPlatformSettings({ configIa: nextConfigIa } as any);
    return;
  }
  await updatePlatformSettings({ configIa: nextConfigIa } as any);
}

export async function saveCalendarTokens(empresaId: number, tokens: CalendarOAuthTokens): Promise<void> {
  if (isPlatformCalendar(empresaId)) {
    const current = await getPlatformCalendarToken();
    await savePlatformCalendarToken({
      access_token: tokens.access_token || current?.access_token || null,
      refresh_token: tokens.refresh_token || current?.refresh_token || null,
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : current?.token_expiry || null,
      calendar_id: current?.calendar_id || DEFAULT_CALENDAR_ID,
    });
    return;
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.empresaId, empresaId))
    .limit(1);

  const payload = {
    empresaId,
    accessToken: tokens.access_token || existing[0]?.accessToken || null,
    refreshToken: tokens.refresh_token || existing[0]?.refreshToken || null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : existing[0]?.tokenExpiry || null,
    calendarId: existing[0]?.calendarId || DEFAULT_CALENDAR_ID,
    updatedAt: new Date(),
  };

  await db
    .insert(googleCalendarTokens)
    .values(payload)
    .onConflictDoUpdate({
      target: googleCalendarTokens.empresaId,
      set: {
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        tokenExpiry: payload.tokenExpiry,
        calendarId: payload.calendarId,
        updatedAt: payload.updatedAt,
      },
    });
}

// ── Salva tokens no banco ─────────────────────────────────────
export async function saveTokens(empresaId: number, code: string): Promise<void> {
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  await saveCalendarTokens(empresaId, tokens);
}

// ── Carrega cliente autenticado para uma empresa ──────────────
export async function getAuthenticatedClient(empresaId: number) {
  if (isPlatformCalendar(empresaId)) {
    const token = await getPlatformCalendarToken();
    if (!token?.access_token && !token?.refresh_token) return null;

    const oauth2 = getOAuth2Client();
    oauth2.setCredentials({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expiry_date: token.token_expiry ? new Date(token.token_expiry).getTime() : undefined,
    });

    oauth2.on("tokens", async (newTokens) => {
      await savePlatformCalendarToken({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token || token.refresh_token,
        token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : token.token_expiry,
        calendar_id: token.calendar_id || "primary",
      });
    });

    return { oauth2, calendarId: token.calendar_id || DEFAULT_CALENDAR_ID };
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(googleCalendarTokens)
    .where(eq(googleCalendarTokens.empresaId, empresaId))
    .limit(1);

  if (rows.length === 0) return null;
  const token = rows[0];
  if (!token.accessToken && !token.refreshToken) return null;

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    access_token: token.accessToken || undefined,
    refresh_token: token.refreshToken || undefined,
    expiry_date: token.tokenExpiry ? new Date(token.tokenExpiry).getTime() : undefined,
  });

  // Auto-refresh se expirado
  oauth2.on("tokens", async (newTokens) => {
    await db
      .update(googleCalendarTokens)
      .set({
        accessToken: newTokens.access_token || token.accessToken,
        refreshToken: newTokens.refresh_token || token.refreshToken,
        tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : token.tokenExpiry,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarTokens.empresaId, empresaId));
  });

  return { oauth2, calendarId: token.calendarId || DEFAULT_CALENDAR_ID };
}

export async function validarGoogleCalendar(empresaId: number): Promise<{ conectado: boolean; error?: string; calendarId?: string }> {
  const auth = await getAuthenticatedClient(empresaId);
  if (!auth) return { conectado: false };

  try {
    const calendar = google.calendar({ version: "v3", auth: auth.oauth2 });
    await calendar.calendars.get({ calendarId: auth.calendarId });
    return { conectado: true, calendarId: auth.calendarId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[GoogleCalendar] Token inválido ou sem permissão:", message);
    return { conectado: false, error: message, calendarId: auth.calendarId };
  }
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
      meetLink: response.data.conferenceData?.entryPoints?.[0]?.uri ?? undefined,
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
  const status = await validarGoogleCalendar(empresaId);
  return status.conectado;
}
