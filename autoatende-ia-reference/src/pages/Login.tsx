import * as React from "react";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { trpc } from "@/src/lib/trpc";
import { toast } from "sonner";

export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const seedMutation = trpc.system.seed.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login for now as we don't have a real login logic yet
    onLoginSuccess();
  };

  const handleSeed = async () => {
    try {
      const res = await seedMutation.mutateAsync();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.info(res.message);
      }
    } catch (err) {
      toast.error("Erro ao inicializar banco de dados. Verifique o DATABASE_URL.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <div className="w-full max-w-sm space-y-8 bg-background p-8 rounded-xl shadow-lg border">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Bot Manager</h1>
          <p className="text-muted-foreground mt-2">Entre na sua conta</p>
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-left">
            <p className="text-[10px] font-bold uppercase text-emerald-800">Acesso Padrão</p>
            <p className="text-xs text-emerald-700">Email: <span className="font-mono font-bold">admin@sistema.com</span></p>
            <p className="text-xs text-emerald-700">Senha: <span className="font-mono font-bold">admin123</span></p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            Acessar Painel
          </Button>
        </form>

        <div className="pt-4 border-t text-center">
          <button 
            onClick={handleSeed}
            disabled={seedMutation.isPending}
            className="text-xs text-muted-foreground hover:underline"
          >
            {seedMutation.isPending ? "Inicializando..." : "Tentar Inicialização do Sistema (PostgreSQL)"}
          </button>
        </div>
      </div>
    </div>
  );
}
