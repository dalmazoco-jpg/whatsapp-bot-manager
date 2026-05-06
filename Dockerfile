FROM node:22-slim AS builder
WORKDIR /app

# Instalar git e dependências de build
RUN apt-get update && apt-get install -y git python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.4.1

# Copiar e instalar dependências
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

# Copiar código e fazer build
COPY . .
RUN pnpm build

FROM node:22-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y git python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.4.1

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
