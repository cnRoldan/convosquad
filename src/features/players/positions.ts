import type { Enums } from '../../types/database.ts';

export const positions = ['POR', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MCO', 'MI', 'MD', 'EI', 'ED', 'DC'] as const satisfies readonly Enums<'player_position'>[];
export type PlayerPosition = typeof positions[number];
export const positionLabels: Record<PlayerPosition, string> = {
  POR: 'Portero', DFC: 'Defensa central', LI: 'Lateral izquierdo', LD: 'Lateral derecho',
  MCD: 'Mediocentro defensivo', MC: 'Mediocentro', MCO: 'Mediocentro ofensivo',
  MI: 'Medio izquierdo', MD: 'Medio derecho', EI: 'Extremo izquierdo', ED: 'Extremo derecho', DC: 'Delantero centro',
};
export function isPosition(value: string): value is PlayerPosition {
  return positions.some((position) => position === value);
}
