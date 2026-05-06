import "dotenv/config";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { usuarios } from "./drizzle/schema";

async function seedMasterUser() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL não está configurada");
    process.exit(1);
  }

  try {
    const sql = postgres(DATABASE_URL, { ssl: "require", max: 10 });
    const db = drizzle(sql);

    const email = "dalmazo.co@gmail.com";
    const senhaHash = await bcrypt.hash("master2026m", 10);

    // Verificar se já existe
    const existing = await db
      .select()
      .from(usuarios)
      .where((t) => t.email === email)
      .limit(1);

    if (existing.length > 0) {
      console.log("✅ Usuário master já existe:", email);
      await sql.end();
      return;
    }

    // Inserir novo usuário master
    await db.insert(usuarios).values({
      email,
      senhaHash,
      nome: "Denis Dalmazo",
      role: "admin",
      empresaId: null,
    });

    console.log("✅ Usuário master criado com sucesso!");
    console.log("📧 Email: dalmazo.co@gmail.com");
    console.log("🔐 Senha: master2026m");
    console.log("👤 Role: admin");

    await sql.end();
  } catch (error) {
    console.error("❌ Erro ao criar usuário master:", error);
    process.exit(1);
  }
}

seedMasterUser();
