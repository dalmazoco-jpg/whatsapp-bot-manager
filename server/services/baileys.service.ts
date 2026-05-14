import makeWASocket, {
  DisconnectReason,
  WASocket,
  proto,
  AuthenticationState,
  SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
  fetchLatestBaileysVersion,
  Browsers,
  useMultiFileAuthState,
  downloadContentFromMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as QRCode from "qrcode";
import { EventEmitter } from "events";
import { getDb, getClienteByWhatsapp, getCardapioByEmpresaId, getEmpresaById } from "../db";
import {
  clientesWhatsapp, mensagensLog, sessoesWhatsapp,
  type InsertClienteWhatsapp, type InsertMensagemLog, type InsertSessaoWhatsapp,
} from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getEmpresaPixQrCodeUrl, handleIncomingMessage, setLeadIaPauseByWhatsapp, shouldSendPixQrCode } from "./ia.service";
import { handlePlatformSalesMessage } from "./platform-sales.service";
import { transcribeGroqAudio } from "./groq-speech.service";
import pino from "pino";
import { rm } from "fs/promises";
import { ENV } from "../_core/env";
import { PLATFORM_WHATSAPP_EMPRESA_ID } from "../../shared/platform";

// ── Auth State armazenado no Supabase ───────────────────────────────────────
async function useSupabaseAuthState(empresaId: number): Promise<{
  state: AuthenticationState;
  saveCreds: () => Promise<void>;
}> {
  const db = getDb();

  // Lê uma chave do banco
  async function readData(key: string): Promise<unknown | null> {
    try {
      const rows = await db.execute(
        `SELECT valor FROM baileys_auth WHERE empresa_id = ${empresaId} AND chave = '${key.replace(/'/g, "''")}'`
      );
      const data = (rows as unknown[]);
      if (!data || !Array.isArray(data) || data.length === 0) return null;
      const row = data[0] as { valor: unknown };
      return JSON.parse(JSON.stringify(row.valor), BufferJSON.reviver);
    } catch {
      return null;
    }
  }

  // Salva uma chave no banco
  async function writeData(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    await db.execute(
      `INSERT INTO baileys_auth (empresa_id, chave, valor, updated_at)
       VALUES (${empresaId}, '${key.replace(/'/g, "''")}', '${serialized.replace(/'/g, "''")}', NOW())
       ON CONFLICT (empresa_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`
    );
  }

  // Remove uma chave
  async function removeData(key: string): Promise<void> {
    await db.execute(
      `DELETE FROM baileys_auth WHERE empresa_id = ${empresaId} AND chave = '${key.replace(/'/g, "''")}'`
    );
  }

  // Carregar credenciais
  const credsRaw = await readData("creds");
  const creds = credsRaw
    ? (credsRaw as ReturnType<typeof initAuthCreds>)
    : initAuthCreds();

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: any = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          })
        );
        return data;
      },
      set: async (data: Record<string, Record<string, unknown>>) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const value = data[category][id];
            const key = `${category}-${id}`;
            tasks.push(value ? writeData(key, value) : removeData(key));
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async () => {
    await writeData("creds", state.creds);
  };

  return { state, saveCreds };
}

// ── Mapa de sockets ativos ───────────────────────────────────────────────────
const activeSockets = new Map<number, WASocket>();
const transientSessions = new Map<number, {
  status: "desconectado" | "qr_pendente" | "conectado";
  qr?: string | null;
  connectedAt?: Date | null;
}>();
export const baileysEvents = new EventEmitter();
baileysEvents.setMaxListeners(100);

function shouldUseTransientWhatsAppState(empresaId: number) {
  return empresaId === PLATFORM_WHATSAPP_EMPRESA_ID || ENV.localAuthFallback || !ENV.databaseUrl;
}

async function getAuthState(empresaId: number) {
  if (shouldUseTransientWhatsAppState(empresaId)) {
    return useMultiFileAuthState(`/tmp/bot-manager-baileys-${empresaId}`);
  }

  return useSupabaseAuthState(empresaId);
}

