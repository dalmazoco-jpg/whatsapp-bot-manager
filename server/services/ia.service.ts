import { invokeLLM, type Message, type Tool, type ToolCall } from "../_core/llm";
import { getDb, getClienteByWhatsapp, getCardapioByEmpresaId, getEmpresaById, getHorariosByEmpresaId } from "../db";
import {
  clientesWhatsapp, mensagensLog, pedidos, agendamentos,
  type InsertClienteWhatsapp, type InsertMensagemLog, type InsertPedido, type InsertAgendamento,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { verificarDisponibilidade, buscarHorariosLivres, criarEvento, temGoogleCalendar } from "./google-calendar.service";
import { notificarContatos, templateNovoAgendamento, templateNovoPedido } from "./notificacoes.service";

// ── Ferramentas da IA ────────────────────────────────────────
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
];

// ── Monta o system prompt dinâmico por ramo ──────────────────
type PagamentoPixConfig = {
  chavePix?: string;
  pixCopiaCola?: string;
  nomeRecebedor?: string;
  banco?: string;
  cidade?: string;
  qrCodeUrl?: string;
  instrucoesPagamento?: string;
};

function normalizePagamentoPix(raw: unknown): PagamentoPixConfig {
  const pix = ((raw as Record<string, unknown>) || {}) as Record<string, unknown>;
  return {
    chavePix: typeof pix.chavePix === "string" ? pix.chavePix.trim() : "",
    pixCopiaCola: typeof pix.pixCopiaCola === "string" ? pix.pixCopiaCola.trim() : "",
    nomeRecebedor: typeof pix.nomeRecebedor === "string" ? pix.nomeRecebedor.trim() : "",
    banco: typeof pix.banco === "string" ? pix.banco.trim() : "",
    cidade: typeof pix.cidade === "string" ? pix.cidade.trim() : "",
    qrCodeUrl: typeof pix.qrCodeUrl === "string" ? pix.qrCodeUrl.trim() : "",
    instrucoesPagamento: typeof pix.instrucoesPagamento === "string" ? pix.instrucoesPagamento.trim() : "",
  };
}

function hasPixConfig(pix: PagamentoPixConfig) {
  return Boolean(pix.chavePix || pix.pixCopiaCola || pix.nomeRecebedor);
}

function isHumanRequest(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("atendente humano") || lower.includes("falar com atendente") || lower.includes("quero atendente") || lower === "humano";
}

function isPauseCommand(text: string) {
  return /^\/?(pause|pausar|assumir)$/i.test(text.trim());
}

function isUnpauseCommand(text: string) {
  return /^\/?(despause|despausar|retomar|ia)$/i.test(text.trim());
}

async function setClienteIaPausada(clienteId: number, paused: boolean, reason?: string) {
  const db = getDb();
  const [clienteAtual] = await db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.id, clienteId)).limit(1);
  if (!clienteAtual) return;
  const prefs = ((clienteAtual.preferencias as Record<string, unknown>) || {}) as Record<string, unknown>;
  await db.update(clientesWhatsapp).set({
    preferencias: {
      ...prefs,
      iaPausada: paused,
      iaPausadaMotivo: paused ? reason || "atendimento_humano" : null,
      iaPausadaEm: paused ? new Date().toISOString() : null,
    },
  }).where(eq(clientesWhatsapp.id, clienteId));
}

export async function setLeadIaPauseByWhatsapp(empresaId: number, whatsappNumber: string, paused: boolean, reason?: string) {
  const cliente = await getClienteByWhatsapp(empresaId, whatsappNumber);
  if (!cliente) return false;
  await setClienteIaPausada(cliente.id, paused, reason);
  return true;
}

export async function getEmpresaPixQrCodeUrl(empresaId: number) {
  const empresa = await getEmpresaById(empresaId);
  const configBot = (empresa?.configBot as Record<string, unknown>) || {};
  const pix = normalizePagamentoPix(configBot.pagamentoPix);
  return pix.qrCodeUrl || "";
}

export function shouldSendPixQrCode(text: string) {
  const lower = text.toLowerCase();
  return lower.includes("pix")
    && (lower.includes("copia e cola") || lower.includes("copia-e-cola") || lower.includes("chave pix") || lower.includes("qr code"));
}

