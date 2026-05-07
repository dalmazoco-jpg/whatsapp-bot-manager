import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { verifyToken } from "../auth";
import { ENV } from "../_core/env";
import { empresas, faturas, licencas, pagamentos, planos } from "../../drizzle/schema";
import { addMonths, getPlanoSaas, PLANOS_SAAS } from "../../shared/billing";
import { MASTER_ADMIN_EMAIL } from "../../shared/platform";
import {
  getFallbackEmpresaById,
  isFallbackAuthEnabled,
  listFallbackEmpresas,
  updateFallbackEmpresaLicenca,
  updateFallbackEmpresaModules,
} from "../fallback-store";

type MemoryFatura = {
  id: number;
  empresaId: number | null;
  planoId: string;
  tipo: string;
  valor: number;
  status: "pendente" | "pago" | "vencido" | "cancelado";
  dataVencimento: Date;
  dataPagamento: Date | null;
  gateway: "infinitepay";
  orderNsu: string;
  slug: string | null;
  transactionId: string | null;
  paymentLink: string | null;
  nfStatus: "pendente";
  nfUrl: string | null;
  createdAt: Date;
};

let nextFaturaId = 1;
const memoryFaturas: MemoryFatura[] = [];

function getPayload(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.app_session_token;
  return token ? verifyToken(token) : null;
}

function isMaster(payload: ReturnType<typeof verifyToken>) {
  return payload?.role === "admin" && payload.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
}

function requireAuth(req: Request, res: Response) {
  const payload = getPayload(req);
  if (!payload) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return payload;
}

function infinitePayLinkFromResponse(data: any) {
  return data?.payment_link || data?.url || data?.link || data?.checkout_url || data?.data?.payment_link || data?.data?.url || null;
}

function infinitePaySlugFromResponse(data: any) {
  return data?.slug || data?.data?.slug || data?.id || null;
}

function infinitePayTransactionFromResponse(data: any) {
  return data?.transaction_id || data?.transaction_nsu || data?.data?.transaction_id || data?.data?.transaction_nsu || null;
}

async function createInfinitePayLink(input: {
  handle: string;
  orderNsu: string;
  description: string;
  price: number;
}) {
  const payload = {
    handle: input.handle,
    order_nsu: input.orderNsu,
    redirect_url: `${ENV.publicAppUrl}/pagamento/sucesso`,
    webhook_url: `${ENV.publicAppUrl}/api/webhooks/infinitepay`,
    items: [
      {
        quantity: 1,
        price: input.price,
        description: input.description,
      },
    ],
  };

  const response = await fetch(`${ENV.infinitePayBaseUrl}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`InfinitePay ${response.status}: ${text}`);
  }
  return { payload, data };
}

async function checkInfinitePayPayment(input: { orderNsu: string; slug?: string | null; transactionId?: string | null }) {
  const body = {
    handle: ENV.infinitePayHandle,
    order_nsu: input.orderNsu,
    ...(input.transactionId ? { transaction_nsu: input.transactionId } : {}),
    ...(input.slug ? { slug: input.slug } : {}),
  };
  const response = await fetch(`${ENV.infinitePayBaseUrl}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`InfinitePay check ${response.status}: ${text}`);
  }
  return data;
}

function isPaidStatus(data: any) {
  const status = String(data?.status || data?.payment_status || data?.data?.status || "").toLowerCase();
  return ["paid", "approved", "confirmed", "pago", "aprovado"].includes(status) || data?.paid === true || data?.data?.paid === true;
}

async function activateLicense(empresaId: number, planoId: string, months = 1) {
  const plano = getPlanoSaas(planoId);
  const expiresAt = addMonths(new Date(), months);

  if (isFallbackAuthEnabled()) {
    updateFallbackEmpresaLicenca(empresaId, true, 30 * months);
    updateFallbackEmpresaModules(empresaId, [...plano.modules]);
    return expiresAt;
  }

  const db = getDb();
  await db.update(empresas).set({
    ativo: true,
    licencaExpira: expiresAt,
    configBot: { modules: plano.modules, planoId },
    updatedAt: new Date(),
  }).where(eq(empresas.id, empresaId));

  await db.execute(`
    INSERT INTO licencas (empresa_id, plano_id, licenca_ativa, licenca_expira, updated_at)
    VALUES (${empresaId}, '${planoId}', true, '${expiresAt.toISOString()}', NOW())
    ON CONFLICT (empresa_id) DO UPDATE SET
      plano_id = EXCLUDED.plano_id,
      licenca_ativa = true,
      licenca_expira = EXCLUDED.licenca_expira,
      updated_at = NOW()
  `);
  return expiresAt;
}

