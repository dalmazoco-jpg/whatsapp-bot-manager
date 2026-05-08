import { ENV } from "../_core/env";

function extensionFromMime(mimeType: string) {
  const clean = mimeType.split(";")[0]?.trim().toLowerCase();
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  return map[clean] || "ogg";
}

export async function transcribeGroqAudio(audioBuffer: Buffer, mimeType = "audio/ogg") {
  if (!ENV.groqApiKey || ENV.groqApiKey.trim().length < 10) {
    throw new Error("GROQ_API_KEY não configurada para transcrição de áudio");
  }

  const sizeMB = audioBuffer.length / (1024 * 1024);
  if (sizeMB > 25) {
    throw new Error(`Áudio muito grande para transcrição (${sizeMB.toFixed(1)}MB)`);
  }

  const formData = new FormData();
  const filename = `whatsapp-audio.${extensionFromMime(mimeType)}`;
  formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), filename);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", "pt");
  formData.append("response_format", "json");
  formData.append("temperature", "0");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.groqApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Groq Speech-to-Text falhou: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ""}`);
  }

  const result = await response.json() as { text?: string };
  const text = result.text?.trim();
  if (!text) throw new Error("Groq Speech-to-Text não retornou transcrição");
  return text;
}
