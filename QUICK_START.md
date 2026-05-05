# Quick Start - WhatsApp Bot Manager

Guia rápido para começar a usar o painel em minutos.

## 1. Acesso Inicial

1. Abra o navegador e acesse: `https://seu-painel.com`
2. Clique em **"Entrar com Manus OAuth"**
3. Faça login com sua conta Manus
4. Pronto! Você está no dashboard

## 2. Primeiro Acesso - Configurações

Antes de começar, configure seus dados:

1. Vá para **Configurações** (ícone de engrenagem)
2. Preencha:
   - **Nome do Negócio**: Ex: "Pizzaria Delícia"
   - **Telefone**: Seu WhatsApp
   - **Email**: Para notificações
   - **Endereço**: Seu local de atendimento
3. Configure **Horário de Atendimento**
4. Adicione **Mensagens Automáticas**:
   - Boas-vindas: "Olá! Bem-vindo ao nosso atendimento..."
   - Ausência: "Desculpe, estamos fora do horário..."
5. Clique em **Salvar Configurações**

## 3. Conectar Google Calendar

Para sincronizar agendamentos:

1. Vá para **Configurações > Integrações**
2. Clique em **Conectar Google Calendar**
3. Autorize a aplicação
4. Pronto! Agendamentos sincronizarão automaticamente

## 4. Integrar Bot Baileys

Para conectar seu bot WhatsApp:

1. Consulte [BAILEYS_INTEGRATION.md](./BAILEYS_INTEGRATION.md)
2. Configure as variáveis de ambiente:
   ```
   PAINEL_URL=https://seu-painel.com
   API_TOKEN=seu_token
   ```
3. Inicie o bot
4. Teste enviando uma mensagem no WhatsApp

## 5. Entender o Dashboard

### KPIs (Cartões no topo)

- **Conversas Ativas**: Número de clientes únicos
- **Pedidos Recebidos**: Total de pedidos + confirmados
- **Agendamentos**: Próximos 30 dias
- **Taxa de Conversão**: % de pedidos confirmados

### Gráficos

- **Pedidos por Período**: Visualize tendências
- **Agendamentos por Período**: Acompanhe demanda

## 6. Gerenciar Clientes

### Listar Clientes

1. Vá para **Clientes**
2. Use a barra de busca para encontrar por nome ou WhatsApp
3. Clique em **Ver Detalhes** para histórico completo

### Status de Atendimento

- **Ativo**: Cliente em conversa ativa
- **Inativo**: Sem interações recentes
- **Bloqueado**: Não recebe mensagens

## 7. Gerenciar Pedidos

### Criar Pedido Manual

1. Vá para **Pedidos**
2. Clique em **Novo Pedido**
3. Preencha:
   - Cliente
   - Descrição
   - Valor
   - Taxa de entrega
4. Clique em **Criar**

### Atualizar Status

1. Clique em um pedido
2. Altere o status:
   - **Recebido** → **Confirmado** → **Em Preparo** → **Saiu para Entrega** → **Entregue**
   - Ou **Cancelado** em qualquer momento
3. Salve as alterações

## 8. Gerenciar Agendamentos

### Criar Agendamento

1. Vá para **Agendamentos**
2. Clique em **Novo Agendamento**
3. Preencha:
   - Cliente
   - Título (ex: "Consulta")
   - Data e Hora
   - Duração (minutos)
4. Clique em **Criar**

### Sincronizar com Google Calendar

Agendamentos são sincronizados automaticamente se Google Calendar estiver conectado.

## 9. Notificações

### Receber Notificações

Você receberá notificações quando:
- ✅ Novo cliente inicia conversa
- ✅ Novo pedido é recebido
- ✅ Novo agendamento é criado
- ✅ Status de pedido é atualizado

### Tipos de Notificação

- **No Painel**: Badge de notificação no topo
- **Email**: Notificação automática (se configurado)
- **WhatsApp**: Mensagem no seu número (opcional)

## 10. Sugestões com IA

### Como Funciona

1. Cliente envia mensagem no WhatsApp
2. IA analisa o histórico de conversa
3. Painel mostra sugestão de resposta
4. Você pode usar a sugestão ou editar

### Exemplo

```
Cliente: "Vocês fazem entrega em meu bairro?"

IA sugere: "Sim! Fazemos entrega em toda a região. 
Qual é seu endereço?"
```

## 11. Relatórios e Métricas

### Visualizar Métricas

1. Vá para **Dashboard**
2. Veja os gráficos de:
   - Pedidos por mês
   - Agendamentos por mês
   - Taxa de conversão
   - Clientes ativos

### Exportar Dados

(Funcionalidade em desenvolvimento)

## 12. Dicas Importantes

### ✅ Boas Práticas

- Responda clientes rapidamente
- Use as sugestões de IA como base
- Mantenha configurações atualizadas
- Faça backup regular do banco de dados

### ⚠️ Cuidados

- Não compartilhe seu token de API
- Mantenha senha segura
- Revise mensagens automáticas regularmente
- Monitore taxa de conversão

## 13. Troubleshooting

### Não consigo fazer login

- Verificar se tem conta Manus
- Limpar cookies do navegador
- Tentar em navegador privado

### Notificações não chegam

- Verificar email de configuração
- Verificar pasta de spam
- Verificar permissões do navegador

### Agendamentos não sincronizam

- Reconectar Google Calendar
- Verificar permissões
- Verificar fuso horário

### IA não gera sugestões

- Verificar conexão com internet
- Aguardar alguns segundos
- Tentar novamente

## 14. Suporte

Precisa de ajuda?

1. Consulte a documentação completa: [README.md](./README.md)
2. Veja integração com Baileys: [BAILEYS_INTEGRATION.md](./BAILEYS_INTEGRATION.md)
3. Deploy na Oracle Cloud: [DEPLOY_ORACLE_CLOUD.md](./DEPLOY_ORACLE_CLOUD.md)
4. Abra issue no GitHub

## 15. Próximos Passos

Agora que você conhece o básico:

1. **Integre seu bot**: Siga [BAILEYS_INTEGRATION.md](./BAILEYS_INTEGRATION.md)
2. **Customize mensagens**: Vá para Configurações
3. **Monitore métricas**: Acompanhe no Dashboard
4. **Expanda funcionalidades**: Consulte roadmap no README

---

**Bem-vindo ao WhatsApp Bot Manager! 🚀**
