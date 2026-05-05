import { invokeLLM } from "../_core/llm";

export async function extractProductsFromImage(base64Image: string): Promise<any[]> {
  try {
    const prompt = `Analise a imagem deste cardápio ou lista de produtos e extraia os itens no formato JSON.
Retorne um array de objetos com os campos: "nome", "descricao", "preco" (em centavos, ex: 1050 para R$ 10,50) e "categoria".

IMPORTANTE: 
1. Se não houver descrição, deixe vazio.
2. Identifique a categoria baseando-se no contexto (ex: Pizzas, Bebidas, Sobremesas).
3. Responda APENAS o JSON.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    // Extrair JSON da resposta (lidar com possíveis markdown)
    const jsonStr = content.match(/\[.*\]/s)?.[0] || content;
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("[OCR] Erro ao extrair produtos:", error);
    return [];
  }
}
