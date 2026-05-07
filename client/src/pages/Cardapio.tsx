import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray, unwrapTrpcData } from "@/lib/trpcData";
import {
  Package,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  ImagePlus,
  FileText,
  Save,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

type ProdutoPreview = {
  nome: string;
  descricao?: string;
  preco: number;
  categoria: string;
};

function getOcrErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (
    message.includes("BUILT_IN_FORGE_API_URL") ||
    message.includes("BUILT_IN_FORGE_API_KEY") ||
    message.toLowerCase().includes("armazenamento configurado") ||
    message.toLowerCase().includes("storage config missing")
  ) {
    return "Importação por foto ainda precisa do storage Forge configurado no servidor. Envie BUILT_IN_FORGE_API_URL e BUILT_IN_FORGE_API_KEY para ativar essa função.";
  }

  if (message.includes("400") || message.toLowerCase().includes("invalid image")) {
    return "A IA não conseguiu ler essa imagem. Tente uma foto mais nítida, sem corte e com os preços visíveis.";
  }

  return message || "Erro ao processar imagem.";
}

export default function Cardapio() {
  const { data: meData } = trpc.auth.me.useQuery();
  const me = unwrapTrpcData<any>(meData);
  const isPlatformCatalog = me?.role === "admin" && !me?.empresaId && !me?.isDelegated;
  const { data: itens, isLoading, refetch } = trpc.cardapio.list.useQuery();
  const itensArray = unwrapTrpcArray<typeof itens extends Array<infer T> ? T : any>(itens);
  const criarItem = trpc.cardapio.create.useMutation({ onSuccess: () => refetch() });
  const updateItem = trpc.cardapio.update.useMutation({ onSuccess: () => refetch() });
  const deleteItem = trpc.cardapio.delete.useMutation({ onSuccess: () => refetch() });
  const ocrMutation = trpc.import.ocr.useMutation();
  const bulkInsertMutation = trpc.import.bulkInsert.useMutation({ onSuccess: () => refetch() });

  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<ProdutoPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({ categoria: "", nome: "", descricao: "", preco: "" });
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const importPanelRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLDivElement | null>(null);
  const formPanelRef = useRef<HTMLDivElement | null>(null);
  const bulkSaving = bulkInsertMutation.isLoading || (bulkInsertMutation as any).isPending;
  const creatingItem = criarItem.isLoading || (criarItem as any).isPending;
  const itemLabel = isPlatformCatalog ? "Plano" : "Item";
  const catalogTitle = isPlatformCatalog ? "Planos da Plataforma" : "Catálogo de Itens";
  const catalogDescription = isPlatformCatalog
    ? "Cadastre seus planos, valores e descrições para a IA oferecer corretamente no atendimento."
    : "Envie foto, texto ou cadastre produtos manualmente. A IA usará este catálogo no atendimento.";

  const openBulkTextPanel = () => {
    importPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openFormPanel = () => {
    formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openPreviewPanel = (products: ProdutoPreview[]) => {
    setPreviewProducts(products);
    setShowPreview(true);
  };

  useEffect(() => {
    if (!showPreview) return;
    requestAnimationFrame(() => {
      previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [showPreview, previewProducts.length]);

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

  const parsePrecoInput = (value: string) => {
    const clean = value.replace(/[^\d,.-]/g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const parsePriceToken = (value: string) => {
    const match = value.match(/(?:r\$\s*)?(\d{1,4}(?:[.,]\d{2})|\d+)/i);
    if (!match) return 0;
    return parsePrecoInput(match[1]);
  };

  const findPriceMatch = (value: string) => {
    const decimalMatches = Array.from(value.matchAll(/(?:r\$\s*)?\d{1,5}(?:[.,]\d{2})/gi));
    if (decimalMatches.length > 0) return decimalMatches[decimalMatches.length - 1];
    const integerAtEnd = value.match(/(?:r\$\s*)?\d+\s*$/i);
    return integerAtEnd;
  };

  const handleCreate = async () => {
    setStatusMessage(null);
    if (!form.nome || !form.categoria || !form.preco) {
      const text = "Preencha categoria, nome e preço antes de salvar.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
      return;
    }

    const precoEmCentavos = parsePrecoInput(form.preco);
    if (precoEmCentavos <= 0) {
      const text = "Preço inválido. Use um valor como 12,90.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
      return;
    }

    try {
      await criarItem.mutateAsync({
        categoria: form.categoria,
        nome: form.nome,
        descricao: form.descricao || undefined,
        preco: precoEmCentavos,
      });
      await refetch();
      const text = `${itemLabel} salvo no catálogo.`;
      setForm({ categoria: "", nome: "", descricao: "", preco: "" });
      setStatusMessage({ type: "success", text });
      toast.success(text);
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Erro ao salvar item.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    }
  };

  const handleToggleDisponivel = async (id: number, current: boolean) => {
    await updateItem.mutateAsync({ id, disponivel: !current });
  };

  const parseBulkText = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const products: ProdutoPreview[] = [];
    let currentCategory = "Geral";

    for (const line of lines) {
      const normalizedLine = line
        .replace(/^[•*-]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .trim();

      if (!normalizedLine) continue;

      const onlyCategory = normalizedLine.match(/^([a-zà-ú0-9 /&-]{3,40}):$/i);
      if (onlyCategory && !parsePriceToken(normalizedLine)) {
        currentCategory = onlyCategory[1].trim();
        continue;
      }

      const priceMatch = findPriceMatch(normalizedLine);
      const preco = priceMatch ? parsePriceToken(priceMatch[0]) : 0;
      if (preco <= 0) continue;

      const beforePrice = normalizedLine.slice(0, priceMatch!.index).trim();
      const afterPrice = normalizedLine.slice((priceMatch!.index || 0) + priceMatch![0].length).trim();
      const separators = ["|", ";", "\t", " - ", " – ", " — "];
      let parts = normalizedLine
        .split(new RegExp(separators.map((sep) => sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")))
        .map((part) => part.trim())
        .filter(Boolean);

      if (parts.length < 2) {
        const name = beforePrice || normalizedLine.replace(priceMatch![0], "").trim();
        const description = afterPrice.replace(/^[-–—,;|]+/, "").trim();
        if (name) {
          products.push({
            nome: name,
            preco,
            descricao: description || undefined,
            categoria: currentCategory,
          });
        }
        continue;
      }

      const pricePartIndex = parts.findIndex((part) => parsePriceToken(part) > 0);
      const nome = (pricePartIndex > 0 ? parts.slice(0, pricePartIndex).join(" ") : parts[0])
        .replace(priceMatch![0], "")
        .trim();
      const remaining = parts.filter((_, index) => index !== pricePartIndex && index !== 0);
      const categoryCandidate = remaining[remaining.length - 1];
      const categoria = categoryCandidate && categoryCandidate.length <= 35 && !/[.,]\d{2}/.test(categoryCandidate)
        ? categoryCandidate
        : currentCategory;
      const descricaoParts = remaining.filter((part) => part !== categoria);
      const descricao = descricaoParts.join(" - ").trim();

      if (nome) {
        products.push({
          nome,
          preco,
          descricao: descricao || undefined,
          categoria,
        });
      }
    }

    return products;
  };

  const handleBulkFileImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.csv,text/plain,text/csv";

    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 1024 * 1024) {
        toast.error("Arquivo muito grande. Use TXT/CSV com até 1MB.");
        return;
      }

      try {
        const text = await file.text();
        setBulkText(text);
        openBulkTextPanel();
        toast.success("Arquivo carregado. Confira o texto e gere a prévia.");
      } catch {
        toast.error("Não consegui ler o arquivo. Use .txt ou .csv.");
      }
    };

    input.click();
  };

  const handleBulkTextImport = async () => {
    setStatusMessage(null);
    if (!bulkText.trim()) return;

    setBulkLoading(true);
    try {
      const products = parseBulkText(bulkText);
      if (products.length === 0) {
        const text = "Nenhum produto reconhecido. Verifique se cada linha tem nome e preço.";
        setStatusMessage({ type: "error", text });
        toast.error(text);
        return;
      }

      openPreviewPanel(products);
      toast.success(`${products.length} itens encontrados. Revise antes de salvar.`);
    } catch {
      toast.error("Erro ao importar itens.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkTextSaveDirect = async () => {
    setStatusMessage(null);
    if (!bulkText.trim()) return;

    setBulkLoading(true);
    try {
      const products = parseBulkText(bulkText);
      if (products.length === 0) {
        const text = "Nenhum produto reconhecido. Cole linhas com nome e preço, como: Pizza Calabresa 49,90.";
        setStatusMessage({ type: "error", text });
        toast.error(text);
        return;
      }
      const result = await bulkInsertMutation.mutateAsync(products);
      await refetch();
      setBulkText("");
      const text = `${result.count || products.length} itens salvos no catálogo.`;
      setStatusMessage({ type: "success", text });
      toast.success(text);
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Erro ao salvar itens.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePhotoImport = () => {
    setStatusMessage(null);
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (file.size > 4 * 1024 * 1024) {
        toast.error("Imagem muito grande. Use imagem com até 4MB.");
        return;
      }

      setOcrLoading(true);

      const reader = new FileReader();

      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const mimeType = dataUrl.match(/^data:(.*?);base64,/)?.[1] || file.type || "image/jpeg";
        const base64 = dataUrl.split(",")[1];

        try {
          toast.loading("Analisando imagem com IA...", { id: "ocr" });

          const products = await ocrMutation.mutateAsync({ imageBase64: base64, mimeType });

          const extractedProducts = unwrapTrpcArray<ProdutoPreview>(products);

          if (extractedProducts.length > 0) {
            openPreviewPanel(extractedProducts);
            toast.success(`${extractedProducts.length} itens encontrados. Revise antes de salvar.`, { id: "ocr" });
          } else {
            toast.error("Nenhum item reconhecido na imagem. Tente uma foto mais nítida.", { id: "ocr" });
          }
        } catch (err) {
          console.error(err);
          toast.error(getOcrErrorMessage(err), { id: "ocr" });
        } finally {
          setOcrLoading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Não foi possível ler a imagem. Tente novamente.", { id: "ocr" });
        setOcrLoading(false);
      };

      reader.readAsDataURL(file);
    };

    input.click();
  };

  const updatePreviewProduct = (index: number, field: keyof ProdutoPreview, value: string) => {
    setPreviewProducts(prev =>
      prev.map((p, i) => {
        if (i !== index) return p;

        if (field === "preco") {
          return { ...p, preco: parsePrecoInput(value) };
        }

        return { ...p, [field]: value };
      })
    );
  };

  const removePreviewProduct = (index: number) => {
    setPreviewProducts(prev => prev.filter((_, i) => i !== index));
  };

  const savePreviewProducts = async () => {
    setStatusMessage(null);
    const validos = previewProducts
      .filter(p => p.nome && p.categoria && p.preco > 0)
      .map((p) => ({ ...p, descricao: p.descricao || undefined }));

    if (validos.length === 0) {
      const text = "Nenhum item válido para salvar. Confira nome, categoria e preço.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
      return;
    }

    try {
      const result = await bulkInsertMutation.mutateAsync(validos);
      await refetch();
      const text = `${result.count || validos.length} itens salvos no catálogo.`;
      setStatusMessage({ type: "success", text });
      toast.success(text);
      setPreviewProducts([]);
      setShowPreview(false);
      setBulkText("");
    } catch (error) {
      console.error(error);
      const text = error instanceof Error ? error.message : "Erro ao salvar itens.";
      setStatusMessage({ type: "error", text });
      toast.error(text);
    }
  };

  const categorias = Array.from(new Set(itensArray.map((i) => i.categoria || "Geral"))).sort();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="typography-h1 mb-2 flex items-center gap-3">
                <Package className="w-8 h-8 text-emerald-500" />
                {catalogTitle}
              </h1>
              <p className="typography-body text-muted-foreground">
                {catalogDescription}
              </p>
            </div>

            <div className="flex gap-3 flex-wrap justify-end">
              <Button
                className="bg-sky-600 text-white hover:bg-sky-700"
                onClick={openBulkTextPanel}
              >
                <FileText className="w-4 h-4 mr-2" />
                Importar Texto
              </Button>

              <Button
                className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                onClick={handlePhotoImport}
                disabled={ocrLoading}
              >
                {ocrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" 
/>}
                Importar Foto
              </Button>

              <Button
                onClick={openFormPanel}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`mb-6 rounded-md border px-4 py-3 text-sm font-medium ${
                statusMessage.type === "success"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
                  : "border-red-500/40 bg-red-500/10 text-red-700"
              }`}
            >
              {statusMessage.text}
            </div>
          )}

          <div ref={importPanelRef} className="scroll-mt-4">
            <Card className="border border-sky-500/50 bg-sky-500/5 mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {isPlatformCatalog ? "Importar planos por texto" : "Importação em Massa por Texto"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {isPlatformCatalog
                    ? "Cole seus planos, um por linha. Exemplo: Plano Inicial - CRM básico, WhatsApp e dashboard - 99,00"
                    : "Cole direto do WhatsApp, planilha ou cardápio. O sistema reconhece preço em qualquer posição e usa linhas com “:” como categoria."}
                </p>

                <Textarea

placeholder={isPlatformCatalog ? `Planos:
Plano Inicial - CRM básico, WhatsApp e dashboard - R$ 99,00
Plano Profissional - CRM completo, funil, automações e relatórios - R$ 249,00
Plano Premium - IA, WhatsApp, multiusuário e suporte prioritário - R$ 499,00` : `Pizzas:
Pizza Calabresa 49,90
Pizza Mussarela - molho, queijo e orégano - R$ 44,90

Bebidas:
Coca-Cola 2L 12,00
Skol Lata; 4,99; Bebidas`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  onPaste={() => setShowPreview(false)}
                  className="border-border min-h-[220px] text-sm"
                />

                <div className="flex flex-wrap gap-3 mt-4">
                  <Button type="button" variant="outline" onClick={handleBulkFileImport}>
                    Anexar TXT/CSV
                  </Button>

                  <Button
                    onClick={handleBulkTextImport}
                    className="bg-sky-600 text-white hover:bg-sky-700"
                    disabled={bulkLoading || !bulkText.trim()}
                  >
                    {bulkLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Gerar prévia
                  </Button>

                  <Button
                    onClick={handleBulkTextSaveDirect}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={bulkLoading || bulkSaving || !bulkText.trim()}
                  >
                    {(bulkLoading || bulkSaving) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar direto
                  </Button>

                  <Button variant="outline" onClick={() => setBulkText("")}>
                    Limpar texto
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {showPreview && (
            <div ref={previewPanelRef} className="scroll-mt-4">
            <Card className="border border-amber-500/60 bg-amber-500/5 mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Revisar itens antes de salvar
                </CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Confira principalmente os preços. A IA pode errar leitura de folheto ou imagem ruim.
                </p>

                <div className="space-y-3">
                  {previewProducts.map((p, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3 border rounded-lg p-3 
bg-background">
                      <Input
                        value={p.nome}
                        onChange={(e) => updatePreviewProduct(index, "nome", e.target.value)}
                        placeholder="Nome"
                      />

                      <Input
                        value={p.descricao || ""}
                        onChange={(e) => updatePreviewProduct(index, "descricao", e.target.value)}
                        placeholder="Descrição"
                      />

                      <Input
                        value={(p.preco / 100).toFixed(2).replace(".", ",")}
                        onChange={(e) => updatePreviewProduct(index, "preco", e.target.value)}
                        placeholder="Preço"
                      />

                      <Input
                        value={p.categoria}
                        onChange={(e) => updatePreviewProduct(index, "categoria", e.target.value)}
                        placeholder="Categoria"
                      />

                      <Button variant="outline" className="text-red-600" onClick={() => removePreviewProduct(index)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="sticky bottom-0 z-10 -mx-6 mt-5 flex flex-wrap gap-3 border-t bg-background/95 px-6 py-4 backdrop-blur">
                  <Button
                    onClick={savePreviewProducts}
                    size="lg"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={bulkSaving || previewProducts.length === 0}
                  >
                    {bulkSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar {previewProducts.length} itens
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewProducts([]);
                      setShowPreview(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          <div ref={formPanelRef} className="scroll-mt-4">
            <Card className="border border-emerald-500/40 bg-emerald-500/5 mb-6">
              <CardHeader><CardTitle>Adicionar {itemLabel}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: 
e.target.value })} />
                  <Input placeholder={isPlatformCatalog ? "Nome do plano" : "Nome"} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value 
})} />
                  <Input placeholder={isPlatformCatalog ? "Descrição do plano" : "Descrição"} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: 
e.target.value })} />
                  <Input placeholder="Preço R$" value={form.preco} onChange={(e) => setForm({ ...form, preco: 
e.target.value })} />
                </div>

                <div className="flex gap-3 mt-4">
                  <Button onClick={handleCreate} className="bg-emerald-600 text-white hover:bg-emerald-700" 
disabled={creatingItem}>
                    {creatingItem && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar {itemLabel}
                  </Button>
                  <Button variant="outline" onClick={() => setForm({ categoria: "", nome: "", descricao: "", preco: "" })}>Limpar</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : categorias.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-16 text-center">
                <Package className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground font-medium">Nenhum item cadastrado ainda</p>
                <p className="text-sm text-muted-foreground mt-1 opacity-70">
                  {isPlatformCatalog ? "Cadastre seus planos para o robô vender com valores corretos." : "Use Importar Foto, Importar Texto ou Novo Item."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {categorias.map((cat) => {
                const catItens = itensArray.filter((i) => (i.categoria || "Geral") === cat);

                return (
                  <Card key={cat} className="border border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        📋 {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({catItens.length} {catItens.length === 1 ? "item" : "itens"})
                        </span>
                      </CardTitle>
                    </CardHeader>

                    <CardContent>
                      <div className="divide-y divide-border">
                        {catItens.map((item) => (
                          <div key={item.id} className={`flex items-center justify-between py-3 ${!item.disponivel ? 
"opacity-50" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.nome}</span>
                                {!item.disponivel && (
                                  <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-600 rounded shrink-0">
                                    Indisponível
                                  </span>
                                )}
                              </div>
                              {item.descricao && (
                                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                  {item.descricao}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-4 shrink-0 ml-4">
                              <span className="font-semibold text-emerald-600">{formatCurrency(item.preco)}</span>

                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleDisponivel(item.id, item.disponivel)}
                                >
                                  {item.disponivel ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 
h-4 text-red-500" />}
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteItem.mutate({ id: item.id })}
                                  className="text-red-500 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
