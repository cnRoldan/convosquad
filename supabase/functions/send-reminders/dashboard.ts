// Generado con node scripts/export-reminder-dashboard.mjs. Edita los archivos originales.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushEventInput = { clubId: string; callUpId: string; eventKey: string; kind: 'published' | 'pending' | 'reminder' | 'vote' | 'cancelled'; actorEaId?: string | null; availability?: string | null };
export function parsePushEvent(data: unknown): PushEventInput | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (Object.keys(data).some(key => !['clubId','callUpId','eventKey','kind'].includes(key))) return null;
  if (!('clubId' in data) || typeof data.clubId !== 'string' || !uuid.test(data.clubId) || !('callUpId' in data) || typeof data.callUpId !== 'string' || !uuid.test(data.callUpId)) return null;
  if (!('eventKey' in data) || typeof data.eventKey !== 'string' || !data.eventKey.trim() || data.eventKey.length > 200 || !('kind' in data) || (data.kind !== 'published' && data.kind !== 'pending' && data.kind !== 'reminder')) return null;
  return { clubId: data.clubId.toLowerCase(), callUpId: data.callUpId.toLowerCase(), eventKey: data.eventKey, kind: data.kind };
}
export function authorizedWorker(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}
export function pushMessage(event: PushEventInput, token: string, recipientUserId?: string | null, canVote = true) {
  return {
    to: token, title: event.kind === 'cancelled' ? 'Convocatoria cancelada' : event.kind === 'vote' ? 'Nueva respuesta en tu convocatoria' : event.kind === 'published' ? 'Nueva convocatoria' : event.kind === 'reminder' ? 'Último aviso para votar' : 'Confirma tu disponibilidad',
    body: event.kind === 'cancelled' ? 'Tu club ha cancelado esta convocatoria. Ya no se puede votar.' : event.kind === 'vote' ? `${event.actorEaId?.slice(0, 100) ?? 'Un jugador'} ha votado: ${event.availability === 'available' ? 'Disponible' : event.availability === 'unavailable' ? 'No disponible' : 'Backup'}.` : event.kind === 'published' ? (canVote ? 'Responde Disponible, No disponible o Backup desde este aviso.' : 'Tu club tiene una convocatoria. Abre ConvoSquad para consultarla.') : event.kind === 'reminder' ? 'Aún no has respondido. Indica si estás disponible, no disponible o backup.' : 'Hay una convocatoria pendiente de tu respuesta. Abre ConvoSquad para responder.',
    channelId: 'call-ups', sound: 'default', ...(event.kind !== 'cancelled' && canVote ? { categoryId: 'call-up-availability' } : {}),
    data: { type: 'call_up', clubId: event.clubId, callUpId: event.callUpId, ...(recipientUserId ? { userId: recipientUserId } : {}), ...(event.kind === 'cancelled' ? { kind: 'cancelled' } : {}) },
  };
}

type Event = { id: string; club_id: string; call_up_id: string; event_key: string; kind?: 'published' | 'pending' | 'reminder' | 'vote' | 'cancelled'; actor_ea_id?: string | null; vote_availability?: string | null };
type Delivery = { id: string; token_snapshot: string; user_id?: string | null; can_vote?: boolean };
type State = 'sent' | 'failed' | 'unknown';
export type ReminderStore = {
  prepare: () => Promise<void>;
  events: () => Promise<Event[]>;
  claim: (id: string) => Promise<Delivery[]>;
  finish: (id: string, state: State, ticketId: string | null) => Promise<void>;
};

export async function dispatchReminders(store: ReminderStore, submit: (messages: ReturnType<typeof pushMessage>[]) => Promise<unknown>) {
  await store.prepare();
  const counts = { attempted: 0, accepted: 0, failed: 0, unknown: 0 };
  for (const event of await store.events()) {
    const deliveries = await store.claim(event.id);
    if (!deliveries.length) continue;
    counts.attempted += deliveries.length;
    let tickets: unknown[] = [];
    try {
      const response = await submit(deliveries.map(delivery => pushMessage({ clubId: event.club_id, callUpId: event.call_up_id, eventKey: event.event_key, kind: event.kind ?? 'reminder', actorEaId: event.actor_ea_id ?? null, availability: event.vote_availability ?? null }, delivery.token_snapshot, delivery.user_id, delivery.can_vote ?? true)));
      if (response && typeof response === 'object' && 'data' in response && Array.isArray(response.data) && response.data.length === deliveries.length) tickets = response.data;
    } catch { /* Una respuesta ambigua nunca se reenvía automáticamente. */ }
    for (const [index, delivery] of deliveries.entries()) {
      const ticket = tickets[index];
      let state: State = 'unknown'; let ticketId: string | null = null;
      if (ticket && typeof ticket === 'object' && 'status' in ticket) {
        if (ticket.status === 'ok' && 'id' in ticket && typeof ticket.id === 'string' && ticket.id.length > 0 && ticket.id.length <= 200) { state = 'sent'; ticketId = ticket.id; }
        else if (ticket.status === 'error') state = 'failed';
      }
      await store.finish(delivery.id, state, ticketId);
      if (state === 'sent') counts.accepted++;
      else counts[state]++;
    }
  }
  return counts;
}

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
      const { data, error } = await client.from('push_events').select('id,club_id,call_up_id,event_key,kind,actor_ea_id,vote_availability,push_deliveries!inner(state)')
        .eq('push_deliveries.state', 'pending').order('created_at').limit(10);
      if (error || !data) throw new Error('No se pudo consultar la cola');
      return data;
    },
    async claim(id) {
      const { data, error } = await client.rpc('claim_push_deliveries', { p_event_id: id, p_limit: 100 });
      if (error || !data) throw new Error('No se pudieron reservar avisos');
      return data;
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
