export const BILLING_STATUS = ["pendente", "pago", "vencido", "cancelado"] as const;
export type BillingStatus = (typeof BILLING_STATUS)[number];

export const PLANOS_SAAS = [
  {
    id: "inicial",
    nome: "Plano Inicial",
    licencaCentavos: 50000,
    mensalidadeCentavos: 9900,
    recursos: ["CRM básico", "Leads", "WhatsApp", "Dashboard simples"],
    modules: ["dashboard", "whatsapp", "configuracoes", "clientes"],
  },
  {
    id: "profissional",
    nome: "Plano Profissional",
    licencaCentavos: 100000,
    mensalidadeCentavos: 24900,
    recursos: ["CRM completo", "WhatsApp", "Funil", "Automações", "Relatórios"],
    modules: ["dashboard", "whatsapp", "configuracoes", "cardapio", "apresentacao", "clientes", "pedidos", "financeiro"],
  },
  {
    id: "premium",
    nome: "Plano Premium",
    licencaCentavos: 150000,
    mensalidadeCentavos: 49900,
    recursos: ["CRM completo", "IA", "WhatsApp", "Multiusuário", "Relatórios avançados", "Suporte prioritário"],
    modules: ["dashboard", "whatsapp", "configuracoes", "cardapio", "apresentacao", "clientes", "pedidos", "agendamentos", "financeiro"],
  },
] as const;

export type PlanoSaasId = (typeof PLANOS_SAAS)[number]["id"];

export function getPlanoSaas(id: string) {
  return PLANOS_SAAS.find((plano) => plano.id === id) ?? PLANOS_SAAS[0];
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}
