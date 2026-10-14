type SupabaseConfiguration = { url: string; publishableKey: string };
type ConfigurationResult = { configuration: SupabaseConfiguration | null; error: string | null };

export function readSupabaseConfiguration(rawUrl: string | undefined, rawKey: string | undefined): ConfigurationResult {
  const url = rawUrl?.trim();
  const publishableKey = rawKey?.trim();
  if (!url || !publishableKey) {
    return { configuration: null, error: 'Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY para usar el acceso real.' };
  }
  try {
    const parsed = new URL(url);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      throw new Error('Invalid project URL');
    }
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
      return { configuration: null, error: 'Utiliza una clave publicable moderna de Supabase (sb_publishable_...). No uses claves secretas ni claves JWT heredadas.' };
    }
    return { configuration: { url: parsed.origin, publishableKey }, error: null };
  } catch {
    return { configuration: null, error: 'EXPO_PUBLIC_SUPABASE_URL debe ser el origen HTTPS del proyecto, sin rutas ni credenciales.' };
  }
}
