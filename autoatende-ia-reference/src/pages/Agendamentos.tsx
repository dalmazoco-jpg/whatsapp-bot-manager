import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  User, 
  Scissors, 
  Stethoscope, 
  Briefcase,
  Layers,
  RefreshCw,
  MoreHorizontal,
  Bot,
  MessageSquare
} from "lucide-react";
import { trpc } from "@/src/lib/trpc";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Label } from "@/src/components/ui/label";
import { Switch as SwitchUI } from "@/src/components/ui/switch";

export default function Agendamentos() {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [view, setView] = React.useState<"month" | "week" | "day">("month");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
    titulo: "",
    descricao: "",
    inicio: "",
    fim: "",
    syncGoogle: true
  });

  const { data: agendamentos, refetch } = trpc.empresa.getAgendamentosList.useQuery();
  
  const syncMutation = trpc.empresa.sincronizarGoogle.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} eventos sincronizados!`);
      refetch();
    },
    onError: (err) => toast.error("Falha ao sincronizar: " + err.message)
  });

  const saveMutation = trpc.empresa.saveAgendamento.useMutation({
    onSuccess: () => {
      toast.success("Agendamento salvo!");
      setIsDialogOpen(false);
      refetch();
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message)
  });

  const handleSave = () => {
    if (!formData.titulo || !formData.inicio || !formData.fim) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    saveMutation.mutate(formData);
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getEventsForDay = (day: Date) => {
    return agendamentos?.filter(a => isSameDay(new Date(a.inicio), day)) || [];
  };

  const services = [
    { name: "Consulta", icon: Stethoscope, color: "bg-blue-100 text-blue-600 border-blue-200" },
    { name: "Corte", icon: Scissors, color: "bg-amber-100 text-amber-600 border-amber-200" },
    { name: "Consultoria", icon: Briefcase, color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
    { name: "Outro", icon: Layers, color: "bg-slate-100 text-slate-600 border-slate-200" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 max-w-[1600px] mx-auto space-y-8 h-screen md:h-auto overflow-y-auto pb-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
              <CalendarIcon className="w-8 h-8 text-indigo-500" />
              Central de Agendamentos
            </h1>
            <p className="text-muted-foreground">
              Gerencie sua agenda conectada ao Google Calendar e acompanhe as marcações via IA.
            </p>
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-2xl border shadow-sm h-12 items-center px-4">
             <div className="flex gap-1 h-full py-1">
                <Button 
                  variant={view === "month" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setView("month")}
                  className="rounded-xl px-4 text-xs font-bold"
                >
                  Mês
                </Button>
                <Button 
                  variant={view === "week" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setView("week")}
                  className="rounded-xl px-4 text-xs font-bold"
                >
                  Semana
                </Button>
                <Button 
                  variant={view === "day" ? "default" : "ghost"} 
                  size="sm" 
                  onClick={() => setView("day")}
                  className="rounded-xl px-4 text-xs font-bold"
                >
                  Dia
                </Button>
             </div>
             <div className="w-px h-6 bg-slate-200 mx-2" />
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
               <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-9 px-4 text-xs font-bold shadow-lg shadow-indigo-500/20">
                  <Plus className="w-4 h-4 mr-2" /> Novo Agendamento
                </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px]">
                 <DialogHeader>
                   <DialogTitle>Novo Agendamento</DialogTitle>
                 </DialogHeader>
                 <div className="grid gap-4 py-4">
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="titulo" className="text-right">Título</Label>
                     <Input id="titulo" className="col-span-3" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="inicio" className="text-right">Início</Label>
                     <Input id="inicio" type="datetime-local" className="col-span-3" value={formData.inicio} onChange={e => setFormData({...formData, inicio: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="fim" className="text-right">Fim</Label>
                     <Input id="fim" type="datetime-local" className="col-span-3" value={formData.fim} onChange={e => setFormData({...formData, fim: e.target.value})} />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="desc" className="text-right">Descrição</Label>
                     <Textarea id="desc" className="col-span-3" value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
                   </div>
                   <div className="flex items-center space-x-2 justify-end">
                     <Label htmlFor="sync">Sincronizar Google Calendar</Label>
                     <SwitchUI id="sync" checked={formData.syncGoogle} onCheckedChange={checked => setFormData({...formData, syncGoogle: checked})} />
                   </div>
                 </div>
                 <DialogFooter>
                   <Button onClick={handleSave} disabled={saveMutation.isPending}>
                     {saveMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                   </Button>
                 </DialogFooter>
               </DialogContent>
             </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Calendar Side */}
          <div className="xl:col-span-3 space-y-6">
            <Card className="border-none shadow-xl overflow-hidden bg-white">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold capitalize">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 rounded-lg border-slate-200">
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 rounded-lg border-slate-200">
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())} className="h-8 rounded-lg text-xs font-bold border-slate-200">
                      Hoje
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => syncMutation.mutate()} 
                      disabled={syncMutation.isPending}
                      className="h-8 rounded-lg text-xs font-bold border-slate-200"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5 mr-2", syncMutation.isPending && "animate-spin")} /> 
                      {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Google"}
                    </Button>
                 </div>
              </div>
              
              <div className="grid grid-cols-7 border-b">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="py-3 text-center text-xs font-black text-slate-400 uppercase tracking-widest border-r last:border-r-0">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-fr">
                {calendarDays.map((day, i) => {
                  const events = getEventsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurMonth = isSameMonth(day, monthStart);
                  const isTodayActive = isToday(day);

                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "min-h-[140px] p-2 border-r border-b last:border-r-0 flex flex-col gap-1 transition-colors cursor-pointer group",
                        !isCurMonth && "bg-slate-50/50",
                        isSelected && "bg-indigo-50/30 ring-1 ring-inset ring-indigo-500/20",
                        "hover:bg-slate-50"
                      )}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                          isTodayActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "text-slate-600",
                          !isCurMonth && "text-slate-300"
                        )}>
                          {format(day, "d")}
                        </span>
                        {events.length > 0 && (
                          <span className="text-[10px] font-black text-slate-300 group-hover:text-amber-500 transition-colors">
                            {events.length} AGEND.
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1.5 overflow-hidden">
                        {events.slice(0, 3).map((e, idx) => (
                           <div 
                            key={idx} 
                            className="bg-white border rounded-lg p-1.5 shadow-sm text-[10px] leading-tight flex flex-col gap-0.5 border-l-4 border-l-indigo-400 group-hover:translate-x-1 transition-transform"
                           >
                             <div className="font-bold truncate text-slate-800">{e.titulo}</div>
                             <div className="flex items-center gap-1 text-slate-400">
                               <Clock className="w-2.5 h-2.5" />
                               {format(new Date(e.inicio), "HH:mm")}
                             </div>
                           </div>
                        ))}
                        {events.length > 3 && (
                          <div className="text-[9px] font-bold text-indigo-500 text-center py-1">
                            + {events.length - 3} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Details Side */}
          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-white overflow-hidden">
              <div className="p-6 bg-slate-900 text-white">
                 <h3 className="font-bold flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    Agenda de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                 </h3>
                 <p className="text-[10px] text-slate-400 opacity-80 uppercase tracking-widest font-black">
                   {getEventsForDay(selectedDate).length} compromissos hoje
                 </p>
              </div>
              <CardContent className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
                 {getEventsForDay(selectedDate).length === 0 ? (
                   <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 opacity-50">
                     <CalendarIcon className="w-12 h-12 mb-4" />
                     <p className="text-xs">Nenhum agendamento para este dia.</p>
                   </div>
                 ) : (
                   getEventsForDay(selectedDate).map((e, idx) => (
                     <div key={idx} className="group relative p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300">
                       <div className="flex justify-between items-start mb-3">
                         <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                             <User className="w-4 h-4 text-indigo-600" />
                           </div>
                           <div>
                             <h4 className="font-bold text-sm text-slate-900 truncate max-w-[150px]">{e.titulo}</h4>
                             <p className="text-[10px] text-slate-400 font-medium">Marcado via {e.canalOrigem || "Painel"}</p>
                           </div>
                         </div>
                         <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></Button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-2 mb-3">
                         <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Horário</div>
                            <div className="text-xs font-black text-slate-700">{format(new Date(e.inicio), "HH:mm")} - {format(new Date(e.fim), "HH:mm")}</div>
                         </div>
                         <div className="bg-white p-2 rounded-xl border border-slate-100">
                            <div className="text-[9px] text-slate-400 font-bold uppercase mb-0.5">Status</div>
                            <div className="text-xs font-black text-emerald-600 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmado
                            </div>
                         </div>
                       </div>

                       <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 h-9 rounded-xl text-[10px] font-bold border-slate-100">Ver Conversa</Button>
                          <Button variant="outline" className="flex-1 h-9 rounded-xl text-[10px] font-bold border-slate-100 text-red-500 hover:text-red-600">Cancelar</Button>
                       </div>
                     </div>
                   ))
                 )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl bg-indigo-950 text-white overflow-hidden">
              <CardHeader className="relative">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="w-4 h-4 text-white" />
                  Agenciamento I.A.
                </CardTitle>
                <div className="absolute top-2 right-2 flex gap-1 h-full items-center p-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                  Sua IA está autorizada a marcar horários automaticamente quando detecta intenção do cliente.
                </p>
                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                  <MessageSquare className="w-8 h-8 text-indigo-400 opacity-50" />
                  <div className="text-[10px] italic">
                    "Tenho amanhã às 14:00 disponível. Posso reservar para você?"
                  </div>
                </div>
                <Button className="w-full h-10 bg-indigo-700 hover:bg-indigo-600 text-xs font-bold rounded-xl border-none">
                  Treinar Regras de Agendamento
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
