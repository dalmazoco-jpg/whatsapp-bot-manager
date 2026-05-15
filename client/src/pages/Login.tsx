import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, MessageSquare, Lock, Mail, Loader2 } from "lucide-react";
import { MASTER_ADMIN_EMAIL } from "@/lib/modules";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState(MASTER_ADMIN_EMAIL);
  const [senha, setSenha] = useState("master2026m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get("google");
    if (google === "nao-cadastrado") {
      setError("Este e-mail do Google ainda não está cadastrado no sistema. Entre com email/senha ou peça ao admin para cadastrar.");
    } else if (google === "erro") {
      setError("Não foi possível concluir o login com Google. Tente novamente.");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao fazer login");
        return;
      }

      // Salvar token no localStorage como backup
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }

      window.location.href = data.user?.role === "admin" ? "/admin" : "/dashboard";
      onLoginSuccess();
    } catch (err) {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotMessage("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        setForgotMessage(data.error || "Erro ao enviar solicitação");
        return;
      }

      setForgotMessage("Instruções enviadas para seu email!");
      setForgotEmail("");
    } catch (err) {
      setForgotMessage("Erro de conexão. Tente novamente.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/google-url", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        const detail = data.redirectUri ? ` Redirect URI: ${data.redirectUri}` : "";
        setError(`${data.error || "Login com Google indisponível."}${detail}`);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Erro ao iniciar login com Google.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-slate-700 bg-slate-800/80 backdrop-blur-xl shadow-2xl">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Zapflow
          </CardTitle>
          <p className="text-sm text-slate-400 mt-1">
            Faça login para acessar seu painel
          </p>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>

            <Button
              id="login-submit"
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium shadow-lg shadow-emerald-500/20 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700" />
            <span className="text-xs text-slate-500">ou</span>
            <div className="h-px flex-1 bg-slate-700" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full border-slate-600 bg-slate-700/30 text-slate-100 hover:bg-slate-700"
          >
            {googleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calendar className="w-4 h-4 mr-2" />}
            {googleLoading ? "Conectando..." : "Entrar com Google e liberar Agenda"}
          </Button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Esqueceu a senha?
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-700 text-center space-y-2 text-xs text-slate-500">
            <p>Admin padrão: admin@sistema.com / admin123</p>
            <p>Admin master: dalmazo.co@gmail.com / master2026m</p>
            <p>Ao usar o login admin master, você entra direto no painel admin sem precisar escolher empresa.</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Esqueceu a senha?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Digite seu email para receber instruções de redefinição de senha.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword}>
            <div className="space-y-4 py-4">
              {forgotMessage && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  forgotMessage.includes("Erro") 
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : "bg-green-500/10 border border-green-500/20 text-green-400"
                }`}>
                  {forgotMessage}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {forgotLoading ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
