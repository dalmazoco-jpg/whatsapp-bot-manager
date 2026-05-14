import { invokeLLM, type Message, type Tool, type ToolCall } from "../_core/llm.ts";
import { getDb, getClienteByWhatsapp, getCardapioByEmpresaId, getEmpresaById, getHorariosByEmpresaId, db } from "../../db.ts";
import {
  clientesWhatsapp, mensagensLog, pedidos, agendamentos, empresas, googleCalendarTokens
} from "../../drizzle/schema.ts";
import { eq, and } from "drizzle-orm";
import { CalendarioService } from "./calendario.ts";

async function verificarDisponibilidade(empresaId: number, data: Date, duracao: number) {
  try {
    const start = data;
    const end = new Date(data.getTime() + (duracao || 60) * 60000);
    
    const dayStart = new Date(data);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(data);
    dayEnd.setHours(23,59,59,999);
    
    const events = await CalendarioService.listEvents(empresaId, dayStart, dayEnd);
    const conflicts = events.filter(e => {
      const eStart = new Date(e.start?.dateTime || e.start?.date || "");
      const eEnd = new Date(e.end?.dateTime || e.end?.date || "");
      return (start < eEnd && end > eStart);
    });
    
    return { disponivel: conflicts.length === 0, conflitos: conflicts.map(c => c.summary) };
  } catch (err) {
    console.error("Erro ao verificar disponibilidade:", err);
    return { disponivel: true, conflitos: [] }; // Fallback
  }
}

async function buscarHorariosLivres(empresaId: number, data: Date, duracao: number) {
  try {
    const dayStart = new Date(data);
    dayStart.setHours(9, 0, 0, 0); // Horário comercial padrão
    const dayEnd = new Date(data);
    dayEnd.setHours(18, 0, 0, 0);

    const events = await CalendarioService.listEvents(empresaId, dayStart, dayEnd);
    const busySlots = events.map(e => ({
      start: new Date(e.start?.dateTime || e.start?.date || ""),
      end: new Date(e.end?.dateTime || e.end?.date || "")
    }));

    const slots: string[] = [];
    let current = new Date(dayStart);
    while (current.getTime() + (duracao || 60) * 60000 <= dayEnd.getTime()) {
      const slotEnd = new Date(current.getTime() + (duracao || 60) * 60000);
      const isBusy = busySlots.some(b => current < b.end && slotEnd > b.start);
      if (!isBusy) {
        slots.push(current.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
      current = new Date(current.getTime() + 30 * 60000); // Tentar a cada 30 min
    }
    return slots;
  } catch (err) {
    return ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
  }
}

async function criarEventoIA(empresaId: number, titulo: string, desc: string, data: Date, duracao: number) {
  try {
    const res = await CalendarioService.createEvent(empresaId, {
      summary: titulo,
      description: desc,
      start: data,
      end: new Date(data.getTime() + (duracao || 60) * 60000),
    });
    return { eventId: res.id, meetLink: res.htmlLink };
  } catch (err) {
    console.error("Erro ao criar evento Google:", err);
    return { eventId: "local-only", meetLink: null };
  }
}

async function temGoogleCalendar(empresaId: number) {
  const tokens = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.empresaId, empresaId)).limit(1);
  return tokens.length > 0;
}

async function notificarContatos(empresaId: number, tipo: string, msg: string) { console.log(`[Notificação ${tipo}]: ${msg}`); }

