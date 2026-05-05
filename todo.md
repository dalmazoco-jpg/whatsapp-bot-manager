# WhatsApp Bot Manager - TODO

## Database Schema
- [x] Create tables: clientes, pedidos, agendamentos, configuracoes, notificacoes, sugestoes_ia
- [x] Define relationships and indexes
- [x] Generate Drizzle migrations

## Backend Implementation
- [x] Create tRPC routers for clientes, pedidos, agendamentos
- [ ] Implement Google Calendar integration (criar, editar, cancelar eventos)
- [x] Implement LLM integration for IA suggestions (histórico + contexto)
- [ ] Implement email notifications (nodemailer ou Manus built-in)
- [ ] Create webhook handlers for WhatsApp events (novos pedidos/agendamentos)
- [ ] Implement real-time notifications via SSE ou WebSocket

## Frontend - Authentication & Layout
- [x] Implement Manus OAuth login flow
- [ ] Create DashboardLayout with sidebar navigation
- [x] Create protected routes wrapper

## Frontend - Dashboard
- [x] Create main dashboard with KPIs (conversas ativas, pedidos, agendamentos)
- [x] Implement charts for metrics (total atendimentos, taxa conversão, pedidos por período)
- [ ] Add real-time notification badge/toast

## Frontend - Gerenciamento de Clientes
- [x] Create clientes list page with filtros e busca
- [ ] Create cliente detail page com histórico de conversas
- [x] Implement status de atendimento

## Frontend - Gerenciamento de Pedidos
- [x] Create pedidos list page com filtros por data
- [x] Create status update UI (pendente → confirmado → entregue/cancelado)
- [ ] Add pedido detail view

## Frontend - Gerenciamento de Agendamentos
- [x] Create calendar view integrado com Google Calendar
- [ ] Implement criar/editar/cancelar agendamentos
- [ ] Add sync com Google Calendar

## Frontend - Configurações
- [x] Create settings page para editar mensagens automáticas
- [x] Add horário de atendimento config
- [x] Add dados do negócio (nome, telefone, etc)

## Frontend - Styling (International Typographic Style)
- [x] Apply grid system (8px base)
- [x] Set typography (sans-serif preta, hierarquia clara)
- [x] Apply color scheme (branco pristino, vermelho acentos, preto linhas)
- [x] Implement spacing e negative space
- [x] Add thin dividers (preto 1px)

## Testing
- [x] Write vitest for auth flow
- [x] Write vitest for tRPC procedures (clientes, pedidos, agendamentos)
- [ ] Write vitest for LLM integration

## GitHub & Deployment
- [ ] Initialize Git repository
- [ ] Create .gitignore
- [ ] Create README.md com instruções de setup
- [ ] Create .env.example
- [ ] Push to GitHub (repositório privado)
- [ ] Prepare Oracle Cloud deployment guide

## Delivery
- [ ] Final testing e validação
- [ ] Create checkpoint
- [ ] Deliver to user com links e instruções