async function buildSystemPrompt(empresaId: number, clienteNome: string, preferencias: Record<string, unknown>): Promise<string> {
  const empresa = await getEmpresaById(empresaId);
  if (!empresa) return "Você é um assistente virtual. Atenda com simpatia em português brasileiro.";

  const cardapio = await getCardapioByEmpresaId(empresaId);
  const horarios = await getHorariosByEmpresaId(empresaId);
  const temCalendar = await temGoogleCalendar(empresaId);
  const configBot = (empresa.configBot as Record<string, unknown>) || {};
  const configIa = (empresa.configIa as Record<string, unknown>) || {};
  const pagamentoPix = normalizePagamentoPix(configBot.pagamentoPix);
  const ramo = (empresa as unknown as { ramo?: string }).ramo || empresa.tipo || "geral";
  const nomeBot = (configBot.nomeBot as string) || (configIa.nomeBot as string) || "Assistente";
  const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  let prompt = `Você é ${nomeBot}, atendente virtual da "${empresa.nome}".\n`;
  prompt += `Ramo: ${ramo}\n\n`;
  prompt += `REGRAS GERAIS:
- Fale sempre em português brasileiro, de forma natural e amigável
- Use emojis com moderação (máximo 2 por mensagem)
- NÃO revele que é uma IA ou robô
- Chame o cliente pelo nome quando souber: ${clienteNome !== "Cliente" ? clienteNome : "(nome ainda não coletado)"}
- Seja objetivo e direto, com respostas curtas e úteis
- Data de hoje: ${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
- Apresente-se apenas no primeiro contato ou se o cliente perguntar quem está falando. Nunca repita apresentação em toda mensagem.
- Responda primeiro a pergunta do cliente. Depois conduza para o próximo passo: escolher item/serviço, tirar dúvida, fechar pedido ou agendar.
- Não invente preço, prazo, produto, serviço, promoção ou disponibilidade. Use somente os dados cadastrados.
- Se faltar informação para fechar, peça apenas o dado necessário no momento.
- Foco principal: fechamento do negócio do estabelecimento, sem parecer insistente.\n\n`;

  // Cardápio/Produtos
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
  } else {
    prompt += `Não há ${ramo === "adega" ? "produtos" : "cardápio"} cadastrado ainda. Informe ao cliente que em breve teremos as opções disponíveis.\n\n`;
  }

  // Horários
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

  // Google Calendar
  if (temCalendar) {
    prompt += `AGENDA (GOOGLE CALENDAR INTEGRADO):
- Você tem acesso à agenda real do estabelecimento
- SEMPRE use verificar_disponibilidade_agenda ANTES de confirmar qualquer horário
- Se ocupado, use buscar_horarios_livres para sugerir alternativas
- Só use agendar_compromisso após o cliente confirmar o horário disponível\n\n`;
  }

  prompt += `ESTRATÉGIA DE ATENDIMENTO:
- Entenda a necessidade do cliente em 1 ou 2 perguntas, no máximo.
- Quando houver produto/cardápio/serviço cadastrado, sugira a melhor opção conforme o que o cliente pediu.
- Para pedido, confirme itens, quantidade, endereço e valor antes de criar.
- Para agendamento, confirme serviço, data e horário antes de marcar.
- Se o cliente estiver pronto, finalize com uma pergunta simples de confirmação.\n\n`;

  prompt += `REGRAS DE PAGAMENTO PIX:
- Quando o cliente pedir forma de pagamento, orçamento, sinal, entrada ou fechamento, use exclusivamente os dados Pix cadastrados da empresa atual (empresa_id ${empresaId}, "${empresa.nome}").
- Nunca invente chave Pix, banco, nome do recebedor, cidade, QR Code, Pix Copia e Cola ou valor.
- Sempre confirme nome do recebedor, valor e descrição do pagamento.
- Se existir Pix Copia e Cola cadastrado, envie o Pix Copia e Cola em texto.
- Se existir QR Code Pix cadastrado, avise que o QR Code será enviado junto, mas sempre mande também o Pix Copia e Cola quando houver.
- Se os dados Pix não estiverem cadastrados, responda exatamente: "Vou solicitar os dados de pagamento corretos para a equipe responsável."\n`;

  if (hasPixConfig(pagamentoPix)) {
    prompt += `DADOS PIX DA EMPRESA ATUAL:
- Chave Pix: ${pagamentoPix.chavePix || "não cadastrada"}
- Nome do recebedor: ${pagamentoPix.nomeRecebedor || "não cadastrado"}
- Banco: ${pagamentoPix.banco || "não cadastrado"}
- Cidade: ${pagamentoPix.cidade || "não cadastrada"}
- Pix Copia e Cola: ${pagamentoPix.pixCopiaCola || "não cadastrado"}
- QR Code Pix: ${pagamentoPix.qrCodeUrl || "não cadastrado"}
- Instruções de pagamento: ${pagamentoPix.instrucoesPagamento || "não cadastradas"}\n\n`;
  } else {
    prompt += "DADOS PIX DA EMPRESA ATUAL: não cadastrados.\n\n";
  }

  // Instruções por ramo
  const instrucoesPorRamo: Record<string, string> = {
    adega: `INSTRUÇÕES PARA ADEGA:
- Sugira harmonizações: vinho + comida quando o cliente pedir indicação
- Para entregas: confirme endereço e horário preferido antes de criar o pedido
- Agendamento de entrega: use agendar_compromisso com data e horário da entrega
- Ao criar pedido, inclua todos os itens e endereço completo
- Verifique se cliente é maior de 18 anos antes de confirmar pedido de bebida alcoólica`,

    pizzaria: `INSTRUÇÕES PARA PIZZARIA:
- Confirme sabor, tamanho e tipo de borda
- Pergunte sobre bebidas antes de finalizar
- Pizza meio a meio: cobre o valor da mais cara
- Sempre pergunte o endereço de entrega antes de criar o pedido
- Use criar_pedido quando o pedido estiver completo`,

    consultorio: `INSTRUÇÕES PARA CONSULTÓRIO:
- SEMPRE verifique disponibilidade antes de sugerir horário
- Confirme nome completo e se é primeira consulta ou retorno
- Use agendar_compromisso para marcar consultas
- Seja discreto e profissional`,

    salao: `INSTRUÇÕES PARA SALÃO/BARBEARIA:
- SEMPRE verifique disponibilidade antes de confirmar horário
- Confirme serviço e profissional preferido
- Use agendar_compromisso para marcar o horário`,

    restaurante: `INSTRUÇÕES PARA RESTAURANTE:
- Apresente o cardápio de forma atrativa
- Confirme itens e endereço antes de criar pedido
- Use criar_pedido quando tudo estiver confirmado`,
  };

  prompt += instrucoesPorRamo[ramo] || `INSTRUÇÕES:
- Atenda com cordialidade e eficiência
- Para pedidos: confirme itens e endereço antes de criar o pedido
- Para agendamentos: confirme data, hora e serviço antes de agendar
- Priorize vendas: sempre que possível, mencione benefícios do produto ou serviço e conduza para o fechamento\n`;

  // Preferências do cliente
  const prefs = Object.entries(preferencias);
  if (prefs.length > 0) {
    prompt += "\n\nPREFERÊNCIAS CONHECIDAS DESTE CLIENTE (não pergunte de novo):\n";
    for (const [k, v] of prefs) {
      prompt += `- ${k.replace(/_/g, " ")}: ${v ? "SIM" : "NÃO"}\n`;
    }
  }

  const promptExtra = configBot.promptExtra || configIa.systemPrompt;
  if (promptExtra) {
    prompt += `\n\nINSTRUÇÕES EXTRAS DO ESTABELECIMENTO:\n${promptExtra}`;
  }

  return prompt;
}

