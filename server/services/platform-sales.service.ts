import { getPlatformSettings } from "../db";
import { isFallbackAuthEnabled, getFallbackPlatformSettings } from "../fallback-store";

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
};

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
  return plans;
}

export async function handlePlatformSalesMessage(senderName: string, text: string) {
  const lower = text.toLowerCase();
  const salesPlans = await getSalesPlans();
  const planList = salesPlans.map((plan: SalesPlan) => `- ${plan.name}: ${plan.modules}`).join("\n");

  if (lower.includes("pix") || lower.includes("cart") || lower.includes("boleto") || lower.includes("pagamento")) {
    return [
      `Perfeito, ${senderName}! Eu consigo finalizar por Pix, cartão ou boleto.`,
      "A integração de pagamento está sendo configurada com a conta jurídica. Me envie: nome da empresa, CNPJ, email, WhatsApp e plano desejado.",
      "Assim que o pagamento estiver ativo, eu envio o link automaticamente por aqui.",
    ].join("\n\n");
  }

  if (lower.includes("nota") || lower.includes("nf") || lower.includes("fiscal")) {
    return [
      "Sim, vamos emitir nota fiscal para o cliente.",
      "Para isso vou precisar dos dados fiscais: razão social, CNPJ, inscrição municipal se tiver, endereço completo, email financeiro e serviço contratado.",
    ].join("\n\n");
  }

  if (lower.includes("plano") || lower.includes("módulo") || lower.includes("modulo") || lower.includes("preço") || lower.includes("valor")) {
    return [
      "Hoje trabalhamos com planos por módulos:",
      planList,
      "Me diga qual combina mais com sua operação que eu te ajudo a fechar.",
    ].join("\n\n");
  }

  return [
    `Olá, ${senderName}! Sou o atendimento comercial do Bot Manager.`,
    "Eu posso tirar dúvidas, apresentar planos e preparar a contratação do robô de WhatsApp para vendas e atendimento.",
    "Para começar, me diga o tipo do seu negócio e quais módulos você quer usar: pedidos, agenda, financeiro, apresentação, clientes ou catálogo.",
  ].join("\n\n");
}
