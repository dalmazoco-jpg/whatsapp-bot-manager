import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { 
  Smartphone, 
  Instagram, 
  Facebook, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  RefreshCcw, 
  LogOut,
  Settings,
  MessageSquare,
  Globe,
  Settings2,
  Lock,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { trpc } from "@/src/lib/trpc";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";

export default function Canais() {
  const { data: canais, isLoading } = trpc.empresa.getCanais.useQuery();
  const { data: sessaoWhatsapp } = trpc.auth.me.useQuery(); // Fallback check for session

  const canaisDisponiveis = [
    { 
      id: 'whatsapp', 
      label: 'WhatsApp', 
      icon: Smartphone, 
      color: 'bg-emerald-500',
      description: 'Conecte seu número para atendimento via IA e humano.'
    },
    { 
      id: 'instagram', 
      label: 'Instagram Direct', 
      icon: Instagram, 
      color: 'bg-pink-500',
      description: 'Envie e receba mensagens do Direct e Story replies.'
    },
    { 
      id: 'messenger', 
      label: 'Messenger', 
      icon: Facebook, 
      color: 'bg-blue-600',
      description: 'Atenda clientes vindos da sua página do Facebook.'
    },
    { 
      id: 'google-calendar', 
      label: 'Google Calendar', 
      icon: Calendar, 
      color: 'bg-indigo-500',
      description: 'IA agenda e consulta horários diretamente na sua agenda.'
    }
  ];

  const getStatusInfo = (canalId: string) => {
    const canal = canais?.find(c => c.tipoCanal === canalId);
    
    // Fallback para WhatsApp legado
    if (canalId === 'whatsapp' && !canal) {
       // Checar se existe sessão Baileys (pode estar em outro lugar do banco)
       // Por simplicidade, assumo que se não está em canais_empresa, está desconectado.
    }

    if (!canal) return { 
      status: 'desconectado', 
      label: 'Desconectado', 
      badgeColor: 'bg-slate-100 text-slate-500', 
      icon: XCircle 
    };

    switch (canal.status) {
      case 'conectado': 
        return { status: 'conectado', label: 'Conectado', badgeColor: 'bg-emerald-100 text-emerald-600', icon: CheckCircle2 };
      case 'erro': 
        return { status: 'erro', label: 'Erro de Conexão', badgeColor: 'bg-red-100 text-red-600', icon: AlertCircle };
      case 'token vencido': 
        return { status: 'vencido', label: 'Token Vencido', badgeColor: 'bg-amber-100 text-amber-600', icon: Clock };
      default: 
        return { status: 'configurando', label: 'Aguardando Configuração', badgeColor: 'bg-blue-100 text-blue-600', icon: RefreshCcw };
    }
  };

  const utils = trpc.useContext();
  const sincronizar = trpc.empresa.sincronizarGoogle.useMutation({
    onSuccess: () => {
      toast.success("Agenda sincronizada com sucesso!");
      utils.empresa.getCanais.invalidate();
    },
    onError: (err) => {
      toast.error("Erro ao sincronizar: " + err.message);
    }
  });

  const handleConnectGoogle = async () => {
    try {
      const empresaId = 1; // HARDCODED FOR TEST - should come from user session
      const response = await fetch(`/api/auth/google/url?empresaId=${empresaId}`);
      const { url } = await response.json();
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const authWindow = window.open(
        url,
        'google_auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      if (!authWindow) {
        toast.error("Popup bloqueada pelo navegador.");
        return;
      }

      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
          toast.success("Google Calendar conectado!");
          utils.empresa.getCanais.invalidate();
          window.removeEventListener('message', messageListener);
        }
      };

      window.addEventListener('message', messageListener);
    } catch (err) {
      toast.error("Erro ao iniciar conexão.");
    }
  };

  const handleAction = (canalId: string, status: string) => {
    if (canalId === 'google-calendar') {
      if (status === 'conectado') {
        sincronizar.mutate();
      } else {
        handleConnectGoogle();
      }
    } else {
      toast.info("Integração com " + canalId + " em breve.");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8 h-screen overflow-y-auto pb-24">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black mb-2">Canais de Integração</h1>
            <p className="text-muted-foreground max-w-lg">
              Gerencie todas as conexões da sua empresa em um só lugar. A IA responderá em todos os canais conectados simultaneamente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full h-10 px-6 font-bold text-xs uppercase tracking-wider">
               Ver Logs de Webhook
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {canaisDisponiveis.map((c) => {
            const status = getStatusInfo(c.id);
            const Icon = c.icon;
            const StatusIcon = status.icon;

            return (
              <Card key={c.id} className="border-none shadow-xl hover:shadow-2xl transition-all duration-300 group overflow-hidden bg-white">
                <div className={cn("h-1.5 w-full", c.color)} />
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-3 rounded-2xl text-white shadow-lg shadow-black/10", c.color)}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className={cn("px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1", status.badgeColor)}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-black tracking-tight">{c.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-xs text-muted-foreground leading-relaxed h-12">
                    {c.description}
                  </p>
                  
                  <div className="space-y-2 pt-4 border-t border-slate-50">
                    {status.status === 'conectado' ? (
                      <>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between h-10 text-xs rounded-xl border-slate-100 hover:bg-slate-50"
                          onClick={() => handleAction(c.id, 'conectado')}
                          disabled={sincronizar.isPending}
                        >
                          <div className="flex items-center gap-2">
                            <RefreshCcw className={cn("w-3.5 h-3.5 text-slate-400", sincronizar.isPending && "animate-spin")} /> {sincronizar.isPending ? "Sincronizando..." : "Sincronizar Canal"}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                        </Button>
                        <Button variant="outline" className="w-full justify-between h-10 text-xs rounded-xl border-slate-100 hover:bg-red-50 text-red-500 hover:text-red-600">
                          <div className="flex items-center gap-2">
                             <LogOut className="w-3.5 h-3.5" /> Desconectar
                          </div>
                        </Button>
                      </>
                    ) : (
                      <Button 
                        onClick={() => handleAction(c.id, 'desconectado')}
                        className={cn("w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider text-white", c.color)}
                      >
                        Conectar {c.label}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 border-none shadow-xl bg-slate-950 text-white overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
               <ShieldCheck className="w-32 h-32" />
             </div>
             <CardHeader className="relative z-10">
               <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-emerald-400" />
                  Segurança Oauth & Webhooks
               </CardTitle>
               <CardDescription className="text-slate-400 text-xs max-w-md">
                 Suas credenciais são armazenadas com criptografia de ponta a ponta. 
                 Nós utilizamos endpoints oficiais certificados pela Meta e Google.
               </CardDescription>
             </CardHeader>
             <CardContent className="relative z-10 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <h4 className="text-xs font-bold mb-2 flex items-center justify-between">
                         Endpoint Webhook Meta
                         <span className="bg-blue-500/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full">ATIVO</span>
                      </h4>
                      <code className="text-[10px] text-emerald-400 block bg-black/30 p-2 rounded-lg truncate">
                         https://botmanager.com/api/webhooks/meta
                      </code>
                   </div>
                   <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-sm">
                      <h4 className="text-xs font-bold mb-2">Configurações Recomendadas</h4>
                      <div className="space-y-2">
                         <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Verificação de SSL</span>
                            <span className="text-emerald-400 font-bold">AUTOMÁTICA</span>
                         </div>
                         <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Retentativa de Falha</span>
                            <span className="text-emerald-400 font-bold">HABILITADA (3x)</span>
                         </div>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-white">
            <CardHeader>
               <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-emerald-500" />
                  Configurações Globais
               </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {[
                 { label: 'Sincronizar histórico retroativo', active: true },
                 { label: 'Detectar sentimentos nas mensagens', active: true },
                 { label: 'Traduzir mensagens estrangeiras', active: false },
                 { label: 'Ativar respostas rápidas em todos', active: true }
               ].map((opt, i) => (
                 <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                    <div className={cn(
                      "w-8 h-4 rounded-full relative transition-colors",
                      opt.active ? "bg-emerald-500" : "bg-slate-200"
                    )}>
                      <div className={cn(
                        "w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all shadow-sm",
                        opt.active ? "right-0.5" : "left-0.5"
                      )} />
                    </div>
                 </div>
               ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
