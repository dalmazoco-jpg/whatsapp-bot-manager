import type { Express, Request, Response } from "express";

// Modo local: OAuth substituído por autenticação local automática
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });

  app.get("/api/auth/local-login", (_req: Request, res: Response) => {
    res.json({ success: true, message: "Modo local ativo — login automático como admin." });
  });
}
