import * as React from "react";
import { useRoute } from "wouter";
import { trpc } from "@/src/lib/trpc";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { 
  Loader2, 
  MapPin, 
  Clock, 
  Instagram, 
  Globe,
  CheckCircle2,
  ChevronRight,
  Package
} from "lucide-react";
import { motion } from "motion/react";

function WhatsAppIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function PublicApresentacao() {
  const [, params] = useRoute("/public/:slug");
  const slug = params ? (params as any).slug : null;
  const { data: empresa, isLoading: loadingEmpresa } = trpc.empresa.getPublicEmpresa.useQuery(slug!, {
    enabled: !!slug,
  });
  const { data: cardapio, isLoading: loadingCat } = trpc.empresa.getPublicCatalog.useQuery(empresa?.id!, {
    enabled: !!empresa?.id,
  });

  if (loadingEmpresa) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!empresa) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-muted-foreground">Estabelecimento não encontrado.</p>
      </div>
    );
  }

  const materiais = (empresa.materiais as any) || {};
  const configBot = (empresa.configBot as any) || {};

  const handleWhatsApp = () => {
    const phone = empresa.whatsappNumero?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=Olá! Vim através da página da ${empresa.nome}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <header className="bg-emerald-600 text-white py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              {empresa.nome}
            </h1>
            <p className="text-xl text-emerald-50 mb-8 max-w-2xl mx-auto leading-relaxed">
              {materiais.descricao || `Bem-vindo à ${empresa.nome}. Qualidade e excelência em cada detalhe de nosso atendimento.`}
            </p>
            <Button 
              size="lg" 
              onClick={handleWhatsApp}
              className="bg-white text-emerald-600 hover:bg-emerald-50 rounded-full px-8 py-6 text-lg font-bold shadow-xl"
            >
              <WhatsAppIcon className="w-6 h-6 mr-2" />
              Falar no WhatsApp
            </Button>
          </motion.div>
        </div>
      </header>

      {/* Info Cards */}
      <div className="container mx-auto max-w-5xl px-4 -mt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-lg border-none">
            <CardContent className="pt-6 text-center">
              <MapPin className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Localização</h3>
              <p className="text-sm text-muted-foreground">{materiais.endereco || "Atendimento Online"}</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-none">
            <CardContent className="pt-6 text-center">
              <Clock className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Horário</h3>
              <p className="text-sm text-muted-foreground">Consulte disponibilidade no WhatsApp</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-none">
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center gap-4">
                <Instagram className="w-8 h-8 text-emerald-500 cursor-pointer" />
                <Globe className="w-8 h-8 text-emerald-500 cursor-pointer" />
              </div>
              <h3 className="font-bold mt-3 mb-1">Redes Sociais</h3>
              <p className="text-sm text-muted-foreground">Siga-nos para novidades</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Catálogo de Produtos/Serviços */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-10">
            <Package className="w-8 h-8 text-emerald-600" />
            <h2 className="text-3xl font-bold">Nossos {empresa.ramo === "loja" ? "Produtos" : "Serviços"}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cardapio?.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 group"
              >
                <div className="h-48 bg-slate-200 relative">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Package className="w-12 h-12" />
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-emerald-600">
                    {item.categoria}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-xl mb-2 group-hover:text-emerald-600 transition-colors">{item.nome}</h3>
                  <p className="text-muted-foreground text-sm mb-4 h-10 overflow-hidden line-clamp-2">
                    {item.descricao}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-slate-900 italic">
                      {(item.preco / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleWhatsApp}
                      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-full"
                    >
                      Pedir <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {cardapio?.length === 0 && !loadingCat && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-muted-foreground">Nenhum item cadastrado no momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* Diferenciais */}
      <section className="py-20 bg-emerald-950 text-white px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-16">Por que escolher {empresa.nome}?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
            {[
              { t: "Atendimento Rápido", d: "Resposta ágil pelo nosso assistente IA para tirar suas dúvidas instantaneamente." },
              { t: "Qualidade Garantida", d: "Processos rigorosos para assegurar que você receba o melhor produto ou serviço." },
              { t: "Suporte Dedicado", d: "Nossa equipe está sempre de prontidão para ajudar em qualquer situação especial." },
              { t: "Preços Justos", d: "Trabalhamos com transparência e as melhores condições de mercado." }
            ].map((d, i) => (
              <div key={i} className="flex gap-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-xl mb-2">{d.t}</h4>
                  <p className="text-emerald-200/70">{d.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t bg-white">
        <div className="container mx-auto max-w-5xl px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="font-bold text-xl">{empresa.nome}</h2>
            <p className="text-sm text-muted-foreground">© 2024 Todos os direitos reservados.</p>
          </div>
          <div className="flex gap-4">
            <WhatsAppIcon className="w-6 h-6 text-slate-400 hover:text-emerald-500 cursor-pointer" />
            <Instagram className="w-6 h-6 text-slate-400 hover:text-pink-500 cursor-pointer" />
          </div>
        </div>
      </footer>

      {/* CTA Fixo Mobile */}
      <div className="fixed bottom-6 right-6 md:hidden">
        <Button 
          size="lg" 
          onClick={handleWhatsApp}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full h-16 w-16 shadow-2xl flex items-center justify-center p-0"
        >
          <WhatsAppIcon className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
}
