import * as http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';

http.setGlobalProxyFromEnv?.();

const { configuration, error } = readSupabaseConfiguration(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
if (!configuration) {
  console.error(error);
  process.exitCode = 2;
} else {
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) },
  });
  try {
    const checks = [
      ['Directorio público (GET, sin filas)', () => client.from('club_directory').select('club_id').limit(0)],
      ['RPC search_clubs (HEAD, sin filas)', () => client.rpc('search_clubs', { p_query: '' }, { get: true, head: true })],
    ];
    for (const [name, run] of checks) {
      const result = await run();
      if (result.error) {
        console.error(`${name}: no verificado (HTTP ${result.status}). Revisa red, variables, permisos y esquema de la API.`);
        process.exitCode = 1;
        break;
      }
      console.log(`${name}: correcto (HTTP ${result.status}).`);
    }
  } catch {
    console.error('No se pudo completar la lectura. Comprueba la conexión y el dominio permitido del proyecto.');
    process.exitCode = 1;
  }
}
