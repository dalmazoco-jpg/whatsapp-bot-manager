import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
import {
  Calendar, Clock, Plus, Trash2, Bell, BellOff,
  CheckCircle2, XCircle, Loader2, ExternalLink,
  Video, Phone, User, AlertCircle, RefreshCw
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
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

  // Contatos de notificação
  const [contatos, setContatos] = useState<ContatoNotificacao[]>([]);
  const [novoContato, setNovoContato] = useState({ nome: "", whatsapp: "", tipo: "proprietario" });
  const [salvandoContato, setSalvandoContato] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<"agenda" | "google" | "notificacoes">("agenda");

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
      return;
    }
    const data = await r.json();
    setGcInfo(data);
    setGcStatus(data.conectado ? "conectado" : "desconectado");
  };

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
            Agendamentos
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie compromissos criados pela IA, integre ao Google Calendar e configure notificações</p>
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-6 border-b border-border">
          {[
            { id: "agenda", label: "📅 Agenda", onClick: () => setAbaAtiva("agenda") },
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

        {/* ABA: AGENDA */}
        {abaAtiva === "agenda" && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
            ) : proximos.length === 0 && passados.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-16 text-center">
                  <Calendar className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">Nenhum agendamento ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">Os clientes podem agendar pelo WhatsApp e a IA registra aqui</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {proximos.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Próximos</h2>
                    <div className="space-y-3">
                      {proximos.map(ag => {
                        const s = STATUS_CONFIG[ag.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.agendado;
                        const googleEventId = (ag as any).googleEventId || (ag as any).google_event_id;
                        const meetLink = (ag as any).googleMeetLink || (ag as any).google_meet_link;
                        return (
                          <Card key={ag.id} className="border border-border hover:border-blue-500/30 transition-colors">
                            <CardContent className="py-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex flex-col items-center justify-center text-blue-600 shrink-0">
                                    <span className="text-xs font-bold">{formatData(ag.dataHora).split(",")[0]}</span>
                                    <span className="text-xs">{formatHora(ag.dataHora)}</span>
                                  </div>
                                  <div>
                                    <p className="font-medium">{ag.titulo}</p>
                                    <p className="text-sm text-muted-foreground">{formatData(ag.dataHora)} · {ag.duracao}min</p>
                                    {googleEventId && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Google Calendar
                                        </span>
                                        {meetLink && (
                                          <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline">
                                            <Video className="w-3 h-3" /> Meet
                                          </a>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                                  {ag.status === "agendado" && (
                                    <>
                                      <Button size="sm" variant="ghost" className="text-emerald-600 hover:text-emerald-700 h-7 px-2 text-xs"
                                        onClick={() => updateStatus.mutate({ id: ag.id, status: "confirmado" })}>
                                        <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar
                                      </Button>
                                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 h-7 px-2 text-xs"
                                        onClick={() => updateStatus.mutate({ id: ag.id, status: "cancelado" })}>
                                        <XCircle className="w-3 h-3 mr-1" /> Cancelar
                                      </Button>
                                    </>
                                  )}
                                  {ag.status === "confirmado" && (
                                    <Button size="sm" variant="ghost" className="text-gray-500 hover:text-gray-700 h-7 px-2 text-xs"
                                      onClick={() => updateStatus.mutate({ id: ag.id, status: "realizado" })}>
                                      <CheckCircle2 className="w-3 h-3 mr-1" /> Realizado
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {passados.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Histórico</h2>
                    <div className="space-y-2 opacity-60">
                      {passados.slice(0, 5).map(ag => {
                        const s = STATUS_CONFIG[ag.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.realizado;
                        return (
                          <Card key={ag.id} className="border border-border">
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{ag.titulo}</p>
                                    <p className="text-xs text-muted-foreground">{formatData(ag.dataHora)} às {formatHora(ag.dataHora)}</p>
                                  </div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${s.bg} ${s.color}`}>{s.label}</span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ABA: GOOGLE CALENDAR */}
        {abaAtiva === "google" && (
          <div className="space-y-6 max-w-2xl">
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
                {gcStatus !== "conectado" ? (
                  <div>
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
                      Conecte sua conta Google para que a IA verifique sua agenda em tempo real antes de confirmar agendamentos, evitando conflitos de horário.
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground mb-4">
                      <p className="flex items-center gap-2">✅ IA verifica disponibilidade automaticamente</p>
                      <p className="flex items-center gap-2">✅ Cria eventos no Google Calendar ao agendar</p>
                      <p className="flex items-center gap-2">✅ Sugere horários livres ao cliente</p>
                      <p className="flex items-center gap-2">✅ Cancela eventos quando o cliente cancelar pelo WhatsApp</p>
                    </div>
                    <Button onClick={conectarGoogle} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={gcInfo.configurado === false}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Conectar Google Calendar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-sm text-emerald-700">
                      ✅ Google Calendar conectado! A IA verificará sua agenda automaticamente{gcInfo.calendarId ? ` (${gcInfo.calendarId})` : ""}.
                    </div>

                    <div className="border-t border-border pt-4">
                      <h3 className="font-medium mb-3 text-sm">Verificar horários disponíveis</h3>
                      <div className="flex gap-2">
                        <Input type="date" value={dataBusca} onChange={e => setDataBusca(e.target.value)} className="max-w-[180px]" />
                        <Button variant="outline" onClick={buscarHorarios} disabled={buscandoHorarios || !dataBusca}>
                          {buscandoHorarios ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          Buscar
                        </Button>
                      </div>
                      {horariosLivres.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {horariosLivres.map(h => (
                            <span key={h} className="px-3 py-1 bg-blue-500/10 text-blue-600 rounded-full text-sm">{h}</span>
                          ))}
                        </div>
                      )}
                      {horariosLivres.length === 0 && dataBusca && !buscandoHorarios && (
                        <p className="text-sm text-muted-foreground mt-2">Nenhum horário disponível nesta data.</p>
                      )}
                    </div>

                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        Para desconectar, revogue o acesso em <a href="https://myaccount.google.com/permissions" target="_blank" className="text-blue-500 hover:underline">myaccount.google.com/permissions</a>
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
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
