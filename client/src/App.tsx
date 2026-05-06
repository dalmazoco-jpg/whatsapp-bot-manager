import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Admin from "./pages/Admin";
import Clientes from "./pages/Clientes";
import Pedidos from "./pages/Pedidos";
import Agendamentos from "./pages/Agendamentos";
import Configuracoes from "./pages/Configuracoes";
import ConexaoWhatsApp from "./pages/ConexaoWhatsApp";
import Cardapio from "./pages/Cardapio";
import Financeiro from "./pages/Financeiro";
import AdminClienteConexao from "./pages/AdminClienteConexao";
import Apresentacao from "./pages/Apresentacao";
import PublicApresentacao from "./pages/PublicApresentacao";
import DashboardLayout from "./components/DashboardLayout";
import { trpc } from "./lib/trpc";
import { unwrapTrpcData } from "./lib/trpcData";
import { useState, useCallback } from "react";

function Router() {
  const [location, setLocation] = useLocation();
  const isPublicRoute = location.startsWith("/public/");
  const isLoginRoute = location === "/login";
  
  // Only query if not on login/public routes
  const queryEnabled = !isPublicRoute && !isLoginRoute;
  const { data: meData, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    enabled: queryEnabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const me = unwrapTrpcData<{
    id: number;
    nome: string;
    email: string;
    role: string;
    empresaId: number | null;
    isDelegated?: boolean;
    empresa?: { nome: string; ramo?: string } | null;
  } | null>(meData);

  const [forceLogin, setForceLogin] = useState(false);

  const handleLoginSuccess = useCallback(() => {
    setForceLogin(false);
    refetch();
    setLocation("/dashboard");
  }, [refetch, setLocation]);

  // If we're on login route, skip loading check and render login directly
  if (isLoginRoute) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // For non-login routes, show loading while checking auth
  if (queryEnabled && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if ((!me || forceLogin) && !isPublicRoute) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = me?.role === "admin";
  const AdminOnly = ({ children }: { children: React.ReactNode }) => {
    if (isAdmin) return <>{children}</>;

    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl rounded-lg border border-border bg-background p-6">
            <h1 className="typography-h2 mb-2">Acesso de administrador necessário</h1>
            <p className="text-muted-foreground mb-4">
              Você está logado como {me?.email || "usuário"} com perfil {me?.role || "desconhecido"}.
              Saia dessa conta e entre com o master admin para criar empresas e clientes.
            </p>
            <div className="text-xs text-muted-foreground">
              <p>Debug info:</p>
              <p>isAdmin: {isAdmin ? 'true' : 'false'}</p>
              <p>me exists: {me ? 'true' : 'false'}</p>
              <p>me.role: {me?.role}</p>
              <p>me.email: {me?.email}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  };

  return (
    <Switch>
      {/* Dashboard principal */}
      <Route path="/login" component={() => <Login onLoginSuccess={handleLoginSuccess} />} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />

      {/* Admin */}
      <Route path="/admin" component={() => <AdminOnly><Admin /></AdminOnly>} />
      <Route path="/admin/cliente/:empresaId" component={() => <AdminOnly><AdminClienteConexao /></AdminOnly>} />

      {/* Empresa pages */}
      <Route path="/whatsapp" component={ConexaoWhatsApp} />
      <Route path="/cardapio" component={Cardapio} />
      <Route path="/dashboard/apresentacao" component={Apresentacao} />
      <Route path="/public/:slug" component={PublicApresentacao} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/pedidos" component={Pedidos} />
      <Route path="/agendamentos" component={Agendamentos} />
      <Route path="/financeiro" component={Financeiro} />
      <Route path="/configuracoes" component={Configuracoes} />

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
