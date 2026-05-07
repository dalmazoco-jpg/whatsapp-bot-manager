import type { Express, Request, Response } from "express";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function buildBrasilApiAddress(data: any) {
  const street = [
    data.descricao_tipo_de_logradouro || data.descricao_tipo_logradouro,
    data.logradouro,
  ].filter(Boolean).join(" ");
  return [
    street,
    data.numero ? `nº ${data.numero}` : "",
    data.complemento,
    data.bairro,
  ].filter(Boolean).join(", ");
}

function normalizeBrasilApi(data: any, cnpj: string) {
  const telefone = data.ddd_telefone_1
    ? `(${String(data.ddd_telefone_1).slice(0, 2)}) ${String(data.ddd_telefone_1).slice(2)}`
    : "";

  return {
    cnpj: data.cnpj || cnpj,
    razaoSocial: data.razao_social || "",
    nomeFantasia: data.nome_fantasia || "",
    responsavelNome: data.qsa?.[0]?.nome_socio || "",
    telefone,
    email: data.email || "",
    endereco: buildBrasilApiAddress(data),
    cidade: data.municipio || "",
    estado: data.uf || "",
    cep: data.cep || "",
  };
}

function normalizeReceitaWs(data: any, cnpj: string) {
  return {
    cnpj: data.cnpj || cnpj,
    razaoSocial: data.nome || "",
    nomeFantasia: data.fantasia || "",
    responsavelNome: data.qsa?.[0]?.nome || "",
    telefone: data.telefone || "",
    email: data.email || "",
    endereco: [
      data.logradouro,
      data.numero ? `nº ${data.numero}` : "",
      data.complemento,
      data.bairro,
    ].filter(Boolean).join(", "),
    cidade: data.municipio || "",
    estado: data.uf || "",
    cep: data.cep || "",
  };
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

      if (response.ok) {
        return res.json(normalizeBrasilApi(data, cnpj));
      }

      console.warn(`[cnpj] BrasilAPI falhou ${response.status}: ${data?.message || data?.error || "sem detalhe"}`);

      const fallbackResponse = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`);
      const fallbackData = await fallbackResponse.json().catch(() => ({}));
      if (!fallbackResponse.ok || fallbackData?.status === "ERROR") {
        return res.status(fallbackResponse.status || response.status).json({
          error: fallbackData?.message || data?.message || data?.error || "CNPJ não encontrado",
        });
      }

      return res.json(normalizeReceitaWs(fallbackData, cnpj));
    } catch (error) {
      console.error("[cnpj] erro ao consultar:", error);
      return res.status(502).json({ error: "Não foi possível consultar o CNPJ agora" });
    }
  });
}
