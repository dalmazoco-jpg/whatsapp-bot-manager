CREATE TABLE "apresentacao_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"slug" text NOT NULL,
	"nome_empresa" text DEFAULT 'Minha Empresa' NOT NULL,
	"descricao" text,
	"logo_url" text,
	"cor_primaria" text DEFAULT '#10b981' NOT NULL,
	"whatsapp" text,
	"endereco" text,
	"instagram" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apresentacao_config_empresa_id_unique" UNIQUE("empresa_id"),
	CONSTRAINT "apresentacao_config_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "baileys_auth" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"chave" text NOT NULL,
	"valor" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos_notificacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"nome" text NOT NULL,
	"whatsapp" text NOT NULL,
	"tipo" text DEFAULT 'proprietario' NOT NULL,
	"eventos" text[] NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer,
	"plano_id" text,
	"tipo" text DEFAULT 'mensalidade' NOT NULL,
	"valor" integer NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"data_vencimento" timestamp,
	"data_pagamento" timestamp,
	"gateway" text DEFAULT 'infinitepay' NOT NULL,
	"order_nsu" text,
	"slug" text,
	"transaction_id" text,
	"payment_link" text,
	"receipt_url" text,
	"nf_status" text DEFAULT 'pendente' NOT NULL,
	"nf_url" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_calendar_tokens_empresa_id_unique" UNIQUE("empresa_id")
);
--> statement-breakpoint
CREATE TABLE "licencas" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"plano_id" text,
	"licenca_ativa" boolean DEFAULT false NOT NULL,
	"licenca_expira" timestamp,
	"ultimo_pagamento_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "licencas_empresa_id_unique" UNIQUE("empresa_id")
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"fatura_id" integer,
	"empresa_id" integer,
	"valor" integer NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"gateway" text DEFAULT 'infinitepay' NOT NULL,
	"order_nsu" text,
	"transaction_id" text,
	"slug" text,
	"capture_method" text,
	"paid_amount" integer,
	"receipt_url" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"valor_licenca" integer NOT NULL,
	"valor_mensalidade" integer NOT NULL,
	"recursos" jsonb,
	"modules" jsonb,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"razao_social" text,
	"cnpj" text,
	"natureza_juridica" text,
	"endereco" text,
	"telefone" text,
	"whatsapp_numero" text,
	"email" text,
	"cnae" text,
	"config_ia" jsonb,
	"contrato_template" text,
	"planos_custom" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" text NOT NULL,
	"name" text,
	"email" text,
	"loginMethod" text,
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "agendamentos" DROP CONSTRAINT "agendamentos_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "agendamentos" DROP CONSTRAINT "agendamentos_cliente_id_clientes_whatsapp_id_fk";
--> statement-breakpoint
ALTER TABLE "cardapio_itens" DROP CONSTRAINT "cardapio_itens_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "clientes_whatsapp" DROP CONSTRAINT "clientes_whatsapp_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "horarios_atendimento" DROP CONSTRAINT "horarios_atendimento_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "mensagens_log" DROP CONSTRAINT "mensagens_log_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "mensagens_log" DROP CONSTRAINT "mensagens_log_cliente_id_clientes_whatsapp_id_fk";
--> statement-breakpoint
ALTER TABLE "notificacoes" DROP CONSTRAINT "notificacoes_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "pedidos" DROP CONSTRAINT "pedidos_cliente_id_clientes_whatsapp_id_fk";
--> statement-breakpoint
ALTER TABLE "sessoes_whatsapp" DROP CONSTRAINT "sessoes_whatsapp_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_empresa_id_empresas_id_fk";
--> statement-breakpoint
ALTER TABLE "cardapio_itens" ALTER COLUMN "preco" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "clientes_whatsapp" ALTER COLUMN "nome" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes_whatsapp" ALTER COLUMN "preferencias" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "itens" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "pedidos" ALTER COLUMN "valor_total" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD COLUMN "google_event_id" text;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD COLUMN "google_meet_link" text;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD COLUMN "notificacao_enviada" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "ramo" text;--> statement-breakpoint
ALTER TABLE "empresas" ADD COLUMN "config_bot" jsonb;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "metodo_pagamento" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "status_pagamento" text DEFAULT 'pendente';--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "data_pagamento" timestamp;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "delivery_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "apresentacao_config" ADD CONSTRAINT "apresentacao_config_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baileys_auth" ADD CONSTRAINT "baileys_auth_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_notificacao" ADD CONSTRAINT "contatos_notificacao_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_tokens" ADD CONSTRAINT "google_calendar_tokens_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licencas" ADD CONSTRAINT "licencas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licencas" ADD CONSTRAINT "licencas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_fatura_id_faturas_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardapio_itens" ADD CONSTRAINT "cardapio_itens_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_whatsapp" ADD CONSTRAINT "clientes_whatsapp_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_atendimento" ADD CONSTRAINT "horarios_atendimento_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_log" ADD CONSTRAINT "mensagens_log_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_log" ADD CONSTRAINT "mensagens_log_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;