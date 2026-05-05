import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Modo local: redireciona direto para o dashboard
    setLocation("/dashboard");
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Carregando painel local...</p>
    </div>
  );
}
