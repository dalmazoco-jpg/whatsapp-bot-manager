import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { trpc } from "@/src/lib/trpc";
import { unwrapTrpcData } from "@/src/lib/trpcData";
import {
  Smartphone,
  QrCode,
  Wifi,
  WifiOff,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/src/components/DashboardLayout";

export default function ConexaoWhatsApp() {
  const { data: meData } = trpc.auth.me.useQuery();
  const me = unwrapTrpcData<any>(meData);
  const empresaId = me?.empresaId;

  const [qrImage, setQrImage] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("desconectado");
  const [connecting, setConnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startSSE = React.useCallback(() => {
    if (!empresaId) return;

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
  }, [empresaId]);

  useEffect(() => {
    if (empresaId) {
      startSSE();
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [empresaId, startSSE]);

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

      startSSE();
    } catch (err) {
      console.error("Connect error:", err);
      setConnecting(false);
    }
  };

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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-emerald-500" />
              Conexão WhatsApp
            </h1>
            <p className="text-muted-foreground">
              Conecte seu número para que a IA possa atender seus clientes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <QrCode className="w-5 h-5" />
                    QR Code
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {qrImage ? (
                  <div className="mb-4">
                    <img
                      src={qrImage}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64 border-2 border-border rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mb-4">
                    <p className="text-muted-foreground text-center">
                      {status === "conectado"
                        ? "Já conectado"
                        : "QR Code será exibido ao conectar"}
                    </p>
                  </div>
                )}

                <div className="space-y-2 w-full">
                  {status === "conectado" ? (
                    <>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        ✅ Seu WhatsApp está conectado e pronto para uso.
                      </p>
                      <Button
                        onClick={handleDisconnect}
                        variant="outline"
                        className="border-red-500/30 text-red-600 hover:bg-red-500/10 w-full"
                      >
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleConnect}
                      disabled={connecting}
                      className="bg-emerald-600 text-white hover:bg-emerald-700 w-full"
                    >
                      {connecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 mr-2" />
                          Gerar QR Code
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle className="text-base">Status da Conexão</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className={`flex items-center gap-3 p-4 rounded-lg ${currentStatus.bg}`}
                  >
                    {currentStatus.icon}
                    <div>
                      <p className={`font-semibold ${currentStatus.color}`}>
                        {currentStatus.label}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-base">Instruções para conetar</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>1. Clique no botão <strong>Gerar QR Code</strong>.</p>
                  <p>2. Abra o WhatsApp no seu celular.</p>
                  <p>3. Vá em <strong>Aparelhos Conectados</strong> e clique em <strong>Conectar um Aparelho</strong>.</p>
                  <p>4. Aponte a câmera para o QR Code exibido nesta tela.</p>
                  <p>5. Pronto! A IA começará a responder automaticamente.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
