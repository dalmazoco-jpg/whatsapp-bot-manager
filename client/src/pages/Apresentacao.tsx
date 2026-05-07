import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray, unwrapTrpcData } from "@/lib/trpcData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import { Copy, ExternalLink, Share2, Loader2, MessageSquare, Sparkles, Images, Wand2 } from "lucide-react";

function slugToUrl(slug?: string) {
  if (!slug) return "";
  return `${window.location.origin}/public/${slug}`;
}

function formatCurrency(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((centavos || 0) / 100);
}

function presentationLabels(ramo?: string | null) {
  const type = ramo || "outro";
  if (["consultorio", "clinica", "salao", "barbearia"].includes(type)) {
    return {
      catalogTitle: "Serviços",
      catalogDescription: "Mostre os serviços disponíveis e facilite o agendamento pelo WhatsApp.",
      empty: "Nenhum serviço cadastrado ainda.",
      publicAction: "Agendar pelo WhatsApp",
      defaultDescription: "Conheça nossos serviços, tire dúvidas e agende seu atendimento pelo WhatsApp.",
    };
  }
  if (["loja", "adega"].includes(type)) {
    return {
      catalogTitle: "Catálogo",
      catalogDescription: "Mostre os produtos disponíveis e facilite o contato pelo WhatsApp.",
      empty: "Nenhum produto cadastrado ainda.",
      publicAction: "Comprar pelo WhatsApp",
      defaultDescription: "Veja nossos produtos, condições e fale com a equipe pelo WhatsApp.",
    };
  }
  return {
    catalogTitle: "Cardápio",
    catalogDescription: "Mostre os itens disponíveis e facilite pedidos pelo WhatsApp.",
    empty: "Nenhum item cadastrado ainda.",
    publicAction: "Pedir pelo WhatsApp",
    defaultDescription: "Confira nossas opções e faça seu pedido pelo WhatsApp.",
  };
}

type GeneratedPresentation = {
  tipo: "cardapio" | "landing" | "folder";
  headline: string;
  subtitulo: string;
  descricao: string;
  cta: string;
  secoes: Array<{ titulo: string; texto: string; itens?: string[] }>;
  destaques: string[];
  recomendacoesFotos: string[];
  corPrimaria: string;
};

