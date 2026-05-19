const env = (import.meta as any).env ?? {};

export const appConfig = {
  geminiApiKey: env.VITE_GEMINI_API_KEY ?? '',
  geminiModel: env.VITE_GEMINI_MODEL ?? 'gemini-2.5-flash',
  supabaseUrl: env.VITE_SUPABASE_URL ?? '',
  supabaseRestUrl: env.VITE_SUPABASE_REST_URL ?? '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
};

export function assertConfigured(name: keyof typeof appConfig) {
  if (!appConfig[name]) {
    throw new Error(`${name} is not configured. Add it to .env.local and restart Vite.`);
  }
}
