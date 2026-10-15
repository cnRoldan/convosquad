import { pushMessage } from './push-event.ts';

type Event = { id: string; club_id: string; call_up_id: string; event_key: string };
type Delivery = { id: string; token_snapshot: string };
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
      const response = await submit(deliveries.map(delivery => pushMessage({ clubId: event.club_id, callUpId: event.call_up_id, eventKey: event.event_key, kind: 'reminder' }, delivery.token_snapshot)));
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
