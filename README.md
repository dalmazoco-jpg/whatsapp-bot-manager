# WhatsApp Bot Manager

Um painel administrativo completo e profissional para gerenciar chatbots inteligentes no WhatsApp. Controle total sobre clientes, pedidos, agendamentos e métricas em tempo real.

## Características Principais

- **Autenticação Segura**: Manus OAuth integrado para acesso exclusivo
- **Gerenciamento de Clientes**: Visualize histórico completo de conversas e status de atendimento
- **Gerenciamento de Pedidos**: Acompanhe status em tempo real (recebido → confirmado → entregue)
- **Agendamentos**: Integração com Google Calendar para sincronização automática
- **Métricas em Tempo Real**: Dashboard com KPIs, gráficos e análise de conversão
- **Sugestões com IA**: Respostas personalizadas geradas por IA baseadas em histórico
- **Notificações**: Alertas em tempo real e por email para novos pedidos/agendamentos
- **Design Profissional**: International Typographic Style com layout limpo e assimétrico

## Stack Tecnológico

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Vite
- **Backend**: Express 4 + tRPC 11 + Node.js
- **Banco de Dados**: MySQL/TiDB + Drizzle ORM
- **Autenticação**: Manus OAuth
- **IA**: LLM Integration para sugestões de resposta
- **Testes**: Vitest

## Instalação Local

### Pré-requisitos

- Node.js 22+
- pnpm 10+
- Banco de dados MySQL/TiDB (Supabase ou similar)

### Setup

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/whatsapp-bot-manager.git
cd whatsapp-bot-manager

# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp .env.example .env.local

# Editar .env.local com suas credenciais
# DATABASE_URL=mysql://user:password@host:port/database
# VITE_APP_ID=seu_app_id
# JWT_SECRET=seu_secret_aleatorio

# Executar migrações do banco de dados
pnpm drizzle-kit migrate

# Iniciar servidor de desenvolvimento
pnpm dev
```

O painel estará disponível em `http://localhost:3000`

## Variáveis de Ambiente

```env
# Banco de Dados
DATABASE_URL=mysql://user:password@host:port/database

# Autenticação
VITE_APP_ID=seu_manus_app_id
JWT_SECRET=seu_secret_aleatorio_minimo_32_caracteres
OAUTH_SERVER_URL=https://api.manus.im

# Configurações Opcionais
VITE_FRONTEND_FORGE_API_KEY=seu_api_key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im

# Integração com App de Entrega (opcional)
# Quando configurada, envia dados do pedido para app de entrega quando sai para entrega
DELIVERY_WEBHOOK_API_KEY=sua_chave_api_do_app_entrega
DELIVERY_WEBHOOK_URL=https://seu-app-entrega.com/api/webhook
```

## Estrutura do Projeto

```
whatsapp-bot-manager/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas (Dashboard, Clientes, Pedidos, etc)
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── lib/           # Utilitários (tRPC client, etc)
│   │   └── index.css      # Estilos globais (International Typographic Style)
│   └── public/            # Arquivos estáticos
├── server/                 # Backend Node.js/Express
│   ├── features.ts        # tRPC routers (clientes, pedidos, agendamentos, etc)
│   ├── db.ts              # Query helpers
│   ├── routers.ts         # Agregação de routers
│   └── _core/             # Framework core (OAuth, tRPC setup, etc)
├── drizzle/               # Migrações e schema do banco
│   ├── schema.ts          # Definição de tabelas
│   └── migrations/        # Arquivos SQL de migração
├── shared/                # Código compartilhado
└── package.json           # Dependências e scripts
```

## Funcionalidades Implementadas

### Dashboard
- KPIs: Conversas ativas, pedidos recebidos, agendamentos, taxa de conversão
- Gráficos de pedidos e agendamentos por período
- Visualização em tempo real

### Gerenciamento de Clientes
- Listagem com busca e filtros
- Status de atendimento (ativo, inativo, bloqueado)
- Histórico de conversas
- Total de pedidos por cliente

### Gerenciamento de Pedidos
- Listagem com filtros por status e data
- Status: recebido, confirmado, em preparo, saiu entrega, entregue, cancelado
- Valores com cálculo de taxa de entrega e comissão
- Atualização de status em tempo real

### Gerenciamento de Agendamentos
- Visualização de próximos agendamentos
- Integração com Google Calendar
- Status: agendado, confirmado, cancelado, realizado
- Duração configurável