// ── Busca histórico de conversa ──────────────────────────────
async function getConversationHistory(clienteId: number, limit = 15): Promise<Message[]> {
  const db = getDb();
  const msgs = await db.select().from(mensagensLog)
    .where(eq(mensagensLog.clienteId, clienteId))
    .orderBy(mensagensLog.createdAt)
    .limit(limit);

  return msgs.map((m): Message => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.conteudo,
  }));
}

// ── Salva mensagem no banco ──────────────────────────────────
async function logMessage(
  empresaId: number,
  clienteId: number,
  direcao: "entrada" | "saida",
  conteudo: string,
  tipo: "texto" | "imagem" | "audio" | "ia_gerada" = direcao === "saida" ? "ia_gerada" : "texto"
) {
  const db = getDb();
  await db.insert(mensagensLog).values({
    empresaId, clienteId, direcao, conteudo, tipo,
  } as InsertMensagemLog);
}

// ── Cria ou recupera cliente ─────────────────────────────────
async function getOrCreateCliente(empresaId: number, whatsappNumber: string, nome: string) {
  let cliente = await getClienteByWhatsapp(empresaId, whatsappNumber);
  if (!cliente) {
    const db = getDb();
    await db.insert(clientesWhatsapp).values({
      empresaId, whatsappNumber, nome, preferencias: {},
    } as InsertClienteWhatsapp);
    cliente = await getClienteByWhatsapp(empresaId, whatsappNumber);
    // Notifica proprietário sobre novo cliente
    notificarContatos(
      empresaId, "novo_cliente",
      `🆕 *Novo Cliente!*\n\n👤 ${nome}\n📱 ${whatsappNumber.replace("@s.whatsapp.net", "").replace("55", "+55 ")}\n\n_Primeiro contato pelo bot_`
    ).catch(console.error);
  }
  return cliente!;
}

