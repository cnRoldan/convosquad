export const availabilityLabels = { available: 'Disponible', unavailable: 'No disponible', backup: 'Backup', unanswered: 'Sin responder' } as const;
export const responseOptions = ['available', 'unavailable', 'backup'] as const;
export const callStatusLabels = { draft: 'Borrador', open: 'Abierta', closed: 'Cerrada', cancelled: 'Cancelada' } as const;
export function countAvailability(players: readonly { availability: keyof typeof availabilityLabels }[]) {
  const counts = { available: 0, unavailable: 0, backup: 0, unanswered: 0 };
  for (const player of players) counts[player.availability]++;
  return counts;
}
export function callUpErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code === '23505') return 'Ya existe una convocatoria para esa fecha local en el club. Elige otro día.';
  if (code === '42501' || code === 'PGRST116') return 'La convocatoria ya no está disponible o no tienes permiso. Actualiza los datos; puede haberse cerrado o cancelado.';
  return 'No se pudo completar la operación. Comprueba tu conexión y vuelve a intentarlo.';
}
