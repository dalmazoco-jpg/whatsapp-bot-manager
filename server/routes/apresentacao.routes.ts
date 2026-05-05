import type { Express, Request, Response } from "express";
import { getPublicApresentacaoDataBySlug } from "../db";

export function registerApresentacaoRoutes(app: Express) {
  app.get("/api/public/apresentacao/:slug", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ error: "Slug inválido" });
    }

    try {
      const data = await getPublicApresentacaoDataBySlug(slug);
      if (!data) {
        return res.status(404).json({ error: "Página não encontrada" });
      }

      return res.json(data);
    } catch (error) {
      console.error("Public apresentacao error:", error);
      return res.status(500).json({ error: "Erro ao carregar apresentação pública" });
    }
  });
}