// ── Executa function calls da IA ─────────────────────────────
async function executeFunctionCall(empresaId: number, clienteId: number, clienteNome: string, toolCall: ToolCall): Promise<string> {
  const funcName = toolCall.function.name;
  let args: Record<string, unknown> = {};

  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (e) {
    return JSON.stringify({ error: "Argumentos inválidos", raw: toolCall.function.arguments });
  }

  console.log(`[IA] Tool: ${funcName}`, JSON.stringify(args));
  const db = getDb();

  try {
    switch (funcName) {
      case "verificar_disponibilidade_agenda": {
        const dataHora = new Date(`${args.data}T${args.hora}:00`);
        const duracao = (args.duracao as number) || 60;
        const { disponivel, conflitos } = await verificarDisponibilidade(empresaId, dataHora, duracao);
        return JSON.stringify({
          disponivel,
          conflitos: conflitos || [],
          mensagem: disponivel
            ? `Horário ${args.hora} está disponível!`
            : `Horário ${args.hora} está ocupado. Conflitos: ${conflitos?.join(", ")}`,
        });
      }

      case "buscar_horarios_livres": {
        const data = new Date(args.data as string);
        const duracao = (args.duracao as number) || 60;
        const horarios = await buscarHorariosLivres(empresaId, data, duracao);
        return JSON.stringify({
          horarios,
          mensagem: horarios.length > 0
            ? `Horários disponíveis: ${horarios.join(", ")}`
            : "Nenhum horário disponível nesta data.",
        });
      }

      case "agendar_compromisso": {
        const dataHora = new Date(`${args.data}T${args.hora}:00`);
        const duracao = (args.duracao as number) || 60;

        const [agCriado] = await db.insert(agendamentos).values({
          empresaId, clienteId,
          titulo: args.titulo as string,
          dataHora,
          duracao,
          status: "agendado",
          descricao: (args.observacoes as string) || null,
        } as InsertAgendamento).returning();

        // Tenta criar no Google Calendar
        let googleEventId: string | undefined;
        let meetLink: string | undefined;
        try {
          const evento = await criarEvento(empresaId, args.titulo as string, `Cliente: ${clienteNome}\n${args.observacoes || ""}`, dataHora, duracao);
          if (evento) {
            googleEventId = evento.eventId;
            meetLink = evento.meetLink;
            await db.update(agendamentos).set({
              googleEventId,
              googleMeetLink: meetLink || null,
              notificacaoEnviada: true,
            }).where(eq(agendamentos.id, agCriado.id));
          }
        } catch (calErr) {
          console.error("[IA] Erro Google Calendar:", calErr);
        }

        // Notifica proprietário
        notificarContatos(empresaId, "agendamento",
          templateNovoAgendamento({ clienteNome, titulo: args.titulo as string, dataHora, duracao, meetLink })
        ).catch(console.error);

        return JSON.stringify({ success: true, agendamento_id: agCriado.id, meet_link: meetLink });
      }

      case "criar_pedido": {
        const itens = args.itens as Array<{ nome: string; qtd: number; observacao?: string }>;
        const itensStr = itens.map(i => `${i.qtd}x ${i.nome}`).join(", ");

        const [pedidoCriado] = await db.insert(pedidos).values({
          empresaId, clienteId,
          itens,
          valorTotal: (args.valor_total_centavos as number) || 0,
          taxaEntrega: 500,
          status: "recebido",
          enderecoEntrega: args.endereco as string,
          observacoes: (args.observacoes as string) || null,
        } as InsertPedido).returning();

        // Notifica proprietário
        notificarContatos(empresaId, "pedido",
          templateNovoPedido({ clienteNome, itens: itensStr, valor: (args.valor_total_centavos as number) || 0, endereco: args.endereco as string, pedidoId: pedidoCriado.id })
        ).catch(console.error);

        return JSON.stringify({ success: true, pedido_id: pedidoCriado.id, mensagem: "Pedido criado com sucesso!" });
      }

      case "salvar_preferencia": {
        const [clienteAtual] = await db.select().from(clientesWhatsapp).where(eq(clientesWhatsapp.id, clienteId)).limit(1);
        if (clienteAtual) {
          const prefs = (clienteAtual.preferencias as Record<string, unknown>) || {};
          prefs[args.chave as string] = args.valor;
          await db.update(clientesWhatsapp).set({ preferencias: prefs }).where(eq(clientesWhatsapp.id, clienteId));
        }
        return JSON.stringify({ success: true });
      }

      default:
        return JSON.stringify({ error: `Função desconhecida: ${funcName}` });
    }
  } catch (err) {
    console.error(`[IA] Erro em ${funcName}:`, err);
    return JSON.stringify({ error: String(err) });
  }
}

