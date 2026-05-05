# Integração com Baileys WhatsApp Bot

Este guia explica como integrar seu bot Baileys com o painel WhatsApp Bot Manager.

## Visão Geral

O fluxo de integração funciona assim:

```
Bot Baileys (WhatsApp) → API do Painel → Banco de Dados
                      ← Sugestões IA ←
```

## Passo 1: Preparar o Bot Baileys

### Instalação Básica

```bash
mkdir whatsapp-bot
cd whatsapp-bot
npm init -y
npm install @whiskeysockets/baileys qrcode-terminal

# Criar arquivo bot.js
touch bot.js
```

### Código Básico do Bot

```javascript
// bot.js
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

const PAINEL_URL = process.env.PAINEL_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('connection closed due to', lastDisconnect?.error, ', reconnecting', shouldReconnect);
      if (shouldReconnect) {
        start();
      }
    } else if (connection === 'open') {
      console.log('opened connection');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Processar mensagens recebidas
  sock.ev.on('messages.upsert', async (m) => {
    console.log('new messages', JSON.stringify(m, undefined, 2));

    if (!m.messages) return;

    const msg = m.messages[0];
    if (!msg.message) return;

    await handleMessage(sock, msg);
  });
}

async function handleMessage(sock, msg) {
  const from = msg.key.remoteJid;
  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  
  if (!text) return;

  try {
    // 1. Enviar mensagem para o painel
    const clienteResponse = await axios.post(
      `${PAINEL_URL}/api/trpc/conversas.create`,
      {
        clienteId: from,
        mensagem: text,
        remetente: 'cliente'
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Mensagem registrada no painel:', clienteResponse.data);

    // 2. Gerar sugestão com IA
    const sugestaoResponse = await axios.post(
      `${PAINEL_URL}/api/trpc/sugestoesIA.generate`,
      {
        clienteId: from,
        historico: [
          { remetente: 'cliente', mensagem: text }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const sugestao = sugestaoResponse.data?.sugestao || 'Obrigado pela mensagem!';

    // 3. Responder ao cliente
    await sock.sendMessage(from, {
      text: sugestao
    });

    console.log('Resposta enviada:', sugestao);

  } catch (error) {
    console.error('Erro ao processar mensagem:', error.message);
    
    // Enviar resposta padrão em caso de erro
    await sock.sendMessage(from, {
      text: 'Desculpe, ocorreu um erro. Tente novamente mais tarde.'
    });
  }
}

start();
```

## Passo 2: Configurar Variáveis de Ambiente

```bash
# Criar .env
cat > .env << EOF
PAINEL_URL=http://seu-painel.com
API_TOKEN=seu_token_de_api
NODE_ENV=production
EOF
```

## Passo 3: Criar Rota de API no Painel

Adicione a seguinte rota no painel para aceitar mensagens do bot:

```typescript
// server/webhooks.ts
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { conversas, InsertConversa } from "../drizzle/schema";

export const webhooksRouter = router({
  receiveMessage: publicProcedure
    .input(
      z.object({
        clienteId: z.string(),
        mensagem: z.string(),
        remetente: z.enum(["cliente", "bot", "humano"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Salvar mensagem
      const newConversa: InsertConversa = {
        userId: 1, // ID do dono do negócio
        clienteId: parseInt(input.clienteId) || 1,
        mensagem: input.mensagem,
        remetente: input.remetente,
      };

      await db.insert(conversas).values(newConversa);

      return { success: true };
    }),
});
```

Adicione ao `server/routers.ts`:

```typescript
import { webhooksRouter } from "./webhooks";

export const appRouter = router({
  // ... outros routers
  webhooks: webhooksRouter,
});
```

## Passo 4: Executar o Bot

```bash
# Instalar dependências
npm install

# Executar bot
node bot.js

# Ou com PM2
pm2 start bot.js --name "whatsapp-bot"
```

## Fluxo Completo de Mensagem

### 1. Cliente envia mensagem no WhatsApp

```
Cliente: "Olá, gostaria de fazer um pedido"
```

### 2. Bot Baileys recebe e processa

```javascript
// bot.js captura a mensagem
const text = "Olá, gostaria de fazer um pedido";
```

### 3. Bot envia para o painel

