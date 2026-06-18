const env = (import.meta as any).env ?? {};

export const appConfig = {
  nvidiaApiKey: env.VITE_NVIDIA_API_KEY ?? '',
  nvidiaModel: env.VITE_NVIDIA_MODEL ?? 'meta/llama-3.3-70b-instruct',
  supabaseUrl: env.VITE_SUPABASE_URL ?? '',
  supabaseRestUrl: env.VITE_SUPABASE_REST_URL ?? '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
};

export function assertConfigured(name: keyof typeof appConfig) {
  if (!appConfig[name]) {
    throw new Error(`${name} is not configured. Add it to .env.local and restart Vite.`);
  }
}
