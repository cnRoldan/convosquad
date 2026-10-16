import { clubLocalTimeToInstant } from './local-time.ts';

export function closingInstant(enabled: boolean, date: string, time: string, timezone: string, startsAt: string, noticeAt: string | null) {
  if (!enabled) return null;
  const instant = clubLocalTimeToInstant(date.trim(), time.trim(), timezone);
  if (Date.parse(instant) > Date.parse(startsAt)) throw new Error('El cierre de votación debe ser anterior o igual a la hora de la convocatoria.');
  if (noticeAt && Date.parse(noticeAt) >= Date.parse(instant)) throw new Error('El último aviso debe ser anterior al cierre de votación.');
  return instant;
}

export function votingDeadlinePassed(call: { closes_at?: string | null }, now = Date.now()) {
  return Boolean(call.closes_at && Date.parse(call.closes_at) <= now);
}
