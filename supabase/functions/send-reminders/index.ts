import { createClient } from '@supabase/supabase-js';
import { authorizedWorker } from '../_shared/push-event.ts';
import { dispatchReminders, type ReminderStore } from '../_shared/reminder-worker.ts';

Deno.serve(async request => {
  if (!authorizedWorker(request.headers.get('authorization'), Deno.env.get('PUSH_WORKER_SECRET'))) return new Response('No autorizado', { status: 401 });
  if (request.method !== 'POST') return new Response('Método no permitido', { status: 405 });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response('Configuración de servidor incompleta', { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const store: ReminderStore = {
    async prepare() {
      const { error } = await client.rpc('prepare_due_call_up_reminders', { p_limit: 100 });
      if (error) throw new Error('No se pudieron preparar avisos');
    },
    async events() {
      const { data, error } = await client.from('push_events').select('id,club_id,call_up_id,event_key,kind,club_name_snapshot,actor_ea_id,vote_availability,push_deliveries!inner(state)')
        .eq('push_deliveries.state', 'pending').order('created_at').limit(10);
      if (error || !data) throw new Error('No se pudo consultar la cola');
      return data;
    },
    async claim(id) {
      const { data, error } = await client.rpc('claim_push_deliveries', { p_event_id: id, p_limit: 100 });
      if (error || !data) throw new Error('No se pudieron reservar avisos');
      const deliveries = data as Awaited<ReturnType<ReminderStore['claim']>>;
      const ids = [...new Set(deliveries.flatMap(delivery => delivery.user_id ? [delivery.user_id] : []))];
      const { data: profiles } = await client.from('profiles').select('id,preferred_language').in('id', ids);
      const languages = new Map<string, string | null>((profiles ?? []).map((profile: { id: string; preferred_language: string | null }) => [profile.id, profile.preferred_language]));
      return deliveries.map(delivery => ({ ...delivery, preferred_language: delivery.user_id ? languages.get(delivery.user_id) ?? 'es' : 'es' }));
    },
    async finish(id, state, ticketId) {
      const { error } = await client.rpc('finish_push_delivery', { p_delivery_id: id, p_state: state, p_ticket_id: ticketId });
      if (error) throw new Error('No se pudo registrar el resultado');
    },
  };
  try {
    const counts = await dispatchReminders(store, async messages => {
      const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify(messages), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Respuesta de Expo no confirmada');
      return response.json();
    });
    return Response.json({ ...counts, delivered: false });
  } catch { return new Response('No se pudo completar el procesamiento de avisos', { status: 503 }); }
});
