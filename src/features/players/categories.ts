import type { Enums } from '../../types/database.ts';
import type { PlayerPosition } from './positions.ts';

export const categories = ['goalkeepers', 'centre_backs', 'wide_backs', 'midfielders', 'attackers', 'backups'] as const satisfies readonly Enums<'roster_category'>[];
export type RosterCategory = typeof categories[number];
export const categoryLabels: Record<RosterCategory, string> = {
  goalkeepers: 'PORTEROS', centre_backs: 'CENTRALES', wide_backs: 'LATERALES / CARRILEROS',
  midfielders: 'CENTROCAMPISTAS', attackers: 'ATACANTES', backups: 'BACKUPS',
};
export const legacyCategory: Record<PlayerPosition, RosterCategory> = {
  POR: 'goalkeepers', DFC: 'centre_backs', LI: 'wide_backs', LD: 'wide_backs', MCD: 'midfielders', MC: 'midfielders',
  MCO: 'midfielders', MI: 'midfielders', MD: 'midfielders', EI: 'attackers', ED: 'attackers', DC: 'attackers',
};
export function isCategory(value: string): value is RosterCategory { return categories.some(category => category === value); }
export function compareRoster(a: { category: RosterCategory; sortOrder: number; id: string }, b: { category: RosterCategory; sortOrder: number; id: string }) {
  return categories.indexOf(a.category) - categories.indexOf(b.category) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);
}
export function moveItem(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return null;
  const copy = [...ids];
  const neighbour = copy[next];
  if (!neighbour) return null;
  copy[next] = id; copy[index] = neighbour;
  return copy;
}
