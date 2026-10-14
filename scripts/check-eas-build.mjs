import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';
const result = readSupabaseConfiguration(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
const validProject = typeof projectId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
if (!result.configuration || !validProject) {
  console.error('Configuración incompleta: comprueba EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY y EXPO_PUBLIC_EAS_PROJECT_ID. No se han impreso sus valores.');
  process.exitCode = 1;
} else console.log('Variables públicas de Supabase y projectId EAS válidos. Verifica también GOOGLE_SERVICES_JSON y las credenciales FCM/APNs en EAS antes de compilar.');
