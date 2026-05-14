import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMOptions {
  messages: Message[];
  tools?: Tool[];
  tool_choice?: "auto" | "none";
  temperature?: number;
}

export async function invokeLLM(options: LLMOptions) {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: options.temperature ?? 0.7,
    }
  });

  // Convert messages to Gemini format
  const systemMessage = options.messages.find(m => m.role === "system")?.content;
  const history = options.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content || "" }]
    }));

  const chat = model.startChat({
    history: history.slice(0, -1),
    systemInstruction: systemMessage,
    tools: options.tools?.map(t => ({
      functionDeclarations: [t.function]
    })) as any,
  });

  const lastMessage = history[history.length - 1]?.parts[0]?.text || "";
  const result = await chat.sendMessage(lastMessage);
  const response = result.response;
  const content = response.text();

  // Mock OpenAI response shape for compatibility with the user's logic
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content,
          tool_calls: (response as any).functionCalls?.map((fc: any, index: number) => ({
            id: `call_${index}`,
            type: "function",
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args)
            }
          })) || []
        }
      }
    ]
  };
}
