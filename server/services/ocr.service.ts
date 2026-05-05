import { ENV } from "../_core/env";

type ProdutoExtraido = {
  nome: string;
  descricao?: string;
  preco: number;
  categoria: string;
};

function normalizarProduto(item: any): ProdutoExtraido | null {
  if (!item?.nome) return null;

  let preco = Number(item.preco || 0);

  // Se vier em reais, converte para centavos
  if (preco > 0 && preco < 1000) {
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

export async function extractProductsFromImage(base64Image: string): Promise<ProdutoExtraido[]> {
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
                url: `data:image/jpeg;base64,${base64Image}`,
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
    const errorText = await response.text();
    console.error("[OCR] Erro Groq Vision:", errorText);
    throw new Error(`Erro ao ler imagem: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) return [];

  const parsed = JSON.parse(content);
  const produtos = Array.isArray(parsed) ? parsed : parsed.produtos;

  if (!Array.isArray(produtos)) return [];

  return produtos
    .map(normalizarProduto)
    .filter(Boolean) as ProdutoExtraido[];
}
