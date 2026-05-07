import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray, unwrapTrpcData } from "@/lib/trpcData";
import { DEFAULT_MODULES, MASTER_ADMIN_EMAIL } from "@/lib/modules";
import { Plus, Search, MessageCircle, LogIn, Building2, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Clientes() {
  const { data: meData } = trpc.auth.me.useQuery();
  const me = unwrapTrpcData<any>(meData);
  const isMasterAdmin = me?.role === "admin" && me?.email?.toLowerCase() === MASTER_ADMIN_EMAIL && !me?.isDelegated;

  const { data: clientes, isLoading, refetch } = trpc.clientes.list.useQuery(undefined, {
    enabled: !isMasterAdmin,
  });
  const { data: empresasData, isLoading: empresasLoading, refetch: refetchEmpresas } = trpc.admin.empresas.useQuery(undefined, {
    enabled: !!isMasterAdmin,
    retry: false,
  });

  const criarClienteFinal = trpc.clientes.create.useMutation({
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      refetch();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao cadastrar cliente"),
  });
  const criarEmpresa = trpc.admin.criarEmpresa.useMutation({
    onSuccess: () => {
      toast.success("Cliente do SaaS cadastrado");
      refetchEmpresas();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao cadastrar cliente"),
  });
  const acessarEmpresa = trpc.admin.acessarEmpresa.useMutation();
  const [searchTerm, setSearchTerm] = useState("");
  const formRef = useRef<HTMLDivElement | null>(null);
  const [clienteForm, setClienteForm] = useState({ nome: "", whatsappNumber: "", endereco: "" });
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [empresaForm, setEmpresaForm] = useState({
    nome: "",
    tipo: "loja" as "pizzaria" | "adega" | "consultorio" | "loja" | "outro",
    whatsappNumero: "",
    nomeUsuario: "",
    emailUsuario: "",
    senhaUsuario: "",
  });

  const clientesArray = unwrapTrpcArray<typeof clientes extends Array<infer T> ? T : any>(clientes);
  const empresasArray = unwrapTrpcArray<typeof empresasData extends Array<infer T> ? T : any>(empresasData);

  const filteredClientes = clientesArray.filter(
    (c) => (c.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) || (c.whatsappNumber || "").includes(searchTerm)
  );
  const filteredEmpresas = empresasArray.filter(
    (empresa) => (empresa.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) || (empresa.whatsappNumero || "").includes(searchTerm)
  );

  const handleAcessarEmpresa = async (empresaId: number) => {
    try {
      const result = await acessarEmpresa.mutateAsync({ empresaId });
      localStorage.setItem("auth_token", result.token);
      document.cookie = `app_session_token=${result.token}; path=/; SameSite=Lax`;
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Erro ao acessar empresa:", err);
      toast.error("Não foi possível acessar o dashboard");
    }
  };

  const handleCreateClienteFinal = async () => {
    setStatusMessage(null);
    if (!clienteForm.nome || !clienteForm.whatsappNumber) {
      const text = "Informe nome e WhatsApp.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    try {
      const cliente = await criarClienteFinal.mutateAsync({
        nome: clienteForm.nome,
        whatsappNumber: clienteForm.whatsappNumber,
        endereco: clienteForm.endereco || undefined,
      });
      await refetch();
      const text = `Cliente ${cliente.nome} salvo.`;
      setClienteForm({ nome: "", whatsappNumber: "", endereco: "" });
      setStatusMessage({ type: "success", text });
      toast.success(text);
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Erro ao salvar cliente.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    }
  };

  const handleCreateEmpresa = async () => {
    setStatusMessage(null);
    if (!empresaForm.nome || !empresaForm.nomeUsuario || !empresaForm.emailUsuario || !empresaForm.senhaUsuario) {
      const text = "Preencha empresa, responsável, email e senha.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
      return;
    }
    try {
      const empresa = await criarEmpresa.mutateAsync({
        ...empresaForm,
        modules: DEFAULT_MODULES,
      });
      await refetchEmpresas();
      const text = `Cliente ${empresa.nome} salvo.`;
      setEmpresaForm({
        nome: "",
        tipo: "loja",
        whatsappNumero: "",
        nomeUsuario: "",
        emailUsuario: "",
        senhaUsuario: "",
      });
      setStatusMessage({ type: "success", text });
      toast.success(text);
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Erro ao salvar cliente.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    }
  };

  const loading = isMasterAdmin ? empresasLoading : isLoading;
  const clienteSaving = criarClienteFinal.isLoading || (criarClienteFinal as any).isPending;
  const empresaSaving = criarEmpresa.isLoading || (criarEmpresa as any).isPending;
  const acessarSaving = acessarEmpresa.isLoading || (acessarEmpresa as any).isPending;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="typography-h1 mb-2">Clientes</h1>
            <p className="typography-body text-muted-foreground">
              {isMasterAdmin ? "Clientes do SaaS cadastrados no seu painel." : "Clientes atendidos via WhatsApp."}
            </p>
          </div>
          <Button onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        <div ref={formRef} className="scroll-mt-4">
          {statusMessage && (
            <div
              className={`mb-4 rounded-md border px-4 py-3 text-sm font-medium ${
                statusMessage.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : "border-red-500/40 bg-red-500/10 text-red-700"
              }`}
            >
              {statusMessage.text}
            </div>
          )}
          <Card className="mb-6 border border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle>{isMasterAdmin ? "Cadastrar cliente do SaaS" : "Cadastrar cliente final"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isMasterAdmin ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input placeholder="Empresa cliente" value={empresaForm.nome} onChange={(e) => setEmpresaForm({ ...empresaForm, nome: e.target.value })} />
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={empresaForm.tipo} onChange={(e) => setEmpresaForm({ ...empresaForm, tipo: e.target.value as any })}>
                      <option value="loja">Loja</option>
                      <option value="pizzaria">Pizzaria</option>
                      <option value="adega">Adega</option>
                      <option value="consultorio">Consultório</option>
                      <option value="outro">Outro</option>
                    </select>
                    <Input placeholder="WhatsApp" value={empresaForm.whatsappNumero} onChange={(e) => setEmpresaForm({ ...empresaForm, whatsappNumero: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input placeholder="Responsável" value={empresaForm.nomeUsuario} onChange={(e) => setEmpresaForm({ ...empresaForm, nomeUsuario: e.target.value })} />
                    <Input placeholder="Email de login" type="email" value={empresaForm.emailUsuario} onChange={(e) => setEmpresaForm({ ...empresaForm, emailUsuario: e.target.value })} />
                    <Input placeholder="Senha" type="password" value={empresaForm.senhaUsuario} onChange={(e) => setEmpresaForm({ ...empresaForm, senhaUsuario: e.target.value })} />
                  </div>
                  <Button onClick={handleCreateEmpresa} disabled={empresaSaving} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    {empresaSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Criar Cliente
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input placeholder="Nome" value={clienteForm.nome} onChange={(e) => setClienteForm({ ...clienteForm, nome: e.target.value })} />
                    <Input placeholder="WhatsApp" value={clienteForm.whatsappNumber} onChange={(e) => setClienteForm({ ...clienteForm, whatsappNumber: e.target.value })} />
                    <Input placeholder="Endereço opcional" value={clienteForm.endereco} onChange={(e) => setClienteForm({ ...clienteForm, endereco: e.target.value })} />
                  </div>
                  <Button onClick={handleCreateClienteFinal} disabled={clienteSaving} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    {clienteSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar Cliente
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={isMasterAdmin ? "Buscar por empresa ou WhatsApp..." : "Buscar por nome ou WhatsApp..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-border"
            />
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : isMasterAdmin ? (
            filteredEmpresas.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum cliente cadastrado</p>
                </CardContent>
              </Card>
            ) : (
              filteredEmpresas.map((empresa) => (
                <Card key={empresa.id} className="border border-border hover:border-emerald-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="typography-h3 mb-2">{empresa.nome}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {empresa.tipo || "outro"}</span>
                          <span className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> {empresa.whatsappNumero || "Sem WhatsApp"}</span>
                          <span>{empresa.ativo ? "Licença ativa" : "Licença inativa"}</span>
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => handleAcessarEmpresa(empresa.id)} disabled={acessarSaving}>
                        <LogIn className="w-4 h-4 mr-2" />
                        Acessar Dashboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )
          ) : filteredClientes.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredClientes.map((cliente) => (
              <Card key={cliente.id} className="border border-border hover:border-emerald-500/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="typography-h3 mb-2">{cliente.nome}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MessageCircle className="w-4 h-4" />
                          <span>{cliente.whatsappNumber}</span>
                        </div>
                        {cliente.endereco && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>{cliente.endereco}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
