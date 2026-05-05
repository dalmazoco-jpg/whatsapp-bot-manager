CREATE TABLE `agendamentos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clienteId` int NOT NULL,
	`googleCalendarEventId` varchar(255),
	`titulo` varchar(255) NOT NULL,
	`descricao` text,
	`dataHora` timestamp NOT NULL,
	`duracao` int NOT NULL DEFAULT 60,
	`status` enum('agendado','confirmado','cancelado','realizado') NOT NULL DEFAULT 'agendado',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agendamentos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`whatsappNumber` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`email` varchar(320),
	`telefone` varchar(20),
	`endereco` text,
	`statusAtendimento` enum('ativo','inativo','bloqueado') NOT NULL DEFAULT 'ativo',
	`ultimaInteracao` timestamp,
	`totalPedidos` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clientes_id` PRIMARY KEY(`id`),
	CONSTRAINT `clientes_whatsappNumber_unique` UNIQUE(`whatsappNumber`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`nomeBusiness` varchar(255) NOT NULL,
	`telefoneBusiness` varchar(20),
	`emailBusiness` varchar(320),
	`enderecoBusiness` text,
	`horarioAbertura` varchar(10),
	`horarioFechamento` varchar(10),
	`mensagemBoasVindas` text,
	`mensagemAusencia` text,
	`googleCalendarId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `configuracoes_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `conversas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clienteId` int NOT NULL,
	`mensagem` text NOT NULL,
	`remetente` enum('cliente','bot','humano') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tipo` enum('novo_pedido','novo_agendamento','pedido_atualizado','agendamento_cancelado') NOT NULL,
	`titulo` varchar(255) NOT NULL,
	`mensagem` text NOT NULL,
	`lida` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clienteId` int NOT NULL,
	`descricao` text NOT NULL,
	`valor` int NOT NULL,
	`taxaEntrega` int NOT NULL DEFAULT 0,
	`comissao` int NOT NULL DEFAULT 0,
	`status` enum('recebido','confirmado','em_preparo','saiu_entrega','entregue','cancelado') NOT NULL DEFAULT 'recebido',
	`dataEntrega` timestamp,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pedidos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sugestoesIA` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`clienteId` int NOT NULL,
	`pedidoId` int,
	`sugestao` text NOT NULL,
	`contexto` text,
	`usada` tinyint NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sugestoesIA_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agendamentos` ADD CONSTRAINT `agendamentos_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuracoes` ADD CONSTRAINT `configuracoes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversas` ADD CONSTRAINT `conversas_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pedidos` ADD CONSTRAINT `pedidos_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sugestoesIA` ADD CONSTRAINT `sugestoesIA_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sugestoesIA` ADD CONSTRAINT `sugestoesIA_clienteId_clientes_id_fk` FOREIGN KEY (`clienteId`) REFERENCES `clientes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sugestoesIA` ADD CONSTRAINT `sugestoesIA_pedidoId_pedidos_id_fk` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE no action ON UPDATE no action;