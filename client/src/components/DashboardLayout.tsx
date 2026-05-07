import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { APP_MODULES, getEmpresaModules, MASTER_ADMIN_EMAIL } from "@/lib/modules";
import { unwrapTrpcData } from "@/lib/trpcData";
import {
  LogOut,
  ShoppingBag,
  Calendar,
  UtensilsCrossed,
  Shield,
  MessageSquare,
  Package,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: meData, isLoading } = trpc.auth.me.useQuery(undefined, {
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
    empresa?: { nome: string; ramo?: string; configBot?: unknown } | null;
  } | null>(meData);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (isLoading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!me) {
    return <>{children}</>;
  }

  const isAdmin = me.role === "admin";
  const isMasterAdmin = isAdmin && me.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
  const isDelegated = me.isDelegated || false;
  const ramo = me.empresa?.ramo || "outro";
  const enabledModules = new Set(getEmpresaModules(me.empresa));

  // Rótulos dinâmicos por ramo
  const labels: Record<string, { cardapio: string; icon: any }> = {
    pizzaria: { cardapio: "Cardápio", icon: UtensilsCrossed },
    adega: { cardapio: "Produtos", icon: ShoppingBag },
    consultorio: { cardapio: "Serviços", icon: Calendar },
    loja: { cardapio: "Catálogo", icon: ShoppingBag },
    outro: { cardapio: "Itens", icon: Package },
  };

  const currentLabels = labels[ramo as keyof typeof labels] || labels.outro;

  const moduleMenuItems = APP_MODULES
    .filter((module) => isAdmin || enabledModules.has(module.id))
    .map((module) => ({
      icon: module.id === "cardapio" ? currentLabels.icon : module.icon,
      label: module.id === "cardapio" ? currentLabels.cardapio : module.label,
      path: module.path,
    }));

  const menuItems = [
    ...(isMasterAdmin ? [{ icon: Shield, label: "Admin", path: "/admin" }] : []),
    ...moduleMenuItems,
  ];


  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent
        me={me}
        menuItems={menuItems}
        isDelegated={isDelegated}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type MenuItem = { icon: React.ComponentType<{ className?: string }>; label: string; path: string };

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  me: { id: number; nome: string; email: string; role: string; empresaId: number | null; isDelegated?: boolean; empresa?: { nome: string; ramo?: string } | null };
  menuItems: MenuItem[];
  isDelegated: boolean;
};

function DashboardLayoutContent({
  children,
  me,
  menuItems,
  isDelegated,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      localStorage.removeItem("auth_token");
      localStorage.removeItem("admin_auth_token");
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleReturnToAdmin = () => {
    const adminToken = localStorage.getItem("admin_auth_token");
    if (!adminToken) {
      window.location.href = "/login";
      return;
    }

    localStorage.setItem("auth_token", adminToken);
    localStorage.removeItem("admin_auth_token");
    document.cookie = `app_session_token=${adminToken}; path=/; SameSite=Lax`;
    window.location.href = "/admin";
  };

  return (
    <>
      <div className="relative">
        <Sidebar
          collapsible="none"
          className="border-r-0"
          disableTransition
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-colors w-full">
              <MessageSquare className="w-5 h-5 text-emerald-500 shrink-0" />
              <span className="font-semibold tracking-tight truncate">
                Bot Manager
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path || (item.path === "/dashboard" && location === "/");
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-colors font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-emerald-500" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-emerald-500/10 text-emerald-600">
                      {me.nome?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {me.nome || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {me.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
      </div>

      <SidebarInset>
        {isDelegated && (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4" />
              <span>Acessando como: <strong>{me.empresa?.nome || "Cliente"}</strong></span>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200 dark:hover:bg-yellow-900"
              onClick={handleReturnToAdmin}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </div>
        )}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-0">{children}</main>
      </SidebarInset>
    </>
  );
}
