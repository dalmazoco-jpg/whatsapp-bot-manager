import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { trpc } from "@/src/lib/trpc";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  ChefHat,
  Truck,
  MoreVertical,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";

export default function Pedidos() {
  const { data: pedidos, refetch, isLoading } = trpc.empresa.getPedidos.useQuery();
  const updateStatus = trpc.empresa.updatePedidoStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      refetch();
    }
  });

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "recebido": return { label: "Recebido", color: "text-blue-500", bg: "bg-blue-500/10", icon: <Clock className="w-4 h-4" /> };
      case "em_preparacao": return { label: "Em Preparo", color: "text-orange-500", bg: "bg-orange-500/10", icon: <ChefHat className="w-4 h-4" /> };
      case "pronto": return { label: "Pronto", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: <CheckCircle2 className="w-4 h-4" /> };
      case "saiu_entrega": return { label: "Em Entrega", color: "text-purple-500", bg: "bg-purple-500/10", icon: <Truck className="w-4 h-4" /> };
      case "entregue": return { label: "Entregue", color: "text-gray-500", bg: "bg-gray-500/10", icon: <CheckCircle2 className="w-4 h-4" /> };
      default: return { label: status, color: "text-muted-foreground", bg: "bg-muted", icon: <Clock className="w-4 h-4" /> };
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-emerald-500" />
              Fila de Produção
            </h1>
            <p className="text-muted-foreground">
              Acompanhe e gerencie o progresso dos pedidos em tempo real.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            Atualizar Agora
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {pedidos?.map((pedido) => {
              const statusCfg = getStatusConfig(pedido.status);
              const itens = (pedido.itens as any[]) || [];

              return (
                <Card key={pedido.id} className="border border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-6 md:w-1/4 border-b md:border-b-0 md:border-r border-border">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg"># {pedido.id}</h3>
                          <div className={`px-2 py-1 rounded flex items-center gap-1 text-xs font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.icon}
                            {statusCfg.label}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-4">
                          {new Date(pedido.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <div className="space-y-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="w-full justify-between">
                                Mudar Status
                                <MoreVertical className="w-4 h-4 ml-2" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: pedido.id, status: "em_preparacao" })}>
                                <ChefHat className="w-4 h-4 mr-2" /> Em Preparo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: pedido.id, status: "pronto" })}>
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Pronto
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: pedido.id, status: "saiu_entrega" })}>
                                <Truck className="w-4 h-4 mr-2" /> Saiu Entrega
                             </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus.mutate({ id: pedido.id, status: "entregue" })}>
                                <CheckCircle2 className="w-4 h-4 mr-2" /> Entregue
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Itens do Pedido</h4>
                          <div className="space-y-2">
                            {itens.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span><span className="font-bold">{item.qtd}x</span> {item.nome}</span>
                                {item.observacao && <p className="text-xs text-orange-500 italic">Obs: {item.observacao}</p>}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col md:flex-row justify-between items-end md:items-center pt-4 border-t border-border">
                          <div className="text-sm">
                            <p className="font-semibold">{pedido.enderecoEntrega || "Retirada no Local"}</p>
                            {pedido.observacoes && <p className="text-muted-foreground text-xs">{pedido.observacoes}</p>}
                          </div>
                          <div className="text-right mt-2 md:mt-0">
                            <p className="text-xs text-muted-foreground">Valor Total</p>
                            <p className="text-xl font-bold text-emerald-600">
                              {(pedido.valorTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {pedidos?.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum pedido recebido ainda.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
