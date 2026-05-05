import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleLogin, handleRegister, handleLogout, handleMe } from "../auth";
import { registerWhatsAppRoutes } from "../routes/whatsapp.sse";
import { registerGoogleCalendarRoutes } from "../routes/google-calendar.routes";
import { restoreActiveSessions } from "../services/baileys.service";



function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Middleware base
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ============================================================
  // Auth REST routes
  // ============================================================
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/register", handleRegister);
  app.post("/api/auth/logout", handleLogout);
  app.get("/api/auth/me", handleMe);
  // Dev helper: gerar token admin local (development only)
  if (process.env.NODE_ENV === "development") {
    const { handleDevLogin } = await import("../auth");
    app.get("/api/auth/dev-login", handleDevLogin);
  }

  // ============================================================
  // WhatsApp SSE + REST routes
  // ============================================================
  registerWhatsAppRoutes(app);
  registerGoogleCalendarRoutes(app);

  // ============================================================
  // tRPC API
  // ============================================================
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        console.error(`TRPC ERROR on [${path}]:`, error);
      },
    })

  );

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("GLOBAL ERROR:", err);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });


  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

const port = Number(process.env.PORT) || 3000;

server.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📡 WhatsApp SSE: /api/whatsapp/qr-stream/:empresaId`);
  console.log(`🔐 Auth: /api/auth/login`);
});

  // Restaurar sessões Baileys ativas
  setTimeout(() => {
    restoreActiveSessions().catch((err) =>
      console.error("Erro ao restaurar sessões Baileys:", err)
    );
  }, 3000);
}

startServer().catch(console.error);


