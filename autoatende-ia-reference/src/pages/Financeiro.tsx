import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { trpc } from "@/src/lib/trpc";
import {
  Wallet,
  TrendingUp,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CreditCard,
  Banknote,
} from "lucide-react";
import DashboardLayout from "@/src/components/DashboardLayout";

// Mocking Pix icon as it doesn't exist in lucide-react yet or use standard icon
function PixIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M7 11L12 6L17 11L12 16L7 11Z" />
      <path d="M12 2L2 12L12 22L22 12L12 2Z" />
    </svg>
  )
}

export default function Financeiro() {
  const { data: stats } = trpc.empresa.getDashboardStats.useQuery();
  const { data: pedidos } = trpc.empresa.getPedidos.useQuery();

  const totalVendas = stats?.faturamentoHoje || 0;
  const numVendas = stats?.pedidosHoje || 0;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Wallet className="w-8 h-8 text-emerald-500" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">
              Acompanhe seu faturamento e fluxo de caixa.
            </p>
          </div>
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Calendar className="w-4 h-4" />
            Este Mês
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vendas Hoje</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalVendas / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
              <p className="text-xs text-muted-foreground">+{numVendas} novos pedidos hoje</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(numVendas > 0 ? (totalVendas / numVendas) / 100 : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
              <p className="text-xs text-muted-foreground">Baseado em pedidos concluídos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagos em Pix</CardTitle>
              <PixIcon className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">75%</div>
              <p className="text-xs text-muted-foreground">Método de pagamento favorito</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Previsão Mensal</CardTitle>
              <Receipt className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 12.450,00</div>
              <p className="text-xs text-muted-foreground">Projeção baseada nos últimos 7 dias</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Últimos Recebimentos</CardTitle>
              <CardDescription>Movimentações financeiras recentes dos pedidos.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pedidos?.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <PixIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Pedido #{p.id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">
                        + {(p.valorTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                      <p className="text-[10px] uppercase text-muted-foreground font-bold">Concluído</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métodos de Recebimento</CardTitle>
              <CardDescription>Distribuição por tipo de pagamento.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><PixIcon className="w-4 h-4 text-emerald-500" /> Pix</span>
                    <span className="font-bold">75%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "75%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-500" /> Cartão de Crédito</span>
                    <span className="font-bold">15%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: "15%" }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2"><Banknote className="w-4 h-4 text-yellow-500" /> Dinheiro</span>
                    <span className="font-bold">10%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500" style={{ width: "10%" }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
