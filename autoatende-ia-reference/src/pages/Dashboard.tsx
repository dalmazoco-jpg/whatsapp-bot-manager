import DashboardLayout from "@/src/components/DashboardLayout";
import { trpc } from "@/src/lib/trpc";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/src/components/ui/card";
import { 
  ShoppingBag, 
  Calendar, 
  DollarSign, 
  Users, 
  MessageSquare, 
  Zap, 
  ArrowUpRight, 
  BarChart3,
  Bot,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { motion } from "motion/react";
import AssistantDrawer from "@/src/components/AssistantDrawer";
import * as React from "react";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.empresa.getDashboardStats.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const empresa = (me as any)?.empresa;

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-1">
              Olá, {me?.nome?.split(' ')[0]} 👋
            </h1>
            <p className="text-muted-foreground">
              Seu assistente IA está{(me as any)?.empresa?.whatsappAtivo ? " ativo e atendendo." : " aguardando conexão."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 shadow-lg shadow-emerald-500/20">
              <Zap className="w-4 h-4 mr-2" />
              Impulsionar Vendas
            </Button>
            {empresa?.slug && (
              <Button 
                variant="outline" 
                className="rounded-full"
                onClick={() => window.open(`/public/${empresa.slug}`, '_blank')}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Ver Minha Página
              </Button>
            )}
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-none shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Vendas Hoje</CardTitle>
              <ShoppingBag className="h-4 w-4 opacity-70" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats?.pedidosHoje || 0}</div>
              <div className="flex items-center text-xs mt-1 text-emerald-100">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                <span>+12% desde ontem</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Agendamentos</CardTitle>
              <Calendar className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{stats?.agendamentosPendentes || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Pendentes para hoje</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Conversas IA</CardTitle>
              <MessageSquare className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">42</div>
              <p className="text-xs text-muted-foreground mt-1">Atendimentos automáticos</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Faturamento</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((stats?.faturamentoHoje || 0) / 100)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Acumulado do dia</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                Desempenho Semanal
              </CardTitle>
              <CardDescription>Resumo de conversas e conversões.</CardDescription>
            </CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center text-muted-foreground bg-slate-50/50 rounded-xl m-6 mt-0">
              [Gráfico de Atividade]
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-emerald-950 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                Assistente Interno
              </CardTitle>
              <CardDescription className="text-emerald-200/60">Peça ajuda para gerir seu negócio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-sm">
                "Crie uma promoção de combo para 4 pessoas com 15% de desconto"
              </div>
              <div className="bg-white/5 p-3 rounded-lg border border-white/10 text-sm">
                "Analise por que tive menos vendas ontem"
              </div>
              <Button 
                variant="outline" 
                className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => setIsAssistantOpen(true)}
              >
                Falar com a IA do Painel
              </Button>
            </CardContent>
          </Card>
        </div>

        <AssistantDrawer isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

        <div className="bg-white border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">Configure sua Página de Vendas</h2>
            <p className="text-muted-foreground mb-6">
              Gere automaticamente um folder, cardápio digital ou landing page para sua empresa e envie pelo WhatsApp com um clique.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-3.4 h-4 text-emerald-500" /> Folder Profissional
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cardápio Digital
              </div>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Landing Page
              </div>
            </div>
          </div>
          <div className="shrink-0">
             <Button 
                onClick={() => window.location.href = '/configuracoes'}
                className="rounded-full px-8 bg-slate-900 hover:bg-slate-800 text-white"
             >
               Configurar Materiais
             </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CheckCircle2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
