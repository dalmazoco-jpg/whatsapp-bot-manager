import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, MessageSquare, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

function formatWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function formatCurrency(centavos: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((centavos || 0) / 100);
}

function presentationLabels(ramo?: string | null) {
  const type = ramo || "outro";
  if (["consultorio", "clinica", "salao", "barbearia"].includes(type)) {
    return {
      categoryLabel: "Serviços",
      itemLabel: "Serviços disponíveis nesta categoria",
      action: "Agendar pelo WhatsApp",
      summary: "Resumo do interesse",
      emptyMessage: "Olá, gostaria de agendar um atendimento.",
      selectedMessage: (names: string[]) => `Olá, tenho interesse em: ${names.join(" + ")}`,
      add: "Tenho interesse",
    };
  }
  if (["loja", "adega"].includes(type)) {
    return {
      categoryLabel: "Categorias",
      itemLabel: "Produtos disponíveis nesta categoria",
      action: "Comprar pelo WhatsApp",
      summary: "Resumo do interesse",
      emptyMessage: "Olá, gostaria de saber mais sobre os produtos.",
      selectedMessage: (names: string[]) => `Olá, tenho interesse em: ${names.join(" + ")}`,
      add: "Adicionar",
    };
  }
  return {
    categoryLabel: "Categorias",
    itemLabel: "Itens disponíveis nesta categoria",
    action: "Pedir no WhatsApp",
    summary: "Resumo do pedido",
    emptyMessage: "Olá, gostaria de fazer um pedido.",
    selectedMessage: (names: string[]) => `Olá, quero pedir: ${names.join(" + ")}`,
    add: "Adicionar ao pedido",
  };
}

export default function PublicApresentacao() {
  const [, params] = useRoute("/public/:slug");
  const slug = params?.slug;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/public/apresentacao/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Não encontrado");
        return res.json();
      })
      .then((json) => {
        setData(json);
      })
      .catch((error) => {
        console.error(error);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const items = data?.itens || [];
  const categories = data?.categorias || [];
  const contact = data?.config?.whatsapp || data?.empresa?.whatsappNumero || "";
  const whatsappNumber = formatWhatsappNumber(contact);
  const labels = presentationLabels(data?.empresa?.ramo || data?.empresa?.tipo);

  const selectedNames = useMemo(
    () => items.filter((item: any) => selectedItems.includes(String(item.id))).map((item: any) => item.nome),
    [items, selectedItems]
  );

  const message = useMemo(() => {
    if (selectedNames.length === 0) return labels.emptyMessage;
    return labels.selectedMessage(selectedNames);
  }, [labels, selectedNames]);

  const handleToggleItem = (id: number, nome: string) => {
    setSelectedItems((prev) => {
      const key = String(id);
      if (prev.includes(key)) return prev.filter((value) => value !== key);
      return [...prev, key];
    });
  };

  const handleWhatsApp = () => {
    if (!whatsappNumber) {
      toast.error("WhatsApp não configurado");
      return;
    }

    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin" />
          <p>Carregando apresentação...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 p-10 text-center">
          <h1 className="text-3xl font-semibold mb-4">Página não encontrada</h1>
          <p className="text-slate-400 mb-6">O link público não existe ou não está disponível no momento.</p>
          <Button asChild>
            <a href="/">Voltar para o início</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 border border-slate-700">
              {data.config.logoUrl ? (
                <img src={data.config.logoUrl} alt={data.config.nomeEmpresa} className="h-full w-full object-cover rounded-3xl" />
              ) : (
                <span className="text-sm font-semibold text-emerald-400">Logo</span>
              )}
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">{data.empresa?.ramo || "Apresentação"}</p>
              <h1 className="text-4xl font-semibold">{data.config.nomeEmpresa || data.empresa?.nome}</h1>
              <p className="max-w-2xl text-slate-400 mt-2">{data.config.descricao || "Confira nossos produtos e peça direto pelo WhatsApp."}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.location.href = "/"}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.75fr_0.25fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6" style={{ borderColor: data.config.corPrimaria || "#10b981" }}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">{labels.categoryLabel}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.length === 0 ? (
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">Sem categorias</span>
                    ) : categories.map((category: string) => (
                      <span key={category} className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">{category}</span>
                    ))}
                  </div>
                </div>
                <Button onClick={handleWhatsApp} size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                  <MessageSquare className="w-4 h-4 mr-2" /> {labels.action}
                </Button>
              </div>
            </div>

            {categories.map((category: string) => (
              <div key={category} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{category}</h2>
                    <p className="text-sm text-slate-500">{labels.itemLabel}</p>
                  </div>
                </div>
                <div className="grid gap-4">
                  {items.filter((item: any) => item.categoria === category).map((item: any) => {
                    const selected = selectedItems.includes(String(item.id));
                    return (
                      <div key={item.id} className="grid gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold">{item.nome}</h3>
                            <span className="text-emerald-300">{formatCurrency(item.preco)}</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-400">{item.descricao || "Descrição não informada."}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          onClick={() => handleToggleItem(item.id, item.nome)}
                        >
                          {selected ? "Remover" : labels.add}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-6">
            <Card className="rounded-3xl border border-slate-800 bg-slate-900/80">
              <CardHeader>
                <CardTitle>{labels.summary}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400 mb-2">Itens selecionados</p>
                  {selectedNames.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum item selecionado.</p>
                  ) : (
                    <ul className="space-y-2 text-sm text-slate-200">
                      {selectedNames.map((nome: string) => (
                        <li key={nome}>• {nome}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-sm text-slate-400">Mensagem automática</p>
                  <div className="mt-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">{message}</div>
                </div>
                <Button onClick={handleWhatsApp} className="w-full bg-emerald-500 hover:bg-emerald-600">
                  <MessageSquare className="w-4 h-4 mr-2" /> {labels.action}
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border border-slate-800 bg-slate-900/80">
              <CardHeader>
                <CardTitle>Contatos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-slate-300">
                  <p>WhatsApp: {contact || "Não configurado"}</p>
                  <p>Instagram: {data.config.instagram || "Não configurado"}</p>
                  <p>Endereço: {data.config.endereco || "Não configurado"}</p>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
