import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool";

export type Message = {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  tool_choice?: "none" | "auto" | { type: "function"; function: { name: string } };
  maxTokens?: number;
  temperature?: number;
};

function resolveProvider(): { url: string; key: string; model: string } {
  if (ENV.groqApiKey && ENV.groqApiKey.trim().length > 10) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: ENV.groqApiKey,
      model: "llama-3.3-70b-versatile", // Melhor modelo Groq para function calling
    };
  }
  if (ENV.forgeApiKey && ENV.forgeApiKey.trim().length > 0) {
    const baseUrl = ENV.forgeApiUrl?.trim() || "https://forge.manus.im";
    return {
      url: `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`,
      key: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
    };
  }
  throw new Error("Nenhuma API key de IA configurada. Configure GROQ_API_KEY no .env");
}

// Normaliza mensagens para o formato Groq/OpenAI
function normalizeMessages(messages: Message[]): unknown[] {
  return messages.map((msg) => {
    const normalized: Record<string, unknown> = { role: msg.role };

    // Mensagem tool (resultado de function call)
    if (msg.role === "tool") {
      normalized.role = "tool";
      normalized.content = msg.content ?? "";
      normalized.tool_call_id = msg.tool_call_id;
      if (msg.name) normalized.name = msg.name;
      return normalized;
    }

    // Mensagem assistant com tool_calls
    if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
      normalized.content = msg.content ?? null;
      normalized.tool_calls = msg.tool_calls;
      return normalized;
    }

    // Mensagens normais
    normalized.content = msg.content ?? "";
    return normalized;
  });
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const provider = resolveProvider();

  const payload: Record<string, unknown> = {
    model: provider.model,
    messages: normalizeMessages(params.messages),
    max_tokens: params.maxTokens ?? 1024,
    temperature: params.temperature ?? 0.7,
  };

  if (params.tools && params.tools.length > 0) {
    payload.tools = params.tools;
    payload.tool_choice = params.tool_choice ?? "auto";
  }

  console.log(`[LLM] Chamando ${provider.model} com ${params.messages.length} mensagens`);

  const response = await fetch(provider.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] Erro ${response.status}:`, errorText);
    throw new Error(`LLM falhou: ${response.status} ${response.statusText} – ${errorText}`);
  }

  const result = await response.json() as InvokeResult;
  const finishReason = result.choices?.[0]?.finish_reason;
  console.log(`[LLM] Resposta recebida. finish_reason: ${finishReason}, tokens: ${result.usage?.total_tokens}`);
  return result;
}
