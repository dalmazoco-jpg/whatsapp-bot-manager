import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Plus, Search, MessageCircle, Phone, Mail, LogIn } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function Clientes() {
  const { data: clientes, isLoading } = trpc.clientes.list.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const acessarEmpresa = trpc.admin.acessarEmpresa.useMutation();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClientes = clientes?.filter(
    (c) => c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || c.whatsappNumber.includes(searchTerm)
  ) || [];

  const handleAcessarEmpresa = async (empresaId: number) => {
    try {
      const result = await acessarEmpresa.mutateAsync({ empresaId });
      // Armazenar token e redirecionar
      localStorage.setItem("auth_token", result.token);
      setLocation("/dashboard");
    } catch (err) {
      console.error("Erro ao acessar empresa:", err);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="typography-h1 mb-2">Clientes</h1>
            <p className="typography-body text-muted-foreground">Clientes atendidos via WhatsApp</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou WhatsApp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border border-border"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : filteredClientes.length === 0 ? (
            <Card className="border border-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nenhum cliente encontrado</p>
              </CardContent>
            </Card>
          ) : (
            filteredClientes.map((cliente) => (
              <Card key={cliente.id} className="border border-border hover:border-emerald-500/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="typography-h3 mb-2">{cliente.nome}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MessageCircle className="w-4 h-4" />
                          <span>{cliente.whatsappNumber}</span>
                        </div>
                        {cliente.endereco && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <span>📍 {cliente.endereco}</span>
                          </div>
                        )}
                      </div>
                      {cliente.preferencias && Object.keys(cliente.preferencias as object).length > 0 && (
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {Object.entries(cliente.preferencias as Record<string, boolean>).map(([key, val]) => (
                            <span key={key} className="inline-block px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-xs rounded">
                              {key.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      className="border border-border"
                      onClick={() => handleAcessarEmpresa(cliente.id)}
                      disabled={acessarEmpresa.isPending}
                    >
                      <LogIn className="w-4 h-4 mr-2" />
                      Acessar Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
