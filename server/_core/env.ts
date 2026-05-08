export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "fallback-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  localAuthFallback: process.env.LOCAL_AUTH_FALLBACK === "true",
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  // IA — Groq (gratuito) como padrão
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  // Forge/Gemini (fallback)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  infinitePayHandle: process.env.INFINITEPAY_HANDLE ?? "denisdalmazo",
  infinitePayBaseUrl: process.env.INFINITEPAY_BASE_URL ?? "https://api.checkout.infinitepay.io",
  publicAppUrl: process.env.APP_URL ?? process.env.PUBLIC_APP_URL ?? "https://crm-whatsapp-saas-237342297859.us-central1.run.app",
  deliveryWebhookUrl: process.env.DELIVERY_WEBHOOK_URL ?? "https://ais-dev-5ckv2i3hy37kkk2vgdspdf-594334575772.us-east1.run.app/api/webhook/delivery",
  deliveryWebhookApiKey: process.env.DELIVERY_WEBHOOK_API_KEY ?? "",
};