async function saveSessionSnapshot(
  empresaId: number,
  snapshot: {
    status: "desconectado" | "qr_pendente" | "conectado";
    qr?: string | null;
    connectedAt?: Date | null;
  }
) {
  transientSessions.set(empresaId, snapshot);
  if (shouldUseTransientWhatsAppState(empresaId)) return;

  const db = getDb();
  const existing = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.empresaId, empresaId)).limit(1);
  if (existing.length > 0) {
    await db.update(sessoesWhatsapp).set({
      status: snapshot.status,
      ultimoQr: snapshot.qr ?? null,
      connectedAt: snapshot.connectedAt ?? existing[0].connectedAt,
      updatedAt: new Date(),
    }).where(eq(sessoesWhatsapp.empresaId, empresaId));
  } else {
    await db.insert(sessoesWhatsapp).values({
      empresaId,
      status: snapshot.status,
      ultimoQr: snapshot.qr ?? null,
      connectedAt: snapshot.connectedAt ?? null,
    } as InsertSessaoWhatsapp);
  }
}

function getMessageText(message: proto.IMessage) {
  return message.conversation
    || message.extendedTextMessage?.text
    || message.imageMessage?.caption
    || message.videoMessage?.caption
    || "";
}

async function streamToBuffer(stream: AsyncIterable<Uint8Array>) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function transcribeWhatsAppAudio(message: proto.IMessage) {
  const audioMessage = message.audioMessage;
  if (!audioMessage) return "";
  const stream = await downloadContentFromMessage(audioMessage as any, "audio");
  const audioBuffer = await streamToBuffer(stream);
  return transcribeGroqAudio(audioBuffer, audioMessage.mimetype || "audio/ogg");
}

function isPauseText(text: string) {
  return /^\/?(pause|pausar|assumir)$/i.test(text.trim());
}

function isUnpauseText(text: string) {
  return /^\/?(despause|despausar|retomar|ia)$/i.test(text.trim());
}

