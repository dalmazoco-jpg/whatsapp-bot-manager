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
import { handleIncomingMessage } from "./ia.service";
import pino from "pino";

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
        const data: Record<string, unknown> = {};
        await Promise.all(
          ids.map(async (id) => {
            let value = await readData(`${type}-${id}`);
            if (type === "app-state-sync-key" && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          })
        );
        return data as Awaited<ReturnType<SignalDataTypeMap[keyof SignalDataTypeMap]["get"]>>;
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
export const baileysEvents = new EventEmitter();
baileysEvents.setMaxListeners(100);

// ── Iniciar sessão ───────────────────────────────────────────────────────────
export async function startBaileysSession(empresaId: number): Promise<void> {
  if (activeSockets.has(empresaId)) {
    console.log(`[Baileys] Sessão ${empresaId} já ativa`);
    return;
  }

  console.log(`[Baileys] Iniciando sessão para empresa ${empresaId}...`);

  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[Baileys] Usando WA v${version.join(".")} (isLatest: ${isLatest})`);

  const { state, saveCreds } = await useSupabaseAuthState(empresaId);
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

      const db = getDb();
      const existing = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.empresaId, empresaId)).limit(1);
      if (existing.length > 0) {
        await db.update(sessoesWhatsapp).set({ status: "qr_pendente", ultimoQr: qrBase64, updatedAt: new Date() }).where(eq(sessoesWhatsapp.empresaId, empresaId));
      } else {
        await db.insert(sessoesWhatsapp).values({ empresaId, status: "qr_pendente", ultimoQr: qrBase64 } as InsertSessaoWhatsapp);
      }

      baileysEvents.emit(`qr:${empresaId}`, { type: "qr", qr: qrBase64 });
    }

    if (connection === "open") {
      console.log(`[Baileys] Empresa ${empresaId} conectada!`);
      const db = getDb();
      await db.update(sessoesWhatsapp).set({ status: "conectado", ultimoQr: null, connectedAt: new Date(), updatedAt: new Date() }).where(eq(sessoesWhatsapp.empresaId, empresaId));
      baileysEvents.emit(`qr:${empresaId}`, { type: "connected" });
    }

    if (connection === "close") {
      const statusCode = Number((lastDisconnect?.error as Boom)?.output?.statusCode || 0);
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;

      console.log(`[Baileys] Empresa ${empresaId} desconectada (${statusCode}), reconectar: ${shouldReconnect}`);
      activeSockets.delete(empresaId);

      const db = getDb();
      await db.update(sessoesWhatsapp).set({ status: "desconectado", updatedAt: new Date() }).where(eq(sessoesWhatsapp.empresaId, empresaId));
      baileysEvents.emit(`qr:${empresaId}`, { type: "disconnected" });

      if (statusCode === 405 || statusCode === DisconnectReason.loggedOut) {
        console.log(`[Baileys] Limpando sessão inválida/desconectada da empresa ${empresaId}...`);
        await db.execute(`DELETE FROM baileys_auth WHERE empresa_id = ${empresaId}`);
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
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid;
      if (!from || from.includes("@g.us") || from.includes("@newsletter") || from === "status@broadcast") continue;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "";
      if (!text.trim()) continue;
      const pushName = msg.pushName || "Cliente";
      console.log(`[Baileys] Empresa ${empresaId} ← ${from}: ${text}`);
      try {
        const resposta = await handleIncomingMessage(empresaId, from, pushName, text);
        if (resposta) await sock.sendMessage(from, { text: resposta });
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
  // Limpar auth do banco
  const db = getDb();
  await db.execute(`DELETE FROM baileys_auth WHERE empresa_id = ${empresaId}`);
  await db.update(sessoesWhatsapp).set({ status: "desconectado", updatedAt: new Date() }).where(eq(sessoesWhatsapp.empresaId, empresaId));
}

export function getSessionStatus(empresaId: number): "conectado" | "desconectado" {
  return activeSockets.has(empresaId) ? "conectado" : "desconectado";
}

export async function sendWhatsAppMessage(empresaId: number, to: string, text: string): Promise<boolean> {
  const sock = activeSockets.get(empresaId);
  if (!sock) return false;
  try {
    await sock.sendMessage(to, { text });
    return true;
  } catch { return false; }
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
