import { t } from '../i18n/runtime.ts';
export const defaultClubTimezone = 'Europe/Madrid';
export const clubTimezones = [
  { value: 'Europe/Madrid', label: 'Madrid · Península y Baleares' },
  { value: 'Atlantic/Canary', label: 'Islas Canarias' },
  { value: 'Europe/London', label: 'Londres · Reino Unido' },
  { value: 'Europe/Dublin', label: 'Dublín · Irlanda' },
  { value: 'Europe/Lisbon', label: 'Lisboa · Portugal' },
  { value: 'Europe/Paris', label: 'París · Francia' },
  { value: 'Europe/Berlin', label: 'Berlín · Alemania' },
  { value: 'Europe/Rome', label: 'Roma · Italia' },
  { value: 'Europe/Athens', label: 'Atenas · Grecia' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires · Argentina' },
  { value: 'America/Montevideo', label: 'Montevideo · Uruguay' },
  { value: 'America/Sao_Paulo', label: 'São Paulo · Brasil' },
  { value: 'America/Santiago', label: 'Santiago · Chile' },
  { value: 'America/Bogota', label: 'Bogotá · Colombia' },
  { value: 'America/Lima', label: 'Lima · Perú' },
  { value: 'America/Caracas', label: 'Caracas · Venezuela' },
  { value: 'America/Mexico_City', label: 'Ciudad de México' },
  { value: 'America/New_York', label: 'Nueva York · Estados Unidos' },
  { value: 'America/Chicago', label: 'Chicago · Estados Unidos' },
  { value: 'America/Los_Angeles', label: 'Los Ángeles · Estados Unidos' },
  { value: 'Asia/Dubai', label: 'Dubái · Emiratos Árabes' },
  { value: 'Asia/Tokyo', label: 'Tokio · Japón' },
  { value: 'Australia/Sydney', label: 'Sídney · Australia' },
  { value: 'UTC', label: 'Hora universal' },
] as const;
export function isClubTimezone(value: string): boolean {
  return clubTimezones.some(zone => zone.value === value);
}
export function timezoneLabel(zone: { value: string; label: string }, date = new Date()): string {
  const offset = new Intl.DateTimeFormat('en-GB', { timeZone: zone.value, timeZoneName: 'longOffset' })
    .formatToParts(date).find(part => part.type === 'timeZoneName')?.value?.replace(/^GMT$/, 'GMT+00:00');
  return offset ? `${t(zone.label)} (${offset})` : t(zone.label);
}
