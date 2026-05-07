import type { Express, Request, Response } from "express";
import { getPublicApresentacaoDataBySlug, getPublicPlatformApresentacaoDataBySlug } from "../db";
import { getFallbackPublicApresentacaoDataBySlug, getFallbackPublicPlatformApresentacaoDataBySlug, isFallbackAuthEnabled } from "../fallback-store";
import { PLATFORM_SETTINGS_ID } from "../../shared/platform";

export function registerApresentacaoRoutes(app: Express) {
  app.get("/api/public/apresentacao/:slug", async (req: Request, res: Response) => {
    const slug = String(req.params.slug || "").trim();
    if (!slug) {
      return res.status(400).json({ error: "Slug inválido" });
    }

    try {
      const data = slug === PLATFORM_SETTINGS_ID
        ? (isFallbackAuthEnabled()
            ? getFallbackPublicPlatformApresentacaoDataBySlug(slug)
            : await getPublicPlatformApresentacaoDataBySlug(slug))
        : (isFallbackAuthEnabled()
            ? getFallbackPublicApresentacaoDataBySlug(slug)
            : await getPublicApresentacaoDataBySlug(slug));
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
