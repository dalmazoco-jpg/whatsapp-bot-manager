import Stripe from 'stripe';
import { getDb } from '../db';

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error('Stripe não configurado: defina STRIPE_SECRET_KEY para usar pagamentos via Stripe');
  }

  stripeClient = new Stripe(apiKey, {
    apiVersion: '2024-06-20',
  });

  return stripeClient;
}

const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient() as any;
    const value = client[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { stripe };

// ── Tipos ─────────────────────────────────────────────────────
export interface CreateCheckoutSessionData {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  metadata?: Record<string, string>;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCustomerData {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CreateProductData {
  name: string;
  description?: string;
  images?: string[];
  metadata?: Record<string, string>;
}

export interface CreatePriceData {
  productId: string;
  unitAmount: number; // em centavos
  currency?: string;
  interval?: 'day' | 'week' | 'month' | 'year';
  metadata?: Record<string, string>;
}

// ── Clientes ──────────────────────────────────────────────────
export async function createCustomer(data: CreateCustomerData) {
  try {
    const customer = await stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: data.metadata,
    });
    return customer;
  } catch (error) {
    console.error('[Stripe] Erro ao criar cliente:', error);
    throw error;
  }
}

export async function getCustomer(customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer;
  } catch (error) {
    console.error('[Stripe] Erro ao buscar cliente:', error);
    throw error;
  }
}

export async function updateCustomer(customerId: string, data: Partial<CreateCustomerData>) {
  try {
    const customer = await stripe.customers.update(customerId, {
      email: data.email,
      name: data.name,
      metadata: data.metadata,
    });
    return customer;
  } catch (error) {
    console.error('[Stripe] Erro ao atualizar cliente:', error);
    throw error;
  }
}

// ── Produtos ──────────────────────────────────────────────────
export async function createProduct(data: CreateProductData) {
  try {
    const product = await stripe.products.create({
      name: data.name,
      description: data.description,
      images: data.images,
      metadata: data.metadata,
    });
    return product;
  } catch (error) {
    console.error('[Stripe] Erro ao criar produto:', error);
    throw error;
  }
}

export async function getProducts() {
  try {
    const products = await stripe.products.list({ active: true });
    return products.data;
  } catch (error) {
    console.error('[Stripe] Erro ao listar produtos:', error);
    throw error;
  }
}

export async function updateProduct(productId: string, data: Partial<CreateProductData>) {
  try {
    const product = await stripe.products.update(productId, {
      name: data.name,
      description: data.description,
      images: data.images,
      metadata: data.metadata,
    });
    return product;
  } catch (error) {
    console.error('[Stripe] Erro ao atualizar produto:', error);
    throw error;
  }
}

// ── Preços ────────────────────────────────────────────────────
export async function createPrice(data: CreatePriceData) {
  try {
    const price = await stripe.prices.create({
      product: data.productId,
      unit_amount: data.unitAmount,
      currency: data.currency || 'brl',
      recurring: data.interval ? { interval: data.interval } : undefined,
      metadata: data.metadata,
    });
    return price;
  } catch (error) {
    console.error('[Stripe] Erro ao criar preço:', error);
    throw error;
  }
}

export async function getPrices(productId?: string) {
  try {
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
    });
    return prices.data;
  } catch (error) {
    console.error('[Stripe] Erro ao listar preços:', error);
    throw error;
  }
}

// ── Sessões de Checkout ───────────────────────────────────────
export async function createCheckoutSession(data: CreateCheckoutSessionData) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: data.priceId,
          quantity: data.quantity || 1,
        },
      ],
      customer_email: data.customerEmail,
      metadata: data.metadata,
      mode: 'payment', // ou 'subscription' para assinaturas
      success_url: data.successUrl || `${process.env.VITE_APP_URL || 'http://localhost:5173'}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl || `${process.env.VITE_APP_URL || 'http://localhost:5173'}/pagamento/cancelado`,
    });
    return session;
  } catch (error) {
    console.error('[Stripe] Erro ao criar sessão de checkout:', error);
    throw error;
  }
}

export async function createSubscriptionCheckoutSession(data: CreateCheckoutSessionData) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: data.priceId,
          quantity: data.quantity || 1,
        },
      ],
      customer_email: data.customerEmail,
      metadata: data.metadata,
      mode: 'subscription',
      success_url: data.successUrl || `${process.env.VITE_APP_URL || 'http://localhost:5173'}/pagamento/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: data.cancelUrl || `${process.env.VITE_APP_URL || 'http://localhost:5173'}/pagamento/cancelado`,
    });
    return session;
  } catch (error) {
    console.error('[Stripe] Erro ao criar sessão de checkout para assinatura:', error);
    throw error;
  }
}

export async function getCheckoutSession(sessionId: string) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('[Stripe] Erro ao buscar sessão de checkout:', error);
    throw error;
  }
}

// ── Webhooks ──────────────────────────────────────────────────
export async function constructEvent(payload: string | Buffer, signature: string, webhookSecret: string) {
  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error) {
    console.error('[Stripe] Erro ao construir evento do webhook:', error);
    throw error;
  }
}

// ── Assinaturas ───────────────────────────────────────────────
export async function getSubscriptions(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
    });
    return subscriptions.data;
  } catch (error) {
    console.error('[Stripe] Erro ao buscar assinaturas:', error);
    throw error;
  }
}

export async function cancelSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    return subscription;
  } catch (error) {
    console.error('[Stripe] Erro ao cancelar assinatura:', error);
    throw error;
  }
}

// ── Pagamentos ────────────────────────────────────────────────
export async function getPaymentIntents(customerId?: string, limit = 10) {
  try {
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit,
    });
    return paymentIntents.data;
  } catch (error) {
    console.error('[Stripe] Erro ao buscar pagamentos:', error);
    throw error;
  }
}

export async function createPaymentIntent(amount: number, currency = 'brl', metadata?: Record<string, string>) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
    });
    return paymentIntent;
  } catch (error) {
    console.error('[Stripe] Erro ao criar payment intent:', error);
    throw error;
  }
}
