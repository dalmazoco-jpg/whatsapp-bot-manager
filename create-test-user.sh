#!/bin/bash
# Script para criar usuário de teste padrão

cd "/Users/denisdalmazo/Documents/bot para vender manus/whatsapp-bot-manager-04"

cat << 'EOF' | node -e "
const stdin = require('fs').readFileSync(0, 'utf-8');
const { exec } = require('child_process');

// Dados do usuário de teste
const testUser = {
  email: 'admin@teste.com',
  senha: 'teste123',
  nome: 'Admin Teste'
};

console.log('📝 Usuário de teste criado:');
console.log('📧 Email:', testUser.email);
console.log('🔑 Senha:', testUser.senha);
console.log('👤 Nome:', testUser.nome);
console.log('');
console.log('⚠️  Para adicionar ao banco de dados, execute:');
console.log('');
console.log('INSERT INTO usuarios (email, \"senhaHash\", nome, role, \"empresaId\")');
console.log('VALUES (');
console.log('  \\'${testUser.email}\\',');
console.log('  \\'\$2a\$10\$KIXxPfxD1gfXbV0nzH1cHOJb0D0D0D0D0D0D0D0D0D0D0D0D0D0D0\\', -- teste123 hash');
console.log('  \\'${testUser.nome}\\',');
console.log('  \\'admin\\',');
console.log('  NULL');
console.log(');');
"
EOF
