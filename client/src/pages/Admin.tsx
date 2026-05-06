import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
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
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Admin() {
  const { data: empresasData, isLoading, refetch } = trpc.admin.empresas.useQuery();
  const empresas = unwrapTrpcArray<typeof empresasData extends Array<infer T> ? T : any>(empresasData);

  const criarEmpresa = trpc.admin.criarEmpresa.useMutation({
    onSuccess: () => refetch(),
  });

  const toggleLicenca = trpc.admin.toggleLicenca.useMutation({
    onSuccess: () => refetch(),
  });

  const acessarEmpresa = trpc.admin.acessarEmpresa.useMutation();

  const [loadingEmpresaId, setLoadingEmpresaId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    tipo: "pizzaria" as "pizzaria" | "adega" | "consultorio" | "loja" | "outro",
    whatsappNumero: "",
    emailUsuario: "",
    senhaUsuario: "",
    nomeUsuario: "",
  });

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
    });
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

          {showForm && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Cadastrar Nova Empresa
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
                    Criar Empresa
                  </Button>

                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
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
              empresas.map((empresa) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
