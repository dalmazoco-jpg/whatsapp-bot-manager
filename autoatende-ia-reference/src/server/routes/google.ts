import { Express } from "express";
import { google } from "googleapis";
import { db } from "../../db.ts";
import { googleCalendarTokens } from "../../drizzle/schema.ts";
import { eq } from "drizzle-orm";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`
);

export function registerGoogleAuthRoutes(app: Express) {
  // 1. Get Auth URL
  app.get("/api/auth/google/url", (req, res) => {
    const empresaId = req.query.empresaId as string;
    if (!empresaId) return res.status(400).json({ error: "empresaId is required" });

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: empresaId // Pass empresaId in state
    });

    res.json({ url });
  });

  // 2. Callback
  app.get("/api/auth/google/callback", async (req, res) => {
    const { code, state: empresaId } = req.query as { code: string; state: string };
    
    if (!code || !empresaId) {
      return res.status(400).send("Código ou empresaId faltando");
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      // Salvar tokens no banco
      const data = {
        empresaId: parseInt(empresaId),
        googleAccountEmail: userInfo.data.email,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        tokenExpiraEm: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        updatedAt: new Date(),
      };

      // Upsert
      const existing = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.empresaId, parseInt(empresaId))).limit(1);
      
      if (existing[0]) {
        await db.update(googleCalendarTokens).set(data).where(eq(googleCalendarTokens.empresaId, parseInt(empresaId)));
      } else {
        await db.insert(googleCalendarTokens).values(data as any);
      }

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; gap: 20px;">
            <div style="color: #059669; font-size: 24px; font-weight: bold;">✓ Conectado com sucesso!</div>
            <p>Sua agenda Google Calendar foi vinculada ao BotManager.</p>
            <script>
              setTimeout(() => {
                if (window.opener) {
                  window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/agendamentos';
                }
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Erro no callback do Google:", error);
      res.status(500).send("Erro ao processar autenticação");
    }
  });
}
