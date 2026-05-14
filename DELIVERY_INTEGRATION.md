# Integração com App de Entrega

Este guia explica como integrar seu painel com um aplicativo de entrega para automatizar o processo de delivery.

## Funcionalidades

Quando integrada, o sistema automaticamente:
- Envia dados do pedido para o app de entrega quando o status muda para "Saiu para Entrega"
- Recebe URL de rastreamento em tempo real
- Notifica o cliente com link de acompanhamento
- Registra erros de integração no pedido

## Configuração

### 1. Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```env
# URL do webhook do seu app de entrega
DELIVERY_WEBHOOK_URL=https://seu-app-entrega.com/api/webhook/delivery

# Chave API para autenticação (fornecida pelo app de entrega)
DELIVERY_WEBHOOK_API_KEY=sua_chave_api_aqui
```

### 2. Formato dos Dados Enviados

O sistema envia um POST com o seguinte payload:

```json
{
  "origin": "Nome do Estabelecimento - Endereço do Estabelecimento",
  "destination": "Endereço completo do cliente",
  "price": 8.50,
  "customerName": "Nome do Cliente",
  "paymentMethod": "cash"
}
```

Headers:
```
Content-Type: application/json
x-api-key: SUA_CHAVE_API
```

### 3. Resposta Esperada

Seu app de entrega deve responder com:

```json
{
  "success": true,
  "trackingUrl": "https://seu-app-entrega.com/rastrear/ABC123",
  "orderId": "ID_INTERNO_DO_APP"
}
```

### 4. Tratamento de Erros

Se a integração falhar:
- O erro é registrado no `deliveryMetadata` do pedido
- O sistema continua funcionando normalmente
- O cliente não é afetado

## Status da Integração

Você pode verificar o status da integração na tela de Pedidos:
- ✅ **Enviado**: Dados enviados com sucesso, link de rastreamento disponível
- ❌ **Erro**: Falha na integração, detalhes no metadata
- ⚪ **Não configurado**: Webhook não configurado, funcionalidade desabilitada

## Testando a Integração

1. Configure as variáveis de ambiente
2. Crie um pedido de teste
3. Mude o status para "Saiu para Entrega"
4. Verifique se os dados foram enviados para seu app
5. Confirme se o cliente recebeu o link de rastreamento

## Configuração Opcional

Se você não usar app de entrega, simplesmente não configure as variáveis `DELIVERY_WEBHOOK_*`. O sistema funcionará normalmente sem essa integração.