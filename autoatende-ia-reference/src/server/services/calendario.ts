import { google } from "googleapis";
import { db } from "../../db.ts";
import { googleCalendarTokens } from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";

export class CalendarioService {
  private static async getClient(empresaId: number) {
    const tokens = (await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.empresaId, empresaId)).limit(1))[0];
    
    if (!tokens) return null;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.tokenExpiraEm?.getTime(),
    });

    // Refresh token if needed
    oauth2Client.on('tokens', async (newTokens) => {
      const updateData: any = { updatedAt: new Date() };
      if (newTokens.access_token) updateData.accessToken = newTokens.access_token;
      if (newTokens.expiry_date) updateData.tokenExpiraEm = new Date(newTokens.expiry_date);
      
      await db.update(googleCalendarTokens).set(updateData).where(eq(googleCalendarTokens.empresaId, empresaId));
    });

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  static async listEvents(empresaId: number, timeMin: Date, timeMax: Date) {
    const calendar = await this.getClient(empresaId);
    if (!calendar) return [];

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    return response.data.items || [];
  }

  static async createEvent(empresaId: number, event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
  }) {
    const calendar = await this.getClient(empresaId);
    if (!calendar) throw new Error("Google Calendar não conectado");

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
      },
    });

    return response.data;
  }

  static async deleteEvent(empresaId: number, eventId: string) {
    const calendar = await this.getClient(empresaId);
    if (!calendar) throw new Error("Google Calendar não conectado");

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    });

    return { success: true };
  }
}
