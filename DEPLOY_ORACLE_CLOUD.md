# Guia de Deploy na Oracle Cloud

Este guia fornece instruções passo a passo para fazer deploy do WhatsApp Bot Manager na Oracle Cloud.

## Opção 1: Oracle Compute Instance (Recomendado)

### Pré-requisitos

- Conta Oracle Cloud (free tier disponível)
- SSH key configurada
- Domínio (opcional, para HTTPS)

### Passo 1: Criar Instância Compute

1. Acesse [Oracle Cloud Console](https://www.oracle.com/cloud/sign-in/)
2. Vá para **Compute > Instances**
3. Clique em **Create Instance**
4. Configure:
   - **Name**: whatsapp-bot-manager
   - **Image**: Ubuntu 22.04 (Always Free eligible)
   - **Shape**: Ampere (A1) - 4 OCPUs, 24 GB RAM (free tier)
   - **SSH Key**: Adicione sua chave pública
5. Clique em **Create**

### Passo 2: Conectar via SSH

```bash
ssh -i sua-chave.key ubuntu@seu-ip-publico
```

### Passo 3: Instalar Dependências

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar pnpm
npm install -g pnpm

# Instalar Git
sudo apt install -y git

# Instalar MySQL Client (se usar banco remoto)
sudo apt install -y mysql-client

# Instalar PM2 (gerenciador de processos)
sudo npm install -g pm2
```

### Passo 4: Clonar Repositório

```bash
cd /home/ubuntu
git clone https://github.com/seu-usuario/whatsapp-bot-manager.git
cd whatsapp-bot-manager
```

### Passo 5: Configurar Variáveis de Ambiente

```bash
# Criar arquivo .env.local
nano .env.local

# Adicionar as seguintes variáveis:
DATABASE_URL=mysql://user:password@seu-banco.com:3306/whatsapp_bot
VITE_APP_ID=seu_manus_app_id
JWT_SECRET=seu_secret_aleatorio_minimo_32_caracteres
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
OWNER_NAME=Seu Nome
OWNER_OPEN_ID=seu_open_id
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=sua_chave
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
VITE_FRONTEND_FORGE_API_KEY=sua_chave_frontend
VITE_APP_TITLE=Zapflow
NODE_ENV=production
PORT=3000
```

### Passo 6: Instalar Dependências do Projeto

```bash
pnpm install
```

### Passo 7: Executar Migrações do Banco

```bash
pnpm drizzle-kit migrate
```

### Passo 8: Build para Produção

```bash
pnpm build
```

### Passo 9: Iniciar com PM2

```bash
# Iniciar aplicação
pm2 start dist/index.js --name "whatsapp-bot-manager"

# Salvar configuração do PM2
pm2 save

# Configurar PM2 para iniciar na boot
pm2 startup
```

### Passo 10: Configurar Nginx como Reverse Proxy (Opcional)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/whatsapp-bot-manager
```

Adicione:

```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/whatsapp-bot-manager /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Passo 11: Configurar SSL com Let's Encrypt (Recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Gerar certificado
sudo certbot --nginx -d seu-dominio.com

# Renovação automática
sudo systemctl enable certbot.timer
```

### Passo 12: Configurar Firewall

```bash
# Ativar firewall
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP
sudo ufw allow 80/tcp

# Permitir HTTPS
sudo ufw allow 443/tcp

# Verificar regras
sudo ufw status
```

## Opção 2: Oracle Database Cloud Service

Se preferir usar o banco de dados gerenciado da Oracle:

1. Vá para **Database > MySQL Database Service**
2. Clique em **Create DB System**
3. Configure conforme necessário
4. Copie a string de conexão
5. Use em `DATABASE_URL` no `.env.local`

## Opção 3: Supabase (PostgreSQL Gerenciado)

Alternativa mais simples usando Supabase:

1. Crie projeto em [supabase.com](https://supabase.com)
2. Copie a connection string
3. Adapte o schema para PostgreSQL se necessário
4. Use em `DATABASE_URL`

## Monitoramento e Manutenção

### Ver logs da aplicação

```bash
pm2 logs whatsapp-bot-manager
```

### Reiniciar aplicação

```bash
pm2 restart whatsapp-bot-manager
```

### Parar aplicação

```bash
pm2 stop whatsapp-bot-manager
```

### Deletar aplicação do PM2

```bash
pm2 delete whatsapp-bot-manager
```

### Monitorar recursos

```bash
pm2 monit
```

## Troubleshooting

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Erro: "Port 3000 already in use"

```bash
# Encontrar processo usando porta 3000
lsof -i :3000

# Matar processo
kill -9 <PID>
```

### Erro: "Database connection failed"

- Verificar `DATABASE_URL`
- Confirmar que o banco está acessível
- Verificar firewall rules

### Erro: "OAuth not working"

- Verificar `VITE_APP_ID`
- Confirmar que a URL de callback está registrada no Manus

## Backup e Recuperação

### Backup do banco de dados

```bash
# MySQL
mysqldump -h seu-host -u user -p database > backup.sql

# Restaurar
mysql -h seu-host -u user -p database < backup.sql
```

### Backup de arquivos

```bash
# Criar arquivo comprimido
tar -czf whatsapp-bot-manager-backup.tar.gz /home/ubuntu/whatsapp-bot-manager

# Copiar para segurança
scp -i sua-chave.key ubuntu@seu-ip:/home/ubuntu/whatsapp-bot-manager-backup.tar.gz ./
```

## Escalabilidade Futura

Para crescimento futuro:

1. **Load Balancer**: Use Oracle Load Balancer para distribuir tráfego
2. **Multiple Instances**: Deploy em múltiplas instâncias
3. **CDN**: Use Oracle CDN para conteúdo estático
4. **Cache**: Implemente Redis para cache
5. **Message Queue**: Use RabbitMQ para processamento assíncrono

## Custos

A Oracle Cloud oferece free tier com:
- 4 OCPUs Ampere
- 24 GB RAM
- 200 GB storage
- Tráfego de saída limitado

Suficiente para iniciar. Upgrade conforme necessário.

## Suporte

Para problemas:

1. Verificar logs: `pm2 logs whatsapp-bot-manager`
2. Consultar documentação Oracle Cloud
3. Abrir issue no GitHub
