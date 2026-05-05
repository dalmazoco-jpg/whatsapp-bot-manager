-- ============================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS — SUPABASE
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================================

-- Limpeza das tabelas antigas (cuidado, apaga os dados antigos!)
DROP TABLE IF EXISTS sessoes_whatsapp CASCADE;
DROP TABLE IF EXISTS mensagens_log CASCADE;
DROP TABLE IF EXISTS notificacoes CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS clientes_whatsapp CASCADE;
DROP TABLE IF EXISTS horarios_atendimento CASCADE;
DROP TABLE IF EXISTS cardapio_itens CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;

-- 1. EMPRESAS
CREATE TABLE IF NOT EXISTS empresas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('pizzaria', 'adega', 'consultorio', 'loja', 'outro')),
  whatsapp_numero TEXT,
  ativo BOOLEAN NOT NULL DEFAULT FALSE,
  licenca_expira TIMESTAMP,
  config_ia JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. USUARIOS (login no painel)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'empresa' CHECK (role IN ('admin', 'empresa')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_signed_in TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. CARDAPIO_ITENS (produtos/serviços)
CREATE TABLE IF NOT EXISTS cardapio_itens (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco INTEGER NOT NULL, -- em centavos
  disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. HORARIOS_ATENDIMENTO (consultórios/serviços)
CREATE TABLE IF NOT EXISTS horarios_atendimento (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TEXT NOT NULL,
  hora_fim TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. CLIENTES_WHATSAPP
CREATE TABLE IF NOT EXISTS clientes_whatsapp (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  whatsapp_number TEXT NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT,
  preferencias JSONB DEFAULT '{}',
  ultima_interacao TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. PEDIDOS
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes_whatsapp(id),
  itens JSONB DEFAULT '[]',
  valor_total INTEGER NOT NULL, -- centavos
  taxa_entrega INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recebido' CHECK (status IN ('recebido', 'confirmado', 'em_preparo', 'saiu_entrega', 'entregue', 'cancelado')),
  endereco_entrega TEXT,
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes_whatsapp(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_hora TIMESTAMP NOT NULL,
  duracao INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'confirmado', 'cancelado', 'realizado')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. MENSAGENS_LOG
CREATE TABLE IF NOT EXISTS mensagens_log (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  cliente_id INTEGER NOT NULL REFERENCES clientes_whatsapp(id),
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada', 'saida')),
  conteudo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto', 'imagem', 'audio', 'ia_gerada')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9. SESSOES_WHATSAPP
CREATE TABLE IF NOT EXISTS sessoes_whatsapp (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL UNIQUE REFERENCES empresas(id),
  status TEXT NOT NULL DEFAULT 'desconectado' CHECK (status IN ('desconectado', 'qr_pendente', 'conectado')),
  ultimo_qr TEXT,
  connected_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10. NOTIFICACOES
CREATE TABLE IF NOT EXISTS notificacoes (
  id SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL REFERENCES empresas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('novo_pedido', 'novo_agendamento', 'pedido_atualizado', 'agendamento_cancelado', 'whatsapp_conectado', 'whatsapp_desconectado')),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cardapio_empresa ON cardapio_itens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes_whatsapp(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON clientes_whatsapp(empresa_id, whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_pedidos_empresa ON pedidos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_empresa ON agendamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(empresa_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_mensagens_empresa ON mensagens_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente ON mensagens_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_empresa ON notificacoes(empresa_id, lida);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Habilitar para isolamento
-- NOTA: O backend usa Drizzle ORM direto, mas se quiser
-- habilitar RLS no Supabase, descomente abaixo:
-- ============================================================
/*
ALTER TABLE cardapio_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_whatsapp ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- Policy: cada empresa só vê seus dados
-- Requer SET LOCAL app.empresa_id = X antes de cada query
CREATE POLICY "empresa_isolation" ON cardapio_itens
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON clientes_whatsapp
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON pedidos
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON agendamentos
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON mensagens_log
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON sessoes_whatsapp
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
CREATE POLICY "empresa_isolation" ON notificacoes
  FOR ALL USING (empresa_id = current_setting('app.empresa_id')::int);
*/

-- ============================================================
-- DADOS INICIAIS: Admin padrão
-- Senha: admin123 (hash bcrypt)
-- ============================================================
-- Nota: O servidor cria o admin automaticamente na primeira execução
-- Se quiser criar manualmente:
-- INSERT INTO usuarios (email, senha_hash, nome, role)
-- VALUES ('admin@sistema.com', '$2a$10$...hash...', 'Admin Global', 'admin');
