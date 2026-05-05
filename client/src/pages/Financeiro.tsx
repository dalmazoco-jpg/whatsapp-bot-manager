import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Financeiro() {
  const { data: pedidos, isLoading, refetch } = trpc.pedidos.list.useQuery();
  const updateStatus = trpc.pedidos.updateStatus.useMutation({ onSuccess: () => refetch() });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
  };

  const pedidosValidos = pedidos?.filter(p => p.status !== "cancelado") || [];
  
  const receitaTotal = pedidosValidos.reduce((acc, p) => acc + (p.valorTotal + p.taxaEntrega), 0);
  
  const pendentes = pedidosValidos.filter(p => p.statusPagamento !== "pago");
  const valorPendente = pendentes.reduce((acc, p) => acc + (p.valorTotal + p.taxaEntrega), 0);
  
  const pagos = pedidosValidos.filter(p => p.statusPagamento === "pago");
  const valorRecebido = pagos.reduce((acc, p) => acc + (p.valorTotal + p.taxaEntrega), 0);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="typography-h1 mb-2 flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            Financeiro
          </h1>
          <p className="typography-body text-muted-foreground">Visão geral do faturamento e recebimentos</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receita Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(receitaTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Valor Recebido</p>
                  <p className="text-2xl font-bold">{formatCurrency(valorRecebido)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pagamentos Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(valorPendente)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Histórico de Recebimentos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12"><p className="text-muted-foreground">Carregando...</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Status Pgto</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedidosValidos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((pedido) => (
                    <TableRow key={pedido.id}>
                      <TableCell className="font-medium">#{pedido.id}</TableCell>
                      <TableCell>{new Date(pedido.createdAt).toLocaleDateString("pt-BR")} {new Date(pedido.createdAt).toLocaleTimeString("pt-BR", {hour: '2-digit', minute:'2-digit'})}</TableCell>
                      <TableCell>{formatCurrency(pedido.valorTotal + pedido.taxaEntrega)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${pedido.statusPagamento === 'pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {pedido.statusPagamento === 'pago' ? 'PAGO' : 'PENDENTE'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {pedido.statusPagamento !== "pago" && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                            onClick={() => updateStatus.mutate({ id: pedido.id, status: pedido.status, statusPagamento: "pago" })}
                          >
                            Marcar Pago
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pedidosValidos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        Nenhum pedido registrado ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
