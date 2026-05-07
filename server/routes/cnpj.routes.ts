import type { Express, Request, Response } from "express";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function buildAddress(data: any) {
  const street = [
    data.descricao_tipo_logradouro,
    data.logradouro,
  ].filter(Boolean).join(" ");
  return [
    street,
    data.numero ? `nº ${data.numero}` : "",
    data.complemento,
    data.bairro,
  ].filter(Boolean).join(", ");
}

export function registerCnpjRoutes(app: Express) {
  app.get("/api/cnpj/:cnpj", async (req: Request, res: Response) => {
    const cnpj = onlyDigits(req.params.cnpj || "");
    if (cnpj.length !== 14) {
      return res.status(400).json({ error: "Informe um CNPJ com 14 dígitos" });
    }

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || data?.error || "CNPJ não encontrado",
        });
      }

      const telefone = data.ddd_telefone_1
        ? `(${String(data.ddd_telefone_1).slice(0, 2)}) ${String(data.ddd_telefone_1).slice(2)}`
        : "";

      return res.json({
        cnpj: data.cnpj || cnpj,
        razaoSocial: data.razao_social || "",
        nomeFantasia: data.nome_fantasia || "",
        responsavelNome: data.qsa?.[0]?.nome_socio || "",
        telefone,
        email: data.email || "",
        endereco: buildAddress(data),
        cidade: data.municipio || "",
        estado: data.uf || "",
        cep: data.cep || "",
      });
    } catch (error) {
      console.error("[cnpj] erro ao consultar:", error);
      return res.status(502).json({ error: "Não foi possível consultar o CNPJ agora" });
    }
  });
}
