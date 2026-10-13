export function formatMatchDate(date: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Madrid',
  }).format(new Date(date));
}
