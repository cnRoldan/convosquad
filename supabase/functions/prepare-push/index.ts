import { createClient } from '@supabase/supabase-js';
import { authorizedWorker, parsePushEvent } from '../_shared/push-event.ts';

Deno.serve(async request => {
  if (!authorizedWorker(request.headers.get('authorization'), Deno.env.get('PUSH_WORKER_SECRET'))) return new Response('No autorizado', { status: 401 });
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Configuración de servidor incompleta', { status: 503 });
  const input = parsePushEvent(await request.json().catch(() => null));
  if (!input) return new Response('Evento no válido', { status: 400 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('prepare_call_up_push', { p_club_id: input.clubId, p_call_up_id: input.callUpId, p_event_key: input.eventKey, p_kind: input.kind });
  if (error || typeof data !== 'string') return new Response('No se pudo preparar el evento', { status: 409 });
  return Response.json({ eventId: data, prepared: true, sent: false }, { status: 202 });
});
