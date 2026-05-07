export const MASTER_ADMIN_EMAIL = "dalmazo.co@gmail.com";
export const PLATFORM_WHATSAPP_EMPRESA_ID = 0;

export const PLATFORM_SETTINGS_ID = "dalmazo-co";

export const DEFAULT_PLATFORM_COMPANY = {
  nome: "DALMAZO & CO.",
  razaoSocial: "DENIS DALMAZO DE OLIVEIRA",
  cnpj: "61.877.802/0001-79",
  naturezaJuridica: "Empresario Individual",
  endereco: "Rua Santiago Lopes Castilho, 1211 - Jardim Primavera - Serrana/SP - CEP 14150-000",
  telefone: "(16) 99413-2480",
  whatsappNumero: "5516994132480",
  email: "imobiliariadn@gmail.com",
  cnae: "74.90-1-04 - Atividades de intermediacao e agenciamento de servicos e negocios em geral, exceto imobiliarios",
};

export const DEFAULT_CONTRACT_TEMPLATE = `CONTRATO DE PRESTACAO DE SERVICOS - DALMAZO & CO.

CONTRATADA: DENIS DALMAZO DE OLIVEIRA, nome fantasia DALMAZO & CO., CNPJ 61.877.802/0001-79, com sede na Rua Santiago Lopes Castilho, 1211, Jardim Primavera, Serrana/SP, CEP 14150-000.

CONTRATANTE: {{cliente_nome}}, inscrita no documento {{cliente_documento}}, representada por {{responsavel_nome}}.

OBJETO: disponibilizacao de acesso ao CRM SaaS, automacoes, modulos contratados e recursos vinculados ao plano {{plano_nome}}.

MODULOS LIBERADOS: {{modulos_liberados}}.

VALORES: licenca/instalacao de {{valor_licenca}} e mensalidade de {{valor_mensalidade}}, salvo condicao comercial, gratuidade ou desconto aprovado pela CONTRATADA.

PAGAMENTO: o acesso podera ser ativado mediante confirmacao de pagamento por link, Pix, cartao, boleto ou liberacao manual/gratuidade concedida pela CONTRATADA.

VIGENCIA: mensal, com renovacao condicionada ao pagamento ou autorizacao administrativa.

ASSINATURA: este contrato podera ser enviado por WhatsApp ou outro meio digital para aceite e assinatura eletronica, inclusive por Gov.br quando aplicavel.

Serrana/SP, {{data}}.`;
