import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./src/server/routers/index.ts";
import cookieParser from "cookie-parser";
import { registerWhatsAppRoutes } from "./src/server/routes/whatsapp.ts";
import { registerGoogleAuthRoutes } from "./src/server/routes/google.ts";
import { restoreActiveSessions } from "./src/server/services/baileys.service.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // API placeholder
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // tRPC implementation
  app.use(
    "/api/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: ({ req, res }) => {
        // No futuro, extrairemos o usuário do cookie/JWT aqui
        // Por enquanto, simulamos o admin padrão
        return {
          user: {
            id: 1,
            nome: "Admin",
            email: "admin@sistema.com",
            role: "admin",
            empresaId: 1, // Atribuindo empresa 1 para testes
          }
        };
      },
    })
  );

  // WhatsApp Routes
  registerWhatsAppRoutes(app);
  // Google Routes
  registerGoogleAuthRoutes(app);

  // Restore sessions
  restoreActiveSessions().catch(console.error);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
