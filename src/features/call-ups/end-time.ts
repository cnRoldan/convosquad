import { clubLocalTimeToInstant } from './local-time.ts';

export function endInstant(date: string, time: string, timezone: string, startsAt: string): string {
  let end = clubLocalTimeToInstant(date.trim(), time.trim(), timezone);
  if (Date.parse(end) <= Date.parse(startsAt)) {
    const next = new Date(`${date.trim()}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    end = clubLocalTimeToInstant(next.toISOString().slice(0, 10), time.trim(), timezone);
  }
  return end;
}