```bash
POST /api/trpc/conversas.create
{
  "clienteId": "5511999999999",
  "mensagem": "Olá, gostaria de fazer um pedido",
  "remetente": "cliente"
}
```

### 4. Painel gera sugestão com IA

```bash
POST /api/trpc/sugestoesIA.generate
{
  "clienteId": "5511999999999",
  "historico": [
    {
      "remetente": "cliente",
      "mensagem": "Olá, gostaria de fazer um pedido"
    }
  ]
}
```

### 5. IA retorna sugestão

```json
{
  "sugestao": "Olá! Bem-vindo! Temos várias opções de produtos. Qual tipo de pedido você gostaria de fazer?"
}
```

### 6. Bot envia resposta ao cliente

```
Bot: "Olá! Bem-vindo! Temos várias opções de produtos. Qual tipo de pedido você gostaria de fazer?"
```

### 7. Dono vê tudo no painel

Dashboard mostra:
- Nova conversa com cliente
- Histórico completo
- Sugestão de resposta
- Status do atendimento

## Funcionalidades Avançadas

### Criar Pedido Automaticamente

```javascript
async function criarPedido(sock, from, descricao, valor) {
  try {
    const pedidoResponse = await axios.post(
      `${PAINEL_URL}/api/trpc/pedidos.create`,
      {
        clienteId: from,
        descricao,
        valor: valor * 100, // Converter para centavos
        taxaEntrega: 500, // R$ 5.00
      },
      { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
    );

    await sock.sendMessage(from, {
      text: `Pedido criado! ID: ${pedidoResponse.data.id}`
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
  }
}
```

### Agendar Consulta

```javascript
async function agendar(sock, from, titulo, data, hora) {
  try {
    const [dia, mes, ano] = data.split('/');
    const dataHora = new Date(`${ano}-${mes}-${dia}T${hora}:00`);

    const agendamentoResponse = await axios.post(
      `${PAINEL_URL}/api/trpc/agendamentos.create`,
      {
        clienteId: from,
        titulo,
        dataHora: dataHora.toISOString(),
        duracao: 60,
      },
      { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
    );

    await sock.sendMessage(from, {
      text: `Agendamento confirmado para ${data} às ${hora}!`
    });
  } catch (error) {
    console.error('Erro ao agendar:', error);
  }
}
```

### Notificar Dono

```javascript
async function notificarDono(tipo, titulo, mensagem) {
  try {
    await axios.post(
      `${PAINEL_URL}/api/trpc/notificacoes.create`,
      {
        tipo,
        titulo,
        mensagem,
      },
      { headers: { 'Authorization': `Bearer ${API_TOKEN}` } }
    );
  } catch (error) {
    console.error('Erro ao notificar:', error);
  }
}
```

## Segurança

### Validação de Mensagens

```javascript
function validarMensagem(texto) {
  // Verificar comprimento
  if (texto.length > 1000) return false;
  
  // Verificar conteúdo suspeito
  const spam = /viagra|casino|lottery/i;
  if (spam.test(texto)) return false;
  
  return true;
}
```

### Rate Limiting

```javascript
const messageCount = new Map();

function checkRateLimit(from, limit = 10, window = 60000) {
  const now = Date.now();
  const userMessages = messageCount.get(from) || [];
  
  // Remover mensagens fora da janela de tempo
  const recentMessages = userMessages.filter(ts => now - ts < window);
  
  if (recentMessages.length >= limit) {
    return false; // Limite atingido
  }
  
  recentMessages.push(now);
  messageCount.set(from, recentMessages);
  return true;
}
```

## Troubleshooting

### Bot não conecta

```bash
# Verificar se a porta está aberta
netstat -tuln | grep 3000

# Verificar logs
pm2 logs whatsapp-bot
```

### Mensagens não chegam ao painel

- Verificar `PAINEL_URL`
- Verificar `API_TOKEN`
- Verificar firewall
- Verificar logs do painel

### IA não gera sugestões

- Verificar conexão com LLM
- Verificar credenciais da API
- Verificar histórico de conversa

## Próximos Passos

1. Implementar autenticação mais robusta
2. Adicionar suporte para mídia (imagens, vídeos)
3. Implementar fila de mensagens
4. Adicionar suporte para múltiplos canais
5. Implementar análise de sentimento