const IA_TOOLS: Tool[] = [
  {
    type: "function",
    function: {
      name: "verificar_disponibilidade_agenda",
      description: "Verifica se um horário está disponível no Google Calendar antes de confirmar agendamento",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          hora: { type: "string", description: "Hora no formato HH:MM" },
          duracao: { type: "number", description: "Duração em minutos, padrão 60" },
        },
        required: ["data", "hora"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_horarios_livres",
      description: "Busca horários disponíveis em uma data para sugerir ao cliente",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          duracao: { type: "number", description: "Duração em minutos" },
        },
        required: ["data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_compromisso",
      description: "Cria o agendamento após confirmar data e hora disponíveis com o cliente",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título/serviço do agendamento" },
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          hora: { type: "string", description: "Hora no formato HH:MM" },
          duracao: { type: "number", description: "Duração em minutos" },
          observacoes: { type: "string", description: "Observações adicionais" },
        },
        required: ["titulo", "data", "hora"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "criar_pedido",
      description: "Cria pedido quando cliente confirmar todos os itens e endereço de entrega",
      parameters: {
        type: "object",
        properties: {
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                qtd: { type: "number" },
                observacao: { type: "string" },
              },
              required: ["nome", "qtd"],
            },
          },
          endereco: { type: "string", description: "Endereço completo de entrega" },
          observacoes: { type: "string" },
          valor_total_centavos: { type: "number", description: "Valor total em centavos" },
        },
        required: ["itens", "endereco", "valor_total_centavos"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salvar_preferencia",
      description: "Salva uma preferência do cliente (ex: sem_cebola, vegetariano, prefere_tinto)",
      parameters: {
        type: "object",
        properties: {
          chave: { type: "string", description: "Nome da preferência em snake_case" },
          valor: { type: "boolean", description: "true = gosta/tem, false = não gosta/não tem" },
        },
        required: ["chave", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "enviar_materiais_comerciais",
      description: "Envia links de folder, cardápio ou landing page da empresa quando o cliente solicitar",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["folder", "cardapio", "landing_page"], description: "Tipo de material a ser enviado" },
        },
        required: ["tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "solicitar_atendimento_humano",
      description: "Transfere a conversa para um atendente humano quando o cliente solicitar explicitamente ou estiver irritado",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string" },
        },
      },
    },
  },
];

async function buildSystemPrompt(empresaId: number, clienteNome: string, preferencias: Record<string, unknown>): Promise<string> {
  const empresa = await getEmpresaById(empresaId);
  if (!empresa) return "Você é um assistente virtual. Atenda com simpatia em português brasileiro.";

  const cardapio = await getCardapioByEmpresaId(empresaId);
  const horarios = await getHorariosByEmpresaId(empresaId);
  const temCalendar = await temGoogleCalendar(empresaId);
  const configBot = (empresa.configBot as Record<string, unknown>) || {};
  const ramo = (empresa as unknown as { ramo?: string }).ramo || empresa.tipo || "geral";
  const nomeBot = (configBot.nomeBot as string) || "Assistente";
  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  let prompt = `Você é ${nomeBot}, atendente virtual da "${empresa.nome}".\n`;
  prompt += `Ramo: ${ramo}\n\n`;

  if (empresa.slug) {
    const baseUrl = `https://ais-dev-tfxoq3zcqgyxl3r457vej6-594334575772.us-east1.run.app/public/${empresa.slug}`;
    prompt += `LINKS IMPORTANTES DA EMPRESA (Pode enviar quando solicitado):\n`;
    prompt += `- Apresentação/Folder/Landing Page: ${baseUrl}\n`;
    prompt += `- Cardápio/Produtos: ${baseUrl}\n\n`;
  }

  prompt += `REGRAS GERAIS:
- Fale sempre em português brasileiro, de forma natural e amigável
- Use emojis com moderação (máximo 2 por mensagem)
- NÃO revele que é uma IA ou robô
- Chame o cliente pelo nome quando souber: ${clienteNome !== "Cliente" ? clienteNome : "(nome ainda não coletado)"}
- Seja objetivo e direto, sem textos longos desnecessários
- Data de hoje: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}\n\n`;

  if (cardapio.length > 0) {
    const tipoCardapio = ["adega", "loja", "mercado", "distribuidora"].includes(ramo) ? "PRODUTOS" : "CARDÁPIO";
    prompt += `${tipoCardapio} DISPONÍVEL:\n`;
    const categorias = Array.from(new Set(cardapio.map((c) => c.categoria || "Geral")));
    for (const cat of categorias) {
      prompt += `\n${cat.toUpperCase()}:\n`;
      for (const item of cardapio.filter((c) => (c.categoria || "Geral") === cat && c.disponivel)) {
        const preco = (item.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        prompt += `- ${item.nome} — ${preco}`;
        if (item.descricao) prompt += ` (${item.descricao})`;
        prompt += "\n";
      }
    }
    prompt += "\n";
  }

  if (horarios.length > 0) {
    const ativos = horarios.filter(h => h.ativo);
    if (ativos.length > 0) {
      prompt += "HORÁRIOS DE ATENDIMENTO:\n";
      for (const h of ativos) {
        prompt += `- ${diasSemana[h.diaSemana]}: ${h.horaInicio} às ${h.horaFim}\n`;
      }
      prompt += "\n";
    }
  }

  if (temCalendar) {
    prompt += `AGENDA (GOOGLE CALENDAR INTEGRADO):
- Você tem acesso à agenda real do estabelecimento
- SEMPRE use verificar_disponibilidade_agenda ANTES de confirmar qualquer horário
- Se ocupado, use buscar_horarios_livres para sugerir alternativas
- Só use agendar_compromisso após o cliente confirmar o horário disponível\n\n`;
  }

  const prefs = Object.entries(preferencias);
  if (prefs.length > 0) {
    prompt += "\n\nPREFERÊNCIAS CONHECIDAS DESTE CLIENTE:\n";
    for (const [k, v] of prefs) {
      prompt += `- ${k.replace(/_/g, " ")}: ${v ? "SIM" : "NÃO"}\n`;
    }
  }

  if (configBot.promptExtra) {
    prompt += `\n\nINSTRUÇÕES EXTRAS DO ESTABELECIMENTO:\n${configBot.promptExtra}`;
  }

  return prompt;
}

async function getConversationHistory(clienteId: number, limit = 15): Promise<Message[]> {
  const msgs = await db.select().from(mensagensLog)
    .where(eq(mensagensLog.clienteId, clienteId))
    .orderBy(mensagensLog.createdAt)
    .limit(limit);

  return msgs.map((m): Message => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.conteudo,
  }));
}