async function createMemoryFatura(input: {
  empresaId: number | null;
  planoId: string;
  tipo: string;
  valor: number;
  orderNsu: string;
  paymentLink: string | null;
  slug: string | null;
  transactionId: string | null;
}) {
  const fatura: MemoryFatura = {
    id: nextFaturaId++,
    empresaId: input.empresaId,
    planoId: input.planoId,
    tipo: input.tipo,
    valor: input.valor,
    status: "pendente",
    dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dataPagamento: null,
    gateway: "infinitepay",
    orderNsu: input.orderNsu,
    slug: input.slug,
    transactionId: input.transactionId,
    paymentLink: input.paymentLink,
    nfStatus: "pendente",
    nfUrl: null,
    createdAt: new Date(),
  };
  memoryFaturas.unshift(fatura);
  return fatura;
}

function findMemoryFatura(input: { faturaId?: number; slug?: string; transactionId?: string; orderNsu?: string }) {
  return memoryFaturas.find((item) =>
    (!!input.faturaId && item.id === input.faturaId) ||
    (!!input.slug && item.slug === input.slug) ||
    (!!input.transactionId && item.transactionId === input.transactionId) ||
    (!!input.orderNsu && item.orderNsu === input.orderNsu)
  );
}

async function applyPaidFatura(fatura: any, paymentPayload: any) {
  const transactionNsu = paymentPayload?.transaction_nsu || paymentPayload?.transaction_id || paymentPayload?.data?.transaction_nsu || fatura.transactionId;
  const receiptUrl = paymentPayload?.receipt_url || paymentPayload?.data?.receipt_url || fatura.receiptUrl || null;
  const paidAmount = Number(paymentPayload?.paid_amount ?? paymentPayload?.amount ?? paymentPayload?.data?.paid_amount ?? fatura.valor);

  if (isFallbackAuthEnabled()) {
    fatura.status = "pago";
    fatura.dataPagamento = fatura.dataPagamento ?? new Date();
    fatura.transactionId = transactionNsu ?? fatura.transactionId;
    fatura.receiptUrl = receiptUrl;
    if (fatura.empresaId) await activateLicense(fatura.empresaId, fatura.planoId || "inicial");
    return fatura;
  }

  const db = getDb();
  await db.update(faturas).set({
    status: "pago",
    dataPagamento: new Date(),
    transactionId: transactionNsu,
    receiptUrl,
    updatedAt: new Date(),
    metadata: { payment: paymentPayload },
  }).where(eq(faturas.id, fatura.id));
  await db.insert(pagamentos).values({
    faturaId: fatura.id,
    empresaId: fatura.empresaId,
    valor: fatura.valor,
    status: "pago",
    gateway: "infinitepay",
    orderNsu: fatura.orderNsu,
    transactionId: transactionNsu,
    slug: fatura.slug,
    captureMethod: paymentPayload?.capture_method || null,
    paidAmount,
    receiptUrl,
    payload: paymentPayload,
  });
  if (fatura.empresaId) await activateLicense(fatura.empresaId, fatura.planoId || "inicial");
  return fatura;
}

