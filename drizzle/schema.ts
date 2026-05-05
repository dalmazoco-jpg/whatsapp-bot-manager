import { pgTable, text, integer, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const empresas = pgTable("empresas", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  tipo: text("tipo").default("outro").notNull(),
  ramo: text("ramo"), // 'pizzaria', 'adega', 'consultorio', 'loja', etc.
  whatsappNumero: text("whatsapp_numero"),
  ativo: boolean("ativo").default(false).notNull(),
  licencaExpira: timestamp("licenca_expira"),
  configIa: jsonb("config_ia"),
  configBot: jsonb("config_bot"), // Configurações específicas do bot (nome, regras, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Empresa = typeof empresas.$inferSelect;
export type InsertEmpresa = typeof empresas.$inferInsert;

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  nome: text("nome").notNull(),
  role: text("role").$type<"admin"|"empresa">().default("empresa").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});
export type Usuario = typeof usuarios.$inferSelect;
export type InsertUsuario = typeof usuarios.$inferInsert;

export const sessoesWhatsapp = pgTable("sessoes_whatsapp", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().unique().references(() => empresas.id, { onDelete: "cascade" }),
  status: text("status").$type<"desconectado"|"qr_pendente"|"conectado">().default("desconectado").notNull(),
  ultimoQr: text("ultimo_qr"),
  connectedAt: timestamp("connected_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type SessaoWhatsapp = typeof sessoesWhatsapp.$inferSelect;
export type InsertSessaoWhatsapp = typeof sessoesWhatsapp.$inferInsert;

// Tabela para persistir o estado de autenticação do Baileys no banco
export const baileysAuth = pgTable("baileys_auth", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  chave: text("chave").notNull(), // 'creds', 'app-state-sync-key', etc.
  valor: jsonb("valor").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientesWhatsapp = pgTable("clientes_whatsapp", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  whatsappNumber: text("whatsapp_number").notNull(),
  nome: text("nome"),
  endereco: text("endereco"),
  preferencias: jsonb("preferencias"),
  ultimaInteracao: timestamp("ultima_interacao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ClienteWhatsapp = typeof clientesWhatsapp.$inferSelect;
export type InsertClienteWhatsapp = typeof clientesWhatsapp.$inferInsert;

export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id, { onDelete: "cascade" }),
  itens: jsonb("itens"),
  valorTotal: integer("valor_total").notNull().default(0), // em centavos
  taxaEntrega: integer("taxa_entrega").notNull().default(0),
  status: text("status").$type<"recebido"|"confirmado"|"em_preparo"|"saiu_entrega"|"entregue"|"cancelado">().default("recebido").notNull(),
  metodoPagamento: text("metodo_pagamento"), // 'pix', 'dinheiro', 'cartao'
  statusPagamento: text("status_pagamento").$type<"pendente"|"pago"|"estornado">().default("pendente"),
  dataPagamento: timestamp("data_pagamento"),
  enderecoEntrega: text("endereco_entrega"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = typeof pedidos.$inferInsert;

export const agendamentos = pgTable("agendamentos", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  dataHora: timestamp("data_hora").notNull(),
  duracao: integer("duracao").default(60).notNull(),
  status: text("status").$type<"agendado"|"confirmado"|"cancelado"|"realizado">().default("agendado").notNull(),
  googleEventId: text("google_event_id"),
  googleMeetLink: text("google_meet_link"),
  notificacaoEnviada: boolean("notificacao_enviada").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Agendamento = typeof agendamentos.$inferSelect;
export type InsertAgendamento = typeof agendamentos.$inferInsert;

export const cardapioItens = pgTable("cardapio_itens", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  categoria: text("categoria").notNull(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  preco: integer("preco").notNull().default(0),
  disponivel: boolean("disponivel").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type CardapioItem = typeof cardapioItens.$inferSelect;
export type InsertCardapioItem = typeof cardapioItens.$inferInsert;

export const horariosAtendimento = pgTable("horarios_atendimento", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  diaSemana: integer("dia_semana").notNull(),
  horaInicio: text("hora_inicio").notNull(),
  horaFim: text("hora_fim").notNull(),
  ativo: boolean("ativo").default(true).notNull(),
});
export type HorarioAtendimento = typeof horariosAtendimento.$inferSelect;
export type InsertHorarioAtendimento = typeof horariosAtendimento.$inferInsert;

export const mensagensLog = pgTable("mensagens_log", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  clienteId: integer("cliente_id").notNull().references(() => clientesWhatsapp.id, { onDelete: "cascade" }),
  direcao: text("direcao").$type<"entrada"|"saida">().notNull(),
  conteudo: text("conteudo").notNull(),
  tipo: text("tipo").$type<"texto"|"imagem"|"audio"|"ia_gerada">().default("texto").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MensagemLog = typeof mensagensLog.$inferSelect;
export type InsertMensagemLog = typeof mensagensLog.$inferInsert;

export const notificacoes = pgTable("notificacoes", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  tipo: text("tipo").notNull(),
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  lida: boolean("lida").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Notificacao = typeof notificacoes.$inferSelect;
export type InsertNotificacao = typeof notificacoes.$inferInsert;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export const contatosNotificacao = pgTable("contatos_notificacao", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().references(() => empresas.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  whatsapp: text("whatsapp").notNull(),
  tipo: text("tipo").default("proprietario").notNull(), // 'proprietario', 'gerente', 'atendente'
  eventos: text("eventos").array().notNull(), // ['agendamento', 'pedido', 'cancelamento', 'novo_cliente']
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type ContatoNotificacao = typeof contatosNotificacao.$inferSelect;
export type InsertContatoNotificacao = typeof contatosNotificacao.$inferInsert;

