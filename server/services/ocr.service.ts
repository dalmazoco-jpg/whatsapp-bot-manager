import { ENV } from "../_core/env";
import { storageGetSignedUrl, storagePut } from "../storage";

type ProdutoExtraido = {
  nome: string;
  descricao?: string;
  preco: number;
  categoria: string;
};

function normalizarProduto(item: any): ProdutoExtraido | null {
  if (!item?.nome) return null;

  let preco = 0;
  if (typeof item.preco === "string") {
    const clean = item.preco.replace(/[^\d,.-]/g, "").replace(",", ".");
    const parsed = Number(clean);
    preco = Number.isFinite(parsed) ? parsed : 0;
  } else {
    preco = Number(item.preco || 0);
  }

  // Inteiros a partir de 100 são tratados como centavos. Valores decimais ou menores que 100 vêm em reais.
  if (preco > 0 && (!Number.isInteger(preco) || preco < 100)) {
    preco = Math.round(preco * 100);
  }

  if (!preco || preco <= 0) return null;

  return {
    nome: String(item.nome).trim(),
    descricao: item.descricao ? String(item.descricao).trim() : undefined,
    preco,
    categoria: item.categoria ? String(item.categoria).trim() : "Geral",
  };
}

async function resolveImageUrl(base64Image: string, mimeType: string): Promise<string> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    return `data:${mimeType};base64,${base64Image}`;
  }

  const buffer = Buffer.from(base64Image, "base64");
  const extension = mimeType.split("/")[1]?.split(";")[0] || "jpg";
  const { key } = await storagePut(`ocr/${Date.now()}.${extension}`, buffer, mimeType);
  return await storageGetSignedUrl(key);
}

export async function extractProductsFromImage(base64Image: string, mimeType = "image/jpeg"): Promise<ProdutoExtraido[]> {
  if (!ENV.groqApiKey) {
    throw new Error("GROQ_API_KEY não configurada");
  }

  const prompt = `
Você é um extrator de produtos de cardápios, folhetos, promoções e listas comerciais.

Extraia todos os produtos visíveis da imagem.

Retorne SOMENTE JSON válido neste formato:

{
  "produtos": [
    {
      "nome": "Coca-Cola 2L",
      "descricao": "opcional",
      "preco": 999,
      "categoria": "Bebidas"
    }
  ]
}

Regras:
- preco SEMPRE em centavos. Ex: R$ 9,99 = 999.
- Se o preço estiver ilegível, NÃO inclua o produto.
- Não invente produto.
- Não invente preço.
- Categoria curta: Pizzas, Bebidas, Porções, Mercado, Adega, Pet Shop, Serviços ou Geral.
- Se for folheto de mercado, use categorias como Bebidas, Mercearia, Carnes, Limpeza, Hortifruti.
`;

  const imageUrl = await resolveImageUrl(base64Image, mimeType);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.groqApiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("[OCR] Erro Groq Vision:", errorText);
    throw new Error(`Erro ao ler imagem: ${response.status} ${errorText ? `- ${errorText}` : ""}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) return [];

  const parsed = typeof content === "string" ? JSON.parse(content) : content;
  const produtos = Array.isArray(parsed) ? parsed : parsed?.produtos;

  if (!Array.isArray(produtos)) return [];

  return produtos
    .map(normalizarProduto)
    .filter(Boolean) as ProdutoExtraido[];
}
