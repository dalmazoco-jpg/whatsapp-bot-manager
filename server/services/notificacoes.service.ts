import { getDb } from "../db";
import { sendWhatsAppMessage } from "./baileys.service";

export type TipoEvento = "agendamento" | "pedido" | "cancelamento" | "entrega" | "novo_cliente";

interface ContatoNotificacao {
  id: number;
  nome: string;
  whatsapp: string;
  tipo: string;
  eventos: string[];
}

// ── Busca contatos de notificação da empresa ──────────────────
async function getContatos(empresaId: number, evento: TipoEvento): Promise<ContatoNotificacao[]> {
  const db = getDb();
  const rows = await db.execute(`
    SELECT id, nome, whatsapp, tipo, eventos
    FROM contatos_notificacao
    WHERE empresa_id = ${empresaId}
    AND ativo = true
    AND '${evento}' = ANY(eventos)
  `) as unknown[];

  if (!Array.isArray(rows)) return [];
  return rows as ContatoNotificacao[];
}

// ── Formata número WhatsApp ───────────────────────────────────
function formatarNumero(numero: string): string {
  const limpo = numero.replace(/\D/g, "");
  if (limpo.startsWith("55")) return `${limpo}@s.whatsapp.net`;
  return `55${limpo}@s.whatsapp.net`;
}

// ── Envia notificação para todos os contatos cadastrados ──────
export async function notificarContatos(
  empresaId: number,
  evento: TipoEvento,
  mensagem: string
): Promise<void> {
  const contatos = await getContatos(empresaId, evento);
  if (contatos.length === 0) return;

  for (const contato of contatos) {
    const numero = formatarNumero(contato.whatsapp);
    await sendWhatsAppMessage(empresaId, numero, mensagem);
    console.log(`[Notificação] Enviado para ${contato.nome} (${contato.tipo}): ${mensagem.substring(0, 60)}...`);
  }
}

// ── Templates de mensagem ─────────────────────────────────────
export function templateNovoAgendamento(dados: {
  clienteNome: string;
  titulo: string;
  dataHora: Date;
  duracao: number;
  meetLink?: string;
}): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(dados.dataHora);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  }).format(dados.dataHora);

  let msg = `📅 *Novo Agendamento!*\n\n`;
  msg += `👤 Cliente: ${dados.clienteNome}\n`;
  msg += `📋 Serviço: ${dados.titulo}\n`;
  msg += `🗓️ Data: ${data}\n`;
  msg += `⏰ Hora: ${hora}\n`;
  msg += `⏱️ Duração: ${dados.duracao} minutos\n`;
  if (dados.meetLink) msg += `🔗 Link Meet: ${dados.meetLink}\n`;
  msg += `\n_Agendado pelo bot WhatsApp_`;
  return msg;
}

export function templateNovoPedido(dados: {
  clienteNome: string;
  itens: string;
  valor: number;
  endereco: string;
  pedidoId: number;
}): string {
  const valor = (dados.valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let msg = `🛒 *Novo Pedido #${dados.pedidoId}!*\n\n`;
  msg += `👤 Cliente: ${dados.clienteNome}\n`;
  msg += `📦 Itens: ${dados.itens}\n`;
  msg += `💰 Total: ${valor}\n`;
  msg += `📍 Endereço: ${dados.endereco}\n`;
  msg += `\n_Pedido recebido pelo bot WhatsApp_`;
  return msg;
}

export function templateCancelamento(dados: {
  clienteNome: string;
  titulo: string;
  dataHora: Date;
  motivo?: string;
}): string {
  const data = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  }).format(dados.dataHora);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  }).format(dados.dataHora);

  let msg = `❌ *Agendamento Cancelado*\n\n`;
  msg += `👤 Cliente: ${dados.clienteNome}\n`;
  msg += `📋 Serviço: ${dados.titulo}\n`;
  msg += `🗓️ Era em: ${data} às ${hora}\n`;
  if (dados.motivo) msg += `💬 Motivo: ${dados.motivo}\n`;
  msg += `\n_Cancelado pelo bot WhatsApp_`;
  return msg;
}

export function templateNovoCliente(dados: {
  clienteNome: string;
  whatsapp: string;
}): string {
  const numero = dados.whatsapp.replace("@s.whatsapp.net", "").replace("55", "");
  return `🆕 *Novo Cliente!*\n\n👤 ${dados.clienteNome}\n📱 WhatsApp: +55 ${numero}\n\n_Primeiro contato pelo bot_`;
}



// ── Notifica especificamente o entregador ─────────────────────
export async function notificarEntregador(empresaId: number, mensagem: string): Promise<void> {
  const db = getDb();
  const rows = await db.execute(`
    SELECT id, nome, whatsapp, tipo, eventos
    FROM contatos_notificacao
    WHERE empresa_id = ${empresaId}
    AND ativo = true
    AND tipo = 'entregador'
  `) as unknown[];

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`[Entregador] Nenhum entregador cadastrado para empresa ${empresaId}`);
    return;
  }

  for (const contato of rows as ContatoNotificacao[]) {
    const numero = formatarNumero(contato.whatsapp);
    await sendWhatsAppMessage(empresaId, numero, mensagem);
    console.log(`[Entregador] ✅ Notificado: ${contato.nome} (${numero})`);
  }
}

// ── Template para entregador (mais detalhado) ─────────────────
export function templateEntregaSaindo(dados: {
  clienteNome: string;
  endereco: string;
  pedidoId: number;
  itens?: string;
  valor?: string;
}): string {
  let msg = `🚚 *ENTREGA — Pedido #${dados.pedidoId}*\n\n`;
  msg += `👤 *Cliente:* ${dados.clienteNome}\n`;
  msg += `📍 *Endereço:* ${dados.endereco}\n`;
  if (dados.itens) msg += `📦 *Itens:* ${dados.itens}\n`;
  if (dados.valor) msg += `💰 *Valor:* ${dados.valor}\n`;
  msg += `\n⚡ _Confirme o recebimento respondendo_ *OK*`;
  return msg;
}
