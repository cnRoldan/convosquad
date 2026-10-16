import { intlLocale } from '../features/i18n/runtime.ts';
export function formatMatchDate(date: string, timeZone = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat(intlLocale(), {
    dateStyle: 'long', timeStyle: 'short', timeZone,
  }).format(new Date(date));
}
