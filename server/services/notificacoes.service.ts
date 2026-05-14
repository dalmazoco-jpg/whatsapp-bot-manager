import { getDb } from "../db";
import { getSessionWhatsAppId, sendWhatsAppMessage } from "./baileys.service";
import { entregasNotificadas } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

export type TipoEvento = "agendamento" | "pedido" | "cancelamento" | "entrega" | "novo_cliente";

// ── Busca pedido aguardando resposta de entregador ─────────────
async function getPedidoAguardandoEntregador(empresaId: number, whatsappNumber: string): Promise<number | null> {
  const db = getDb();
  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, "");
  const rows = await db.execute(`
    SELECT DISTINCT pedido_id
    FROM entregas_notificadas
    WHERE entregador_whatsapp = '${cleanWhatsapp}'
    AND resposta_recebida = false
    LIMIT 1
  `) as unknown[];
  if (Array.isArray(rows) && rows.length > 0) {
    return (rows[0] as any).pedido_id || null;
  }
  return null;
}

// ── Verifica se um número é de um entregador ──────────────────
export async function isEntregador(empresaId: number, whatsappNumber: string): Promise<boolean> {
  const db = getDb();
  const rows = await db.execute(`
    SELECT id FROM contatos_notificacao
    WHERE empresa_id = ${empresaId}
    AND LOWER(TRIM(tipo)) = 'entregador'
    AND whatsapp = '${whatsappNumber.replace(/[^0-9]/g, "")}'
    AND ativo = true
  `) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

// ── Processa resposta do entregador ──────────────────────────
export async function processarRespostaEntregador(empresaId: number, whatsappNumber: string, resposta: string): Promise<{ processado: boolean; mensagem?: string }> {
  const pedidoId = await getPedidoAguardandoEntregador(empresaId, whatsappNumber);
  if (!pedidoId) {
    return { processado: false };
  }

  const db = getDb();
  const respostaLower = resposta.toLowerCase().trim();

  let respostaTipo: 'aceitou' | 'rejeitou' | null = null;
  let mensagem = '';

  // Detecta tipo de resposta
  if (respostaLower.includes('ok') || respostaLower.includes('sim') || respostaLower.includes('aceito') || respostaLower.includes('vou fazer')) {
    respostaTipo = 'aceitou';
    mensagem = '✅ Obrigado! Entrega confirmada.';
  } else if (respostaLower.includes('não') || respostaLower.includes('rejeito') || respostaLower.includes('não posso') || respostaLower.includes('ocupado')) {
    respostaTipo = 'rejeitou';
    mensagem = '❌ Entrega rejeitada. Procurando outro entregador...';

    // Busca próximo entregador
    const proximosEntregadores = await db.execute(`
      SELECT whatsapp FROM contatos_notificacao
      WHERE empresa_id = ${empresaId}
      AND LOWER(TRIM(tipo)) = 'entregador'
      AND ativo = true
      AND whatsapp <> '${whatsappNumber.replace(/[^0-9]/g, "")}'
      LIMIT 5
    `) as unknown[];

    if (Array.isArray(proximosEntregadores) && proximosEntregadores.length > 0) {
      // Busca dados do pedido para reenviar
      const pedidoData = await db.execute(`
        SELECT p.*, c.nome as cliente_nome, c.whatsapp as cliente_whatsapp
        FROM pedidos p
        LEFT JOIN clientes_whatsapp c ON c.id = p.cliente_id
        WHERE p.id = ${pedidoId}
      `) as unknown[];

      if (Array.isArray(pedidoData) && pedidoData.length > 0) {
        const pedido = pedidoData[0] as any;
        const endereco = pedido.enderecoEntrega || pedido.endereco_entrega || "Endereço não informado";
        const itens = Array.isArray(pedido.itens)
          ? pedido.itens.map((i: any) => `${i.qtd}x ${i.nome}`).join(", ")
          : "Ver pedido no sistema";
        const valor = pedido.valorTotal
          ? (pedido.valorTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—";

        const msg = templateEntregaSaindo({
          clienteNome: pedido.cliente_nome || "Cliente",
          endereco,
          pedidoId,
          itens,
          valor
        });

        // Notifica próximos entregadores
        for (const ent of proximosEntregadores as { whatsapp: string }[]) {
          const numero = formatarNumero(ent.whatsapp);
          if (numero) {
            await sendWhatsAppMessage(empresaId, numero, msg);
            await db.insert(entregasNotificadas).values({
              pedidoId,
              entregadorWhatsapp: ent.whatsapp.replace(/[^0-9]/g, ""),
              notificadoEm: new Date(),
              respostaRecebida: false,
            });
          }
        }
      }
    }
  }

  if (respostaTipo) {
    // Atualiza a notificação como respondida
    const db = getDb();
    const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, "");
    await db.update(entregasNotificadas)
      .set({
        respostaRecebida: true,
        respostaTipo,
        respostaEm: new Date(),
      })
      .where(and(
        eq(entregasNotificadas.pedidoId, pedidoId),
        eq(entregasNotificadas.entregadorWhatsapp, cleanWhatsapp)
      ));

    return { processado: true, mensagem };
  }

  return { processado: false };
}

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
  const limpo = String(numero || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!limpo) return "";
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

  const selfId = getSessionWhatsAppId(empresaId);

  for (const contato of contatos) {
    const numero = formatarNumero(contato.whatsapp);
    if (!numero) {
      console.log(`[Notificação] Ignorado contato inválido: ${contato.nome} (${contato.whatsapp})`);
      continue;
    }
    if (selfId && selfId === numero) {
      console.log(`[Notificação] Ignorado próprio número da sessão para ${contato.nome}`);
      continue;
    }
    const enviado = await sendWhatsAppMessage(empresaId, numero, mensagem);
    if (enviado) {
      console.log(`[Notificação] Enviado para ${contato.nome} (${contato.tipo}): ${mensagem.substring(0, 60)}...`);
    } else {
      console.log(`[Notificação] Falha ao enviar para ${contato.nome} (${contato.tipo}): ${numero}`);
    }
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
  taxaEntrega?: number;
  endereco: string;
  pedidoId: number;
}): string {
  const subtotal = (dados.valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const taxaEntrega = dados.taxaEntrega ? (dados.taxaEntrega / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;
  const total = ((dados.valor + (dados.taxaEntrega || 0)) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  let msg = `🛒 *Novo Pedido #${dados.pedidoId}!*\n\n`;
  msg += `👤 Cliente: ${dados.clienteNome}\n`;
  msg += `📦 Itens: ${dados.itens}\n`;
  msg += `💰 Subtotal: ${subtotal}\n`;
  if (taxaEntrega) msg += `🚚 Taxa de entrega: ${taxaEntrega}\n`;
  msg += `🔢 Total: ${total}\n`;
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
export async function notificarEntregador(empresaId: number, mensagem: string, pedidoId?: number): Promise<void> {
  const db = getDb();
  const rows = await db.execute(`
    SELECT id, nome, whatsapp, tipo, eventos
    FROM contatos_notificacao
    WHERE empresa_id = ${empresaId}
    AND ativo = true
    AND LOWER(TRIM(tipo)) = 'entregador'
    AND whatsapp IS NOT NULL
    AND whatsapp <> ''
  `) as unknown[];

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`[Entregador] Nenhum entregador cadastrado para empresa ${empresaId}`);
    return;
  }

  const selfId = getSessionWhatsAppId(empresaId);

  for (const contato of rows as ContatoNotificacao[]) {
    const numero = formatarNumero(contato.whatsapp);
    if (!numero) {
      console.log(`[Entregador] Ignorado contato com número inválido: ${contato.nome}`);
      continue;
    }
    if (selfId && selfId === numero) {
      console.log(`[Entregador] Ignorado próprio número da sessão para ${contato.nome}`);
      continue;
    }
    const enviado = await sendWhatsAppMessage(empresaId, numero, mensagem);
    if (enviado) {
      console.log(`[Entregador] ✅ Notificado: ${contato.nome} (${numero})`);

      // Registra a notificação se pedidoId foi fornecido
      if (pedidoId) {
        await db.insert(entregasNotificadas).values({
          pedidoId,
          entregadorWhatsapp: contato.whatsapp.replace(/[^0-9]/g, ""),
          notificadoEm: new Date(),
          respostaRecebida: false,
        });
      }
    } else {
      console.log(`[Entregador] ❌ Falha ao notificar: ${contato.nome} (${numero})`);
    }
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

export function templatePedidoEmPreparacao(dados: {
  clienteNome: string;
  endereco: string;
  pedidoId: number;
  itens?: string;
  valor?: string;
}): string {
  let msg = `🍔 *PEDIDO EM PREPARAÇÃO — #${dados.pedidoId}*\n\n`;
  msg += `👤 *Cliente:* ${dados.clienteNome}\n`;
  msg += `📍 *Endereço/retirada:* ${dados.endereco}\n`;
  if (dados.itens) msg += `📦 *Itens:* ${dados.itens}\n`;
  if (dados.valor) msg += `💰 *Valor:* ${dados.valor}\n`;
  msg += `\n⏱️ _Prepare a entrega/retirada. Quando sair, marque "Saiu p/ Entrega" no painel._`;
  return msg;
}