### Configurações
- Dados do negócio (nome, telefone, email, endereço)
- Horário de atendimento
- Mensagens automáticas (boas-vindas, ausência)
- Integração com Google Calendar

### Notificações
- Alertas em tempo real para novos pedidos/agendamentos
- Histórico de notificações
- Marcação como lida

### Sugestões com IA
- Geração automática de respostas personalizadas
- Análise de histórico de conversa
- Contexto de pedido incluído
- Integração com LLM

## Deploy na Oracle Cloud

### Opção 1: Oracle Cloud Compute Instance

```bash
# 1. Criar instância Ubuntu 22.04 na Oracle Cloud

# 2. SSH na instância
ssh -i sua-chave.key ubuntu@seu-ip-publico

# 3. Instalar Node.js e pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g pnpm

# 4. Clonar repositório
git clone https://github.com/seu-usuario/whatsapp-bot-manager.git
cd whatsapp-bot-manager

# 5. Instalar dependências
pnpm install

# 6. Configurar variáveis de ambiente
nano .env.local

# 7. Executar migrações
pnpm drizzle-kit migrate

# 8. Build para produção
pnpm build

# 9. Iniciar servidor
pnpm start

# 10. (Opcional) Usar PM2 para manter o processo rodando
npm install -g pm2
pm2 start dist/index.js --name "whatsapp-bot-manager"
pm2 save
pm2 startup
```

### Opção 2: Docker na Oracle Cloud

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
```

```bash
# Build e deploy
docker build -t whatsapp-bot-manager .
docker run -d -p 3000:80 \
  -e DATABASE_URL="mysql://..." \
  -e VITE_APP_ID="..." \
  -e JWT_SECRET="..." \
  whatsapp-bot-manager
```

### Opção 3: Supabase + Oracle Cloud

```bash
# 1. Criar projeto Supabase (banco de dados PostgreSQL)
# 2. Copiar DATABASE_URL do Supabase
# 3. Adaptar schema.ts para PostgreSQL (se necessário)
# 4. Deploy no Oracle Cloud conforme Opção 1
```

## Integração com Baileys (WhatsApp Bot)

O painel foi projetado para funcionar com um bot Baileys. Aqui está como integrar:

```javascript
// bot.js (seu bot Baileys)
const axios = require('axios');

// Quando receber mensagem
sock.ev.on('messages.upsert', async (m) => {
  const message = m.messages[0];
  
  // Enviar para o painel via API
  await axios.post('http://seu-painel.com/api/trpc/conversas.create', {
    clienteId: message.key.remoteJid,
    mensagem: message.message.conversation,
    remetente: 'cliente'
  });
  
  // Gerar sugestão com IA
  const sugestao = await axios.post('http://seu-painel.com/api/trpc/sugestoesIA.generate', {
    clienteId: message.key.remoteJid,
    historico: [/* histórico de conversa */]
  });
  
  // Responder ao cliente
  await sock.sendMessage(message.key.remoteJid, {
    text: sugestao.data.sugestao
  });
});
```

## Testes

```bash
# Executar testes
pnpm test

# Testes com coverage
pnpm test -- --coverage

# Modo watch
pnpm test -- --watch
```

## Build para Produção

```bash
# Build frontend e backend
pnpm build

# Iniciar servidor de produção
pnpm start
```

## Troubleshooting

### Erro de conexão com banco de dados
- Verificar `DATABASE_URL` em `.env.local`
- Confirmar que o banco está acessível
- Executar `pnpm drizzle-kit migrate` novamente

### Erro de autenticação Manus OAuth
- Verificar `VITE_APP_ID` e `OAUTH_SERVER_URL`
- Confirmar que a aplicação está registrada no Manus

### Erro ao gerar sugestões com IA
- Verificar `VITE_FRONTEND_FORGE_API_KEY`
- Confirmar que o LLM está disponível

## Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a MIT License - veja o arquivo LICENSE para detalhes.

## Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do email de suporte.

## Roadmap

- [ ] Integração completa com Google Calendar
- [ ] Notificações por email com Nodemailer
- [ ] WebSocket para notificações em tempo real
- [ ] Integração com Stripe para pagamentos
- [ ] Relatórios avançados em PDF
- [ ] Mobile app com React Native
- [ ] Integração com múltiplos canais (Instagram, Telegram, etc)
- [ ] Analytics avançado com BI
