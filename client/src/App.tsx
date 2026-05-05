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
import { trpc } from "./lib/trpc";
import { useState, useCallback } from "react";

function Router() {
  const [location] = useLocation();
  const isPublicRoute = location.startsWith("/public/");
  const { data: me, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [forceLogin, setForceLogin] = useState(false);

  const handleLoginSuccess = useCallback(() => {
    setForceLogin(false);
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!me && !isPublicRoute) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = me?.role === "admin";

  return (
    <Switch>
      {/* Dashboard principal */}
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />

      {/* Admin (somente admin) */}
      {isAdmin && <Route path="/admin" component={Admin} />}
      {isAdmin && <Route path="/admin/cliente/:empresaId" component={AdminClienteConexao} />}

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
