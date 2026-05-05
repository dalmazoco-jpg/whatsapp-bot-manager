CREATE TABLE apresentacao_config (
  id serial PRIMARY KEY,
  empresa_id integer NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  nome_empresa text NOT NULL DEFAULT 'Minha Empresa',
  descricao text,
  logo_url text,
  cor_primaria text NOT NULL DEFAULT '#10b981',
  whatsapp text,
  endereco text,
  instagram text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