// ── Handler principal de mensagens ───────────────────────────
export async function handleIncomingMessage(
  empresaId: number,
  whatsappNumber: string,
  senderName: string,
  text: string,
  options: { inputType?: "texto" | "audio" } = {}
): Promise<string> {
  console.log(`[IA] Empresa ${empresaId} | ${whatsappNumber} | Msg: ${text}`);

  try {
    const cliente = await getOrCreateCliente(empresaId, whatsappNumber, senderName);

    // Atualiza última interação
    const db = getDb();
    await db.update(clientesWhatsapp).set({ ultimaInteracao: new Date() }).where(eq(clientesWhatsapp.id, cliente.id));

    // Log da mensagem recebida
    await logMessage(empresaId, cliente.id, "entrada", text, options.inputType || "texto");

    if (isUnpauseCommand(text)) {
      await setClienteIaPausada(cliente.id, false);
      return "IA retomada para este atendimento.";
    }

    if (isPauseCommand(text)) {
      await setClienteIaPausada(cliente.id, true, "comando_pause");
      return "IA pausada para este atendimento. Um atendente pode assumir a conversa.";
    }

    if (isHumanRequest(text)) {
      await setClienteIaPausada(cliente.id, true, "cliente_solicitou_humano");
      notificarContatos(
        empresaId,
        "novo_cliente",
        `🙋 *Cliente pediu atendente humano*\n\n👤 ${cliente.nome || senderName}\n📱 ${whatsappNumber.replace("@s.whatsapp.net", "")}\n💬 ${text}`
      ).catch(console.error);
      return "Certo, vou chamar um atendente humano para continuar seu atendimento.";
    }

    // Monta contexto
    const preferencias = (cliente.preferencias as Record<string, unknown>) || {};
    if (preferencias.iaPausada === true) {
      return "";
    }
    const systemPrompt = await buildSystemPrompt(empresaId, cliente.nome || senderName, preferencias);
    const history = await getConversationHistory(cliente.id);

    // Monta array de mensagens
    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-12), // Limita histórico para não exceder tokens
      { role: "user", content: text },
    ];

    // Chama a IA
    let response = await invokeLLM({ messages, tools: IA_TOOLS, tool_choice: "auto", temperature: 0.45 });
    let assistantMsg = response.choices[0]?.message;

    // Loop de function calling
    let maxIterations = 5;
    while (assistantMsg?.tool_calls && assistantMsg.tool_calls.length > 0 && maxIterations-- > 0) {
      // CRÍTICO: Preserva tool_calls na mensagem do assistant
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? null,
        tool_calls: assistantMsg.tool_calls,
      });

      // Executa cada tool call
      for (const toolCall of assistantMsg.tool_calls) {
        const result = await executeFunctionCall(empresaId, cliente.id, cliente.nome || senderName, toolCall);
        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
        });
      }

      // Nova chamada à IA com resultados das tools
      response = await invokeLLM({ messages, tools: IA_TOOLS, tool_choice: "auto", temperature: 0.45 });
      assistantMsg = response.choices[0]?.message;
    }

    const resposta = assistantMsg?.content?.trim() || "Desculpe, tive um problema técnico. Pode repetir sua mensagem? 🙏";

    // Log da resposta
    await logMessage(empresaId, cliente.id, "saida", resposta);

    console.log(`[IA] Resposta para ${whatsappNumber}: ${resposta.substring(0, 80)}...`);
    return resposta;

  } catch (err) {
    console.error("[IA] Erro crítico:", err);
    return "Olá! Nosso sistema está passando por uma instabilidade. Por favor, tente novamente em alguns instantes. 🙏";
  }
}
