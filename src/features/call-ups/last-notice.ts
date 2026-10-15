import { clubLocalTimeToInstant } from './local-time.ts';

export function lastNoticeInstant(enabled: boolean, date: string, time: string, timezone: string, startsAt: string) {
  if (!enabled) return null;
  const instant = clubLocalTimeToInstant(date.trim(), time.trim(), timezone);
  if (Date.parse(instant) >= Date.parse(startsAt)) throw new Error('El último aviso debe ser anterior a la hora de la convocatoria.');
  return instant;
}
export function responseCooldown(respondedAt: string | null | undefined, now = Date.now()) {
  if (!respondedAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(respondedAt) + 30_000 - now) / 1000)) || 0;
}