export default function Apresentacao() {
  const [activeTab, setActiveTab] = useState("cardapio");
  const { data: meData } = trpc.auth.me.useQuery();
  const me = unwrapTrpcData<{ empresa?: { nome?: string; ramo?: string; tipo?: string; whatsappNumero?: string } | null } | null>(meData);
  const labels = presentationLabels(me?.empresa?.ramo || me?.empresa?.tipo);
  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = trpc.apresentacao.getConfig.useQuery();
  const config = unwrapTrpcData<any>(configData);
  const { data: itens, isLoading: itensLoading } = trpc.cardapio.list.useQuery();
  const itensArray = unwrapTrpcArray<typeof itens extends Array<infer T> ? T : any>(itens);
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
  const [aiInstructions, setAiInstructions] = useState("");
  const [generated, setGenerated] = useState<GeneratedPresentation | null>(null);
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
  const gerarAutomatico = trpc.apresentacao.gerarAutomatico.useMutation({
    onSuccess: (data: any) => {
      const nextConfig = data?.config;
      if (nextConfig) {
        setForm({
          nomeEmpresa: nextConfig.nomeEmpresa || "",
          descricao: nextConfig.descricao || "",
          logoUrl: nextConfig.logoUrl || "",
          corPrimaria: nextConfig.corPrimaria || "#10b981",
          whatsapp: nextConfig.whatsapp || "",
          endereco: nextConfig.endereco || "",
          instagram: nextConfig.instagram || "",
          ativo: nextConfig.ativo ?? true,
        });
      }
      setGenerated(data?.conteudo || null);
      refetchConfig();
      toast.success(data?.fonte === "ia" ? "Apresentação gerada com IA" : "Apresentação gerada automaticamente");
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao gerar apresentação"),
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
    } else if (me?.empresa) {
      setForm((prev) => ({
        ...prev,
        nomeEmpresa: prev.nomeEmpresa || me.empresa?.nome || "",
        descricao: prev.descricao || labels.defaultDescription,
        whatsapp: prev.whatsapp || me.empresa?.whatsappNumero || "",
      }));
    }
  }, [config, me?.empresa?.nome, me?.empresa?.whatsappNumero, labels.defaultDescription]);

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

  const handleGenerateAutomatic = async (tipo?: "cardapio" | "landing" | "folder") => {
    const requestedType = tipo;
    const result: any = await gerarAutomatico.mutateAsync({
      tipo: requestedType,
      instrucoes: aiInstructions.trim() || undefined,
    });
    if (result?.conteudo?.tipo) {
      setActiveTab(result.conteudo.tipo);
    }
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
              Gerencie a apresentação pública da empresa, landing page e folder digital compartilhável.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab("cardapio")}>{labels.catalogTitle}</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("landing")}>Landing Page</Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab("folder")}>Folder</Button>
          </div>
        </div>

        <Card className="mb-6 border border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              Gerador automático
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div className="space-y-3">
                <Textarea
                  value={aiInstructions}
                  onChange={(event) => setAiInstructions(event.target.value)}
                  className="min-h-[92px]"
                  placeholder="Ex.: destacar promoções da semana, falar que atende por agendamento, usar tom mais premium..."
                />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => handleGenerateAutomatic()} disabled={gerarAutomatico.isPending}>
                    {gerarAutomatico.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                    Gerar pelo ramo
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateAutomatic("landing")} disabled={gerarAutomatico.isPending}>
                    Landing
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateAutomatic("cardapio")} disabled={gerarAutomatico.isPending}>
                    {labels.catalogTitle}
                  </Button>
                  <Button variant="outline" onClick={() => handleGenerateAutomatic("folder")} disabled={gerarAutomatico.isPending}>
                    Folder
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                {generated ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">{generated.tipo}</div>
                      <h2 className="mt-1 text-xl font-semibold text-foreground">{generated.headline}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{generated.subtitulo}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {generated.destaques.slice(0, 4).map((item) => (
                        <span key={item} className="rounded-full border border-emerald-500/60 px-3 py-1 text-xs text-emerald-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Images className="h-4 w-4 text-emerald-400" />
                      Dados usados
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Ramo: {me?.empresa?.ramo || me?.empresa?.tipo || "não informado"}. Itens disponíveis: {availableItems.length}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      A geração preenche a descrição, ajusta a cor e sugere fotos conforme o tipo de negócio.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {generated?.secoes?.length ? (
              <div className="grid gap-3 md:grid-cols-3">
                {generated.secoes.slice(0, 3).map((secao) => (
                  <div key={secao.titulo} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                    <h3 className="text-sm font-semibold text-foreground">{secao.titulo}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{secao.texto}</p>
                    {secao.itens?.length ? (
                      <div className="mt-3 space-y-1">
                        {secao.itens.slice(0, 4).map((item) => (
                          <div key={item} className="text-xs text-emerald-200">{item}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {generated?.recomendacoesFotos?.length ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Images className="h-4 w-4 text-emerald-400" />
                  Fotos recomendadas
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {generated.recomendacoesFotos.map((foto) => (
                    <div key={foto} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-muted-foreground">
                      {foto}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="cardapio">{labels.catalogTitle}</TabsTrigger>
            <TabsTrigger value="landing">Landing Page</TabsTrigger>
            <TabsTrigger value="folder">Folder</TabsTrigger>
          </TabsList>

          <TabsContent value="cardapio">
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mt-6">
              <div className="space-y-4">
                <Card className="border border-border">
                  <CardHeader>
                    <CardTitle>{labels.catalogTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{labels.catalogDescription}</p>
                        <p className="text-xs text-muted-foreground">Apenas itens disponíveis aparecerão na página pública.</p>
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
                    <CardTitle>{labels.catalogTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {itensLoading ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 w-3/4 bg-slate-700 rounded" />
                        <div className="h-4 w-1/2 bg-slate-700 rounded" />
                      </div>
                    ) : itensArray.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{labels.empty}</p>
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
                        <Button size="sm" onClick={handleGenerateLink} disabled={gerarLinkPublico.isLoading || configLoading}>
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
                    <Textarea value={form.descricao} onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))} className="min-h-[120px]" placeholder={labels.defaultDescription} />
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
                      <Button onClick={handleGenerateLink} disabled={gerarLinkPublico.isLoading || configLoading}>
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
