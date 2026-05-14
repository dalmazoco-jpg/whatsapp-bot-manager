import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { useSearchParams, Link } from "wouter";

export default function PagamentoSucesso() {
  const [searchParams] = useSearchParams();
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      // Buscar dados da sessão do Stripe
      fetch(`/api/stripe/checkout-session/${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSessionData(data);
          setLoading(false);
        })
        .catch((error) => {
          console.error("Erro ao buscar dados da sessão:", error);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-4" />
          <p className="text-muted-foreground">Verificando pagamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl text-green-600">Pagamento Aprovado!</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Seu pagamento foi processado com sucesso. Obrigado pela compra!
          </p>

          {sessionData && (
            <div className="text-left bg-gray-50 p-3 rounded-lg text-sm">
              <p><strong>ID da Sessão:</strong> {sessionData.id}</p>
              <p><strong>Status:</strong> {sessionData.payment_status === 'paid' ? 'Pago' : sessionData.payment_status}</p>
              {sessionData.amount_total && (
                <p><strong>Valor:</strong> {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: sessionData.currency?.toUpperCase() || "BRL",
                }).format(sessionData.amount_total / 100)}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Link href="/dashboard">
              <Button className="w-full">
                Voltar ao Dashboard
              </Button>
            </Link>
            <Link href="/pagamentos">
              <Button variant="outline" className="w-full">
                Ver Outros Produtos
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}