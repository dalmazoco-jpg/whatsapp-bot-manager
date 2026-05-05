import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  ImagePlus,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Cardapio() {
  const { data: itens, isLoading, refetch } = trpc.cardapio.list.useQuery();
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
  const [form, setForm] = useState({ categoria: "", nome: "", descricao: "", preco: "" });

  const handleCreate = async () => {
    if (!form.nome || !form.categoria || !form.preco) return;
    const precoEmCentavos = Math.round(parseFloat(form.preco.replace(",", ".")) * 100);
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

  const formatCurrency = (centavos: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

  // ── Importação por Texto ───────────────────────────────────────
  // Aceita formatos:
  //   Pizza Margherita - 45.90
  //   Pizza Margherita | 45,90 | Descrição opcional | Categoria
  //   Pizza Margherita; 45.90
  const parseBulkText = (text: string) => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    const products: { nome: string; preco: number; descricao?: string; categoria: string }[] = [];
    for (const line of lines) {
      // Try separator: | ; - ,
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
      // Find price: first part that looks like a number
      let preco = 0;
      let precoIdx = -1;
      for (let i = 1; i < parts.length; i++) {
        const num = parseFloat(parts[i].replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(num) && num > 0) { preco = Math.round(num * 100); precoIdx = i; break; }
      }
      if (!nome || preco === 0) continue;
      const descricao = parts.find((_, i) => i !== 0 && i !== precoIdx && isNaN(parseFloat(parts[i].replace(/[^\d.,]/g, "").replace(",", "."))));
      const categoria = parts[parts.length - 1] && isNaN(parseFloat(parts[parts.length - 1])) && parts[parts.length - 1] !== descricao
        ? parts[parts.length - 1]
        : "geral";
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
      await bulkInsertMutation.mutateAsync(products);
      toast.success(`${products.length} itens importados com sucesso!`);
      setBulkText("");
      setShowBulkText(false);
    } catch (err) {
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
      setOcrLoading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          toast.loading("Analisando imagem com IA...", { id: "ocr" });
          const products = await ocrMutation.mutateAsync({ imageBase64: base64 });
          if (products && products.length > 0) {
            await bulkInsertMutation.mutateAsync(products);
            toast.success(`${products.length} itens importados da foto!`, { id: "ocr" });
          } else {
            toast.error("Nenhum item reconhecido na imagem.", { id: "ocr" });
          }
        } catch (err) {
          toast.error("Erro ao processar imagem.", { id: "ocr" });
        } finally {
          setOcrLoading(false);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const categorias = itens ? [...new Set(itens.map((i) => i.categoria))].sort() : [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="typography-h1 mb-2 flex items-center gap-3">
                <Package className="w-8 h-8 text-emerald-500" />
                Catálogo de Itens
              </h1>
              <p className="typography-body text-muted-foreground">
                Gerencie os produtos e serviços que a IA vai apresentar aos clientes
              </p>
            </div>
            <div className="flex gap-3 flex-wrap justify-end">
              <Button
                variant="outline"
                className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                onClick={() => { setShowBulkText(!showBulkText); setShowForm(false); }}
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
                {ocrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImagePlus className="w-4 h-4 mr-2" />}
                Importar Foto
              </Button>
              <Button
                onClick={() => { setShowForm(!showForm); setShowBulkText(false); }}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>
          </div>

          {/* Bulk Text Import Panel */}
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
                  Cole sua lista de itens, um por linha. Formatos aceitos:
                  <code className="ml-1 text-xs bg-muted px-1 py-0.5 rounded">Nome - Preço</code>
                  <code className="ml-1 text-xs bg-muted px-1 py-0.5 rounded">Nome | Preço | Descrição | Categoria</code>
                </p>
                <p className="text-xs text-muted-foreground mb-3 opacity-75">
                  Exemplo:<br/>
                  Pizza Margherita - 45.90<br/>
                  Coca-Cola 2L | 12.00 | Gelada | bebidas<br/>
                  Consulta Geral; 150,00
                </p>
                <Textarea
                  placeholder={"Pizza Margherita - 45.90\nCoca-Cola 2L - 12.00\nConsulta Geral - 150.00"}
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
                    Importar {bulkText.trim() ? `(${parseBulkText(bulkText).length} itens)` : ""}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowBulkText(false); setBulkText(""); }}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Single Item Form */}
          {showForm && (
            <Card className="border border-emerald-500/30 bg-emerald-500/5 mb-6">
              <CardHeader><CardTitle>Adicionar Item</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Categoria</label>
                    <Input id="cardapio-categoria" placeholder="pizza, bebida, serviço..." value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="border-border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nome</label>
                    <Input id="cardapio-nome" placeholder="Nome do item" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="border-border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Descrição (opcional)</label>
                    <Input id="cardapio-descricao" placeholder="Descrição breve" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="border-border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Preço (R$)</label>
                    <Input id="cardapio-preco" placeholder="45,00" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} className="border-border" />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button onClick={handleCreate} className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={criarItem.isPending}>
                    {criarItem.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Adicionar
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Item list */}
          {isLoading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : categorias.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-16 text-center">
                <Package className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-30" />
                <p className="text-muted-foreground font-medium">Nenhum item cadastrado ainda</p>
                <p className="text-sm text-muted-foreground mt-1 opacity-70">
                  Adicione seus produtos ou serviços manualmente, importe de uma foto ou cole uma lista de texto.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {categorias.map((cat) => {
                const catItens = itens?.filter((i) => i.categoria === cat) || [];
                return (
                  <Card key={cat} className="border border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        📋 {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        <span className="text-sm font-normal text-muted-foreground">({catItens.length} {catItens.length === 1 ? "item" : "itens"})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="divide-y divide-border">
                        {catItens.map((item) => (
                          <div key={item.id} className={`flex items-center justify-between py-3 ${!item.disponivel ? "opacity-50" : ""}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.nome}</span>
                                {!item.disponivel && (
                                  <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-600 rounded shrink-0">Indisponível</span>
                                )}
                              </div>
                              {item.descricao && <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.descricao}</p>}
                            </div>
                            <div className="flex items-center gap-4 shrink-0 ml-4">
                              <span className="font-semibold text-emerald-600">{formatCurrency(item.preco)}</span>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleToggleDisponivel(item.id, item.disponivel)} title={item.disponivel ? "Marcar indisponível" : "Marcar disponível"}>
                                  {item.disponivel ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => deleteItem.mutate({ id: item.id })} className="text-red-500 hover:text-red-600">
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