// ── Iniciar sessão ───────────────────────────────────────────────────────────
export async function startBaileysSession(empresaId: number): Promise<void> {
  if (activeSockets.has(empresaId)) {
    console.log(`[Baileys] Sessão ${empresaId} já ativa`);
    return;
  }

  console.log(`[Baileys] Iniciando sessão para empresa ${empresaId}...`);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[Baileys] Usando WA v${version.join(".")} (isLatest: ${isLatest})`);

  const { state, saveCreds } = await getAuthState(empresaId);
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu("Chrome"),
    connectTimeoutMs: 30000,
    retryRequestDelayMs: 250,
  });

  activeSockets.set(empresaId, sock);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`[Baileys] QR gerado para empresa ${empresaId}`);
      const qrBase64 = await QRCode.toDataURL(qr, { width: 300 });

      await saveSessionSnapshot(empresaId, { status: "qr_pendente", qr: qrBase64 });

      baileysEvents.emit(`qr:${empresaId}`, { type: "qr", qr: qrBase64 });
    }

    if (connection === "open") {
      console.log(`[Baileys] Empresa ${empresaId} conectada!`);
      await saveSessionSnapshot(empresaId, { status: "conectado", qr: null, connectedAt: new Date() });
      baileysEvents.emit(`qr:${empresaId}`, { type: "connected" });
    }

    if (connection === "close") {
      const statusCode = Number((lastDisconnect?.error as Boom)?.output?.statusCode || 0);
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;

      console.log(`[Baileys] Empresa ${empresaId} desconectada (${statusCode}), reconectar: ${shouldReconnect}`);
      activeSockets.delete(empresaId);

      await saveSessionSnapshot(empresaId, { status: "desconectado", qr: null });
      baileysEvents.emit(`qr:${empresaId}`, { type: "disconnected" });

      if (statusCode === 405 || statusCode === DisconnectReason.loggedOut) {
        console.log(`[Baileys] Limpando sessão inválida/desconectada da empresa ${empresaId}...`);
        if (shouldUseTransientWhatsAppState(empresaId)) {
          await rm(`/tmp/bot-manager-baileys-${empresaId}`, { recursive: true, force: true });
        } else {
          const db = getDb();
          await db.execute(`DELETE FROM baileys_auth WHERE empresa_id = ${empresaId}`);
        }
      }

      if (shouldReconnect) {
        console.log(`[Baileys] Reconectando empresa ${empresaId} em 5s...`);
        setTimeout(() => startBaileysSession(empresaId), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (!m.messages || m.type !== "notify") return;
    for (const msg of m.messages) {
      if (!msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from || from.includes("@g.us") || from.includes("@newsletter") || from === "status@broadcast") continue;

      const textMessage = getMessageText(msg.message);
      if (msg.key.fromMe) {
        if (isPauseText(textMessage) || isUnpauseText(textMessage)) {
          const paused = isPauseText(textMessage);
          const ok = await setLeadIaPauseByWhatsapp(empresaId, from, paused, paused ? "atendente_assumiu" : "atendente_liberou");
          if (ok) {
            await sock.sendMessage(from, {
              text: paused
                ? "IA pausada para este atendimento. Você pode assumir a conversa."
                : "IA retomada para este atendimento.",
            });
          }
        }
        continue;
      }

      let text = textMessage;
      let inputType: "texto" | "audio" = "texto";
      if (!text.trim() && msg.message.audioMessage) {
        try {
          text = await transcribeWhatsAppAudio(msg.message);
          inputType = "audio";
          console.log(`[Baileys] Áudio transcrito empresa ${empresaId} ← ${from}: ${text}`);
        } catch (error) {
          console.error("[Baileys] Erro ao transcrever áudio:", error);
          await sock.sendMessage(from, { text: "Não consegui entender esse áudio. Pode enviar em texto ou gravar novamente, por favor?" });
          continue;
        }
      }

      if (!text.trim()) continue;
      const pushName = msg.pushName || "Cliente";
      console.log(`[Baileys] Empresa ${empresaId} ← ${from}: ${text}`);
      try {
        const resposta = empresaId === PLATFORM_WHATSAPP_EMPRESA_ID
          ? await handlePlatformSalesMessage(pushName, text)
          : await handleIncomingMessage(empresaId, from, pushName, text, { inputType });
        if (resposta) {
          await sock.sendMessage(from, { text: resposta });
          if (empresaId !== PLATFORM_WHATSAPP_EMPRESA_ID && shouldSendPixQrCode(resposta)) {
            const qrCodeUrl = await getEmpresaPixQrCodeUrl(empresaId);
            if (qrCodeUrl) {
              await sock.sendMessage(from, { image: { url: qrCodeUrl }, caption: "QR Code Pix" });
            }
          }
        }
      } catch (error) {
        console.error(`[Baileys] Erro ao processar mensagem:`, error);
        await sock.sendMessage(from, { text: "Desculpe, tive um problema técnico. Pode tentar novamente? 🙏" });
      }
    }
  });
}

export async function stopBaileysSession(empresaId: number): Promise<void> {
  const sock = activeSockets.get(empresaId);
  if (sock) {
    try { await sock.logout(); } catch {}
    activeSockets.delete(empresaId);
  }
  await saveSessionSnapshot(empresaId, { status: "desconectado", qr: null });
  if (shouldUseTransientWhatsAppState(empresaId)) {
    await rm(`/tmp/bot-manager-baileys-${empresaId}`, { recursive: true, force: true });
    return;
  }
  const db = getDb();
  await db.execute(`DELETE FROM baileys_auth WHERE empresa_id = ${empresaId}`);
}

export function getSessionStatus(empresaId: number): "conectado" | "desconectado" {
  return activeSockets.has(empresaId) ? "conectado" : "desconectado";
}

export function getSessionSnapshot(empresaId: number) {
  const snapshot = transientSessions.get(empresaId);
  if (activeSockets.has(empresaId)) {
    return {
      status: snapshot?.status === "qr_pendente" ? "qr_pendente" : "conectado",
      qr: snapshot?.qr ?? null,
      connectedAt: snapshot?.connectedAt ?? null,
    };
  }
  return snapshot ?? { status: "desconectado" as const, qr: null, connectedAt: null };
}

export function getSessionWhatsAppId(empresaId: number): string | null {
  const sock = activeSockets.get(empresaId);
  if (!sock) return null;
  const user = sock.user as any;
  return (user?.id || user?.jid || null) as string | null;
}

export async function sendWhatsAppMessage(empresaId: number, to: string, text: string): Promise<boolean> {
  const sock = activeSockets.get(empresaId);
  if (!sock) return false;
  try {
    const selfId = getSessionWhatsAppId(empresaId);
    if (selfId && selfId === to) {
      console.warn(`[Baileys] Ignorando envio para o próprio número da sessão: ${to}`);
      return false;
    }
    await sock.sendMessage(to, { text });
    return true;
  } catch (error) {
    console.error(`[Baileys] Erro ao enviar mensagem para ${to}:`, error);
    return false;
  }
}

export async function restoreActiveSessions(): Promise<void> {
  try {
    const db = getDb();
    const sessoes = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.status, "conectado"));
    for (const sessao of sessoes) {
      console.log(`[Baileys] Restaurando sessão empresa ${sessao.empresaId}...`);
      startBaileysSession(sessao.empresaId).catch((err) =>
        console.error(`[Baileys] Falha ao restaurar sessão ${sessao.empresaId}:`, err)
      );
    }
  } catch (error) {
    console.error("[Baileys] Erro ao restaurar sessões:", error);
  }
}
