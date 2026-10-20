import { votingDeadlinePassed } from './closing-time.ts';
import { clubLocalDateTime } from './local-time.ts';

type CallState = { status: 'draft' | 'open' | 'closed' | 'cancelled'; local_date: string; timezone: string; closes_at?: string | null };

export function callUpStatusLabel(call: CallState, now = Date.now(), historical = false) {
  if (call.status === 'cancelled') return 'Cancelada';
  if (call.status === 'draft') return 'Borrador';
  if (historical || call.local_date < clubLocalDateTime(call.timezone, new Date(now)).date) return 'Finalizada';
  return call.status === 'closed' || votingDeadlinePassed(call, now) ? 'Activa · Votación cerrada' : 'Activa · Votación abierta';
}
