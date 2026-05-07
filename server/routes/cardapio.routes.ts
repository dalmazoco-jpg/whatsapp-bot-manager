import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { verifyToken } from "../auth";
import { cardapioItens, type InsertCardapioItem } from "../../drizzle/schema";
import { createFallbackCardapioItem, isFallbackAuthEnabled } from "../fallback-store";

type NormalizedCardapioItem = InsertCardapioItem & {
  empresaId: number;
  categoria: string;
  nome: string;
  preco: number;
};

function getPayload(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.app_session_token;
  return token ? verifyToken(token) : null;
}

function getEffectiveEmpresaId(req: Request, res: Response) {
  const payload = getPayload(req);
  if (!payload) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }

  const empresaId = payload.delegatedEmpresaId ?? payload.empresaId ?? null;
  if (!empresaId) {
    res.status(403).json({ error: "Empresa não selecionada" });
    return null;
  }

  return empresaId;
}

function normalizeItem(input: any, empresaId: number): NormalizedCardapioItem {
  const preco = Number(input?.preco);
  if (!input?.nome || !input?.categoria || !Number.isFinite(preco) || preco <= 0) {
    throw new Error("Informe categoria, nome e preço válido");
  }

  return {
    empresaId,
    categoria: String(input.categoria).trim(),
    nome: String(input.nome).trim(),
    descricao: input.descricao ? String(input.descricao).trim() : null,
    preco: Math.round(preco),
    disponivel: input.disponivel ?? true,
  };
}

export function registerCardapioRoutes(app: Express) {
  app.post("/api/cardapio", async (req: Request, res: Response) => {
    try {
      const empresaId = getEffectiveEmpresaId(req, res);
      if (!empresaId) return;

      const item = normalizeItem(req.body, empresaId);
      if (isFallbackAuthEnabled()) {
        return res.status(201).json(createFallbackCardapioItem(item));
      }

      const db = getDb();
      const [created] = await db.insert(cardapioItens).values(item).returning();
      return res.status(201).json(created);
    } catch (error) {
      console.error("[cardapio-rest] erro ao criar item:", error);
      return res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao salvar item" });
    }
  });

  app.post("/api/cardapio/bulk", async (req: Request, res: Response) => {
    try {
      const empresaId = getEffectiveEmpresaId(req, res);
      if (!empresaId) return;

      const rawItems = Array.isArray(req.body) ? req.body : req.body?.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return res.status(400).json({ error: "Nenhum item enviado" });
      }

      const items = rawItems.map((item) => normalizeItem(item, empresaId));
      if (isFallbackAuthEnabled()) {
        const created = items.map((item) => createFallbackCardapioItem(item));
        return res.status(201).json({ success: true, count: created.length, items: created });
      }

      const db = getDb();
      const created = await db.insert(cardapioItens).values(items).returning();
      return res.status(201).json({ success: true, count: created.length, items: created });
    } catch (error) {
      console.error("[cardapio-rest] erro ao criar itens em massa:", error);
      return res.status(400).json({ error: error instanceof Error ? error.message : "Erro ao salvar itens" });
    }
  });
}
