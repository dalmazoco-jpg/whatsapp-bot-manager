import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
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
} from "@/src/components/ui/sidebar";
import { useIsMobile } from "@/src/hooks/useMobile";
import { trpc } from "@/src/lib/trpc";
import { APP_MODULES, getEmpresaModules, MASTER_ADMIN_EMAIL } from "@/src/lib/modules";
import { unwrapTrpcData } from "@/src/lib/trpcData";
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
import * as React from "react";
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
      path: (module as any).path,
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
      window.location.href = "/login";
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        collapsible="none"
        className="border-r"
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
              <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none">
                <Avatar className="h-9 w-9 border shrink-0">
                  <AvatarFallback className="text-xs font-medium bg-emerald-500/10 text-emerald-600">
                    {me.nome?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-none">
                    {me.nome || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1">
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

      <SidebarInset className="flex w-full flex-col overflow-hidden">
        {isDelegated && (
          <div className="bg-yellow-50 dark:bg-yellow-950/30 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <AlertCircle className="w-4 h-4" />
              <span>Acessando como: <strong>{me.empresa?.nome || "Cliente"}</strong></span>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              className="border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-200 dark:hover:bg-yellow-900"
              onClick={() => setLocation("/clientes")}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </div>
        )}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40 shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SidebarTrigger className="h-9 w-9" />
              <span>{activeMenuItem?.label ?? "Menu"}</span>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </SidebarInset>
    </div>
  );
}
