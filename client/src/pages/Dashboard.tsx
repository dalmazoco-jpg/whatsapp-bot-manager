import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageSquare, ShoppingBag, Calendar, TrendingUp, Smartphone, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Dashboard() {
  const { data: me } = trpc.auth.me.useQuery();
  const { data: clientes = [] } = trpc.clientes.list.useQuery();
  const { data: pedidos, error: pedidosError } = trpc.pedidos.list.useQuery();
  const { data: agendamentos = [] } = trpc.agendamentos.list.useQuery();
  const { data: whatsappStatus } = trpc.whatsapp.status.useQuery();

  const { data: financeiro } = trpc.financeiro.stats.useQuery();

  console.log("Dashboard - pedidos data:", pedidos, "error:", pedidosError);
  
  const pedidosArray = Array.isArray(pedidos) ? pedidos : [];
  const totalClientes = Array.isArray(clientes) ? clientes.length : 0;
  const totalPedidos = pedidosArray.length || 0;
  const totalAgendamentos = Array.isArray(agendamentos) ? agendamentos.length : 0;
  const pedidosConfirmados = pedidosArray.filter((p) => p.status === "confirmado" || p.status === "entregue").length || 0;
  const taxaConversao = totalPedidos > 0 ? ((pedidosConfirmados / totalPedidos) * 100).toFixed(1) : "0";
  const isWhatsappConectado = whatsappStatus && "status" in whatsappStatus && whatsappStatus.status === "conectado";

  const formatCurrency = (centavos: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((centavos || 0) / 100);
  };


  const chartData = [
    { mes: "Jan", pedidos: 12, agendamentos: 8 },
    { mes: "Fev", pedidos: 19, agendamentos: 12 },
    { mes: "Mar", pedidos: 15, agendamentos: 10 },
    { mes: "Abr", pedidos: 22, agendamentos: 15 },
    { mes: "Mai", pedidos: 18, agendamentos: 14 },
    { mes: "Jun", pedidos: 25, agendamentos: 18 },
  ];

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-10">
          <h1 className="typography-h1 mb-2">Dashboard</h1>
          <p className="typography-body text-muted-foreground">
            Bem-vindo de volta, {me?.nome} 👋
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-10">
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-lg font-bold ${isWhatsappConectado ? "text-emerald-500" : "text-red-500"}`}>
                {isWhatsappConectado ? "● Conectado" : "○ Offline"}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalClientes}</div>
              <p className="text-xs text-muted-foreground mt-1">Atendidos via WhatsApp</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalPedidos}</div>
              <p className="text-xs text-muted-foreground mt-1">{pedidosConfirmados} confirmados</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Agendamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAgendamentos}</div>
              <p className="text-xs text-muted-foreground mt-1">Próximos 30 dias</p>
            </CardContent>
          </Card>

          <Card className="border border-border bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Faturamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(financeiro?.faturamentoTotal || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Hoje: {formatCurrency(financeiro?.faturamentoHoje || 0)}</p>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Conversão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{taxaConversao}%</div>
              <p className="text-xs text-muted-foreground mt-1">Pedidos finalizados</p>
            </CardContent>
          </Card>
        </div>


        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Pedidos por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="pedidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle>Agendamentos por Período</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }} />
                  <Line type="monotone" dataKey="agendamentos" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
