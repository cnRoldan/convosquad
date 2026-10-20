export const availabilityLabels = { available: 'Disponible', unavailable: 'No disponible', backup: 'Backup', unanswered: 'Sin responder' } as const;
export const responseOptions = ['available', 'unavailable', 'backup'] as const;
export function countAvailability(players: readonly { availability: keyof typeof availabilityLabels }[]) {
  const counts = { available: 0, unavailable: 0, backup: 0, unanswered: 0 };
  for (const player of players) counts[player.availability]++;
  return counts;
}
export function callUpErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === '40001') return 'La convocatoria ha cambiado. Actualízala antes de continuar.';
  if (code === 'P0031') return 'El plazo para votar ha terminado. Para reabrir o reiniciar, modifica primero la hora de cierre.';
  if (code === 'P0030') return 'Espera 30 segundos desde tu último voto antes de cambiarlo.';
  if (code === '23514') return 'Revisa los horarios: aviso y cierre deben ser del mismo día de la convocatoria, el aviso anterior al cierre y el cierre anterior o igual al inicio.';
  if (code === '23505') return 'Ya existe una convocatoria para esa fecha local en el club. Elige otro día.';
  if (code === '42501' || code === 'PGRST116') return 'La convocatoria ya no está disponible o no tienes permiso. Actualiza los datos; puede haberse cerrado o cancelado.';
  if (code === '22023') return 'La operación no es válida para el estado o la fecha de esta convocatoria. Actualiza los datos.';
  return 'No se pudo completar la operación. Comprueba tu conexión y vuelve a intentarlo.';
}
