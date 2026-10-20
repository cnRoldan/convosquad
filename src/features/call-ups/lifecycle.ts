import { votingDeadlinePassed } from './closing-time.ts';
import { clubLocalDateTime } from './local-time.ts';

type CallState = { status: 'draft' | 'open' | 'closed' | 'cancelled'; local_date: string; timezone: string; closes_at?: string | null; ends_at?: string | null };

export function callUpHasEnded(call: Pick<CallState, 'ends_at' | 'local_date' | 'timezone'>, now = Date.now()) {
  return call.ends_at ? Date.parse(call.ends_at) <= now : call.local_date < clubLocalDateTime(call.timezone, new Date(now)).date;
}

export function callUpStatusLabel(call: CallState, now = Date.now(), historical = false) {
  if (call.status === 'cancelled') return 'Cancelada';
  if (call.status === 'draft') return 'Borrador';
  if (historical || callUpHasEnded(call, now)) return 'Finalizada';
  return call.status === 'closed' || votingDeadlinePassed(call, now) ? 'Activa · Votación cerrada' : 'Activa · Votación abierta';
}
