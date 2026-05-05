import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Search, Package, ShoppingBag, Clock, CheckCircle2, DollarSign } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  recebido:     { label: "Recebido",     color: "bg-blue-100 text-blue-800 border-blue-200" },
  confirmado:   { label: "Confirmado",   color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  em_preparo:   { label: "Em Preparo",   color: "bg-orange-100 text-orange-800 border-orange-200" },
  saiu_entrega: { label: "Saiu p/ Entrega", color: "bg-purple-100 text-purple-800 border-purple-200" },
  entregue:     { label: "Entregue",     color: "bg-green-100 text-green-800 border-green-200" },
  cancelado:    { label: "Cancelado",    color: "bg-red-100 text-red-800 border-red-200" },
};

export default function Pedidos() {
  const { data: pedidos, isLoading, refetch } = trpc.pedidos.list.useQuery();
  const updateStatus = trpc.pedidos.updateStatus.useMutation({ onSuccess: () => refetch() });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

  const formatDate = (d: string | Date) => {
    const date = new Date(d);
    return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const filteredPedidos = pedidos?.filter((p) => {
    const matchesSearch =
      (p.observacoes || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toString().includes(searchTerm);
    const matchesStatus = statusFilter === "todos" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Summary stats
  const totalReceita = filteredPedidos
    .filter(p => p.status !== "cancelado")
    .reduce((acc, p) => acc + p.valorTotal + p.taxaEntrega, 0);
  const pendentes = filteredPedidos.filter(p => p.status !== "cancelado" && p.statusPagamento !== "pago").length;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="typography-h1 mb-2 flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-emerald-500" />
            Pedidos
          </h1>
          <p className="typography-body text-muted-foreground">Pedidos criados pela IA via WhatsApp</p>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{filteredPedidos.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Pagtos Pendentes</p>
                <p className="text-xl font-bold text-yellow-600">{pendentes}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border col-span-2">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign className="w-8 h-8 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Faturamento (filtro)</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalReceita)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por ID ou observação..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border border-border" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="border border-border"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12"><p className="text-muted-foreground">Carregando...</p></div>
          ) : filteredPedidos.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredPedidos.map((pedido) => {
              const sc = STATUS_CONFIG[pedido.status] || STATUS_CONFIG.recebido;
              const total = pedido.valorTotal + pedido.taxaEntrega;
              return (
                <Card key={pedido.id} className="border border-border hover:border-emerald-500/30 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-base">Pedido #{pedido.id}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded border font-medium ${sc.color}`}>{sc.label}</span>
                          {pedido.statusPagamento === "pago" ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> PAGO
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">
                              Pgto Pendente
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{formatDate(pedido.createdAt)}</span>
                        </div>

                        {/* Itens */}
                        {pedido.itens && Array.isArray(pedido.itens) && (
                          <div className="mb-3">
                            {(pedido.itens as Array<{ nome: string; qtd: number; observacao?: string }>).map((item, idx) => (
                              <p key={idx} className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{item.qtd}x</span> {item.nome}
                                {item.observacao && <span className="opacity-60"> ({item.observacao})</span>}
                              </p>
                            ))}
                          </div>
                        )}

                        {pedido.enderecoEntrega && (
                          <p className="text-sm text-muted-foreground mb-2">📍 {pedido.enderecoEntrega}</p>
                        )}

                        {/* Value breakdown */}
                        <div className="flex flex-wrap gap-4 text-sm mt-3 pt-3 border-t border-border">
                          <div>
                            <span className="text-muted-foreground">Subtotal: </span>
                            <span className="font-medium">{formatCurrency(pedido.valorTotal)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Entrega: </span>
                            <span className="font-medium">{formatCurrency(pedido.taxaEntrega)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total: </span>
                            <span className="font-bold text-emerald-600 text-base">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {pedido.status === "recebido" && (
                          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: "confirmado" })}>Confirmar</Button>
                        )}
                        {pedido.status === "confirmado" && (
                          <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: "em_preparo" })}>Preparar</Button>
                        )}
                        {pedido.status === "em_preparo" && (
                          <Button size="sm" className="bg-purple-600 text-white hover:bg-purple-700"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: "saiu_entrega" })}>Saiu Entrega</Button>
                        )}
                        {pedido.status === "saiu_entrega" && (
                          <Button size="sm" className="bg-green-600 text-white hover:bg-green-700"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: "entregue" })}>Entregue</Button>
                        )}
                        {pedido.statusPagamento !== "pago" && pedido.status !== "cancelado" && (
                          <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: pedido.status, statusPagamento: "pago" })}>
                            Marcar Pago
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
    </DashboardLayout>
  );
}
