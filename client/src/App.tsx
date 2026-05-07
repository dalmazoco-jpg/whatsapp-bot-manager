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
import { APP_MODULES, getEmpresaModules, MASTER_ADMIN_EMAIL } from "./lib/modules";
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
    empresa?: { nome: string; ramo?: string; configBot?: unknown; ativo?: boolean; licencaExpira?: string | Date | null } | null;
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
  const isMasterAdmin = isAdmin && me?.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
  const enabledModules = new Set(getEmpresaModules(me?.empresa));
  const isRequiredOperationalModule = (moduleId: string) => ["dashboard", "whatsapp", "configuracoes"].includes(moduleId);
  const licenseActive = isAdmin || !me?.empresa || (
    me.empresa.ativo !== false &&
    (!me.empresa.licencaExpira || new Date(me.empresa.licencaExpira).getTime() >= Date.now())
  );
  const ModuleOnly = ({ moduleId, children }: { moduleId: string; children: React.ReactNode }) => {
    if (!licenseActive && !isRequiredOperationalModule(moduleId)) {
      return (
        <DashboardLayout>
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-xl rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-6">
              <h1 className="typography-h2 mb-2">Licença vencida</h1>
              <p className="text-muted-foreground mb-4">
                Regularize a mensalidade para liberar novamente os módulos do plano.
              </p>
              <button
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                onClick={() => setLocation("/configuracoes")}
              >
                Ir para pagamento
              </button>
            </div>
          </div>
        </DashboardLayout>
      );
    }

    if (isAdmin || enabledModules.has(moduleId as any)) return <>{children}</>;

    const moduleLabel = APP_MODULES.find((module) => module.id === moduleId)?.label || "módulo";
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl rounded-lg border border-border bg-background p-6">
            <h1 className="typography-h2 mb-2">Módulo não liberado</h1>
            <p className="text-muted-foreground">
              O módulo {moduleLabel} não faz parte do plano desta empresa.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  };
  const AdminOnly = ({ children }: { children: React.ReactNode }) => {
    if (isMasterAdmin) return <>{children}</>;

    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-xl rounded-lg border border-border bg-background p-6">
            <h1 className="typography-h2 mb-2">Acesso de administrador necessário</h1>
            <p className="text-muted-foreground mb-4">
              Você está logado como {me?.email || "usuário"} com perfil {me?.role || "desconhecido"}.
              O painel admin fica disponível apenas para {MASTER_ADMIN_EMAIL}.
            </p>
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
      <Route path="/cardapio" component={() => <ModuleOnly moduleId="cardapio"><Cardapio /></ModuleOnly>} />
      <Route path="/dashboard/apresentacao" component={() => <ModuleOnly moduleId="apresentacao"><Apresentacao /></ModuleOnly>} />
      <Route path="/public/:slug" component={PublicApresentacao} />
      <Route path="/clientes" component={() => <ModuleOnly moduleId="clientes"><Clientes /></ModuleOnly>} />
      <Route path="/pedidos" component={() => <ModuleOnly moduleId="pedidos"><Pedidos /></ModuleOnly>} />
      <Route path="/agendamentos" component={() => <ModuleOnly moduleId="agendamentos"><Agendamentos /></ModuleOnly>} />
      <Route path="/financeiro" component={() => <ModuleOnly moduleId="financeiro"><Financeiro /></ModuleOnly>} />
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
