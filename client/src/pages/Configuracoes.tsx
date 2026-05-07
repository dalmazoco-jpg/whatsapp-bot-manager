import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcData } from "@/lib/trpcData";
import { AlertTriangle, Bot, CreditCard, Download, ExternalLink, FileText, Loader2, Save, Search, Settings } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Configuracoes() {
  const { data: configData, refetch } = trpc.configuracoes.get.useQuery();
  const config = unwrapTrpcData<any>(configData);
  const { data: contratoData, refetch: refetchContrato } = trpc.configuracoes.contrato.useQuery();
  const contrato = unwrapTrpcData<any>(contratoData);
  const updateConfig = trpc.configuracoes.update.useMutation({
    onSuccess: (data: any) => {
      if (data?.success === false) {
        toast.error("Não encontrei empresa vinculada para salvar.");
        return;
      }
      toast.success("Configurações salvas");
      refetch();
      refetchContrato();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao salvar configurações"),
  });

  const [formData, setFormData] = useState({
    nome: "",
    pessoaTipo: "fisica",
    razaoSocial: "",
    nomeCompleto: "",
    responsavelNome: "",
    documentoTipo: "CPF",
    documentoNumero: "",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    whatsappNumero: "",
    nomeBot: "",
    systemPrompt: "",
  });
  const [licenca, setLicenca] = useState<any>(null);
  const [pagando, setPagando] = useState(false);
  const [consultandoCnpj, setConsultandoCnpj] = useState(false);

  useEffect(() => {
    if (config) {
      const configIa = config.configIa as { nomeBot?: string; systemPrompt?: string } | null;
      const configBot = (config.configBot as any) || {};
      const responsavel = configBot.responsavelLegal || {};
      setFormData({
        nome: config.nome || "",
        pessoaTipo: responsavel.pessoaTipo || "fisica",
        razaoSocial: responsavel.razaoSocial || "",
        nomeCompleto: responsavel.nomeCompleto || "",
        responsavelNome: responsavel.responsavelNome || "",
        documentoTipo: responsavel.documentoTipo || "CPF",
        documentoNumero: responsavel.documentoNumero || "",
        email: responsavel.email || "",
        telefone: responsavel.telefone || "",
        endereco: responsavel.endereco || "",
        cidade: responsavel.cidade || "",
        estado: responsavel.estado || "",
        cep: responsavel.cep || "",
        whatsappNumero: config.whatsappNumero || "",
        nomeBot: configIa?.nomeBot || "",
        systemPrompt: configIa?.systemPrompt || "",
      });
    }
  }, [config]);

  const carregarLicenca = async () => {
    const res = await fetch("/api/pagamentos/minha-licenca", {
      headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
    });
    if (res.ok) setLicenca(await res.json());
  };

  useEffect(() => {
    carregarLicenca().catch(console.error);
  }, []);

  const pagarMensalidade = async () => {
    setPagando(true);
    try {
      const res = await fetch("/api/pagamentos/criar-link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planoId: licenca?.plano?.id || "inicial", tipo: "mensalidade" }),
      });
      const data = await res.json();
      if (data.payment_link) window.open(data.payment_link, "_blank");
    } finally {
      setPagando(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    await updateConfig.mutateAsync({
      nome: formData.nome,
      whatsappNumero: formData.whatsappNumero,
      configBot: {
        responsavelLegal: {
          pessoaTipo: formData.pessoaTipo,
          razaoSocial: formData.razaoSocial,
          nomeCompleto: formData.nomeCompleto,
          responsavelNome: formData.responsavelNome,
          documentoTipo: formData.documentoTipo,
          documentoNumero: formData.documentoNumero,
          email: formData.email,
          telefone: formData.telefone,
          whatsapp: formData.whatsappNumero,
          endereco: formData.endereco,
          cidade: formData.cidade,
          estado: formData.estado,
          cep: formData.cep,
        },
      },
      configIa: {
        nomeBot: formData.nomeBot || undefined,
        systemPrompt: formData.systemPrompt || undefined,
      },
    });
  };

  const buscarCnpj = async () => {
    const cnpj = formData.documentoNumero.replace(/\D/g, "");
    if (cnpj.length !== 14) {
      toast.error("Informe um CNPJ válido com 14 dígitos.");
      return;
    }

    setConsultandoCnpj(true);
    try {
      const res = await fetch(`/api/cnpj/${cnpj}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "CNPJ não encontrado.");

      setFormData((prev) => ({
        ...prev,
        pessoaTipo: "juridica",
        documentoTipo: "CNPJ",
        documentoNumero: data.cnpj || prev.documentoNumero,
        nome: data.nomeFantasia || data.razaoSocial || prev.nome,
        nomeCompleto: data.razaoSocial || prev.nomeCompleto,
        razaoSocial: data.nomeFantasia || prev.razaoSocial,
        responsavelNome: data.responsavelNome || prev.responsavelNome,
        email: data.email || prev.email,
        telefone: data.telefone || prev.telefone,
        endereco: data.endereco || prev.endereco,
        cidade: data.cidade || prev.cidade,
        estado: data.estado || prev.estado,
        cep: data.cep || prev.cep,
      }));
      toast.success("Dados do CNPJ preenchidos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao consultar CNPJ.");
    } finally {
      setConsultandoCnpj(false);
    }
  };

  const downloadContract = () => {
    const content = contrato?.contratoPreenchido || contrato?.contratoTemplate || "";
    if (!content) {
      toast.error("Contrato padrão ainda não configurado.");
      return;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contrato-${(formData.nome || "cliente").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
          <Card className={`border ${licenca?.licencaAtiva ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/40 bg-yellow-500/5"} lg:col-span-2`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {licenca?.licencaAtiva ? <CreditCard className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                Licença e Pagamentos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">
                  {licenca?.licencaAtiva ? "Licença ativa" : "Licença vencida ou pendente"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Plano: {licenca?.plano?.nome || "Não definido"} · Vencimento: {licenca?.licencaExpira ? new Date(licenca.licencaExpira).toLocaleDateString("pt-BR") : "sem data"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Nota fiscal: estrutura preparada para integração futura.</p>
                {licenca?.faturas?.find((fatura: any) => fatura.receiptUrl) && (
                  <button
                    className="mt-2 text-sm text-emerald-700 underline"
                    onClick={() => window.open(licenca.faturas.find((fatura: any) => fatura.receiptUrl).receiptUrl, "_blank")}
                  >
                    Ver comprovante do último pagamento
                  </button>
                )}
              </div>
              <Button onClick={pagarMensalidade} disabled={pagando} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <CreditCard className="w-4 h-4 mr-2" />
                {pagando ? "Gerando..." : "Pagar mensalidade"}
              </Button>
            </CardContent>
          </Card>

          {/* Dados do Responsável Legal */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Dados do Usuário / Responsável Legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome comercial ou identificação do cliente</label>
                <Input name="nome" value={formData.nome} onChange={handleChange} placeholder="Adega do Morro, João Silva, Consultório..." className="border border-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Tipo de contratante</label>
                  <select name="pessoaTipo" value={formData.pessoaTipo} onChange={(e) => setFormData((prev) => ({ ...prev, pessoaTipo: e.target.value, documentoTipo: e.target.value === "juridica" ? "CNPJ" : "CPF" }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="fisica">Pessoa física</option>
                    <option value="juridica">Pessoa jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">CPF/CNPJ</label>
                  <div className="flex gap-2">
                    <Input name="documentoNumero" value={formData.documentoNumero} onChange={handleChange} placeholder="000.000.000-00 ou 00.000.000/0000-00" className="border border-border" />
                    <Button type="button" variant="outline" onClick={buscarCnpj} disabled={consultandoCnpj}>
                      {consultandoCnpj ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome completo / razão social</label>
                  <Input name="nomeCompleto" value={formData.nomeCompleto} onChange={handleChange} placeholder="Nome civil ou razão social" className="border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Responsável legal</label>
                  <Input name="responsavelNome" value={formData.responsavelNome} onChange={handleChange} placeholder="Quem assina o contrato" className="border border-border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Nome fantasia, se houver</label>
                <Input name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} placeholder="Nome fantasia ou razão social alternativa" className="border border-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Email financeiro/contratual</label>
                  <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="financeiro@email.com" className="border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Telefone</label>
                  <Input name="telefone" value={formData.telefone} onChange={handleChange} placeholder="(16) 99999-9999" className="border border-border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp conectado/cobrança</label>
                <Input name="whatsappNumero" value={formData.whatsappNumero} onChange={handleChange} placeholder="5511999999999" className="border border-border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Endereço completo</label>
                <Input name="endereco" value={formData.endereco} onChange={handleChange} placeholder="Rua, número, bairro, complemento" className="border border-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Cidade</label>
                  <Input name="cidade" value={formData.cidade} onChange={handleChange} placeholder="Cidade" className="border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">UF</label>
                  <Input name="estado" value={formData.estado} onChange={handleChange} placeholder="SP" className="border border-border" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">CEP</label>
                  <Input name="cep" value={formData.cep} onChange={handleChange} placeholder="00000-000" className="border border-border" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Estes dados serão usados para contrato, cobrança, emissão de boleto/nota quando configurado e eventual formalização jurídica.
              </p>
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

          <Card className="border border-border lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Contrato para Assinatura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-4 text-sm">
                {contrato?.contratoPreenchido || contrato?.contratoTemplate || "O contrato padrão ainda será configurado pelo administrador."}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" onClick={downloadContract}>
                  <Download className="w-4 h-4 mr-2" />
                  Baixar contrato
                </Button>
                <Button type="button" variant="outline" onClick={() => window.open("https://www.gov.br/governodigital/pt-br/assinatura-eletronica", "_blank")}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Assinar pelo gov.br
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Após preencher os dados e salvar, baixe o contrato atualizado para assinatura digital.
              </p>
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
