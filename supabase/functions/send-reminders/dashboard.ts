// Generado con node scripts/export-reminder-dashboard.mjs. Edita los archivos originales.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const copy = {
 es: { club_join_request:"Nueva solicitud de acceso", joinRequestBody:"quiere unirse a", reviewRequests:"Revisa las solicitudes pendientes.", club_approved:"Solicitud aceptada", admissionBody:"te ha admitido en su club. Ya puedes acceder a sus convocatorias.", evaluation:'Hora de valorar a los jugadores', evaluationBody:'Ya puedes valorar el desempeño de los jugadores de esta convocatoria. Abre ConvoSquad para puntuar.', cancelled:'Convocatoria cancelada', vote:'Nueva respuesta en tu convocatoria', published:'Nueva convocatoria', reminder:'Último aviso para votar', pending:'Confirma tu disponibilidad', cancelledBody:'Tu club ha cancelado esta convocatoria. Ya no se puede votar.', publishedBody:'Responde Disponible, No disponible o Backup desde este aviso.', readOnly:'Tu club tiene una convocatoria. Abre ConvoSquad para consultarla.', reminderBody:'Aún no has respondido. Indica si estás disponible, no disponible o backup.', pendingBody:'Hay una convocatoria pendiente de tu respuesta. Abre ConvoSquad para responder.', available:'Disponible', unavailable:'No disponible', backup:'Backup', player:'Un jugador', voted:'ha votado' },
 en: { club_join_request:"New join request", joinRequestBody:"wants to join", reviewRequests:"Review the pending requests.", club_approved:"Request accepted", admissionBody:"has accepted you into the club. You can now access its call-ups.", evaluation:'Time to rate the players', evaluationBody:'You can now rate the players in this call-up. Open ConvoSquad to give your ratings.', cancelled:'Call-up cancelled', vote:'New response to your call-up', published:'New call-up', reminder:'Last reminder to vote', pending:'Confirm your availability', cancelledBody:'Your club has cancelled this call-up. Voting is closed.', publishedBody:'Choose Available, Unavailable or Backup from this notification.', readOnly:'Your club has a call-up. Open ConvoSquad to view it.', reminderBody:'You have not responded yet. Choose available, unavailable or backup.', pendingBody:'A call-up is awaiting your response. Open ConvoSquad to respond.', available:'Available', unavailable:'Unavailable', backup:'Backup', player:'A player', voted:'voted' },
 de: { club_join_request:"Neue Beitrittsanfrage", joinRequestBody:"möchte folgendem Verein beitreten:", reviewRequests:"Prüfe die ausstehenden Anfragen.", club_approved:"Anfrage angenommen", admissionBody:"hat dich in den Verein aufgenommen. Du kannst jetzt auf die Aufgebote zugreifen.", evaluation:'Zeit für die Spielerbewertung', evaluationBody:'Du kannst jetzt die Spieler dieses Aufgebots bewerten. Öffne ConvoSquad, um Bewertungen abzugeben.', cancelled:'Aufgebot abgesagt', vote:'Neue Antwort auf dein Aufgebot', published:'Neues Aufgebot', reminder:'Letzte Erinnerung zur Abstimmung', pending:'Bestätige deine Verfügbarkeit', cancelledBody:'Dein Verein hat dieses Aufgebot abgesagt. Eine Abstimmung ist nicht mehr möglich.', publishedBody:'Wähle direkt in dieser Benachrichtigung Verfügbar, Nicht verfügbar oder Ersatz.', readOnly:'Dein Verein hat ein Aufgebot erstellt. Öffne ConvoSquad, um es anzusehen.', reminderBody:'Du hast noch nicht geantwortet. Wähle Verfügbar, Nicht verfügbar oder Ersatz.', pendingBody:'Ein Aufgebot wartet auf deine Antwort. Öffne ConvoSquad, um zu antworten.', available:'Verfügbar', unavailable:'Nicht verfügbar', backup:'Ersatz', player:'Ein Spieler', voted:'hat abgestimmt' },
 fr: { club_join_request:"Nouvelle demande d’adhésion", joinRequestBody:"souhaite rejoindre", reviewRequests:"Consulte les demandes en attente.", club_approved:"Demande acceptée", admissionBody:"vous a admis dans son club. Vous pouvez maintenant accéder à ses convocations.", evaluation:'Il est temps d’évaluer les joueurs', evaluationBody:'Tu peux maintenant évaluer les joueurs de cette convocation. Ouvre ConvoSquad pour les noter.', cancelled:'Convocation annulée', vote:'Nouvelle réponse à votre convocation', published:'Nouvelle convocation', reminder:'Dernier rappel pour voter', pending:'Confirmez votre disponibilité', cancelledBody:'Votre club a annulé cette convocation. Le vote est fermé.', publishedBody:'Choisissez Disponible, Indisponible ou Remplaçant depuis cette notification.', readOnly:'Votre club a une convocation. Ouvrez ConvoSquad pour la consulter.', reminderBody:'Vous n’avez pas encore répondu. Choisissez Disponible, Indisponible ou Remplaçant.', pendingBody:'Une convocation attend votre réponse. Ouvrez ConvoSquad pour répondre.', available:'Disponible', unavailable:'Indisponible', backup:'Remplaçant', player:'Un joueur', voted:'a voté' },
} as const;
export function pushCopy(language: string | null | undefined) { return copy[language === 'en' || language === 'de' || language === 'fr' ? language : 'es']; }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type PushEventInput = { clubId: string; callUpId: string | null; eventKey: string; kind: 'published' | 'pending' | 'reminder' | 'vote' | 'cancelled' | 'evaluation' | 'club_approved' | 'club_join_request'; clubName?: string | null; actorEaId?: string | null; availability?: string | null };
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
export function pushMessage(event: PushEventInput, token: string, recipientUserId?: string | null, canVote = true, language = 'es') {
  const text = pushCopy(language);
  if (event.kind === 'club_join_request') return {
    to: token, title: text.club_join_request,
    body: `${event.actorEaId?.slice(0, 100) ?? text.player} ${text.joinRequestBody} ${event.clubName?.slice(0, 100) ?? 'ConvoSquad'}. ${text.reviewRequests}`,
    channelId: 'call-ups', sound: 'default',
    data: { type: 'club_join_request', clubId: event.clubId, ...(recipientUserId ? { userId: recipientUserId } : {}) },
  };
  if (event.kind === 'club_approved') return {
    to: token, title: text.club_approved, body: `${event.clubName?.slice(0, 100) ?? 'ConvoSquad'} ${text.admissionBody}`,
    channelId: 'call-ups', sound: 'default',
    data: { type: 'club_approved', clubId: event.clubId, ...(recipientUserId ? { userId: recipientUserId } : {}) },
  };
  return {
    to: token, title: text[event.kind],
    body: event.kind === 'evaluation' ? text.evaluationBody : event.kind === 'cancelled' ? text.cancelledBody : event.kind === 'vote'
      ? `${event.actorEaId?.slice(0, 100) ?? text.player} ${text.voted}: ${event.availability === 'available' ? text.available : event.availability === 'unavailable' ? text.unavailable : text.backup}.`
      : event.kind === 'published' ? (canVote ? text.publishedBody : text.readOnly) : event.kind === 'reminder' ? text.reminderBody : text.pendingBody,
    channelId: 'call-ups', sound: 'default', ...(event.kind !== 'cancelled' && event.kind !== 'evaluation' && canVote ? { categoryId: 'call_up_availability' } : {}),
    data: { type: 'call_up', clubId: event.clubId, callUpId: event.callUpId, ...(recipientUserId ? { userId: recipientUserId } : {}), ...(event.kind === 'cancelled' ? { kind: 'cancelled' } : {}) },
  };
}

type Event = { id: string; club_id: string; call_up_id: string | null; event_key: string; kind?: 'published' | 'pending' | 'reminder' | 'vote' | 'cancelled' | 'evaluation' | 'club_approved' | 'club_join_request'; club_name_snapshot?: string | null; actor_ea_id?: string | null; vote_availability?: string | null };
type Delivery = { id: string; token_snapshot: string; user_id?: string | null; can_vote?: boolean; preferred_language?: string | null };
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
      const response = await submit(deliveries.map(delivery => pushMessage({ clubId: event.club_id, callUpId: event.call_up_id, eventKey: event.event_key, kind: event.kind ?? 'reminder', actorEaId: event.actor_ea_id ?? null, availability: event.vote_availability ?? null, clubName: event.club_name_snapshot ?? null }, delivery.token_snapshot, delivery.user_id, delivery.can_vote ?? true, delivery.preferred_language ?? 'es')));
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