export function registerPagamentosRoutes(app: Express) {
  app.get("/api/pagamentos/planos", (_req, res) => {
    res.json({ planos: PLANOS_SAAS });
  });

  app.get("/api/pagamentos/admin/resumo", async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;
    if (!isMaster(payload)) return res.status(403).json({ error: "Acesso restrito ao master admin" });

    if (isFallbackAuthEnabled()) {
      const empresasList = listFallbackEmpresas();
      const now = new Date();
      const faturamentoMensal = memoryFaturas
        .filter((f) => f.status === "pago" && f.dataPagamento && f.dataPagamento.getMonth() === now.getMonth() && f.dataPagamento.getFullYear() === now.getFullYear())
        .reduce((acc, f) => acc + f.valor, 0);
      return res.json({
        empresasAtivas: empresasList.filter((e) => e.ativo).length,
        empresasVencidas: empresasList.filter((e) => e.licencaExpira && e.licencaExpira < now).length,
        empresasVencendo: empresasList.filter((e) => e.licencaExpira && e.licencaExpira >= now && e.licencaExpira <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
        faturamentoMensal,
        faturas: memoryFaturas.slice(0, 20),
      });
    }

    const db = getDb();
    const empresasList = await db.select().from(empresas);
    const faturasList = await db.select().from(faturas).orderBy(faturas.createdAt).limit(50);
    const now = new Date();
    res.json({
      empresasAtivas: empresasList.filter((e) => e.ativo).length,
      empresasVencidas: empresasList.filter((e) => e.licencaExpira && e.licencaExpira < now).length,
      empresasVencendo: empresasList.filter((e) => e.licencaExpira && e.licencaExpira >= now && e.licencaExpira <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length,
      faturamentoMensal: faturasList.filter((f) => f.status === "pago" && f.dataPagamento && f.dataPagamento.getMonth() === now.getMonth()).reduce((acc, f) => acc + f.valor, 0),
      faturas: faturasList.reverse(),
    });
  });

  app.get("/api/pagamentos/minha-licenca", async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;
    const empresaId = payload.empresaId;
    if (!empresaId) return res.json({ licencaAtiva: payload.role === "admin", plano: null, licencaExpira: null, faturas: [] });

    if (isFallbackAuthEnabled()) {
      const empresa = getFallbackEmpresaById(empresaId);
      const planoId = ((empresa?.configBot as any)?.planoId as string) || "inicial";
      return res.json({
        licencaAtiva: !!empresa?.ativo && (!empresa.licencaExpira || empresa.licencaExpira > new Date()),
        plano: getPlanoSaas(planoId),
        licencaExpira: empresa?.licencaExpira ?? null,
        faturas: memoryFaturas.filter((f) => f.empresaId === empresaId),
      });
    }

    const db = getDb();
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, empresaId)).limit(1);
    const planoId = ((empresa?.configBot as any)?.planoId as string) || "inicial";
    const historico = await db.select().from(faturas).where(eq(faturas.empresaId, empresaId)).limit(20);
    res.json({
      licencaAtiva: !!empresa?.ativo && (!empresa.licencaExpira || empresa.licencaExpira > new Date()),
      plano: getPlanoSaas(planoId),
      licencaExpira: empresa?.licencaExpira ?? null,
      faturas: historico,
    });
  });

  app.post("/api/pagamentos/criar-link", async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const planoId = req.body.plano_id || req.body.planoId || "inicial";
      const tipo = req.body.tipo || "mensalidade";
      const plano = getPlanoSaas(planoId);
      const valor = Number(req.body.valor ?? (tipo === "licenca" ? plano.licencaCentavos : plano.mensalidadeCentavos));
      const empresaId = isMaster(payload) ? (req.body.empresa_id ?? req.body.empresaId ?? null) : payload.empresaId;
      const description = req.body.description || `${tipo === "licenca" ? "Licença/instalação" : "Mensalidade"} ${plano.nome}`;
      const provisionalId = isFallbackAuthEnabled() ? nextFaturaId : Date.now();
      const orderNsu = `empresa_${empresaId || "lead"}_fatura_${provisionalId}`;

      const result = await createInfinitePayLink({
        handle: req.body.handle || ENV.infinitePayHandle,
        orderNsu,
        description,
        price: valor,
      });
      const paymentLink = infinitePayLinkFromResponse(result.data);
      const slug = infinitePaySlugFromResponse(result.data);
      const transactionId = infinitePayTransactionFromResponse(result.data);

      let fatura: any;
      if (isFallbackAuthEnabled()) {
        fatura = await createMemoryFatura({ empresaId, planoId, tipo, valor, orderNsu, paymentLink, slug, transactionId });
      } else {
        const db = getDb();
        const [created] = await db.insert(faturas).values({
          empresaId,
          planoId,
          tipo,
          valor,
          status: "pendente",
          dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gateway: "infinitepay",
          orderNsu,
          slug,
          transactionId,
          paymentLink,
          metadata: { infinitepay: result.data },
        }).returning();
        fatura = created;
      }

      res.json({ success: true, fatura, payment_link: paymentLink, slug, invoice_slug: slug, order_nsu: orderNsu, transaction_id: transactionId, infinitepay: result.data });
    } catch (error) {
      console.error("[Pagamentos] criar-link:", error);
      res.status(500).json({ error: "Erro ao criar link de pagamento", details: String(error) });
    }
  });

  app.post("/api/pagamentos/verificar", async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;

    try {
      const faturaId = Number(req.body.fatura_id ?? req.body.faturaId);
      let fatura: any = null;
      if (isFallbackAuthEnabled()) {
        fatura = findMemoryFatura({
          faturaId,
          slug: req.body.slug || req.body.invoice_slug,
          transactionId: req.body.transaction_id || req.body.transaction_nsu,
          orderNsu: req.body.order_nsu,
        });
      } else if (faturaId) {
        const db = getDb();
        fatura = (await db.select().from(faturas).where(eq(faturas.id, faturaId)).limit(1))[0];
      }
      if (!fatura) return res.status(404).json({ error: "Fatura não encontrada" });
      if (!isMaster(payload) && payload.empresaId !== fatura.empresaId) return res.status(403).json({ error: "Sem permissão" });

      const status = await checkInfinitePayPayment({ orderNsu: fatura.orderNsu, slug: fatura.slug, transactionId: fatura.transactionId });
      const paid = isPaidStatus(status);
      if (paid) {
        await applyPaidFatura(fatura, status);
      }

      res.json({ success: true, paid, status, fatura });
    } catch (error) {
      console.error("[Pagamentos] verificar:", error);
      res.status(500).json({ error: "Erro ao verificar pagamento", details: String(error) });
    }
  });

  app.post("/api/pagamentos/admin/licenca", async (req, res) => {
    const payload = requireAuth(req, res);
    if (!payload) return;
    if (!isMaster(payload)) return res.status(403).json({ error: "Acesso restrito ao master admin" });

    const empresaId = Number(req.body.empresa_id ?? req.body.empresaId);
    const action = req.body.action;
    const planoId = req.body.plano_id || req.body.planoId || "inicial";
    if (!empresaId) return res.status(400).json({ error: "empresa_id obrigatório" });

    if (action === "suspender") {
      if (isFallbackAuthEnabled()) {
        updateFallbackEmpresaLicenca(empresaId, false);
      } else {
        const db = getDb();
        await db.update(empresas).set({ ativo: false, updatedAt: new Date() }).where(eq(empresas.id, empresaId));
        await db.update(licencas).set({ licencaAtiva: false, updatedAt: new Date() }).where(eq(licencas.empresaId, empresaId));
      }
      return res.json({ success: true });
    }

    const expiresAt = await activateLicense(empresaId, planoId);
    res.json({ success: true, licenca_expira: expiresAt });
  });

  app.post(["/api/webhooks/infinitepay", "/api/pagamentos/webhook/infinitepay"], async (req, res) => {
    const body = req.body || {};
    const orderNsu = body.order_nsu;
    const invoiceSlug = body.invoice_slug || body.slug;
    const transactionNsu = body.transaction_nsu || body.transaction_id;
    const amount = Number(body.amount);

    let fatura: any = null;
    if (isFallbackAuthEnabled()) {
      fatura = findMemoryFatura({ orderNsu, slug: invoiceSlug, transactionId: transactionNsu });
    } else {
      const db = getDb();
      if (orderNsu) {
        fatura = (await db.select().from(faturas).where(eq(faturas.orderNsu, orderNsu)).limit(1))[0];
      }
    }

    if (!fatura) return res.status(400).json({ error: "order_nsu não encontrado" });
    if (Number.isFinite(amount) && amount !== Number(fatura.valor)) {
      return res.status(400).json({ error: "Valor do webhook não confere com a fatura" });
    }

    await applyPaidFatura(fatura, body);
    return res.status(200).json({ success: true });
  });
}
