import type { RosterCategory } from '../players/categories.ts';

import type { Slot } from './model.ts';

export type FieldCategory = Exclude<RosterCategory, 'backups'>;

// The editor faces the opponent's goal: smaller y = further forward.
// Cluster nearby depths, allowing small drags without changing the formation.
const rowTolerance = 0.10;
const maxRowSpan = 0.16;

export function recognizeFormation(slots: readonly Slot[]) {
  const outfield = slots.filter(slot => slot.id !== 0);
  const invalid = slots.some(slot => !Number.isFinite(slot.x) || !Number.isFinite(slot.y) || slot.x < 0 || slot.x > 1 || slot.y < 0 || slot.y > 1);
  if (invalid || slots.length !== 11 || new Set(slots.map(slot => slot.id)).size !== 11 || !slots.some(slot => slot.id === 0)) {
    return { formation: 'Personalizada', positions: [] as { slotId: number; category: FieldCategory }[] };
  }
  const rows: Slot[][] = [];
  for (const slot of [...outfield].sort((a, b) => b.y - a.y || a.x - b.x || a.id - b.id)) {
    const row = rows.at(-1);
    const mean = row ? row.reduce((sum, point) => sum + point.y, 0) / row.length : 0;
    if (row && Math.abs(mean - slot.y) <= rowTolerance + 1e-9 && row[0]!.y - slot.y <= maxRowSpan) row.push(slot);
    else rows.push([slot]);
  }
  const plausible = rows.length >= 3 && rows.length <= 5 && rows[0]!.length >= 2 && rows[0]!.length <= 5 && rows.at(-1)!.length <= 4;
  const positions: { slotId: number; category: FieldCategory }[] = [{ slotId: 0, category: 'goalkeepers' }];
  for (const slot of outfield) {
    // Defensive depth takes precedence over width: an open centre-back in
    // a back three must never become a wing-back just because x is wide.
    let category: FieldCategory;
    if (slot.y >= 0.70) category = 'centre_backs';
    else if (slot.y < 0.30) category = 'attackers';
    else if (slot.x <= 0.22 || slot.x >= 0.78) category = 'wide_backs';
    else category = 'midfielders';
    positions.push({ slotId: slot.id, category });
  }
  return { formation: plausible ? rows.map(row => row.length).join('-') : 'Personalizada', positions };
}
