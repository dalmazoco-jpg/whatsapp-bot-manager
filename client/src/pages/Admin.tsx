import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  APP_MODULES,
  AppModuleId,
  BASIC_MODULES,
  DEFAULT_MODULES,
  getEmpresaModules,
  normalizeModules,
} from "@/lib/modules";
import { unwrapTrpcArray, unwrapTrpcData } from "@/lib/trpcData";
import {
  Building2,
  Plus,
  CheckCircle2,
  XCircle,
  Smartphone,
  Calendar,
  Shield,
  Loader2,
  LogIn,
  Check,
  Lock,
  DollarSign,
  AlertTriangle,
  FileText,
  Save,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PLANOS_SAAS } from "../../../shared/billing";
import { toast } from "sonner";

function ModuleGrid({
  value,
  onChange,
  compact = false,
}: {
  value: AppModuleId[];
  onChange: (next: AppModuleId[]) => void;
  compact?: boolean;
}) {
  const selected = new Set(normalizeModules(value));

  const toggleModule = (moduleId: AppModuleId, required?: boolean) => {
    if (required) return;

    const next = new Set(selected);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    onChange(normalizeModules(Array.from(next)));
  };

  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
      {APP_MODULES.map((module) => {
        const isSelected = selected.has(module.id);
        const Icon = module.icon;
        return (
          <button
            key={module.id}
            type="button"
            onClick={() => toggleModule(module.id, module.required)}
            className={`flex min-h-12 items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
              isSelected
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                : "border-border bg-background text-muted-foreground hover:border-emerald-500/40"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium">{module.label}</span>
            </span>
            {module.required ? (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : isSelected ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded border border-border" />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function Admin() {
  const { data: empresasData, isLoading, refetch } = trpc.admin.empresas.useQuery();
  const empresas = unwrapTrpcArray<typeof empresasData extends Array<infer T> ? T : any>(empresasData);
  const { data: plataformaData, refetch: refetchPlataforma } = trpc.admin.plataforma.useQuery();
  const plataforma = unwrapTrpcData<any>(plataformaData);

  const criarEmpresa = trpc.admin.criarEmpresa.useMutation({
    onSuccess: () => {
      toast.success("Cliente criado");
      refetch();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao criar cliente"),
  });

  const toggleLicenca = trpc.admin.toggleLicenca.useMutation({
    onSuccess: () => refetch(),
  });

  const atualizarEmpresa = trpc.admin.atualizarEmpresa.useMutation({
    onSuccess: () => refetch(),
  });

  const acessarEmpresa = trpc.admin.acessarEmpresa.useMutation();
  const atualizarPlataforma = trpc.admin.atualizarPlataforma.useMutation({
    onSuccess: () => refetchPlataforma(),
  });

  const [loadingEmpresaId, setLoadingEmpresaId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [financeiro, setFinanceiro] = useState<any>(null);
  const [planoCobranca, setPlanoCobranca] = useState<Record<number, string>>({});
  const [loadingPagamentoId, setLoadingPagamentoId] = useState<number | null>(null);
  const [ultimoLink, setUltimoLink] = useState<string>("");
  const [platformForm, setPlatformForm] = useState({
    nome: "",
    razaoSocial: "",
    cnpj: "",
    endereco: "",
    telefone: "",
    whatsappNumero: "",
    email: "",
    contratoTemplate: "",
  });

  const [form, setForm] = useState({
    nome: "",
    tipo: "pizzaria" as "pizzaria" | "adega" | "consultorio" | "loja" | "outro",
    whatsappNumero: "",
    emailUsuario: "",
    senhaUsuario: "",
    nomeUsuario: "",
    modules: DEFAULT_MODULES,
  });

  useEffect(() => {
    if (!plataforma) return;
    setPlatformForm({
      nome: plataforma.nome || "",
      razaoSocial: plataforma.razaoSocial || "",
      cnpj: plataforma.cnpj || "",
      endereco: plataforma.endereco || "",
      telefone: plataforma.telefone || "",
      whatsappNumero: plataforma.whatsappNumero || "",
      email: plataforma.email || "",
      contratoTemplate: plataforma.contratoTemplate || "",
    });
  }, [plataforma]);

  const handleAcessarEmpresa = async (empresaId: number) => {
    setLoadingEmpresaId(empresaId);

    try {
      const result = await acessarEmpresa.mutateAsync({ empresaId });

      if (!result?.token) {
        console.error("Token não retornado");
        return;
      }

      localStorage.setItem("auth_token", result.token);
      document.cookie = `app_session_token=${result.token}; path=/; SameSite=Lax`;

      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Erro ao acessar empresa:", err);
    } finally {
      setLoadingEmpresaId(null);
    }
  };

  const handleCreate = async () => {
    if (!form.nome || !form.emailUsuario || !form.senhaUsuario || !form.nomeUsuario) {
      toast.error("Preencha nome da empresa, responsável, email e senha.");
      return;
    }

    await criarEmpresa.mutateAsync(form);

    setShowForm(false);
    setForm({
      nome: "",
      tipo: "pizzaria",
      whatsappNumero: "",
      emailUsuario: "",
      senhaUsuario: "",
      nomeUsuario: "",
      modules: DEFAULT_MODULES,
    });
  };

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}`,
    "Content-Type": "application/json",
  });

  const carregarFinanceiro = async () => {
    const res = await fetch("/api/pagamentos/admin/resumo", { headers: authHeaders() });
    if (res.ok) setFinanceiro(await res.json());
  };

  useEffect(() => {
    carregarFinanceiro().catch(console.error);
  }, []);

  const gerarCobranca = async (empresa: any, tipo: "mensalidade" | "licenca") => {
    setLoadingPagamentoId(empresa.id);
    try {
      const planoId = planoCobranca[empresa.id] || ((empresa.configBot as any)?.planoId as string) || "inicial";
      const res = await fetch("/api/pagamentos/criar-link", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ empresaId: empresa.id, planoId, tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar cobrança");
      if (data.payment_link) {
        setUltimoLink(data.payment_link);
        await navigator.clipboard?.writeText(data.payment_link).catch(() => {});
        window.open(data.payment_link, "_blank");
      }
      await carregarFinanceiro();
    } catch (error) {
      console.error(error);
      alert("Não foi possível gerar a cobrança. Confira a configuração da InfinitePay.");
    } finally {
      setLoadingPagamentoId(null);
    }
  };

  const alterarLicenca = async (empresaId: number, action: "renovar" | "suspender") => {
    const planoId = planoCobranca[empresaId] || "inicial";
    await fetch("/api/pagamentos/admin/licenca", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ empresaId, planoId, action }),
    });
    await refetch();
    await carregarFinanceiro();
  };

  const verificarPagamento = async (fatura: any) => {
    await fetch("/api/pagamentos/verificar", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        faturaId: fatura.id,
        order_nsu: fatura.orderNsu,
        slug: fatura.slug,
        transaction_id: fatura.transactionId,
      }),
    });
    await carregarFinanceiro();
    await refetch();
  };

  const updateEmpresaModules = async (empresaId: number, modules: AppModuleId[]) => {
    await atualizarEmpresa.mutateAsync({ id: empresaId, modules: normalizeModules(modules) });
  };

  const salvarPlataforma = async () => {
    await atualizarPlataforma.mutateAsync(platformForm);
  };

  const tipoLabels: Record<string, string> = {
    pizzaria: "🍕 Pizzaria",
    adega: "🍷 Adega",
    consultorio: "🦷 Consultório",
    loja: "🏪 Loja",
    outro: "📦 Outro",
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="typography-h1 mb-2 flex items-center gap-3">
                <Shield className="w-8 h-8 text-emerald-500" />
                Painel Admin
              </h1>
              <p className="typography-body text-muted-foreground">
                Gerenciar empresas, licenças e configurações
              </p>
            </div>

            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Empresa
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="border border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Empresas ativas</p>
                <p className="text-2xl font-bold text-emerald-600">{financeiro?.empresasAtivas ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold text-red-600">{financeiro?.empresasVencidas ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Vencendo</p>
                <p className="text-2xl font-bold text-yellow-600">{financeiro?.empresasVencendo ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border border-border">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Faturamento mensal</p>
                <p className="text-2xl font-bold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((financeiro?.faturamentoMensal ?? 0) / 100)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                Minha empresa e contrato padrão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Nome fantasia"
                  value={platformForm.nome}
                  onChange={(event) => setPlatformForm({ ...platformForm, nome: event.target.value })}
                />
                <Input
                  placeholder="Razão social"
                  value={platformForm.razaoSocial}
                  onChange={(event) => setPlatformForm({ ...platformForm, razaoSocial: event.target.value })}
                />
                <Input
                  placeholder="CNPJ"
                  value={platformForm.cnpj}
                  onChange={(event) => setPlatformForm({ ...platformForm, cnpj: event.target.value })}
                />
                <Input
                  placeholder="WhatsApp"
                  value={platformForm.whatsappNumero}
                  onChange={(event) => setPlatformForm({ ...platformForm, whatsappNumero: event.target.value })}
                />
                <Input
                  placeholder="Telefone"
                  value={platformForm.telefone}
                  onChange={(event) => setPlatformForm({ ...platformForm, telefone: event.target.value })}
                />
                <Input
                  placeholder="Email"
                  value={platformForm.email}
                  onChange={(event) => setPlatformForm({ ...platformForm, email: event.target.value })}
                />
                <Input
                  className="md:col-span-2"
                  placeholder="Endereço"
                  value={platformForm.endereco}
                  onChange={(event) => setPlatformForm({ ...platformForm, endereco: event.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Contrato padrão enviado aos clientes</label>
                <Textarea
                  value={platformForm.contratoTemplate}
                  onChange={(event) => setPlatformForm({ ...platformForm, contratoTemplate: event.target.value })}
                  className="min-h-[240px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Este contrato fica salvo no seu painel e aparece no painel do cliente. A IA poderá enviar este modelo para aceite e assinatura digital.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={salvarPlataforma}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={atualizarPlataforma.isPending}
                >
                  {atualizarPlataforma.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar minha empresa e contrato
                </Button>
              </div>
            </CardContent>
          </Card>

          {showForm && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Cadastrar Novo Cliente
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nome da Empresa
                    </label>
                    <Input
                      id="admin-empresa-nome"
                      placeholder="Pizzaria do Denis"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      className="border-border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo</label>
                    <Select
                      value={form.tipo}
                      onValueChange={(v: any) => setForm({ ...form, tipo: v })}
                    >
                      <SelectTrigger className="border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pizzaria">🍕 Pizzaria</SelectItem>
                        <SelectItem value="adega">🍷 Adega</SelectItem>
                        <SelectItem value="consultorio">🦷 Consultório</SelectItem>
                        <SelectItem value="loja">🏪 Loja</SelectItem>
                        <SelectItem value="outro">📦 Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      WhatsApp opcional
                    </label>
                    <Input
                      id="admin-empresa-whatsapp"
                      placeholder="5516999999999"
                      value={form.whatsappNumero}
                      onChange={(e) =>
                        setForm({ ...form, whatsappNumero: e.target.value })
                      }
                      className="border-border"
                    />
                  </div>
                </div>

                <div className="divider-thin" />

                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="font-semibold">Módulos liberados</h4>
                      <p className="text-sm text-muted-foreground">
                        Dashboard, WhatsApp e Configurações são obrigatórios em todos os planos.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm({ ...form, modules: BASIC_MODULES })}
                      >
                        Básico
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm({ ...form, modules: DEFAULT_MODULES })}
                      >
                        Liberar tudo
                      </Button>
                    </div>
                  </div>
                  <ModuleGrid
                    value={form.modules}
                    onChange={(modules) => setForm({ ...form, modules })}
                  />
                </div>

                <div className="divider-thin" />

                <h4 className="font-semibold">Conta de Acesso da Empresa</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nome do Responsável
                    </label>
                    <Input
                      id="admin-usuario-nome"
                      placeholder="Denis"
                      value={form.nomeUsuario}
                      onChange={(e) =>
                        setForm({ ...form, nomeUsuario: e.target.value })
                      }
                      className="border-border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email de Login
                    </label>
                    <Input
                      id="admin-usuario-email"
                      type="email"
                      placeholder="denis@empresa.com"
                      value={form.emailUsuario}
                      onChange={(e) =>
                        setForm({ ...form, emailUsuario: e.target.value })
                      }
                      className="border-border"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Senha</label>
                    <Input
                      id="admin-usuario-senha"
                      type="password"
                      placeholder="••••••"
                      value={form.senhaUsuario}
                      onChange={(e) =>
                        setForm({ ...form, senhaUsuario: e.target.value })
                      }
                      className="border-border"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleCreate}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={criarEmpresa.isPending}
                  >
                    {criarEmpresa.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Criar Cliente
                  </Button>

                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {ultimoLink && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-8">
              <CardContent className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Último link de pagamento gerado</p>
                  <p className="text-xs text-muted-foreground truncate">{ultimoLink}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(ultimoLink)}>
                  Copiar link
                </Button>
              </CardContent>
            </Card>
          )}

          {financeiro?.faturas?.length > 0 && (
            <Card className="border border-border mb-8">
              <CardHeader>
                <CardTitle>Faturas recentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {financeiro.faturas.slice(0, 5).map((fatura: any) => (
                  <div key={fatura.id} className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">
                        #{fatura.id} · {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((fatura.valor || 0) / 100)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fatura.status} · {fatura.orderNsu || fatura.transactionId || fatura.slug || "sem referência"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {fatura.paymentLink && (
                        <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(fatura.paymentLink)}>
                          Copiar link
                        </Button>
                      )}
                      {fatura.receiptUrl && (
                        <Button size="sm" variant="outline" onClick={() => window.open(fatura.receiptUrl, "_blank")}>
                          Comprovante
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => verificarPagamento(fatura)}>
                        Verificar
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Carregando empresas...</p>
              </div>
            ) : !empresas || empresas.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma empresa cadastrada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Clique em Nova Empresa para começar
                  </p>
                </CardContent>
              </Card>
            ) : (
              empresas.map((empresa) => {
                const modules = getEmpresaModules(empresa);
                return (
                <Card
                  key={empresa.id}
                  className={`border transition-colors ${
                    empresa.ativo
                      ? "border-emerald-500/30 hover:border-emerald-500/50"
                      : "border-border hover:border-red-500/30"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="typography-h3">{empresa.nome}</h3>

                          <span className="text-sm">
                            {tipoLabels[empresa.tipo] || empresa.tipo}
                          </span>

                          {empresa.ativo ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 
text-emerald-600 text-xs rounded-full font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Ativa
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-600 
text-xs rounded-full font-medium">
                              <XCircle className="w-3 h-3" />
                              Inativa
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Smartphone className="w-4 h-4" />
                            <span>{empresa.whatsappNumero || "Não configurado"}</span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {empresa.licencaExpira
                                ? `Expira: ${new Date(
                                    empresa.licencaExpira
                                  ).toLocaleDateString("pt-BR")}`
                                : "Sem data"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-medium">Módulos do plano</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={atualizarEmpresa.isPending}
                                onClick={() => updateEmpresaModules(empresa.id, BASIC_MODULES)}
                              >
                                Básico
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={atualizarEmpresa.isPending}
                                onClick={() => updateEmpresaModules(empresa.id, DEFAULT_MODULES)}
                              >
                                Tudo
                              </Button>
                            </div>
                          </div>
                          <ModuleGrid
                            compact
                            value={modules}
                            onChange={(next) => updateEmpresaModules(empresa.id, next)}
                          />
                        </div>

                        <div className="mt-5 rounded-md border border-border p-3">
                          <div className="mb-3 flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                            <p className="text-sm font-medium">Financeiro e licença</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                            <Select
                              value={planoCobranca[empresa.id] || ((empresa.configBot as any)?.planoId as string) || "inicial"}
                              onValueChange={(value) => setPlanoCobranca({ ...planoCobranca, [empresa.id]: value })}
                            >
                              <SelectTrigger className="border-border">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PLANOS_SAAS.map((plano) => (
                                  <SelectItem key={plano.id} value={plano.id}>
                                    {plano.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => gerarCobranca(empresa, "licenca")} disabled={loadingPagamentoId === empresa.id}>
                                Licença
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => gerarCobranca(empresa, "mensalidade")} disabled={loadingPagamentoId === empresa.id}>
                                Mensalidade
                              </Button>
                              <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => alterarLicenca(empresa.id, "renovar")}>
                                Renovar
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-500/30 text-red-600 hover:bg-red-500/10" onClick={() => alterarLicenca(empresa.id, "suspender")}>
                                Suspender
                              </Button>
                            </div>
                          </div>
                          {!empresa.ativo && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-yellow-700">
                              <AlertTriangle className="h-3 w-3" />
                              Empresa sem licença ativa.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() => handleAcessarEmpresa(empresa.id)}
                          disabled={loadingEmpresaId === empresa.id}
                        >
                          {loadingEmpresaId === empresa.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Abrindo...
                            </>
                          ) : (
                            <>
                              <LogIn className="w-4 h-4 mr-2" />
                              Acessar Dashboard
                            </>
                          )}
                        </Button>

                        {empresa.ativo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                            onClick={() =>
                              toggleLicenca.mutate({
                                empresaId: empresa.id,
                                ativo: false,
                              })
                            }
                          >
                            Desativar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() =>
                              toggleLicenca.mutate({
                                empresaId: empresa.id,
                                ativo: true,
                                diasLicenca: 30,
                              })
                            }
                          >
                            Ativar 30 dias
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
