import {
  ArrowLeftRight,
  Bot,
  Calendar,
  Layout,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { MASTER_ADMIN_EMAIL } from "../../shared/platform";

export { MASTER_ADMIN_EMAIL };

export const REQUIRED_MODULES = ["dashboard", "canais", "atendimento", "agendamentos", "configuracoes"] as const;

export const APP_MODULES = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutDashboard, required: true },
  { id: "canais", label: "Canais", path: "/canais", icon: ArrowLeftRight, required: true },
  { id: "atendimento", label: "Central de Atendimento", path: "/atendimento", icon: MessageSquare, required: true },
  { id: "agendamentos", label: "Agendas", path: "/agendamentos", icon: Calendar, required: true },
  { id: "whatsapp", label: "WhatsApp Antigo", path: "/whatsapp", icon: Smartphone, required: false },
  { id: "testar-ia", label: "Laboratório IA", path: "/testar-ia", icon: Bot, required: true },
  { id: "campanhas", label: "Campanhas", path: "/campanhas", icon: Megaphone, required: false },
  { id: "cardapio", label: "Itens", path: "/cardapio", icon: Package, required: false },
  { id: "apresentacao", label: "Folder & Marketing", path: "/dashboard/apresentacao", icon: Layout, required: false },
  { id: "clientes", label: "Clientes", path: "/clientes", icon: Users, required: false },
  { id: "pedidos", label: "Pedidos", path: "/pedidos", icon: ShoppingBag, required: false },
  { id: "financeiro", label: "Financeiro", path: "/financeiro", icon: TrendingUp, required: false },
  { id: "configuracoes", label: "Configurações", path: "/configuracoes", icon: Settings, required: true },
] as const;

export type AppModuleId = (typeof APP_MODULES)[number]["id"];

export const DEFAULT_MODULES: AppModuleId[] = APP_MODULES.map((module) => module.id);

export const BASIC_MODULES: AppModuleId[] = [
  ...REQUIRED_MODULES,
  "cardapio",
  "clientes",
];

export function normalizeModules(value: unknown): AppModuleId[] {
  const requested = Array.isArray(value) ? value : DEFAULT_MODULES;
  const valid = new Set(APP_MODULES.map((module) => module.id));
  const modules = new Set<AppModuleId>();

  for (const module of REQUIRED_MODULES) modules.add(module);
  for (const module of requested) {
    if (typeof module === "string" && valid.has(module as AppModuleId)) {
      modules.add(module as AppModuleId);
    }
  }

  return APP_MODULES.filter((module) => modules.has(module.id)).map((module) => module.id);
}

export function getEmpresaModules(empresa?: { configBot?: unknown; modules?: unknown } | null) {
  const configBot = empresa?.configBot && typeof empresa.configBot === "object" ? empresa.configBot as any : null;
  return normalizeModules(empresa?.modules ?? configBot?.modules);
}
