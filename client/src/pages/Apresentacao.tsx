import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Copy, ExternalLink, Share2, Loader2, MessageSquare } from "lucide-react";

function slugToUrl(slug?: string) {
  if (!slug) return "";
  return `${window.location.origin}/public/${slug}`;
}

function formatCurrency(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((centavos || 0) / 100);
}

export default function Apresentacao() {
  const [activeTab, setActiveTab] = useState("cardapio");
  const { data: config, isLoading: configLoading, refetch: refetchConfig } = trpc.apresentacao.getConfig.useQuery();
  const { data: itens, isLoading: itensLoading } = trpc.cardapio.list.useQuery();
  const itensArray = unwrapTrpcArray<typeof itens extends Array<infer T> ? T : any>(itens);
  const updateConfig = trpc.apresentacao.updateConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração salva");
      refetchConfig();
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });
  const gerarLinkPublico = trpc.apresentacao.gerarLinkPublico.useMutation({
    onSuccess: () => {
      toast.success("Link público gerado");
      refetchConfig();
    },
    onError: () => toast.error("Erro ao gerar link público"),
  });

  const [form, setForm] = useState({
    nomeEmpresa: "",
    descricao: "",
    logoUrl: "",
    corPrimaria: "#10b981",
    whatsapp: "",
    endereco: "",
    instagram: "",
    ativo: true,
  });

  useEffect(() => {
    if (config) {
      setForm({
        nomeEmpresa: config.nomeEmpresa || "",
        descricao: config.descricao || "",
        logoUrl: config.logoUrl || "",
        corPrimaria: config.corPrimaria || "#10b981",
        whatsapp: config.whatsapp || "",
        endereco: config.endereco || "",
        instagram: config.instagram || "",
        ativo: config.ativo ?? true,
      });
    }
  }, [config]);

  const availableItems = useMemo(
    () => itensArray.filter((item) => item.disponivel).sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)),
    [itensArray]
  );

  const categories = useMemo(
    () => Array.from(new Set(availableItems.map((item) => item.categoria || "Geral"))),
    [availableItems]
  );

  const publicUrl = config?.slug ? slugToUrl(config.slug) : "";

  const handleSaveConfig = async () => {
    await updateConfig.mutateAsync({
      nomeEmpresa: form.nomeEmpresa,
      descricao: form.descricao,
      logoUrl: form.logoUrl,
      corPrimaria: form.corPrimaria,
      whatsapp: form.whatsapp,
      endereco: form.endereco,
      instagram: form.instagram,
      ativo: form.ativo,
    });
  };

  const handleGenerateLink = async () => {
    await gerarLinkPublico.mutateAsync();
  };

  const handleCopyLink = async () => {
    if (!publicUrl) {
      toast.error("Gere o link público primeiro");
      return;
    }
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado para a área de transferência");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="typography-h1">Apresentação Comercial</h1>
            <p className="typography-body text-muted-foreground max-w-2xl">
              Gerencie o seu cardápio público, crie a landing page e o folder digital compartilhável.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("cardapio")}>Cardápio</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("landing")}>Landing Page</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("folder")}>Folder</Button>
          </div>
        </div>

        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="cardapio">Cardápio</TabsTrigger>
            <TabsTrigger value="landing">Landing Page</TabsTrigger>
            <TabsTrigger value="folder">Folder</TabsTrigger>
          </TabsList>

          <TabsContent value="cardapio">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mt-6">
              <div className="space-y-4">
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle>Cardápio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Aqui estão os itens do cardápio da sua empresa.</p>
                        <p className="text-xs text-muted-foreground">Apenas produtos disponíveis aparecerão na página pública.</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (config?.slug) {
                              window.open(publicUrl, "_blank");
                            } else {
                              handleGenerateLink();
                            }
                          }}
                          disabled={gerarLinkPublico.isLoading || configLoading}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visualizar público
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleCopyLink}
                          disabled={!publicUrl}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Compartilhar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle>Itens do cardápio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {itensLoading ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-3/4 bg-slate-700 rounded" />
                        <div className="h-4 w-1/2 bg-slate-700 rounded" />
                      </div>
                    ) : itensArray.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum item cadastrado ainda.</p>
                    ) : (
                      <div className="space-y-4">
                        {availableItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-slate-700 p-4 bg-slate-950/80">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <div className="text-sm uppercase tracking-[0.2em] text-emerald-300">{item.categoria}</div>
                                <div className="text-lg font-semibold">{item.nome}</div>
                                {item.descricao ? <p className="text-sm text-muted-foreground mt-1">{item.descricao}</p> : null}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-semibold text-emerald-500">{formatCurrency(item.preco)}</span>
                                <span className="rounded-full border border-emerald-500 px-2 py-1 text-xs uppercase text-emerald-300">Disponível</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle>Link público</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">{config?.slug ? "Link já disponível:" : "Gere o link público para compartilhar seu site."}</p>
                      {config?.slug ? (
                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm break-words">{publicUrl}</div>
                      ) : (
                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm text-muted-foreground">Link ainda não gerado</div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={handleGenerateLink} disabled={gerarLinkPublico.isLoading || !config}>
                          {gerarLinkPublico.isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                          {config?.slug ? "Atualizar link" : "Gerar link"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCopyLink} disabled={!publicUrl}>
                          <Copy className="w-4 h-4 mr-2" />Copiar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="landing">
            <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] mt-6">
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Editor de Landing Page</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">Nome da empresa</label>
                    <Input value={form.nomeEmpresa} onChange={(e) => setForm((prev) => ({ ...prev, nomeEmpresa: e.target.value }))} />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">Descrição</label>
                    <Textarea value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} className="min-h-[120px]" />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">Cor principal</label>
                    <Input type="color" value={form.corPrimaria} onChange={(e) => setForm((prev) => ({ ...prev, corPrimaria: e.target.value }))} className="h-12 p-0" />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">URL do logo</label>
                    <Input value={form.logoUrl} onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))} />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">WhatsApp</label>
                    <Input value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} placeholder="5511999999999" />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">Endereço</label>
                    <Input value={form.endereco} onChange={(e) => setForm((prev) => ({ ...prev, endereco: e.target.value }))} />
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm font-medium text-foreground">Instagram</label>
                    <Input value={form.instagram} onChange={(e) => setForm((prev) => ({ ...prev, instagram: e.target.value }))} placeholder="@seu_perfil" />
                  </div>
                  <Button onClick={handleSaveConfig} disabled={updateConfig.isLoading || configLoading}>
                    {updateConfig.isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Salvar alterações
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-border rounded-3xl overflow-hidden">
                <div className="p-6" style={{ backgroundColor: form.corPrimaria || "#10b981" }}>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 rounded-2xl bg-white/15 flex items-center justify-center overflow-hidden">
                      {form.logoUrl ? <img src={form.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-white">Logo</span>}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">{form.nomeEmpresa || "Minha Empresa"}</h2>
                      <p className="text-sm text-white/80">Landing page ativa</p>
                    </div>
                  </div>
                </div>
                <CardContent>
                  <p className="text-sm text-foreground mb-4">{form.descricao || "Use este espaço para explicar seus serviços e chamar o cliente."}</p>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-700 p-4 bg-slate-950/80">
                      <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Contato</div>
                      <p className="text-sm text-foreground">WhatsApp: {form.whatsapp || "--"}</p>
                      <p className="text-sm text-foreground">Instagram: {form.instagram || "--"}</p>
                      <p className="text-sm text-foreground">Endereço: {form.endereco || "--"}</p>
                    </div>
                    <Button variant="secondary" onClick={() => publicUrl && window.open(publicUrl, "_blank")} disabled={!publicUrl}>
                      <ExternalLink className="w-4 h-4 mr-2" /> Ver página pública
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="folder">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mt-6">
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Folder Digital</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">Visualize o catálogo em formato de folder e gere o link compartilhável.</p>
                    <div className="grid gap-3">
                      <Button onClick={handleGenerateLink} disabled={gerarLinkPublico.isLoading || !config}>
                        {gerarLinkPublico.isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                        Gerar link compartilhável
                      </Button>
                      {publicUrl ? (
                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-sm break-words">{publicUrl}</div>
                      ) : null}
                      <div className="grid gap-3">
                        {categories.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Cadastre produtos no cardápio para preencher o folder.</p>
                        ) : (
                          categories.map((category) => (
                            <div key={category} className="rounded-2xl border border-slate-700 p-4">
                              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">{category}</div>
                              <div className="mt-3 space-y-3">
                                {availableItems.filter((item) => item.categoria === category).map((item) => (
                                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 p-3 bg-slate-950/80">
                                    <div>
                                      <div className="font-medium">{item.nome}</div>
                                      <p className="text-sm text-muted-foreground">{item.descricao}</p>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-semibold text-emerald-400">{formatCurrency(item.preco)}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border">
                <CardHeader>
                  <CardTitle>Preview do folder</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-slate-800 flex items-center justify-center text-white">F</div>
                      <div>
                        <p className="font-semibold">Folder digital</p>
                        <p className="text-sm text-muted-foreground">A página pública mostra produtos em grid responsivo.</p>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-700 bg-slate-950/80 p-4">
                      {availableItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem itens disponíveis.</p>
                      ) : (
                        <div className="grid gap-3">
                          {availableItems.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-700 p-3 bg-slate-900">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold">{item.nome}</div>
                                  <p className="text-sm text-muted-foreground">{item.categoria}</p>
                                </div>
                                <span className="text-emerald-400">{formatCurrency(item.preco)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => { if (publicUrl) window.open(publicUrl, "_blank"); }} disabled={!publicUrl}>
                      <MessageSquare className="w-4 h-4 mr-2" /> Abrir página pública
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
