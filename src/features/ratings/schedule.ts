import { clubLocalTimeToInstant } from '../call-ups/local-time.ts';

export function evaluationInstant(enabled: boolean, date: string, time: string, timezone: string, startsAt: string): string | null {
  if (!enabled) return null;
  let instant = clubLocalTimeToInstant(date.trim(), time.trim(), timezone);
  if (Date.parse(instant) < Date.parse(startsAt)) {
    const next = new Date(`${date.trim()}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    instant = clubLocalTimeToInstant(next.toISOString().slice(0, 10), time.trim(), timezone);
  }
  return instant;
}
