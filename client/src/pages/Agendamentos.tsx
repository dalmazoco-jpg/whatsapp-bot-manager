import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
import {
  Calendar, Clock, Plus, Trash2, Bell,
  CheckCircle2, XCircle, Loader2, ExternalLink,
  Video, Phone, User, AlertCircle, RefreshCw
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import GoogleCalendar from "@/components/GoogleCalendar";
import { toast } from "sonner";

const STATUS_CONFIG = {
  agendado: { label: "Agendado", color: "text-blue-500", bg: "bg-blue-500/10" },
  confirmado: { label: "Confirmado", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  cancelado: { label: "Cancelado", color: "text-red-500", bg: "bg-red-500/10" },
  realizado: { label: "Realizado", color: "text-gray-500", bg: "bg-gray-500/10" },
};

type ContatoNotificacao = {
  id: number; nome: string; whatsapp: string; tipo: string; eventos: string[];
};

type HorarioAtendimento = {
  id?: number;
  diaSemana: number;
  label: string;
  horaInicio: string;
  horaFim: string;
  ativo: boolean;
};

const DIA_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function Agendamentos() {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: agendamentos, isLoading, refetch } = trpc.agendamentos.list.useQuery();
  const updateStatus = trpc.agendamentos.updateStatus.useMutation({ onSuccess: () => refetch() });

  // Google Calendar
  const [gcStatus, setGcStatus] = useState<"conectado" | "desconectado" | "carregando">("carregando");
  const [gcInfo, setGcInfo] = useState<{ configurado?: boolean; redirectUri?: string; error?: string; calendarId?: string }>({});
  const [horariosLivres, setHorariosLivres] = useState<string[]>([]);
  const [dataBusca, setDataBusca] = useState("");
  const [buscandoHorarios, setBuscandoHorarios] = useState(false);
  const [eventosGoogle, setEventosGoogle] = useState<Array<{ id: string; titulo: string; inicio: string; fim: string; local?: string; link?: string }>>([]);
  const [carregandoEventosGoogle, setCarregandoEventosGoogle] = useState(false);

  // Contatos de notificação
  const [contatos, setContatos] = useState<ContatoNotificacao[]>([]);
  const [novoContato, setNovoContato] = useState({ nome: "", whatsapp: "", tipo: "proprietario" });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"google" | "notificacoes">("google");

  const { data: horariosData, refetch: refetchHorarios } = trpc.horarios.list.useQuery();
  const upsertHorario = trpc.horarios.upsert.useMutation({
    onSuccess: async () => {
      await refetchHorarios();
      toast.success("Horário salvo");
    },
  });
  const [horarios, setHorarios] = useState<HorarioAtendimento[]>([]);

  const token = localStorage.getItem("auth_token") || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const apiFetch = (url: string, init?: RequestInit) =>
    fetch(url, { credentials: "include", ...(init || {}), headers: { ...headers, ...(init?.headers || {}) } });

  // Verifica status Google Calendar
  const verificarGoogleCalendar = async () => {
    setGcStatus("carregando");
    const r = await apiFetch("/api/google/status");
    if (!r.ok) {
      setGcStatus("desconectado");
      setEventosGoogle([]);
      return;
    }
    const data = await r.json();
    setGcInfo(data);
    const conectado = data.conectado ? "conectado" : "desconectado";
    setGcStatus(conectado);
    if (conectado === "conectado") {
      await carregarEventosGoogle();
    } else {
      setEventosGoogle([]);
    }
  };

  useEffect(() => {
    verificarGoogleCalendar();
  }, []);

  // Conectar Google Calendar
  const conectarGoogle = async () => {
    const r = await apiFetch("/api/google/auth-url");
    const data = await r.json();
    if (!r.ok || !data.url) {
      toast.error(data.error || "Não foi possível gerar o link do Google Calendar");
      return;
    }
    window.location.href = data.url;
    setTimeout(verificarGoogleCalendar, 5000);
  };

  const carregarEventosGoogle = async () => {
    setCarregandoEventosGoogle(true);
    try {
      const r = await apiFetch("/api/google/eventos?maxResults=8&dias=7");
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao carregar eventos do Google Calendar");
      setEventosGoogle(data.eventos || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar eventos do Google Calendar");
      setEventosGoogle([]);
    } finally {
      setCarregandoEventosGoogle(false);
    }
  };

  // Buscar horários livres
  const buscarHorarios = async () => {
    if (!dataBusca) return;
    setBuscandoHorarios(true);
    try {
      const r = await apiFetch(`/api/google/horarios-livres?data=${dataBusca}&duracao=60`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao buscar horários");
      setHorariosLivres(data.horarios || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao buscar horários");
    } finally {
      setBuscandoHorarios(false);
    }
  };

  // Carregar contatos de notificação
  const carregarContatos = async () => {
    const r = await apiFetch("/api/notificacoes/contatos");
    const data = await r.json();
    setContatos(Array.isArray(data) ? data : []);
  };

  // Adicionar contato
  const adicionarContato = async () => {
    if (!novoContato.nome || !novoContato.whatsapp) return;
    setSalvandoContato(true);
    await apiFetch("/api/notificacoes/contatos", {
      method: "POST", headers,
      body: JSON.stringify({ ...novoContato, eventos: ["agendamento", "pedido", "cancelamento", "novo_cliente", "entrega"] }),
    });
    setNovoContato({ nome: "", whatsapp: "", tipo: "proprietario" });
    await carregarContatos();
    setSalvandoContato(false);
  };

  // Remover contato
  const removerContato = async (id: number) => {
    await apiFetch(`/api/notificacoes/contatos/${id}`, { method: "DELETE" });
    await carregarContatos();
  };

  const agendamentosArray = unwrapTrpcArray<typeof agendamentos extends Array<infer T> ? T : any>(agendamentos);

  useEffect(() => {
    if (!horariosData) return;
    const map = new Map(horariosData.map((h) => [h.diaSemana, h]));
    const rows: HorarioAtendimento[] = DIA_DA_SEMANA.map((label, diaSemana) => {
      const existing = map.get(diaSemana);
      return {
        id: existing?.id,
        diaSemana,
        label,
        horaInicio: existing?.horaInicio || "08:00",
        horaFim: existing?.horaFim || "18:00",
        ativo: existing?.ativo ?? false,
      };
    });
    setHorarios(rows);
  }, [horariosData]);

  const atualizarHorario = (index: number, partial: Partial<HorarioAtendimento>) => {
    setHorarios((current) => current.map((horario, idx) => idx === index ? { ...horario, ...partial } : horario));
  };

  const salvarHorario = async (horario: HorarioAtendimento) => {
    await upsertHorario.mutateAsync({
      diaSemana: horario.diaSemana,
      horaInicio: horario.horaInicio,
      horaFim: horario.horaFim,
      ativo: horario.ativo,
    });
  };
  const agOrdenados = [...agendamentosArray].sort(
    (a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime()
  );
  const proximos = agOrdenados.filter(a => new Date(a.dataHora) >= new Date());
  const passados = agOrdenados.filter(a => new Date(a.dataHora) < new Date());

  const formatData = (d: Date | string) =>
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(d));
  const formatHora = (d: Date | string) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="typography-h1 mb-1 flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-500" />
            Google Calendar
          </h1>
          <p className="text-muted-foreground text-sm">Visualize, crie e edite seus compromissos diretamente pela agenda do Google no SaaS</p>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { id: "google", label: "🗓️ Google Calendar", onClick: () => { setAbaAtiva("google"); verificarGoogleCalendar(); } },
            { id: "notificacoes", label: "🔔 Notificações", onClick: () => { setAbaAtiva("notificacoes"); carregarContatos(); } },
          ].map(aba => (
            <button
              key={aba.id}
              onClick={aba.onClick}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${abaAtiva === aba.id ? "border-blue-500 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {aba.label}
            </button>
          ))}
        </div>

        {/* ABA: GOOGLE CALENDAR */}
        {abaAtiva === "google" && (
          <div className="space-y-4">
            {gcStatus !== "conectado" ? (
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🗓️ Integração Google Calendar
                    {gcStatus === "carregando" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {gcStatus === "conectado" && <span className="text-xs text-emerald-500 font-normal flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Conectado</span>}
                    {gcStatus === "desconectado" && <span className="text-xs text-red-400 font-normal">Desconectado</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {gcInfo.configurado === false && (
                    <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-800">
                      Google Calendar ainda não está configurado no servidor. Cadastre no Cloud Run as variáveis <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code> e use este redirect URI no Google Cloud: <code>{gcInfo.redirectUri}</code>
                    </div>
                  )}
                  {gcInfo.error && gcInfo.configurado !== false && (
                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">
                      A conexão atual não passou na validação do Google. Conecte novamente para renovar a permissão.
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mb-4">
                    Conecte sua conta Google para visualizar e gerenciar sua agenda diretamente no SaaS, sem precisar abrir uma nova aba.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground mb-4">
                    <p className="flex items-center gap-2">✅ Visualize sua agenda em formato de calendário</p>
                    <p className="flex items-center gap-2">✅ Crie novos eventos diretamente</p>
                    <p className="flex items-center gap-2">✅ Edite e cancele eventos existentes</p>
                    <p className="flex items-center gap-2">✅ IA verifica disponibilidade automaticamente</p>
                  </div>
                  <Button onClick={conectarGoogle} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={gcInfo.configurado === false}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Conectar Google Calendar
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <GoogleCalendar empresaId={me?.empresaId || 0} />

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-base">Verificar Horários Disponíveis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Data</label>
                        <Input
                          type="date"
                          value={dataBusca}
                          onChange={(e) => setDataBusca(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={buscarHorarios}
                        disabled={buscandoHorarios}
                        className="w-full"
                      >
                        {buscandoHorarios ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Buscar Horários
                      </Button>
                      {horariosLivres.length > 0 && (
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <p className="text-xs font-medium text-emerald-700 mb-2">Horários disponíveis:</p>
                          <div className="flex flex-wrap gap-2">
                            {horariosLivres.map((horario) => (
                              <Badge key={horario} variant="secondary" className="text-xs">
                                {horario}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border border-border">
                    <CardHeader>
                      <CardTitle className="text-base">Horários de Atendimento</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground max-h-64 overflow-y-auto space-y-2">
                      {horarios.length === 0 ? (
                        <p>Carregando horários...</p>
                      ) : (
                        horarios.filter(h => h.ativo).map((horario) => (
                          <div key={horario.diaSemana} className="p-2 rounded bg-background border border-border text-xs">
                            <p className="font-medium">{horario.label}</p>
                            <p className="text-muted-foreground">{horario.horaInicio} - {horario.horaFim}</p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        )}

        {/* ABA: NOTIFICAÇÕES */}
        {abaAtiva === "notificacoes" && (
          <div className="space-y-6 max-w-2xl">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle>🔔 Contatos para Notificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Quando a IA criar um agendamento, receber um pedido ou um novo cliente entrar em contato, essas pessoas receberão uma mensagem automática no WhatsApp.
                </p>

                {/* Adicionar contato */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-medium">Adicionar contato</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Nome" value={novoContato.nome} onChange={e => setNovoContato(p => ({ ...p, nome: e.target.value }))} />
                    <Input placeholder="WhatsApp (ex: 11999999999)" value={novoContato.whatsapp} onChange={e => setNovoContato(p => ({ ...p, whatsapp: e.target.value }))} />
                  </div>
                  <div className="flex gap-2">
                    <select className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={novoContato.tipo} onChange={e => setNovoContato(p => ({ ...p, tipo: e.target.value }))}>
                      <option value="proprietario">Proprietário</option>
                      <option value="gerente">Gerente</option>
                      <option value="entregador">Entregador</option>
                      <option value="atendente">Atendente</option>
                    </select>
                    <Button onClick={adicionarContato} disabled={salvandoContato || !novoContato.nome || !novoContato.whatsapp} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      {salvandoContato ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      Adicionar
                    </Button>
                  </div>
                </div>

                {/* Lista de contatos */}
                {contatos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum contato cadastrado</p>
                    <p className="text-xs mt-1">Adicione o proprietário para receber notificações automáticas</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contatos.map(c => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.nome}</p>
                            <p className="text-xs text-muted-foreground">{c.whatsapp} · {c.tipo}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {c.eventos?.slice(0, 3).map(ev => (
                              <span key={ev} className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">{ev}</span>
                            ))}
                          </div>
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 w-7 p-0" onClick={() => removerContato(c.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 bg-yellow-500/10 rounded-lg text-xs text-yellow-700">
                  ⚠️ O WhatsApp da empresa precisa estar conectado para enviar notificações automáticas.
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
