import { createRequire } from 'node:module';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';
const result = readSupabaseConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const require = createRequire(import.meta.url);
let projectId;
try { projectId = require('expo/config').getConfig(process.cwd()).exp.extra?.eas?.projectId; } catch { projectId = undefined; }
const validProject = typeof projectId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
if (!result.configuration || !validProject) {
  console.error('Configuración incompleta: comprueba EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY y el projectId vinculado en app.json (o EXPO_PUBLIC_EAS_PROJECT_ID). No se han impreso sus valores.');
  process.exitCode = 1;
} else console.log('Variables públicas de Supabase y projectId EAS válidos. Verifica también GOOGLE_SERVICES_JSON y las credenciales FCM/APNs en EAS antes de compilar.');
