import type { PlayerPosition } from '../players/positions.ts';
import type { Slot } from './model.ts';

// The editor faces the opponent's goal: smaller y = further forward.
// Cluster nearby depths, allowing small drags without changing the formation.
const rowTolerance = 0.10;
const maxRowSpan = 0.16;

export function recognizeFormation(slots: readonly Slot[]) {
  const outfield = slots.filter(slot => slot.id !== 0);
  const invalid = slots.some(slot => !Number.isFinite(slot.x) || !Number.isFinite(slot.y) || slot.x < 0 || slot.x > 1 || slot.y < 0 || slot.y > 1);
  if (invalid || slots.length !== 11 || new Set(slots.map(slot => slot.id)).size !== 11 || !slots.some(slot => slot.id === 0)) {
    return { formation: 'Personalizada', positions: [] as { slotId: number; position: PlayerPosition }[] };
  }
  const rows: Slot[][] = [];
  for (const slot of [...outfield].sort((a, b) => b.y - a.y || a.x - b.x || a.id - b.id)) {
    const row = rows.at(-1);
    const mean = row ? row.reduce((sum, point) => sum + point.y, 0) / row.length : 0;
    if (row && Math.abs(mean - slot.y) <= rowTolerance + 1e-9 && row[0]!.y - slot.y <= maxRowSpan) row.push(slot);
    else rows.push([slot]);
  }
  const plausible = rows.length >= 3 && rows.length <= 5 && rows[0]!.length >= 2 && rows[0]!.length <= 5 && rows.at(-1)!.length <= 4;
  const positions: { slotId: number; position: PlayerPosition }[] = [{ slotId: 0, position: 'POR' }];
  rows.forEach((row, index) => {
    for (const slot of row) {
      const wide = slot.x <= 0.28 ? 'left' : slot.x >= 0.72 ? 'right' : null;
      let position: PlayerPosition;
      if (index === 0 && slot.y >= 0.58) {
        position = row.length >= 4 && wide ? (wide === 'left' ? 'LI' : 'LD') : 'DFC';
      } else if (slot.y < 0.28) {
        position = slot.x < 0.33 ? 'EI' : slot.x > 0.67 ? 'ED' : 'DC';
      } else if (wide && (slot.x <= 0.22 || slot.x >= 0.78)) {
        position = wide === 'left' ? 'MI' : 'MD';
      } else if (slot.y >= 0.58 || (rows.length >= 4 && index === 1 && slot.y >= 0.48)) {
        position = 'MCD';
      } else {
        position = slot.y < 0.40 ? 'MCO' : 'MC';
      }
      positions.push({ slotId: slot.id, position });
    }
  });
  return { formation: plausible ? rows.map(row => row.length).join('-') : 'Personalizada', positions };
}
