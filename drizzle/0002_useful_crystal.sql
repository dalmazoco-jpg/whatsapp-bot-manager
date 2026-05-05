CREATE TABLE "agendamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text,
	"data_hora" timestamp NOT NULL,
	"duracao" integer DEFAULT 60 NOT NULL,
	"status" text DEFAULT 'agendado' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cardapio_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"categoria" text NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"preco" integer NOT NULL,
	"disponivel" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clientes_whatsapp" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"whatsapp_number" text NOT NULL,
	"nome" text NOT NULL,
	"endereco" text,
	"preferencias" jsonb DEFAULT '{}'::jsonb,
	"ultima_interacao" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"tipo" text DEFAULT 'outro' NOT NULL,
	"whatsapp_numero" text,
	"ativo" boolean DEFAULT false NOT NULL,
	"licenca_expira" timestamp,
	"config_ia" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horarios_atendimento" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora_inicio" text NOT NULL,
	"hora_fim" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mensagens_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"direcao" text NOT NULL,
	"conteudo" text NOT NULL,
	"tipo" text DEFAULT 'texto' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"mensagem" text NOT NULL,
	"lida" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"itens" jsonb DEFAULT '[]'::jsonb,
	"valor_total" integer NOT NULL,
	"taxa_entrega" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'recebido' NOT NULL,
	"endereco_entrega" text,
	"observacoes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessoes_whatsapp" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer NOT NULL,
	"status" text DEFAULT 'desconectado' NOT NULL,
	"ultimo_qr" text,
	"connected_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessoes_whatsapp_empresa_id_unique" UNIQUE("empresa_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa_id" integer,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"nome" text NOT NULL,
	"role" text DEFAULT 'empresa' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cardapio_itens" ADD CONSTRAINT "cardapio_itens_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_whatsapp" ADD CONSTRAINT "clientes_whatsapp_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios_atendimento" ADD CONSTRAINT "horarios_atendimento_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_log" ADD CONSTRAINT "mensagens_log_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagens_log" ADD CONSTRAINT "mensagens_log_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_whatsapp_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes_whatsapp"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;