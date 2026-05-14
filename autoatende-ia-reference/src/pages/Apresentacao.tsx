import * as React from "react";
import DashboardLayout from "@/src/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { trpc } from "@/src/lib/trpc";
import { toast } from "sonner";
import { Globe, Palette, Layout, ExternalLink, Save, Loader2, Image as ImageIcon } from "lucide-react";

export default function Apresentacao() {
  const { data: me, refetch } = trpc.auth.me.useQuery();
  const updateSettings = trpc.empresa.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Materiais atualizados!");
      refetch();
    }
  });

  const empresa = (me as any)?.empresa;
  const materiais = empresa?.materiais || {};

  const [formData, setFormData] = React.useState({
    slug: "",
    descricao: "",
    endereco: "",
    instagram: "",
    website: "",
  });

  React.useEffect(() => {
    if (empresa) {
      setFormData({
        slug: empresa.slug || "",
        descricao: materiais.descricao || "",
        endereco: materiais.endereco || "",
        instagram: materiais.instagram || "",
        website: materiais.website || "",
      });
    }
  }, [empresa]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      slug: formData.slug,
      materiais: {
        ...materiais,
        descricao: formData.descricao,
        endereco: formData.endereco,
        instagram: formData.instagram,
        website: formData.website,
      }
    });
  };

  const publicUrl = empresa?.slug ? `/public/${empresa.slug}` : "";

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black mb-2">Materiais Comerciais</h1>
            <p className="text-muted-foreground">
              Configure como sua empresa aparece para o mundo e envie folders automáticos.
            </p>
          </div>
          {publicUrl && (
            <Button variant="outline" onClick={() => window.open(publicUrl, "_blank")} className="rounded-full">
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver Página Pública
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="w-5 h-5 text-emerald-500" />
                  Identidade Visual
                </CardTitle>
                <CardDescription>Configure o endereço e a descrição que aparecerão no seu folder.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <label className="text-sm font-bold">Endereço Personalizado (URL)</label>
                  <div className="flex gap-2 items-center">
                    <span className="text-muted-foreground text-sm">botmanager.com/public/</span>
                    <Input 
                      placeholder="seu-negocio" 
                      value={formData.slug}
                      onChange={e => setFormData(p => ({ ...p, slug: e.target.value }))}
                      className="rounded-lg font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-bold">Descrição do Negócio / Bio</label>
                  <Textarea 
                    placeholder="Conte um pouco sobre sua empresa, missão e diferenciais..."
                    className="min-h-[120px] rounded-xl resize-none"
                    value={formData.descricao}
                    onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm font-bold">Endereço Físico (ou Atendimento Online)</label>
                  <Input 
                    placeholder="Rua Exemplo, 123 - Centro"
                    value={formData.endereco}
                    onChange={e => setFormData(p => ({ ...p, endereco: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-emerald-500" />
                  Redes Sociais
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Instagram</label>
                  <Input 
                    placeholder="@seu.negocio"
                    value={formData.instagram}
                    onChange={e => setFormData(p => ({ ...p, instagram: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Website</label>
                  <Input 
                    placeholder="www.seunegocio.com.br"
                    value={formData.website}
                    onChange={e => setFormData(p => ({ ...p, website: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden">
               <div className="p-6 bg-emerald-500/10 border-b border-white/5">
                <h3 className="font-bold flex items-center gap-2">
                  <Palette className="w-5 h-5 text-emerald-400" />
                  Destaque Visual
                </h3>
               </div>
               <CardContent className="p-6 space-y-6">
                  <div className="aspect-video bg-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 border border-white/5">
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <span className="text-xs">Banner (Em breve)</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed italic">
                    "A tipografia e as cores serão ajustadas automaticamente para combinar com o ramo do seu negócio."
                  </p>
               </CardContent>
            </Card>

            <Button 
               type="submit"
               disabled={updateSettings.isPending}
               className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg"
            >
              {updateSettings.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
              Salvar Alterações
            </Button>

            <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
              <h4 className="font-bold text-emerald-900 text-sm mb-2">Folder Inteligente</h4>
              <p className="text-[11px] text-emerald-800/70 leading-relaxed mb-4">
                Sempre que configurado, a IA enviará o link da sua página pública quando o cliente pedir "informações", "valores" ou "folder".
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-white p-2 rounded-lg border border-emerald-200">
                <Layout className="w-4 h-4" /> Link do Folder Ativo
              </div>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
