import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { unwrapTrpcArray } from "@/lib/trpcData";
import { CreditCard, ShoppingCart, CheckCircle, XCircle, Loader2, ExternalLink } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

interface StripeProduct {
  id: string;
  name: string;
  description?: string;
  images?: string[];
  metadata?: Record<string, string>;
}

interface StripePrice {
  id: string;
  product: string;
  unit_amount: number;
  currency: string;
  recurring?: {
    interval: 'day' | 'week' | 'month' | 'year';
  };
  metadata?: Record<string, string>;
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: number;
  items: {
    data: Array<{
      price: StripePrice;
    }>;
  };
}

export default function Pagamentos() {
  const { data: me } = trpc.auth.me.useQuery();
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const token = localStorage.getItem("auth_token") || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const apiFetch = (url: string, init?: RequestInit) =>
    fetch(url, { credentials: "include", ...(init || {}), headers: { ...headers, ...(init?.headers || {}) } });

  // Carregar produtos e preços
  const loadStripeData = async () => {
    setLoading(true);
    try {
      const [productsRes, pricesRes, subscriptionsRes] = await Promise.all([
        apiFetch("/api/stripe/products"),
        apiFetch("/api/stripe/prices"),
        apiFetch("/api/stripe/subscriptions"),
      ]);

      const productsData = await productsRes.json();
      const pricesData = await pricesRes.json();
      const subscriptionsData = await subscriptionsRes.json();

      setProducts(productsData.products || []);
      setPrices(pricesData.prices || []);
      setSubscriptions(subscriptionsData.subscriptions || []);
    } catch (error) {
      toast.error("Erro ao carregar dados de pagamento");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStripeData();
  }, []);

  // Criar sessão de checkout
  const createCheckout = async (priceId: string, isSubscription = false) => {
    setCheckoutLoading(priceId);
    try {
      const endpoint = isSubscription ? "/api/stripe/create-subscription-checkout" : "/api/stripe/create-checkout-session";
      const response = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ priceId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao criar checkout");

      // Redirecionar para Stripe Checkout
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao processar pagamento");
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Cancelar assinatura
  const cancelSubscription = async (subscriptionId: string) => {
    try {
      const response = await apiFetch("/api/stripe/cancel-subscription", {
        method: "POST",
        body: JSON.stringify({ subscriptionId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao cancelar assinatura");

      toast.success("Assinatura cancelada com sucesso");
      loadStripeData(); // Recarregar dados
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao cancelar assinatura");
    }
  };

  // Formatar preço
  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  // Formatar data
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("pt-BR");
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="typography-h1 mb-1 flex items-center gap-3">
            <CreditCard className="w-7 h-7 text-blue-500" />
            Pagamentos
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie produtos, preços e assinaturas com Stripe
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground mt-2">Carregando dados de pagamento...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Assinaturas Ativas */}
            {subscriptions.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Assinaturas Ativas</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {subscriptions.map((subscription) => (
                    <Card key={subscription.id} className="border border-border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium">
                            {subscription.items.data[0]?.price?.recurring?.interval === 'month' ? 'Plano Mensal' :
                             subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'Plano Anual' : 'Plano'}
                          </h3>
                          <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                            {subscription.status === 'active' ? 'Ativo' : subscription.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Próxima cobrança: {formatDate(subscription.current_period_end)}
                        </p>
                        {subscription.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelSubscription(subscription.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Cancelar Assinatura
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Produtos Disponíveis */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Produtos Disponíveis</h2>
              {products.length === 0 ? (
                <Card className="border border-border">
                  <CardContent className="py-16 text-center">
                    <ShoppingCart className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-muted-foreground">Nenhum produto configurado no Stripe</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure produtos e preços no painel do Stripe
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => {
                    const productPrices = prices.filter((price) => price.product === product.id);
                    return (
                      <Card key={product.id} className="border border-border hover:border-blue-500/30 transition-colors">
                        <CardHeader>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          {product.description && (
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {productPrices.map((price) => (
                            <div key={price.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                              <div>
                                <p className="font-medium">
                                  {formatPrice(price.unit_amount, price.currency)}
                                  {price.recurring && (
                                    <span className="text-sm text-muted-foreground ml-1">
                                      /{price.recurring.interval === 'month' ? 'mês' :
                                        price.recurring.interval === 'year' ? 'ano' : price.recurring.interval}
                                    </span>
                                  )}
                                </p>
                                {!price.recurring && (
                                  <p className="text-xs text-muted-foreground">Pagamento único</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => createCheckout(price.id, !!price.recurring)}
                                disabled={checkoutLoading === price.id}
                              >
                                {checkoutLoading === price.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Comprar
                                  </>
                                )}
                              </Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Informações do Stripe */}
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Configuração Stripe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <strong>Status:</strong>{" "}
                  {process.env.NODE_ENV === 'development' ? (
                    <span className="text-green-600">Modo de teste (testes)</span>
                  ) : (
                    <span className="text-blue-600">Modo produção</span>
                  )}
                </p>
                <p>
                  <strong>Chave pública:</strong>{" "}
                  {process.env.VITE_STRIPE_PUBLISHABLE_KEY ? (
                    <span className="text-green-600">Configurada</span>
                  ) : (
                    <span className="text-red-600">Não configurada</span>
                  )}
                </p>
                <p>
                  <strong>Webhook:</strong>{" "}
                  {process.env.STRIPE_WEBHOOK_SECRET ? (
                    <span className="text-green-600">Configurado</span>
                  ) : (
                    <span className="text-red-600">Não configurado</span>
                  )}
                </p>
                <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg text-yellow-800 text-xs">
                  <p className="font-medium mb-1">Para configurar webhooks em produção:</p>
                  <p>1. Acesse o painel do Stripe</p>
                  <p>2. Vá para "Webhooks" e crie um novo webhook</p>
                  <p>3. URL: https://seusite.com/api/stripe/webhook</p>
                  <p>4. Eventos: checkout.session.completed, invoice.payment_succeeded, customer.subscription.*</p>
                  <p>5. Copie o secret e configure a variável STRIPE_WEBHOOK_SECRET</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}