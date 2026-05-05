import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function ConexaoWhatsApp() {
  const { data: me } = trpc.auth.me.useQuery();
  const empresaId = me?.empresaId;

  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("desconectado");
  const [connecting, setConnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Conectar ao SSE para receber QR em tempo real
  const startSSE = () => {
    if (!empresaId) return;

    // Fechar conexão anterior
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem("auth_token") || "";
    const url = `/api/whatsapp/qr-stream/${empresaId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "qr":
            setQrImage(data.qr);
            setStatus("qr_pendente");
            setConnecting(false);
            break;
          case "connected":
            setQrImage(null);
            setStatus("conectado");
            setConnecting(false);
            break;
          case "disconnected":
            setQrImage(null);
            setStatus("desconectado");
            setConnecting(false);
            break;
          case "status":
            setStatus(data.status);
            break;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    es.onerror = () => {
      console.error("SSE connection error");
    };

    eventSourceRef.current = es;
  };

  // Auto-conectar SSE se já estiver aguardando QR
  useEffect(() => {
    if (empresaId) {
      // Pequeno delay para garantir que o me query terminou (já garantido pelo check de empresaId)
      startSSE();
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [empresaId]);


  // Iniciar conexão WhatsApp
  const handleConnect = async () => {
    if (!empresaId) return;
    setConnecting(true);
    setQrImage(null);

    try {
      const token = localStorage.getItem("auth_token") || "";
      await fetch(`/api/whatsapp/connect/${empresaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      // Iniciar SSE para receber QR
      startSSE();
    } catch (err) {
      console.error("Connect error:", err);
      setConnecting(false);
    }
  };

  // Desconectar
  const handleDisconnect = async () => {
    if (!empresaId) return;

    try {
      const token = localStorage.getItem("auth_token") || "";
      await fetch(`/api/whatsapp/disconnect/${empresaId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      setStatus("desconectado");
      setQrImage(null);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  const statusConfig = {
    conectado: {
      icon: <Wifi className="w-5 h-5 text-emerald-500" />,
      label: "Conectado",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    qr_pendente: {
      icon: <QrCode className="w-5 h-5 text-yellow-500" />,
      label: "Aguardando scan...",
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    desconectado: {
      icon: <WifiOff className="w-5 h-5 text-red-500" />,
      label: "Desconectado",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  };

  const currentStatus = statusConfig[status as keyof typeof statusConfig] || statusConfig.desconectado;

  if (!empresaId) {
    return (
      <DashboardLayout>
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="border border-border max-w-md">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Você precisa estar vinculado a uma empresa para conectar o WhatsApp.
            </p>
          </CardContent>
        </Card>
      </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="typography-h1 mb-2 flex items-center gap-3">
            <Smartphone className="w-8 h-8 text-emerald-500" />
            Conexão WhatsApp
          </h1>
          <p className="typography-body text-muted-foreground">
            Conecte seu WhatsApp escaneando o QR Code abaixo
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* QR Code Area */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  QR Code
                </span>
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${currentStatus.bg} ${currentStatus.color}`}>
                  {currentStatus.icon}
                  {currentStatus.label}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center min-h-[350px]">
                {status === "conectado" ? (
                  <div className="text-center">
                    <CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
                    <p className="text-xl font-semibold text-emerald-600">
                      WhatsApp Conectado!
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Seu bot está recebendo e respondendo mensagens automaticamente.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6 border-red-500/30 text-red-600 hover:bg-red-500/10"
                      onClick={handleDisconnect}
                    >
                      <WifiOff className="w-4 h-4 mr-2" />
                      Desconectar
                    </Button>
                  </div>
                ) : qrImage ? (
                  <div className="text-center">
                    <div className="p-4 bg-white rounded-2xl shadow-lg inline-block mb-4">
                      <img
                        src={qrImage}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64"
                        id="whatsapp-qr-image"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Abra o WhatsApp no seu celular → Menu → Aparelhos conectados → Conectar aparelho
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3"
                      onClick={handleConnect}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Gerar novo QR
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Smartphone className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-6">
                      Clique no botão abaixo para gerar o QR Code
                    </p>
                    <Button
                      onClick={handleConnect}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={connecting}
                    >
                      {connecting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4 mr-2" />
                      )}
                      {connecting ? "Gerando QR Code..." : "Conectar WhatsApp"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          <div className="space-y-6">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle>📋 Como Conectar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Clique em "Conectar WhatsApp"</p>
                    <p className="text-sm text-muted-foreground">Um QR Code será gerado automaticamente</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Abra o WhatsApp no celular</p>
                    <p className="text-sm text-muted-foreground">Vá em Menu (⋮) → Aparelhos conectados → Conectar aparelho</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Escaneie o QR Code</p>
                    <p className="text-sm text-muted-foreground">Aponte a câmera para o QR Code na tela</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-medium">Pronto!</p>
                    <p className="text-sm text-muted-foreground">O bot começará a responder mensagens automaticamente com IA</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border bg-yellow-500/5">
              <CardContent className="py-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  ⚠️ <strong>Importante:</strong> Mantenha o celular conectado à internet.
                  Se o celular ficar offline por muito tempo, a sessão pode desconectar.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
