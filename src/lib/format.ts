export function formatMatchDate(date: string, timeZone = 'Europe/Madrid'): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long', timeStyle: 'short', timeZone,
  }).format(new Date(date));
}
