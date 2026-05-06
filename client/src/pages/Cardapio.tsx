import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
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

export default function Cardapio() {
  const { data: itens, isLoading, refetch } = trpc.cardapio.list.useQuery();
  const itensArray = unwrapTrpcArray<typeof itens extends Array<infer T> ? T : any>(itens);
  const criarItem = trpc.cardapio.create.useMutation({ onSuccess: () => refetch() });
  const updateItem = trpc.cardapio.update.useMutation({ onSuccess: () => refetch() });
  const deleteItem = trpc.cardapio.delete.useMutation({ onSuccess: () => refetch() });
  const ocrMutation = trpc.import.ocr.useMutation();
  const bulkInsertMutation = trpc.import.bulkInsert.useMutation({ onSuccess: () => refetch() });

  const [showForm, setShowForm] = useState(false);
  const [showBulkText, setShowBulkText] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<ProdutoPreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({ categoria: "", nome: "", descricao: "", preco: "" });

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

  const parsePrecoInput = (value: string) => {
    const clean = value.replace(/[^\d,.-]/g, "").replace(",", ".");
    const n = Number(clean);
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  const handleCreate = async () => {
    if (!form.nome || !form.categoria || !form.preco) return;

    const precoEmCentavos = parsePrecoInput(form.preco);
    if (precoEmCentavos <= 0) {
      toast.error("Preço inválido.");
      return;
    }

    await criarItem.mutateAsync({
      categoria: form.categoria,
      nome: form.nome,
      descricao: form.descricao || undefined,
      preco: precoEmCentavos,
    });

    setShowForm(false);
    setForm({ categoria: "", nome: "", descricao: "", preco: "" });
    toast.success("Item adicionado com sucesso!");
  };

  const handleToggleDisponivel = async (id: number, current: boolean) => {
    await updateItem.mutateAsync({ id, disponivel: !current });
  };

  const parseBulkText = (text: string) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const products: ProdutoPreview[] = [];

    for (const line of lines) {
      const separators = ["|", ";", " - ", ","];
      let parts: string[] = [];

      for (const sep of separators) {
        if (line.includes(sep)) {
          parts = line.split(sep).map(p => p.trim());
          break;
        }
      }

      if (parts.length < 2) continue;

      const nome = parts[0];
      let preco = 0;
      let precoIdx = -1;

      for (let i = 1; i < parts.length; i++) {
        const num = Number(parts[i].replace(/[^\d,.-]/g, "").replace(",", "."));
        if (Number.isFinite(num) && num > 0) {
          preco = Math.round(num * 100);
          precoIdx = i;
          break;
        }
      }

      if (!nome || preco <= 0) continue;

      const descricao = parts.find((p, i) => {
        if (i === 0 || i === precoIdx) return false;
        const n = Number(p.replace(/[^\d,.-]/g, "").replace(",", "."));
        return !Number.isFinite(n);
      });

      const ultima = parts[parts.length - 1];
      const categoria =
        ultima && ultima !== descricao && !Number.isFinite(Number(ultima.replace(",", ".")))
          ? ultima
          : "Geral";

      products.push({ nome, preco, descricao: descricao || undefined, categoria });
    }

    return products;
  };

  const handleBulkTextImport = async () => {
    if (!bulkText.trim()) return;

    setBulkLoading(true);
    try {
      const products = parseBulkText(bulkText);
      if (products.length === 0) {
        toast.error("Nenhum produto reconhecido. Verifique o formato.");
        return;
      }

      setPreviewProducts(products);
      setShowPreview(true);
      setShowBulkText(false);
      toast.success(`${products.length} itens encontrados. Revise antes de salvar.`);
    } catch {
      toast.error("Erro ao importar itens.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePhotoImport = () => {
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
        const base64 = (reader.result as string).split(",")[1];

        try {
          toast.loading("Analisando imagem com IA...", { id: "ocr" });

          const products = await ocrMutation.mutateAsync({ imageBase64: base64 });

          if (products && products.length > 0) {
            setPreviewProducts(products);
            setShowPreview(true);
            toast.success(`${products.length} itens encontrados. Revise antes de salvar.`, { id: "ocr" });
          } else {
            toast.error("Nenhum item reconhecido na imagem. Tente uma foto mais nítida.", { id: "ocr" });
          }
        } catch (err) {
          console.error(err);
          toast.error("Erro ao processar imagem.", { id: "ocr" });
        } finally {
          setOcrLoading(false);
        }
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
    const validos = previewProducts.filter(p => p.nome && p.categoria && p.preco > 0);

    if (validos.length === 0) {
      toast.error("Nenhum item válido para salvar.");
      return;
    }

    await bulkInsertMutation.mutateAsync(validos);
    toast.success(`${validos.length} itens salvos no catálogo!`);
    setPreviewProducts([]);
    setShowPreview(false);
    setBulkText("");
    refetch();
  };

  const categorias = [...new Set(itensArray.map((i) => i.categoria || "Geral"))].sort();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="typography-h1 mb-2 flex items-center gap-3">
                <Package className="w-8 h-8 text-emerald-500" />
                Catálogo de Itens
              </h1>
              <p className="typography-body text-muted-foreground">
                Envie foto, texto ou cadastre produtos manualmente. A IA usará este catálogo no atendimento.
              </p>
            </div>

            <div className="flex gap-3 flex-wrap justify-end">
              <Button
                variant="outline"
                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                onClick={() => { setShowBulkText(!showBulkText); setShowForm(false); setShowPreview(false); }}
              >
                <FileText className="w-4 h-4 mr-2" />
                Importar Texto
              </Button>

              <Button
                variant="outline"
                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                onClick={handlePhotoImport}
                disabled={ocrLoading}
              >
                {ocrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" 
/>}
                Importar Foto
              </Button>

              <Button
                onClick={() => { setShowForm(!showForm); setShowBulkText(false); setShowPreview(false); }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>
          </div>

          {showBulkText && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Importação em Massa por Texto
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Cole uma lista, um item por linha. Exemplo: Coca-Cola 2L - 9,99
                </p>

                <Textarea

placeholder={`Pizza Calabresa - 49,90
Coca-Cola 2L | 12,00 | Gelada | Bebidas
Skol Lata; 4,99; Bebidas`}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  className="border-border min-h-[140px] font-mono text-sm"
                />

                <div className="flex gap-3 mt-4">
                  <Button
                    onClick={handleBulkTextImport}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={bulkLoading || !bulkText.trim()}
                  >
                    {bulkLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Gerar prévia
                  </Button>

                  <Button variant="outline" onClick={() => { setShowBulkText(false); setBulkText(""); }}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {showPreview && (
            <Card className="border border-amber-500/40 bg-amber-500/5 mb-6">
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

                <div className="flex gap-3 mt-4">
                  <Button
                    onClick={savePreviewProducts}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={bulkInsertMutation.isPending || previewProducts.length === 0}
                  >
                    {bulkInsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
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
          )}

          {showForm && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-6">
              <CardHeader><CardTitle>Adicionar Item</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input placeholder="Categoria" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: 
e.target.value })} />
                  <Input placeholder="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value 
})} />
                  <Input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: 
e.target.value })} />
                  <Input placeholder="Preço R$" value={form.preco} onChange={(e) => setForm({ ...form, preco: 
e.target.value })} />
                </div>

                <div className="flex gap-3 mt-4">
                  <Button onClick={handleCreate} className="bg-emerald-600 text-white hover:bg-emerald-700" 
disabled={criarItem.isPending}>
                    {criarItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

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
                  Use Importar Foto, Importar Texto ou Novo Item.
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
