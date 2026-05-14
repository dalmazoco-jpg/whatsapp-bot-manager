import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { trpc } from "@/src/lib/trpc";
import { Megaphone, Users, Send, Loader2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function Campanhas() {
  const [mensagem, setMensagem] = React.useState("");
  const [tag, setTag] = React.useState("todas");
  const { data: conversas } = trpc.empresa.getConversas.useQuery();

  const disparar = trpc.empresa.dispararCampanha.useMutation({
    onSuccess: (data) => {
      toast.success(`Campanha disparada para ${data.total} clientes!`);
      setMensagem("");
    },
    onError: (err) => {
      toast.error("Erro ao disparar campanha: " + err.message);
    }
  });

  const handleSend = () => {
    if (!mensagem.trim() || disparar.isPending) return;
    disparar.mutate({ 
      mensagem: mensagem.trim(), 
      tag: tag === "todas" ? undefined : tag 
    });
  };

  const tags = Array.from(new Set(conversas?.flatMap(c => c.tags as string[]) || []));

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-emerald-500" />
            Campanhas Automáticas
          </h1>
          <p className="text-muted-foreground">
            Envie mensagens em massa para seus clientes segmentados por tags. Use com moderação para evitar banimentos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle>Nova Campanha</CardTitle>
                <CardDescription>Escreva a mensagem que deseja enviar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-bold">Público Alvo</label>
                    <Select value={tag} onValueChange={setTag}>
                      <SelectTrigger className="rounded-xl h-12">
                        <SelectValue placeholder="Selecione um segmento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todos os Clientes ({conversas?.length || 0})</SelectItem>
                        {tags.map(t => (
                          <SelectItem key={t} value={t}>Tag: {t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-bold">Mensagem</label>
                    <Textarea 
                      placeholder="Olá! Temos uma novidade para você..."
                      className="min-h-[150px] rounded-2xl p-4 resize-none focus:ring-emerald-500"
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      As mensagens serão enviadas com um intervalo de 5-10 segundos cada.
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleSend}
                  disabled={disparar.isPending || !mensagem.trim()}
                  className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20"
                >
                  {disparar.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Send className="w-5 h-5 mr-2" />}
                  Disparar Agora
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-yellow-50 border-l-4 border-l-yellow-400">
              <CardContent className="p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-yellow-900">Aviso Anti-Spam</h4>
                  <p className="text-xs text-yellow-800/80 leading-relaxed">
                    Envios massivos para contatos que não têm seu número salvo podem levar ao bloqueio do WhatsApp. 
                    Recomendamos enviar apenas para clientes que já interagiram com seu bot.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Estatísticas do Público</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-muted-foreground">Total Alcançável</span>
                  <span className="text-sm font-bold">{conversas?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-muted-foreground">Tags Ativas</span>
                  <span className="text-sm font-bold">{tags.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-emerald-50">
              <CardHeader>
                <CardTitle className="text-sm text-emerald-900">Exemplos de Uso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-white/50 p-3 rounded-lg text-[10px] text-emerald-800 italic">
                  "Oi! Temos uma cortesia esperando por você hoje. Basta apresentar esta mensagem."
                </div>
                <div className="bg-white/50 p-3 rounded-lg text-[10px] text-emerald-800 italic">
                   "Aviso: Estaremos fechados no feriado. Antecipe seu pedido!"
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
