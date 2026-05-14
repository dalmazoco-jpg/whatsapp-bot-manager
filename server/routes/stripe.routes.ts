import type { Express, Request, Response } from "express";
import { verifyToken } from "../auth";
import {
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  getCheckoutSession,
  constructEvent,
  getCustomer,
  createCustomer,
  getProducts,
  getPrices,
  getSubscriptions,
  cancelSubscription,
  getPaymentIntents,
} from "../services/stripe.service";
import { getDb } from "../db";

function getEmpresaIdFromRequest(req: Request) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.app_session_token;
  const payload = token ? verifyToken(token) : null;
  const delegatedOrEmpresaId = payload?.delegatedEmpresaId || payload?.empresaId;
  const platformMasterId = payload?.role === "admin" && payload.email?.toLowerCase() === "admin@manus.app" ? 0 : null;
  return {
    payload,
    empresaId: delegatedOrEmpresaId ?? platformMasterId,
  };
}

export function registerStripeRoutes(app: Express) {
  // POST /api/stripe/create-checkout-session — criar sessão de checkout
  app.post("/api/stripe/create-checkout-session", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });

    const { priceId, quantity, successUrl, cancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId é obrigatório" });

    try {
      const session = await createCheckoutSession({
        priceId,
        quantity,
        customerEmail: payload.email,
        metadata: { empresaId: String(empresaId) },
        successUrl,
        cancelUrl,
      });
      return res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("[Stripe] Erro ao criar checkout session:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // POST /api/stripe/create-subscription-checkout — criar sessão de checkout para assinatura
  app.post("/api/stripe/create-subscription-checkout", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });

    const { priceId, quantity, successUrl, cancelUrl } = req.body;
    if (!priceId) return res.status(400).json({ error: "priceId é obrigatório" });

    try {
      const session = await createSubscriptionCheckoutSession({
        priceId,
        quantity,
        customerEmail: payload.email,
        metadata: { empresaId: String(empresaId) },
        successUrl,
        cancelUrl,
      });
      return res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("[Stripe] Erro ao criar subscription checkout:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // GET /api/stripe/checkout-session/:sessionId — buscar sessão de checkout
  app.get("/api/stripe/checkout-session/:sessionId", async (req: Request, res: Response) => {
    const { payload } = getEmpresaIdFromRequest(req);
    if (!payload) return res.status(401).json({ error: "Não autenticado" });

    const { sessionId } = req.params;
    try {
      const session = await getCheckoutSession(sessionId);
      return res.json(session);
    } catch (error) {
      console.error("[Stripe] Erro ao buscar checkout session:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // GET /api/stripe/products — listar produtos
  app.get("/api/stripe/products", async (req: Request, res: Response) => {
    try {
      const products = await getProducts();
      return res.json({ products });
    } catch (error) {
      console.error("[Stripe] Erro ao listar produtos:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // GET /api/stripe/prices — listar preços
  app.get("/api/stripe/prices", async (req: Request, res: Response) => {
    const { productId } = req.query;
    try {
      const prices = await getPrices(productId as string);
      return res.json({ prices });
    } catch (error) {
      console.error("[Stripe] Erro ao listar preços:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // GET /api/stripe/subscriptions — listar assinaturas do cliente
  app.get("/api/stripe/subscriptions", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });

    try {
      // Primeiro buscar o customerId da empresa
      const db = getDb();
      const empresa = await db.execute(`SELECT stripe_customer_id FROM empresas WHERE id = ${empresaId}`);
      const customerId = Array.isArray(empresa) && empresa.length > 0 ? (empresa[0] as any).stripe_customer_id : null;

      if (!customerId) return res.json({ subscriptions: [] });

      const subscriptions = await getSubscriptions(customerId);
      return res.json({ subscriptions });
    } catch (error) {
      console.error("[Stripe] Erro ao listar assinaturas:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // POST /api/stripe/cancel-subscription — cancelar assinatura
  app.post("/api/stripe/cancel-subscription", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ error: "subscriptionId é obrigatório" });

    try {
      const subscription = await cancelSubscription(subscriptionId);
      return res.json({ subscription });
    } catch (error) {
      console.error("[Stripe] Erro ao cancelar assinatura:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // GET /api/stripe/payment-intents — listar pagamentos
  app.get("/api/stripe/payment-intents", async (req: Request, res: Response) => {
    const { payload, empresaId } = getEmpresaIdFromRequest(req);
    if (!payload || empresaId == null) return res.status(401).json({ error: "Não autenticado" });

    const { limit } = req.query;

    try {
      // Primeiro buscar o customerId da empresa
      const db = getDb();
      const empresa = await db.execute(`SELECT stripe_customer_id FROM empresas WHERE id = ${empresaId}`);
      const customerId = Array.isArray(empresa) && empresa.length > 0 ? (empresa[0] as any).stripe_customer_id : null;

      const paymentIntents = await getPaymentIntents(customerId, parseInt(limit as string) || 10);
      return res.json({ paymentIntents });
    } catch (error) {
      console.error("[Stripe] Erro ao listar pagamentos:", error);
      return res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // POST /api/stripe/webhook — webhook do Stripe
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error("[Stripe] Webhook secret não configurado");
      return res.status(500).json({ error: "Webhook secret não configurado" });
    }

    let event;

    try {
      event = await constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      console.error(`[Stripe] Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Processar o evento
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          console.log('[Stripe] Checkout session completed:', session.id);

          // Aqui você pode atualizar o status da empresa, ativar funcionalidades, etc.
          // Por exemplo, marcar que o pagamento foi aprovado

          break;

        case 'invoice.payment_succeeded':
          const invoice = event.data.object;
          console.log('[Stripe] Invoice payment succeeded:', invoice.id);

          // Processar pagamento de assinatura

          break;

        case 'customer.subscription.created':
          const subscription = event.data.object;
          console.log('[Stripe] Subscription created:', subscription.id);

          // Ativar funcionalidades da assinatura

          break;

        case 'customer.subscription.updated':
          const updatedSubscription = event.data.object;
          console.log('[Stripe] Subscription updated:', updatedSubscription.id);

          break;

        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object;
          console.log('[Stripe] Subscription deleted:', deletedSubscription.id);

          // Desativar funcionalidades da assinatura

          break;

        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('[Stripe] Erro ao processar webhook:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // GET /api/stripe/config — configuração pública do Stripe
  app.get("/api/stripe/config", async (req: Request, res: Response) => {
    return res.json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
  });
}