async function logMessage(empresaId: number, clienteId: number, direcao: "entrada" | "saida", conteudo: string) {
  await db.insert(mensagensLog).values({
    empresaId, clienteId, direcao, conteudo, tipo: direcao === "saida" ? "ia_gerada" : "texto",
  } as any);
}

async function getOrCreateCliente(empresaId: number, whatsappNumber: string, nome: string) {
  let cliente = await getClienteByWhatsapp(empresaId, whatsappNumber);
  if (!cliente) {
    const [newCliente] = await db.insert(clientesWhatsapp).values({
      empresaId, whatsappNumber, nome, preferencias: {}, tags: ["novo"]
    } as any).returning();
    cliente = newCliente;
    notificarContatos(empresaId, "novo_cliente", `🆕 *Novo Cliente!* 👤 ${nome}`).catch(console.error);
  }
  return cliente!;
}

async function executeFunctionCall(empresaId: number, clienteId: number, clienteNome: string, toolCall: ToolCall): Promise<string> {
  const funcName = toolCall.function.name;
  let args: any = {};
  try { args = JSON.parse(toolCall.function.arguments); } catch (e) { return JSON.stringify({ error: "Invalid args" }); }

  switch (funcName) {
    case "verificar_disponibilidade_agenda": {
      const res = await verificarDisponibilidade(empresaId, new Date(`${args.data}T${args.hora}:00`), args.duracao || 60);
      return JSON.stringify(res);
    }
    case "buscar_horarios_livres": {
      const res = await buscarHorariosLivres(empresaId, new Date(args.data), args.duracao || 60);
      return JSON.stringify({ horarios: res });
    }
    case "agendar_compromisso": {
      const dataHora = new Date(`${args.data}T${args.hora}:00`);
      const duracao = args.duracao || 60;
      
      const cal = await criarEventoIA(empresaId, args.titulo, args.observacoes, dataHora, duracao);
      
      const [ag] = await db.insert(agendamentos).values({
        empresaId, 
        clienteId, 
        titulo: args.titulo, 
        inicio: dataHora, 
        fim: new Date(dataHora.getTime() + duracao * 60000),
        status: "agendado", 
        descricao: args.observacoes,
        calendarEventId: cal.eventId
      } as any).returning();
      
      return JSON.stringify({ success: true, agendamento_id: ag.id, google_link: cal.meetLink });
    }
    case "criar_pedido": {
      const [ped] = await db.insert(pedidos).values({
        empresaId, clienteId, itens: args.itens, valorTotal: args.valor_total_centavos,
        taxaEntrega: 0, status: "recebido", enderecoEntrega: args.endereco, observacoes: args.observacoes
      } as any).returning();
      return JSON.stringify({ success: true, pedido_id: ped.id });
    }
    case "salvar_preferencia": {
      const cliente = await db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.id, clienteId)).limit(1);
      const prefs = (cliente[0].preferencias as any) || {};
      prefs[args.chave] = args.valor;
      await db.update(clientesWhatsapp).set({ preferencias: prefs }).where(eq(clientesWhatsapp.id, clienteId));
      return JSON.stringify({ success: true });
    }
    case "enviar_materiais_comerciais": {
      const results = await db.select().from(empresas).where(eq(empresas.id, empresaId)).limit(1);
      const empresa = results[0];
      if (!empresa?.slug) return JSON.stringify({ error: "Empresa sem slug configurado" });
      const baseUrl = `https://ais-dev-tfxoq3zcqgyxl3r457vej6-594334575772.us-east1.run.app/public/${empresa.slug}`;
      return JSON.stringify({ success: true, link: baseUrl, mensagem: `Aqui está o link solicitado: ${baseUrl}` });
    }
    case "solicitar_atendimento_humano": {
      await db.update(clientesWhatsapp).set({ statusAtendimento: "humano" }).where(eq(clientesWhatsapp.id, clienteId));
      return JSON.stringify({ success: true, message: "Um atendente humano foi solicitado e assumirá em breve." });
    }
    default: return JSON.stringify({ error: "Func not found" });
  }
}

