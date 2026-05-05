import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Save, Settings, Bot } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Configuracoes() {
  const { data: config, refetch } = trpc.configuracoes.get.useQuery();
  const updateConfig = trpc.configuracoes.update.useMutation({ onSuccess: () => refetch() });

  const [formData, setFormData] = useState({
    nome: "",
    whatsappNumero: "",
    nomeBot: "",
    systemPrompt: "",
  });

  useEffect(() => {
    if (config) {
      const configIa = config.configIa as { nomeBot?: string; systemPrompt?: string } | null;
      setFormData({
        nome: config.nome || "",
        whatsappNumero: config.whatsappNumero || "",
        nomeBot: configIa?.nomeBot || "",
        systemPrompt: configIa?.systemPrompt || "",
      });
    }
  }, [config]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    await updateConfig.mutateAsync({
      nome: formData.nome,
      whatsappNumero: formData.whatsappNumero,
      configIa: {
        nomeBot: formData.nomeBot || undefined,
        systemPrompt: formData.systemPrompt || undefined,
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="typography-h1 mb-2 flex items-center gap-2">
            <Settings className="w-8 h-8" />
            Configurações
          </h1>
          <p className="typography-body text-muted-foreground">Configurar dados da empresa e comportamento da IA</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Dados da Empresa */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome da Empresa</label>
                <Input name="nome" value={formData.nome} onChange={handleChange} placeholder="Pizzaria do Denis" className="border border-border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp Conectado</label>
                <Input name="whatsappNumero" value={formData.whatsappNumero} onChange={handleChange} placeholder="5511999999999" className="border border-border" />
              </div>
            </CardContent>
          </Card>

          {/* Configuração da IA */}
          <Card className="border border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-500" />
                Configuração da IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Bot</label>
                <Input name="nomeBot" value={formData.nomeBot} onChange={handleChange} placeholder="Ex: Julia, Atendente Virtual" className="border border-border" />
                <p className="text-xs text-muted-foreground mt-1">Como a IA vai se apresentar para os clientes</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Instruções Personalizadas</label>
                <Textarea
                  name="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={handleChange}
                  placeholder="Ex: Sempre ofereça a pizza do dia antes do cardápio completo. A promoção de hoje é Pizza Pepperoni por R$ 35,00."
                  className="border border-border min-h-32"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Regras extras que a IA deve seguir durante o atendimento. O cardápio é carregado automaticamente da aba Cardápio.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Button onClick={handleSave} className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={updateConfig.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateConfig.isPending ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
