import { ENV } from "../_core/env";
import type { Pedido, ClienteWhatsapp, Empresa } from "../../drizzle/schema";

type DeliveryPaymentMethod = "cash" | "company";

export type DeliveryWebhookPayload = {
  origin: string;
  destination: string;
  price: number;
  customerName: string;
  paymentMethod: DeliveryPaymentMethod;
};

function toReais(centavos: number) {
  return Number((centavos / 100).toFixed(2));
}

function pickPaymentMethod(pedido: Pedido): DeliveryPaymentMethod {
  const metadata = ((pedido.deliveryMetadata as Record<string, unknown>) || {}) as Record<string, unknown>;
  const deliveryPaymentBy = String(metadata.deliveryPaymentBy || "").toLowerCase();
  if (deliveryPaymentBy === "empresa" || deliveryPaymentBy === "company") return "company";
  return "cash";
}

function extractTrackingUrl(result: unknown) {
  const data = ((result as Record<string, unknown>) || {}) as Record<string, unknown>;
  return String(data.trackingUrl || data.tracking_url || data.url || data.link || "");
}

export function buildDeliveryPayload(params: {
  empresa: Empresa;
  pedido: Pedido;
  cliente: ClienteWhatsapp | null;
}): DeliveryWebhookPayload {
  const origin = params.empresa.nome || "Ponto de Coleta";
  const destination = params.pedido.enderecoEntrega || params.cliente?.endereco || "Endereço do Cliente";
  const customerName = params.cliente?.nome || "Cliente";
  return {
    origin,
    destination,
    price: toReais(params.pedido.taxaEntrega || 0),
    customerName,
    paymentMethod: pickPaymentMethod(params.pedido),
  };
}

export async function sendDeliveryWebhook(payload: DeliveryWebhookPayload) {
  if (!ENV.deliveryWebhookApiKey) {
    throw new Error("DELIVERY_WEBHOOK_API_KEY não configurada no servidor");
  }

  const response = await fetch(ENV.deliveryWebhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.deliveryWebhookApiKey,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: unknown = rawText;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(`Webhook de entrega falhou: ${response.status} ${response.statusText} ${rawText}`);
  }

  return {
    status: "enviado",
    sentAt: new Date().toISOString(),
    payload,
    response: data,
    trackingUrl: extractTrackingUrl(data),
  };
}