export async function handleIncomingMessage(empresaId: number, whatsappNumber: string, senderName: string, text: string): Promise<string | null> {
  const cliente = await getOrCreateCliente(empresaId, whatsappNumber, senderName);
  
  // Se estiver em atendimento humano, a IA não responde
  if (cliente.statusAtendimento === "humano") return null;

  await db.update(clientesWhatsapp).set({ ultimaInteracao: new Date() }).where(eq(clientesWhatsapp.id, cliente.id));
  await logMessage(empresaId, cliente.id, "entrada", text);

  // Detecção simples de palavras chave para transbordo
  const triggerHumano = ["humano", "atendente", "pessoa", "falar com alguém", "gerente"].some(w => text.toLowerCase().includes(w));
  if (triggerHumano) {
    await db.update(clientesWhatsapp).set({ statusAtendimento: "humano" }).where(eq(clientesWhatsapp.id, cliente.id));
    return "Entendido. Estou transferindo você para um dos nossos atendentes humanos. Por favor, aguarde um momento.";
  }

  const history = await getConversationHistory(cliente.id);
  const sysPrompt = await buildSystemPrompt(empresaId, cliente.nome, (cliente.preferencias as any) || {});

  const messages: Message[] = [
    { role: "system", content: sysPrompt },
    ...history,
    { role: "user", content: text }
  ];

  const response = await invokeLLM({ messages, tools: IA_TOOLS });
  let msg = response.choices[0].message;

  if (msg.tool_calls && msg.tool_calls.length > 0) {
    for (const tc of msg.tool_calls) {
      const result = await executeFunctionCall(empresaId, cliente.id, cliente.nome, tc);
      messages.push({ role: "assistant", content: msg.content, tool_calls: [tc] });
      messages.push({ role: "tool", content: result, tool_call_id: tc.id, name: tc.function.name });
    }
    const finalRes = await invokeLLM({ messages, tools: IA_TOOLS });
    msg = finalRes.choices[0].message;
  }

  const resposta = msg.content || "Desculpe, tive um problema.";
  await logMessage(empresaId, cliente.id, "saida", resposta);
  return resposta;
}
