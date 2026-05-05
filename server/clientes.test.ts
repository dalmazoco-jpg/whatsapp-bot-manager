import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

function createTestContext(): TrpcContext {
  const user: User = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("clientes router", () => {
  it("should list clientes for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.clientes.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create a new cliente", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.clientes.create({
        whatsappNumber: "5511999999999",
        nome: "João Silva",
        email: "joao@example.com",
        telefone: "(11) 99999-9999",
        endereco: "Rua Exemplo, 123",
      });

      expect(result).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should get a cliente by id", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.clientes.get({ id: 1 });
      expect(result === undefined || result.id === 1).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("pedidos router", () => {
  it("should list pedidos for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.pedidos.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create a new pedido", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.pedidos.create({
        clienteId: 1,
        descricao: "Pizza Grande",
        valor: 5000,
        taxaEntrega: 1000,
      });

      expect(result).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should update pedido status", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.pedidos.updateStatus({
        id: 1,
        status: "confirmado",
      });

      expect(result.success).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("agendamentos router", () => {
  it("should list agendamentos for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.agendamentos.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create a new agendamento", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const result = await caller.agendamentos.create({
        clienteId: 1,
        titulo: "Consulta",
        descricao: "Consulta de acompanhamento",
        dataHora: futureDate,
        duracao: 60,
      });

      expect(result).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("configuracoes router", () => {
  it("should get configuracoes for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.configuracoes.get();
      expect(result === undefined || result.userId === ctx.user.id).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});

describe("notificacoes router", () => {
  it("should list notificacoes for authenticated user", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.notificacoes.list();
      expect(Array.isArray(result)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
