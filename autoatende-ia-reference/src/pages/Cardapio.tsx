import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { trpc } from "@/src/lib/trpc";
import {
  Package,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Check,
  X,
} from "lucide-react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";

export default function Cardapio() {
  const { data: items, refetch, isLoading } = trpc.empresa.getCatalogItems.useQuery();
  const saveItem = trpc.empresa.saveCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Item salvo!");
      refetch();
      setIsDialogOpen(false);
      resetForm();
    }
  });

  const deleteItem = trpc.empresa.deleteCatalogItem.useMutation({
    onSuccess: () => {
      toast.success("Item excluído!");
      refetch();
    }
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [disponivel, setDisponivel] = useState(true);

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setCategoria("");
    setDescricao("");
    setPreco("");
    setDisponivel(true);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setNome(item.nome);
    setCategoria(item.categoria);
    setDescricao(item.descricao || "");
    setPreco((item.preco / 100).toString());
    setDisponivel(item.disponivel);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome || !categoria || !preco) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    try {
      await saveItem.mutateAsync({
        id: editingId || undefined,
        nome,
        categoria,
        descricao,
        preco: Math.round(parseFloat(preco.replace(",", ".")) * 100),
        disponivel,
      });
    } catch (err) {
      toast.error("Erro ao salvar item");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="w-8 h-8 text-emerald-500" />
              Cardápio / Catálogo
            </h1>
            <p className="text-muted-foreground">
              Estes são os itens que a IA oferecerá aos seus clientes.
            </p>
          </div>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items?.map((item) => (
              <Card key={item.id} className={!item.disponivel ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded">
                      {item.categoria}
                    </span>
                    {!item.disponivel && (
                      <span className="text-xs font-medium px-2 py-1 bg-red-500/10 text-red-600 rounded flex items-center gap-1">
                        <X className="w-3 h-3" /> Indisponível
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-2">{item.nome}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                    {item.descricao || "Sem descrição."}
                  </p>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-xl font-bold text-emerald-600">
                      {(item.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => {
                          if (confirm("Deseja excluir este item?")) {
                            deleteItem.mutate(item.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {items?.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum item cadastrado ainda.</p>
                <Button variant="link" onClick={() => setIsDialogOpen(true)} className="text-emerald-600">
                  Cadastrar meu primeiro item
                </Button>
              </div>
            )}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Item" : "Novo Item"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nome" className="text-right">Nome</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="categoria" className="text-right">Categoria</Label>
                <Input id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ex: Pizzas, Bebidas..." className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="preco" className="text-right">Preço (R$)</Label>
                <Input id="preco" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="descricao" className="text-right">Descrição</Label>
                <Textarea id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Disponível</Label>
                <div className="col-span-3 flex items-center gap-4">
                  <Button 
                    type="button" 
                    variant={disponivel ? "default" : "outline"} 
                    className={disponivel ? "bg-emerald-600" : ""}
                    onClick={() => setDisponivel(true)}
                  >
                    <Check className="w-3 h-3 mr-1" /> Sim
                  </Button>
                  <Button 
                    type="button" 
                    variant={!disponivel ? "destructive" : "outline"}
                    onClick={() => setDisponivel(false)}
                  >
                    <X className="w-3 h-3 mr-1" /> Não
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveItem.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {saveItem.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function Save(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

