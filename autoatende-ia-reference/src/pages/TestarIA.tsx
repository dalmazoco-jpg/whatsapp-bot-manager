import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { trpc } from "@/src/lib/trpc";
import { Bot, User, Send, Loader2, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface TestMsg {
  role: "user" | "bot";
  content: string;
}

export default function TestarIA() {
  const [messages, setMessages] = React.useState<TestMsg[]>([]);
  const [input, setInput] = React.useState("");

  const testar = trpc.empresa.testarIA.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "bot", content: data.resposta }]);
    }
  });

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || testar.isPending) return;

    setMessages(prev => [...prev, { role: "user", content: input.trim() }]);
    testar.mutate({ msg: input.trim() });
    setInput("");
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black mb-2">Laboratório da IA</h1>
          <p className="text-muted-foreground">
            Simule conversas com seu assistente para garantir que ele responda corretamente antes de ativar no WhatsApp.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col h-[600px] border bg-white rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm">Preview do Atendimento</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-xs text-muted-foreground">
                Limpar conversa
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground opacity-50">
                  <MessageSquare className="w-12 h-12 mb-4" />
                  <p className="text-sm">Envie uma mensagem para começar o teste</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    m.role === "bot" ? "bg-emerald-600 text-white" : "bg-slate-100 border"
                  )}>
                    {m.role === "bot" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5 text-slate-500" />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] shadow-sm",
                    m.role === "bot" ? "bg-white border text-slate-800 rounded-tl-none" : "bg-emerald-600 text-white rounded-tr-none"
                  )}>
                    {m.content}
                  </div>
                </div>
              ))}
              {testar.isPending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center animate-pulse">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="bg-white border p-4 rounded-2xl rounded-tl-none flex items-center gap-2 h-10 shadow-sm">
                    <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t">
              <form onSubmit={handleSend} className="relative">
                <Input 
                  placeholder="Simule uma pergunta do cliente..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={testar.isPending}
                  className="rounded-full h-12 pr-12 border-slate-200 focus-visible:ring-emerald-500"
                />
                <Button 
                  type="submit" 
                  disabled={testar.isPending || !input.trim()}
                  className="absolute right-1.5 top-1.5 h-9 w-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full p-0"
                >
                  {testar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-lg bg-emerald-950 text-white overflow-hidden">
              <div className="p-6">
                <h3 className="font-bold flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  Sugestões de Teste
                </h3>
                <div className="space-y-3">
                  {[
                    "Quais são os horários de atendimento?",
                    "Qual o valor da consulta?",
                    "Vocês aceitam convênio?",
                    "Onde vocês ficam?",
                    "Quero falar com um atendente",
                    "Me manda os planos e valores"
                  ].map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(s)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs text-emerald-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="border-none shadow-sm bg-slate-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Como funciona?</CardTitle>
              </CardHeader>
              <CardContent className="text-[11px] text-muted-foreground leading-relaxed space-y-2">
                <p>Nesta tela, a IA utiliza exatamente a mesma base de conhecimento que usará no WhatsApp real.</p>
                <p>Se ela responder algo incorreto, verifique seu cadastro em <strong>"Itens e Serviços"</strong> e nas <strong>"Configurações da IA"</strong>.</p>
                <p><strong>Dica:</strong> Se você pedir humano, o sistema mudará seu status para "Aguardando Atendente" no banco de dados.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
