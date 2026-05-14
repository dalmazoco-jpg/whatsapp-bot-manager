import { pgTable, serial, text, integer, boolean, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";

// Enums baseados no SQL fornecido
export const tipoEmpresaEnum = pgEnum('tipo_empresa', ['pizzaria', 'adega', 'consultorio', 'loja', 'outro']);
export const roleUsuarioEnum = pgEnum('role_usuario', ['admin', 'empresa']);
export const statusPedidoEnum = pgEnum('status_pedido', ['recebido', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado']);
export const statusAgendamentoEnum = pgEnum('status_agendamento', ['agendado', 'confirmado', 'cancelado', 'realizado']);
export const direcaoMensagemEnum = pgEnum('direcao_mensagem', ['entrada', 'saida']);
export const tipoMensagemEnum = pgEnum('tipo_mensagem', ['texto', 'imagem', 'audio', 'ia_gerada']);
export const statusWhatsappEnum = pgEnum('status_whatsapp', ['desconectado', 'qr_pendente', 'conectado']);
export const tipoNotificacaoEnum = pgEnum('tipo_notificacao', ['novo_pedido', 'novo_agendamento', 'pedido_atualizado', 'agendamento_cancelado', 'whatsapp_conectado', 'whatsapp_desconectado']);

// 1. EMPRESAS
export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").default("outro").notNull(), 
  whatsappNumero: text("whatsapp_numero"),
  ativo: boolean("ativo").default(false).notNull(),
  licencaExpira: timestamp("licenca_expira"),
  configIa: jsonb("config_ia").default({}),
  configBot: jsonb("config_bot").default({}),
  slug: text("slug").unique(),
  materiais: jsonb("materiais").default({}),
  ramo: text("ramo").default("geral"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. USUARIOS
export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome").notNull(),
  role: text("role").default("atendente").notNull(), // admin, dono, gerente, atendente, cozinha, entregador
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

// 3. CARDAPIO_ITENS
export const cardapioItens = pgTable("cardapio_itens", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  categoria: text("categoria").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: integer("preco").notNull(), // em centavos
  disponivel: boolean("disponivel").default(true).notNull(),
  imageUrl: text("image_url"),
  tempoProducao: integer("tempo_producao"), // em minutos
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 4. HORARIOS_ATENDIMENTO
export const horariosAtendimento = pgTable("horarios_atendimento", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  diaSemana: integer("dia_semana").notNull(),
  horaInicio: text("hora_inicio").notNull(),
  horaFim: text("hora_fim").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
});

// 5. CLIENTES_WHATSAPP
export const clientesWhatsapp = pgTable("clientes_whatsapp", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  whatsappNumber: text("whatsapp_number").notNull(),
  nome: text("nome").notNull(),
  endereco: text("endereco"),
  bairro: text("bairro"),
  preferencias: jsonb("preferencias").default({}),
  tags: jsonb("tags").default([]), // ["vif", "novo", "fiel"]
  statusAtendimento: text("status_atendimento").default("ia"), // ia, humano, aguardando, finalizado
  ultimaInteracao: timestamp("ultima_interacao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 6. PEDIDOS
export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id),
  itens: jsonb("itens").default([]),
  valorTotal: integer("valor_total").notNull(),
  taxaEntrega: integer("taxa_entrega").default(0).notNull(),
  status: text("status").default("recebido").notNull(),
  tipo: text("tipo").default("entrega"), // entrega, retirada, mesa
  enderecoEntrega: text("endereco_entrega"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 7. AGENDAMENTOS
export const agendamentos = pgTable("agendamentos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  clienteId: integer("cliente_id").references(() => clientesWhatsapp.id), // Mantemos para compatibilidade
  conversaId: integer("conversa_id").references(() => conversas.id),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  inicio: timestamp("inicio").notNull(),
  fim: timestamp("fim").notNull(),
  status: text("status").default("agendado").notNull(),
  servico: text("servico"),
  profissionalId: text("profissional_id"),
  canalOrigem: text("canal_origem"), // whatsapp, instagram, messenger, site
  calendarEventId: text("calendar_event_id"),
  notificacaoEnviada: boolean("notificacao_enviada").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 8. MENSAGENS_LOG
export const mensagensLog = pgTable("mensagens_log", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id),
  direcao: text("direcao").notNull(), // entrada, saida
  conteudo: text("conteudo").notNull(),
  tipo: text("tipo").default("texto").notNull(), // texto, imagem, audio, ia_gerada
  sentimento: text("sentimento"), // positivo, negativo, neutro
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 9. SESSOES_WHATSAPP
export const sessoesWhatsapp = pgTable("sessoes_whatsapp", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().unique().references(() => empresas.id),
  status: text("status").default("desconectado").notNull(),
  ultimoQr: text("ultimo_qr"),
  connectedAt: timestamp("connected_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Auth Baileys no banco
export const baileysAuth = pgTable("baileys_auth", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull(),
  chave: text("chave").notNull(),
  valor: jsonb("valor").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 10. NOTIFICACOES
export const notificacoes = pgTable("notificacoes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  tipo: text("tipo").notNull(),
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  lida: boolean("lida").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 11. ENTREGADORES
export const entregadores = pgTable("entregadores", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  nome: text("nome").notNull(),
  telefone: text("telefone"),
  whatsappNumber: text("whatsapp_number"),
  ativo: boolean("ativo").default(true),
  disponivel: boolean("disponivel").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 12. ENTREGAS
export const entregas = pgTable("entregas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  entregadorId: integer("entregador_id").references(() => entregadores.id),
  valorTaxa: integer("valor_taxa").notNull(),
  status: text("status").notNull(), // aguardando, em_transito, entregue, devolvido
  saiuAt: timestamp("saiu_at"),
  entregueAt: timestamp("entregue_at"),
});

// --- NOVAS TABELAS OMNICHANNEL E CALENDAR ---

// 18. CANAIS_EMPRESA
export const canaisEmpresa = pgTable("canais_empresa", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  tipoCanal: text("tipo_canal").notNull(), // whatsapp, instagram, messenger, site
  nome: text("nome"),
  identificadorExterno: text("identificador_externo"),
  status: text("status").default("aguardando configuração").notNull(), // conectado, desconectado, erro, aguardando configuração, token vencido
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiraEm: timestamp("token_expira_em"),
  configuracoes: jsonb("configuracoes").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 19. CONVERSAS (Omnichannel version of clients)
export const conversas = pgTable("conversas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  canal: text("canal").notNull(), // whatsapp, instagram, messenger, site
  canalContatoId: text("canal_contato_id").notNull(), // numero whatsapp, user id instagram, etc
  nomeCliente: text("nome_cliente"),
  telefone: text("telefone"),
  username: text("username"),
  statusAtendimento: text("status_atendimento").default("ia"), // ia, humano, aguardando, finalizado
  atendenteId: integer("atendente_id").references(() => usuarios.id),
  iaAtiva: boolean("ia_ativa").default(true),
  ultimaMensagem: text("ultima_mensagem"),
  ultimaInteracao: timestamp("ultima_interacao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 20. MENSAGENS (Omnichannel version of mensagens_log)
export const mensagens = pgTable("mensagens", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  conversaId: integer("conversa_id").notNull().references(() => conversas.id),
  canal: text("canal").notNull(),
  direcao: text("direcao").notNull(), // entrada, saida
  tipo: text("tipo").default("texto").notNull(), // texto, imagem, audio, video, documento
  conteudo: text("conteudo").notNull(),
  mediaUrl: text("media_url"),
  autor: text("autor").notNull(), // cliente, ia, humano, sistema
  status: text("status"), // pendente, enviado, entregue, lido
  externalMessageId: text("external_message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 21. GOOGLE_CALENDAR_TOKENS
export const googleCalendarTokens = pgTable("google_calendar_tokens", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  usuarioId: integer("usuario_id").references(() => usuarios.id),
  googleAccountEmail: text("google_account_email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  scope: text("scope"),
  tokenExpiraEm: timestamp("token_expira_em"),
  calendarId: text("calendar_id").default("primary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 22. WEBHOOK_LOGS
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id),
  canal: text("canal").notNull(), // meta, google, whatsapp
  evento: text("evento"),
  payload: jsonb("payload").notNull(),
  status: text("status"),
  erro: text("erro"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Modify agendamentos to be more comprehensive as requested
// We'll keep the old table name but update the structure if needed or just add fields.
// Since we are adding new tables, I'll update the existing agendamentos in another multi_edit.

// 13. PAGAMENTOS
export const pagamentos = pgTable("pagamentos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
  provedor: text("provedor").default("asaas"),
  provedorId: text("provedor_id"),
  valor: integer("valor").notNull(),
  metodo: text("metodo").notNull(), // pix, cartao, boleto, dinheiro
  status: text("status").notNull(), // pendente, pago, vencido, cancelado
  pixCopiaECola: text("pix_copia_e_cola"),
  pixQrCodeAt: timestamp("pix_qr_code_at"),
  pagoAt: timestamp("pago_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 14. CAIXA
export const caixa = pgTable("caixa", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  status: text("status").default("aberto").notNull(), // aberto, fechado
  valorAbertura: integer("valor_abertura").notNull(),
  valorFechamento: integer("valor_fechamento"),
  abertoPor: integer("aberto_por").references(() => usuarios.id),
  fechadoPor: integer("fechado_por").references(() => usuarios.id),
  abertoAt: timestamp("aberto_at").defaultNow().notNull(),
  fechadoAt: timestamp("fechado_at"),
});

export const caixaMovimentacoes = pgTable("caixa_movimentacoes", {
  id: serial("id").primaryKey(),
  caixaId: integer("caixa_id").notNull().references(() => caixa.id),
  tipo: text("tipo").notNull(), // entrada, saida (sangria)
  valor: integer("valor").notNull(),
  descricao: text("descricao"),
  metodo: text("metodo"), // pix, cartao, dinheiro
  pedidoId: integer("pedido_id").references(() => pedidos.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 15. CAMPANHAS
export const campanhas = pgTable("campanhas", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  nome: text("nome").notNull(),
  regra: text("regra").notNull(), // reativacao_10d, boas_vindas, fidelidade
  mensagem: text("mensagem").notNull(),
  ativa: boolean("ativa").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campanhaEnvios = pgTable("campanha_envios", {
  id: serial("id").primaryKey(),
  campanhaId: integer("campanha_id").notNull().references(() => campanhas.id),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id),
  status: text("status").notNull(), // enviado, erro, lido, respondeu
  respondeu: boolean("respondeu").default(false),
  enviadoAt: timestamp("enviado_at").defaultNow().notNull(),
});

// 16. BASE_CONHECIMENTO
export const baseConhecimento = pgTable("base_conhecimento", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  pergunta: text("pergunta").notNull(),
  resposta: text("resposta").notNull(),
  tags: jsonb("tags").default([]),
  ativa: boolean("ativa").default(true),
});

// 17. BAIRROS_ENTREGA
export const bairrosEntrega = pgTable("bairros_entrega", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id),
  nome: text("nome").notNull(),
  taxa: integer("taxa").notNull(),
  tempoEstimado: integer("tempo_estimado"), // em minutos
});
