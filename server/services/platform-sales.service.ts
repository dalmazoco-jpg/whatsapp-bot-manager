import { getPlatformSettings } from "../db";
import { isFallbackAuthEnabled, getFallbackPlatformSettings } from "../fallback-store";
import { invokeLLM, type Message } from "../_core/llm";
import { PLANOS_SAAS } from "../../shared/billing";

const plans = [
  {
    name: "Essencial",
    modules: "Dashboard, WhatsApp, Configurações, Itens e Clientes",
  },
  {
    name: "Vendas",
    modules: "Essencial + Pedidos, Financeiro e Apresentação",
  },
  {
    name: "Agenda Pro",
    modules: "Essencial + Agendamentos e Apresentação",
  },
  {
    name: "Completo",
    modules: "Todos os módulos liberados",
  },
];

type SalesPlan = {
  name: string;
  modules: string;
  mensalidade?: string;
  implantacao?: string;
};

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  whatsapp: "WhatsApp",
  configuracoes: "Configurações",
  clientes: "Clientes/CRM",
  cardapio: "Produtos/Catálogo",
  apresentacao: "Apresentação comercial",
  pedidos: "Pedidos",
  agendamentos: "Agenda",
  financeiro: "Financeiro",
};

function formatCurrency(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

async function getSalesPlans() {
  try {
    const settings = isFallbackAuthEnabled()
      ? getFallbackPlatformSettings()
      : await getPlatformSettings();
    const custom = Array.isArray((settings as any)?.planosCustom) ? (settings as any).planosCustom : [];
    const available = custom.filter((item: any) => item.disponivel !== false && item.nome);
    if (available.length > 0) {
      return available.map((item: any) => ({
        name: item.nome,
        modules: `${item.descricao || "Plano do CRM SaaS"} - ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((Number(item.preco) || 0) / 100)}`,
      }));
    }
  } catch (error) {
    console.warn("[platform-sales] usando planos padrão:", error);
  }
  if (PLANOS_SAAS.length > 0) {
    return PLANOS_SAAS.map((plano) => ({
      name: plano.nome,
      modules: [...plano.recursos, ...plano.modules.map((moduleId) => moduleLabels[moduleId] || moduleId)].join(", "),
      mensalidade: formatCurrency(plano.mensalidadeCentavos),
      implantacao: formatCurrency(plano.licencaCentavos),
    }));
  }
  return plans;
}

function inferRecommendedPlan(lower: string, salesPlans: SalesPlan[]) {
  if (lower.includes("agenda") || lower.includes("agendamento") || lower.includes("horário") || lower.includes("horario")) {
    return salesPlans.find((plan) => /premium|agenda|completo/i.test(plan.name)) || salesPlans.at(-1);
  }
  if (
    lower.includes("pedido") ||
    lower.includes("produto") ||
    lower.includes("catálogo") ||
    lower.includes("catalogo") ||
    lower.includes("cardápio") ||
    lower.includes("cardapio") ||
    lower.includes("adega") ||
    lower.includes("loja") ||
    lower.includes("delivery") ||
    lower.includes("financeiro")
  ) {
    return salesPlans.find((plan) => /profissional|vendas|premium|completo/i.test(plan.name)) || salesPlans[1] || salesPlans[0];
  }
  if (lower.includes("ia") || lower.includes("multi") || lower.includes("relatório") || lower.includes("relatorio")) {
    return salesPlans.find((plan) => /premium|completo/i.test(plan.name)) || salesPlans.at(-1);
  }
  return undefined;
}

function buildFallbackResponse(senderName: string, text: string, salesPlans: SalesPlan[]) {
  const lower = text.toLowerCase();
  const recommended = inferRecommendedPlan(lower, salesPlans);
  const planList = salesPlans
    .map((plan: SalesPlan) => {
      const price = plan.mensalidade ? ` | mensal ${plan.mensalidade}${plan.implantacao ? ` | implantação ${plan.implantacao}` : ""}` : "";
      return `- ${plan.name}: ${plan.modules}${price}`;
    })
    .join("\n");

  if (lower.includes("pix") || lower.includes("cart") || lower.includes("boleto") || lower.includes("pagamento")) {
    return [
      "Fechamos por Pix, cartão ou boleto.",
      "No mensal, é cobrada a implantação junto com o primeiro mês, porque o sistema é pré-pago. No anual, não cobramos implantação, mas existe fidelidade de 12 meses.",
      `Me envie nome/razão social, CPF ou CNPJ, WhatsApp, e-mail e o plano escolhido que eu preparo a contratação, ${senderName}.`,
    ].join("\n\n");
  }

  if (lower.includes("nota") || lower.includes("nf") || lower.includes("fiscal")) {
    return [
      "Sim, vamos emitir nota fiscal para o cliente.",
      "Para isso vou precisar dos dados fiscais: razão social, CNPJ, inscrição municipal se tiver, endereço completo, email financeiro e serviço contratado.",
    ].join("\n\n");
  }

  if (lower.includes("plano") || lower.includes("módulo") || lower.includes("modulo") || lower.includes("preço") || lower.includes("valor")) {
    if (recommended) {
      return [
        `Para esse caso, eu indicaria o ${recommended.name}. Ele cobre melhor essa operação: ${recommended.modules}.`,
        `No mensal, entra implantação${recommended.implantacao ? ` de ${recommended.implantacao}` : ""} + primeiro mês${recommended.mensalidade ? ` de ${recommended.mensalidade}` : ""}, tudo pré-pago. No anual, não cobra implantação, mas tem fidelidade de 12 meses.`,
        "O app libera todos os módulos na primeira semana; depois de 7 dias ficam ativos os módulos do plano contratado.",
        "Quer que eu prepare a contratação? Me envie nome/razão social, CPF/CNPJ, WhatsApp e e-mail.",
      ].join("\n\n");
    }

    return [
      "Hoje trabalhamos com planos por módulos:",
      planList,
      "Na primeira semana todos os módulos ficam liberados. Depois dos 7 dias, permanecem os módulos do plano contratado.",
      "Me diga seu tipo de negócio e o que precisa controlar: clientes, produtos, pedidos, agenda, financeiro ou apresentação. Eu indico o plano certo.",
    ].join("\n\n");
  }

  return [
    `Certo, ${senderName}. Para eu te indicar o plano correto: seu negócio vende produtos, atende por agendamento ou precisa dos dois?`,
    "O app integra WhatsApp, clientes, catálogo/produtos, pedidos, agenda, financeiro e apresentação conforme o plano.",
    "Na primeira semana todos os módulos ficam liberados; depois seguem ativos os módulos assinados.",
  ].join("\n\n");
}

function buildSalesPrompt(planList: string) {
  return `Você é o atendimento comercial da Dalmazo & Co. para vender um sistema SaaS de CRM, WhatsApp, automação e IA.

OBJETIVO
- Responder exatamente a pergunta do lead e conduzir para fechamento.
- Indicar o plano correto conforme necessidade: produtos/catálogo/pedidos, agenda, financeiro, apresentação, CRM/clientes, WhatsApp e IA.
- Ser direto, consultivo e firme, sem texto longo.

REGRAS DE CONVERSA
- Não se apresente em toda mensagem. Apresente-se só se for o primeiro contato claro ou se perguntarem quem é.
- Não diga que é IA, robô ou modelo.
- Use no máximo 2 parágrafos curtos, salvo quando o lead pedir lista de planos.
- Faça no máximo 1 pergunta por resposta.
- Responda dúvidas antes de vender.
- Não invente módulos, preços, descontos ou prazos.
- Não prometa configuração instantânea: diga que a liberação acontece pelo app/painel após contratação e confirmação.

CONDIÇÕES COMERCIAIS OBRIGATÓRIAS
- Plano mensal: cobra taxa de implantação/licenciamento + primeiro mês juntos na entrada. O sistema é pré-pago.
- Plano anual: não cobra taxa de implantação, mas tem fidelidade de 12 meses.
- Integração com app/painel: após contratar, o app libera os módulos do cliente automaticamente conforme o plano.
- Primeira semana: todos os módulos ficam liberados para o cliente conhecer/testar.
- Após 7 dias: ficam ativos somente os módulos assinados no plano.

PLANOS DISPONÍVEIS
${planList}

FECHAMENTO
- Quando o lead demonstrar interesse, peça os dados mínimos para contrato/cobrança: nome ou razão social, CPF/CNPJ, WhatsApp, e-mail e plano desejado.
- Se não souber o plano, pergunte qual rotina ele precisa resolver e recomende um plano.`;
}

export async function handlePlatformSalesMessage(senderName: string, text: string) {
  const salesPlans = await getSalesPlans();
  const planList = salesPlans
    .map((plan: SalesPlan) => {
      const valores = plan.mensalidade
        ? ` Mensalidade: ${plan.mensalidade}.${plan.implantacao ? ` Implantação no mensal: ${plan.implantacao}.` : ""}`
        : "";
      return `- ${plan.name}: ${plan.modules}.${valores}`;
    })
    .join("\n");

  const messages: Message[] = [
    { role: "system", content: buildSalesPrompt(planList) },
    { role: "user", content: `Nome do lead: ${senderName}\nMensagem: ${text}` },
  ];

  try {
    const response = await invokeLLM({ messages, temperature: 0.35, maxTokens: 650 });
    const answer = response.choices[0]?.message?.content?.trim();
    if (answer) return answer;
  } catch (error) {
    console.warn("[platform-sales] IA indisponível, usando resposta local:", error);
  }

  return buildFallbackResponse(senderName, text, salesPlans);
}
