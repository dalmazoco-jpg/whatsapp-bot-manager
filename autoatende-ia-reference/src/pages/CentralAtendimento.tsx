import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent } from "@/src/components/ui/card";
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Instagram, 
  Facebook, 
  Smartphone, 
  MoreVertical, 
  Send, 
  User, 
  Bot, 
  Clock, 
  Check, 
  CheckCheck,
  Calendar,
  Package,
  FileText,
  UserCheck,
  Slash,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Layout
} from "lucide-react";
import { trpc } from "@/src/lib/trpc";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

export default function CentralAtendimento() {
  const [selectedConversaId, setSelectedConversaId] = React.useState<number | null>(null);
  const [filter, setFilter] = React.useState("todos");
  const [message, setMessage] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: conversas, refetch: refetchConversas, isLoading: loadingConversas } = trpc.empresa.getConversas.useQuery();
  
  const selectedConversa = conversas?.find(c => c.id === selectedConversaId);
  
  // Usar query para mensagens (pode ser legado ou omni)
  const isOmni = (selectedConversa as any)?.canal !== undefined;
  
  const { data: mensagensOmni, refetch: refetchOmni } = trpc.empresa.getMensagensOmni.useQuery(selectedConversaId!, {
    enabled: !!selectedConversaId && isOmni,
    refetchInterval: 3000,
  });

  const { data: mensagensLegacy, refetch: refetchLegacy } = trpc.empresa.getMensagens.useQuery(selectedConversaId!, {
    enabled: !!selectedConversaId && !isOmni,
    refetchInterval: 3000,
  });

  const mensagens = isOmni ? mensagensOmni : mensagensLegacy;

  const enviarOmni = trpc.empresa.enviarMensagemOmni.useMutation({
    onSuccess: () => {
      setMessage("");
      refetchOmni();
      refetchConversas();
    }
  });

  const enviarLegacy = trpc.empresa.enviarMensagem.useMutation({
    onSuccess: () => {
      setMessage("");
      refetchLegacy();
      refetchConversas();
    }
  });

  const devolverIA = trpc.empresa.devolverConversaIA.useMutation({
    onSuccess: () => {
      toast.success("Conversa devolvida para a IA");
      refetchConversas();
    }
  });

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || !selectedConversaId) return;

    if (isOmni) {
      enviarOmni.mutate({ conversaId: selectedConversaId, texto: message });
    } else {
      enviarLegacy.mutate({ clienteId: selectedConversaId, texto: message });
    }
  };

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const filteredConversas = conversas?.filter(c => {
    if (filter === "todos") return true;
    if (filter === "whatsapp") return (c as any).canal === 'whatsapp' || (c as any).whatsappNumber !== undefined;
    if (filter === "instagram") return (c as any).canal === 'instagram';
    if (filter === "messenger") return (c as any).canal === 'messenger';
    if (filter === "humano") return (c as any).statusAtendimento === 'humano';
    return true;
  });

  const getCanalIcon = (conversa: any) => {
    if (conversa.canal === 'instagram') return <Instagram className="w-3 h-3 text-pink-500" />;
    if (conversa.canal === 'messenger') return <Facebook className="w-3 h-3 text-blue-500" />;
    return <Smartphone className="w-3 h-3 text-emerald-500" />;
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-slate-50 rounded-3xl border shadow-sm m-4 lg:m-8">
        {/* Sidebar */}
        <div className="w-80 border-r bg-white flex flex-col">
          <div className="p-4 border-b space-y-4">
            <h1 className="font-black text-xl tracking-tight">Central de Atendimento</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar cliente..." className="pl-9 bg-slate-100 border-none rounded-xl" />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <Button 
                variant={filter === "todos" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFilter("todos")}
                className="rounded-full px-4 h-8 text-xs font-bold"
              >
                Todos
              </Button>
              <Button 
                variant={filter === "humano" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFilter("humano")}
                className="rounded-full px-4 h-8 text-xs font-bold whitespace-nowrap"
              >
                Aguardando Humano
              </Button>
              <Button 
                variant={filter === "whatsapp" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFilter("whatsapp")}
                className="rounded-full px-4 h-8 text-xs font-bold"
              >
                WhatsApp
              </Button>
              <Button 
                variant={filter === "instagram" ? "default" : "outline"} 
                size="sm" 
                onClick={() => setFilter("instagram")}
                className="rounded-full px-4 h-8 text-xs font-bold"
              >
                Instagram
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loadingConversas ? (
              <div className="p-8 text-center text-slate-400 text-sm">Carregando conversas...</div>
            ) : filteredConversas?.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">Nenhuma conversa encontrada.</div>
            ) : (
              filteredConversas?.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConversaId(c.id)}
                  className={cn(
                    "w-full p-4 flex gap-3 border-b hover:bg-slate-50 transition-colors text-left relative",
                    selectedConversaId === c.id && "bg-emerald-50 hover:bg-emerald-50 border-r-4 border-r-emerald-500"
                  )}
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 border relative">
                    <User className="w-6 h-6 text-emerald-600" />
                    <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full border shadow-sm">
                      {getCanalIcon(c)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className="font-bold text-sm truncate">{c.nomeCliente || c.nome}</h3>
                      <span className="text-[10px] text-slate-400">
                        {c.ultimaInteracao ? new Date(c.ultimaInteracao).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mb-1">
                      {c.ultimaMensagem || c.whatsappNumber || c.username || 'Iniciando conversa...'}
                    </p>
                    <div className="flex gap-1">
                      {c.statusAtendimento === 'humano' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">HUMANO</span>
                      )}
                      {!c.iaAtiva && c.statusAtendimento !== 'humano' && (
                        <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">IA PAUSADA</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedConversa ? (
            <>
              {/* Header */}
              <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center border">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-sm text-slate-900">{(selectedConversa as any).nomeCliente || (selectedConversa as any).nome}</h3>
                       {getCanalIcon(selectedConversa)}
                    </div>
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {selectedConversa.statusAtendimento === 'humano' ? 'Aguardando Atendente' : 'Atendido por IA'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedConversa.statusAtendimento === 'humano' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-full h-8 text-xs font-bold"
                      onClick={() => devolverIA.mutate(selectedConversaId!)}
                      disabled={devolverIA.isPending}
                    >
                      <Bot className="w-3.5 h-3.5 mr-1.5" />
                      Devolver para IA
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100"><Clock className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-slate-100"><MoreVertical className="w-4 h-4" /></Button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
                <div className="flex justify-center mb-8">
                   <div className="bg-slate-200/50 backdrop-blur-sm text-slate-500 text-[10px] px-3 py-1 rounded-full font-medium uppercase tracking-wider">
                     Início do atendimento via {(selectedConversa as any).canal || 'WhatsApp'}
                   </div>
                </div>
                
                {mensagens?.map((m: any, i) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[80%] space-y-1",
                    m.direcao === "saida" ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "p-4 text-sm shadow-sm relative group",
                      m.direcao === "saida" 
                        ? "bg-emerald-600 text-white rounded-2xl rounded-tr-none" 
                        : "bg-white border rounded-2xl rounded-tl-none text-slate-800"
                    )}>
                      {m.conteudo}
                      <div className={cn(
                        "text-[10px] mt-1 flex items-center gap-1 opacity-70 justify-end",
                        m.direcao === "saida" ? "text-emerald-100" : "text-slate-400"
                      )}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {m.direcao === "saida" && <CheckCheck className="w-3 h-3" />}
                      </div>
                      
                      <div className={cn(
                         "absolute top-0 text-[9px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity",
                         m.direcao === "saida" ? "-left-12 text-slate-400" : "-right-12 text-slate-400"
                      )}>
                        {m.autor || 'IA'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 border-t bg-white">
                <div className="flex gap-2 mb-3">
                   <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-full border-slate-200">
                     <Calendar className="w-3 h-3 mr-1" /> Agendar
                   </Button>
                   <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-full border-slate-200">
                     <Package className="w-3 h-3 mr-1" /> Folder
                   </Button>
                   <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-full border-slate-200">
                     <FileText className="w-3 h-3 mr-1" /> Orçamento
                   </Button>
                </div>
                <form onSubmit={handleSend} className="relative">
                  <Input 
                    placeholder="Responda ao cliente..." 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="pr-12 h-14 bg-slate-100 border-none rounded-2xl focus-visible:ring-emerald-500 font-medium"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="absolute right-2 top-2 h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <div className="bg-slate-100 p-8 rounded-full mb-6">
                <MessageSquare className="w-16 h-16 opacity-20" />
              </div>
              <h3 className="font-bold text-slate-600 text-lg">Central Omni Ativa</h3>
              <p className="text-sm max-w-xs text-center mt-2 opacity-70">
                Selecione uma conversa ao lado para responder mensagens do WhatsApp, Instagram ou Messenger.
              </p>
            </div>
          )}
        </div>

        {/* Right Info Panel (Optional) */}
        {selectedConversa && (
          <div className="w-72 border-l bg-white hidden xl:flex flex-col p-6 space-y-8 overflow-y-auto">
             <div>
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Perfil do Cliente</h4>
               <div className="space-y-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center">
                     <UserCheck className="w-5 h-5 text-slate-500" />
                   </div>
                   <div>
                     <p className="text-xs font-black text-slate-900">{(selectedConversa as any).nomeCliente || (selectedConversa as any).nome}</p>
                     <p className="text-[10px] text-slate-400">{(selectedConversa as any).canalContatoId || (selectedConversa as any).whatsappNumber}</p>
                   </div>
                 </div>
               </div>
             </div>

             <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Tags e Segmentos</h4>
                <div className="flex flex-wrap gap-2">
                  {((selectedConversa as any).tags as string[] || []).map(t => (
                    <span key={t} className="bg-emerald-50 text-emerald-700 text-[10px] px-2 py-1 rounded-lg border border-emerald-100 font-bold">
                      {t}
                    </span>
                  )) || <span className="text-[10px] text-slate-400 italic">Sem tags...</span>}
                </div>
             </div>

             <div className="pt-6 border-t">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Ações Rápidas</h4>
                <div className="space-y-2">
                   <Button variant="outline" className="w-full justify-start text-xs rounded-xl h-10 border-slate-100">
                     <ArrowLeftRight className="w-3.5 h-3.5 mr-2 text-slate-400" /> Transferir Atendimento
                   </Button>
                   <Button variant="outline" className="w-full justify-start text-xs rounded-xl h-10 border-slate-100 text-red-500 hover:text-red-600 hover:bg-red-50">
                     <Slash className="w-3.5 h-3.5 mr-2" /> Bloquear Contato
                   </Button>
                </div>
             </div>

             <Card className="bg-slate-900 border-none text-white overflow-hidden shadow-xl mt-auto">
               <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Bot className="w-5 h-5 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-tighter">Status da IA</span>
                  </div>
                  <div className="space-y-1 mb-4">
                    <p className="text-xs font-bold">Atendimento Automático</p>
                    <p className="text-[10px] opacity-60">A IA está monitorando conversas nos 3 canais ativos.</p>
                  </div>
                  <Button className="w-full h-8 text-[10px] bg-emerald-600 hover:bg-emerald-500 border-none">
                    Ver Insights
                  </Button>
               </CardContent>
             </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
