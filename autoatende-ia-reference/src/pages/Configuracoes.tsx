import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import { trpc } from "@/src/lib/trpc";
import { unwrapTrpcData } from "@/src/lib/trpcData";
import {
  Settings,
  Bot,
  User,
  Save,
  Loader2,
  Clock,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { toast } from "sonner";

export default function Configuracoes() {
  const { data: meData, refetch } = trpc.auth.me.useQuery();
  const me = unwrapTrpcData<any>(meData);
  const updateSettings = trpc.empresa.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      refetch();
    }
  });

  const [nome, setNome] = useState("");
  const [ramo, setRamo] = useState("");
  const [nomeBot, setNomeBot] = useState("");
  const [promptExtra, setPromptExtra] = useState("");
  const [responderAudio, setResponderAudio] = useState(false);
  const [slug, setSlug] = useState("");
  const [materiais, setMateriais] = useState({
    endereco: "",
    descricao: "",
    instagram: "",
    site: "",
  });

  useEffect(() => {
    if (me?.empresa) {
      setNome(me.empresa.nome || "");
      setRamo(me.empresa.ramo || "");
      setSlug(me.empresa.slug || "");
      setMateriais(me.empresa.materiais || { endereco: "", descricao: "", instagram: "", site: "" });
      const configBot = me.empresa.configBot || {};
      setNomeBot(configBot.nomeBot || "");
      setPromptExtra(configBot.promptExtra || "");
      setResponderAudio(configBot.responderAudio || false);
    }
  }, [me]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        nome,
        ramo,
        slug,
        materiais,
        configBot: {
          nomeBot,
          promptExtra,
          responderAudio,
        },
      });
    } catch (err) {
      toast.error("Erro ao salvar configurações.");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="w-8 h-8 text-emerald-500" />
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie as informações do seu negócio e o comportamento do robô.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Navegação lateral fake para visual */}
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-2 bg-emerald-500/10 text-emerald-600">
              <Bot className="w-4 h-4" /> Inteligência Artificial
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <User className="w-4 h-4" /> Perfil da Empresa
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Clock className="w-4 h-4" /> Horário de Funcionamento
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <MapPin className="w-4 h-4" /> Taxas de Entrega
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <ShieldCheck className="w-4 h-4" /> Assinatura & Faturamento
            </Button>
          </div>

          <div className="md:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Personalidade do Robô
                </CardTitle>
                <CardDescription>
                  Defina como a IA deve se comportar e atender seus clientes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nomeBot">Nome do Robô</Label>
                  <Input
                    id="nomeBot"
                    placeholder="Ex: Atendente Virtual, Bia, Carlos..."
                    value={nomeBot}
                    onChange={(e) => setNomeBot(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promptExtra">Instruções Extras (Prompt Customizado)</Label>
                  <Textarea
                    id="promptExtra"
                    placeholder="Diga à IA como ela deve agir. Ex: 'Seja sempre muito formal' ou 'Sempre ofereça uma sobremesa após o pedido principal'."
                    className="min-h-[150px]"
                    value={promptExtra}
                    onChange={(e) => setPromptExtra(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Essas instruções serão incluídas no "cérebro" da IA em todas as conversas.
                  </p>
                </div>
                <div className="flex items-center space-x-2 py-4 border-t">
                  <input
                    type="checkbox"
                    id="responderAudio"
                    className="w-5 h-5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                    checked={responderAudio}
                    onChange={(e) => setResponderAudio(e.target.checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor="responderAudio" className="text-sm font-bold leading-none cursor-pointer">
                      Responder por áudio (Experimental)
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      O sistema enviará áudio ptt como se fosse uma mensagem de voz.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações da Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nomeEmpresa">Nome do Estabelecimento</Label>
                    <Input
                      id="nomeEmpresa"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ramo">Ramo de Atuação</Label>
                    <Input
                      id="ramo"
                      placeholder="Ex: Pizzaria, Adega, Clínica..."
                      value={ramo}
                      onChange={(e) => setRamo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Link Público (Slug)</Label>
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground text-sm">/public/</span>
                    <Input
                      id="slug"
                      placeholder="nome-da-sua-empresa"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Este será o link do seu folder e landing page.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Endereço para os Materiais</Label>
                  <Input
                    value={materiais.endereco}
                    onChange={(e) => setMateriais({ ...materiais, endereco: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição Curta (Apresentação)</Label>
                  <Textarea
                    value={materiais.descricao}
                    onChange={(e) => setMateriais({ ...materiais, descricao: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {updateSettings.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
