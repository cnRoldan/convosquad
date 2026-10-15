import * as http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';

http.setGlobalProxyFromEnv?.();
const { configuration, error } = readSupabaseConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
if (!configuration) {
  console.error(error);
  process.exitCode = 2;
} else {
  const safeFetch = (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: safeFetch },
  });
  try {
    const response = await safeFetch(`${configuration.url}/auth/v1/settings`, { headers: { apikey: configuration.publishableKey } });
    const settings = response.ok ? await response.json() : null;
    if (settings?.mailer_autoconfirm === true && settings.disable_signup !== true) console.log('Auth: altas habilitadas sin confirmación de correo.');
    else { console.error('Auth pendiente: habilita altas y desactiva Confirm email en Supabase.'); process.exitCode = 1; }
    const result = await client.rpc('is_ea_id_available', { p_ea_id: '__auth_probe__' }, { get: true });
    if (!result.error && typeof result.data === 'boolean') console.log('RPC de disponibilidad: accesible con la clave publicable.');
    else { console.error(`RPC pendiente: aplica 20261015180000_ea_id_auth.sql (HTTP ${result.status}).`); process.exitCode = 1; }
  } catch {
    console.error('No se pudo completar la comprobación de lectura. Revisa red y configuración.');
    process.exitCode = 1;
  }
}
