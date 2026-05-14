export async function notifyOwner(input: { title: string; content: string }) {
  console.log(`[Notificação] Título: ${input.title} - Conteúdo: ${input.content}`);
  // Aqui você integrará com seu robô ou serviço de mensagens (WhatsApp/Email)
  return true;
}
