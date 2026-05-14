import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion,
  BufferJSON,
  initAuthCreds,
  proto,
  Browsers,
  type ConnectionState
} from "@whiskeysockets/baileys";
import { EventEmitter } from "events";
import pino from "pino";
import QRCode from "qrcode";
import { db, getSessaoByEmpresaId } from "../../db.ts";
import * as schema from "../../drizzle/schema.ts";
import { sessoesWhatsapp, baileysAuth, empresas } from "../../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import { handleIncomingMessage } from "./ia.service.ts";
import { rm, mkdir } from "fs/promises";
import path from "path";
import fs from "fs";

export const baileysEvents = new EventEmitter();
baileysEvents.setMaxListeners(100);

interface SessionSnapshot {
  status: "desconectado" | "qr_pendente" | "conectado";
  qr: string | null;
  connectedAt: Date | null;
}

const activeSockets = new Map<number, any>();
const transientSessions = new Map<number, SessionSnapshot>();

// DB-based Auth State
async function useDbAuthState(empresaId: number) {
  async function readData(key: string) {
    const results = await db.select().from(baileysAuth)
      .where(and(eq(baileysAuth.empresaId, empresaId), eq(baileysAuth.chave, key)))
      .limit(1);
    if (results.length === 0) return null;
    return JSON.parse(JSON.stringify(results[0].valor), BufferJSON.reviver);
  }

  async function writeData(key: string, value: any) {
    const serialized = JSON.stringify(value, BufferJSON.replacer);
    const existing = await db.select().from(baileysAuth)
      .where(and(eq(baileysAuth.empresaId, empresaId), eq(baileysAuth.chave, key)))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(baileysAuth).set({ valor: JSON.parse(serialized), updatedAt: new Date() })
        .where(eq(baileysAuth.id, existing[0].id));
    } else {
      await db.insert(baileysAuth).values({
        empresaId, chave: key, valor: JSON.parse(serialized)
      });
    }
  }

  async function removeData(key: string) {
    await db.delete(baileysAuth).where(and(eq(baileysAuth.empresaId, empresaId), eq(baileysAuth.chave, key)));
  }

  const credsRaw = await readData("creds");
  const creds = credsRaw || initAuthCreds();

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: any = {};
        await Promise.all(ids.map(async id => {
          let value = await readData(`${type}-${id}`);
          if (type === "app-state-sync-key" && value) {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          data[id] = value;
        }));
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const cat in data) {
          for (const id in data[cat]) {
            const value = data[cat][id];
            tasks.push(value ? writeData(`${cat}-${id}`, value) : removeData(`${cat}-${id}`));
          }
        }
        await Promise.all(tasks);
      }
    }
  };

  return { state, saveCreds: async () => await writeData("creds", state.creds) };
}

export function getSessionStatus(empresaId: number) {
  return activeSockets.has(empresaId) ? "conectado" : "desconectado";
}

export function getSessionSnapshot(empresaId: number) {
  const s = transientSessions.get(empresaId);
  if (activeSockets.has(empresaId)) {
    return {
      status: s?.status === "qr_pendente" ? "qr_pendente" : "conectado",
      qr: s?.qr || null,
      connectedAt: s?.connectedAt || null,
    };
  }
  return s || { status: "desconectado", qr: null, connectedAt: null };
}

async function saveSessionSnapshot(empresaId: number, snapshot: SessionSnapshot) {
  transientSessions.set(empresaId, snapshot);
  
  const existing = await getSessaoByEmpresaId(empresaId);
  if (existing) {
    await db.update(sessoesWhatsapp).set({
      status: snapshot.status,
      ultimoQr: snapshot.qr,
      connectedAt: snapshot.connectedAt || existing.connectedAt,
      updatedAt: new Date(),
    }).where(eq(sessoesWhatsapp.empresaId, empresaId));
  } else {
    await db.insert(sessoesWhatsapp).values({
      empresaId, status: snapshot.status, ultimoQr: snapshot.qr, connectedAt: snapshot.connectedAt
    });
  }
}

export async function startBaileysSession(empresaId: number) {
  if (activeSockets.has(empresaId)) return;

  const { state, saveCreds } = await useDbAuthState(empresaId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }) as any,
    browser: Browsers.ubuntu("Chrome"),
  });

  activeSockets.set(empresaId, sock);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      const qrDataUrl = await QRCode.toDataURL(qr);
      await saveSessionSnapshot(empresaId, { status: "qr_pendente", qr: qrDataUrl, connectedAt: null });
      baileysEvents.emit(`qr:${empresaId}`, { type: "qr", qr: qrDataUrl });
    }

    if (connection === "open") {
      await saveSessionSnapshot(empresaId, { status: "conectado", qr: null, connectedAt: new Date() });
      baileysEvents.emit(`qr:${empresaId}`, { type: "connected" });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405;
      
      activeSockets.delete(empresaId);
      await saveSessionSnapshot(empresaId, { status: "desconectado", qr: null, connectedAt: null });
      baileysEvents.emit(`qr:${empresaId}`, { type: "disconnected" });

      if (shouldReconnect) {
        setTimeout(() => startBaileysSession(empresaId), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    if (m.type !== "notify") return;
    for (const msg of m.messages) {
      if (msg.key.fromMe || !msg.message) continue;
      
      const from = msg.key.remoteJid;
      if (!from || from.includes("@g.us")) continue;
      
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
      const pushName = msg.pushName || "Cliente";
      
      try {
        const reply = await handleIncomingMessage(empresaId, from, pushName, text);
        if (reply) {
          const empresa = await db.select().from(schema.empresas).where(eq(schema.empresas.id, empresaId)).limit(1);
          const configBot = (empresa[0]?.configBot as any) || {};
          
          if (configBot.responderAudio) {
            // Se habilitado, envia áudio (MOCKADO para MVP sem binários nativos de TTS no container)
            // No ambiente real, aqui chamaria Piper TTS ou Google TTS
            await sock.sendMessage(from, { text: reply }); // Fallback texto
            // await sock.sendMessage(from, { 
            //   audio: { url: "..." }, 
            //   mimetype: 'audio/mp4', 
            //   ptt: true 
            // }); 
          } else {
            await sock.sendMessage(from, { text: reply });
          }
        }
      } catch (err) {
        console.error("Error processing msg:", err);
      }
    }
  });
}

export async function sendMessage(empresaId: number, to: string, text: string) {
  const sock = activeSockets.get(empresaId);
  if (!sock) throw new Error("Sessão não conectada");
  await sock.sendMessage(to, { text });
}

export async function stopBaileysSession(empresaId: number) {
  const sock = activeSockets.get(empresaId);
  if (sock) {
    try { await sock.logout(); } catch {}
    activeSockets.delete(empresaId);
  }
  await saveSessionSnapshot(empresaId, { status: "desconectado", qr: null, connectedAt: null });
  await db.delete(baileysAuth).where(eq(baileysAuth.empresaId, empresaId));
}

export async function restoreActiveSessions() {
  const sessions = await db.select().from(sessoesWhatsapp).where(eq(sessoesWhatsapp.status, "conectado"));
  for (const s of sessions) {
    startBaileysSession(s.empresaId).catch(console.error);
  }
}
