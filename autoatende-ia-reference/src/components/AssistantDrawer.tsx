import * as React from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Bot, Send, User, Loader2, Sparkles, X } from "lucide-react";
import { trpc } from "@/src/lib/trpc";
import { cn } from "@/src/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AssistantDrawer({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [messages, setMessages] = React.useState<Message[]>([
    { role: "assistant", content: "Olá! Sou seu copiloto de gestão. Como posso ajudar com sua empresa hoje? Posso criar promoções, melhorar descrições ou analisar conversas." }
  ]);
  const [input, setInput] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const mutation = trpc.empresa.enviarMensagemInterna.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.resposta }]);
    }
  });

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || mutation.isPending) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    mutation.mutate({ pergunta: userMsg });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white shadow-2xl z-50 flex flex-col border-l animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b flex justify-between items-center bg-emerald-950 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/20 p-2 rounded-lg">
            <Bot className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-bold text-lg leading-tight">Copiloto de Gestão</h2>
            <p className="text-xs text-emerald-300/80">IA treinada em seu negócio</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
              m.role === "assistant" ? "bg-emerald-600 text-white" : "bg-white border"
            )}>
              {m.role === "assistant" ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5 text-slate-600" />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed max-w-[85%] shadow-sm",
              m.role === "assistant" ? "bg-white border text-slate-800 rounded-tl-none" : "bg-emerald-600 text-white rounded-tr-none"
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center animate-pulse">
              <Bot className="w-5 h-5" />
            </div>
            <div className="bg-white border p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t bg-white">
        <form onSubmit={handleSend} className="relative">
          <Input 
            placeholder="Pergunte qualquer coisa..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={mutation.isPending}
            className="pr-12 h-14 rounded-xl border-slate-200 focus-visible:ring-emerald-500"
          />
          <Button 
            type="submit" 
            disabled={mutation.isPending || !input.trim()}
            className="absolute right-2 top-2 h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-0"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button 
            type="button" 
            onClick={() => setInput("Crie uma promoção para hoje")}
            className="text-[10px] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
          >
            <Sparkles className="w-3 h-3 text-emerald-500" /> Criar Promoção
          </button>
          <button 
            type="button" 
            onClick={() => setInput("Analise minhas vendas")}
            className="text-[10px] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 font-medium"
          >
            <Sparkles className="w-3 h-3 text-emerald-500" /> Analisar Vendas
          </button>
        </div>
      </div>
    </div>
  );
}
