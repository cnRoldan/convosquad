import type { Candidate, Lineup, Slot } from './model.ts';
import type { FieldCategory } from './recognize-formation.ts';

export type PositionExperience = { player_id: string; category: FieldCategory; appearances: number };

// Match the roster's position groups using pitch geometry, not slot numbers:
// the same slot ID may represent a different role in another formation.
export function slotCategory(formation: Lineup['formation'], slot: Slot): FieldCategory {
  if (slot.id === 0) return 'goalkeepers';
  if (slot.y >= .65) return formation !== '3-5-2' && (slot.x <= .26 || slot.x >= .74) ? 'wide_backs' : 'centre_backs';
  if (slot.y < .30) return 'attackers';
  if (slot.x <= .22 || slot.x >= .78) return 'wide_backs';
  return 'midfielders';
}

export function suggestPlayers(lineup: Lineup, slotId: number, candidates: Candidate[], experience: PositionExperience[]) {
  const target = lineup.slots.find(slot => slot.id === slotId);
  if (!target) return [];
  const category = slotCategory(lineup.formation, target);
  const selectable = new Set([...lineup.bench, ...lineup.slots.flatMap(slot => slot.playerId ? [slot.playerId] : [])]);
  return candidates.filter(player => player.active && player.id !== target.playerId && selectable.has(player.id)).map(player => ({
    player,
    rosterMatch: player.category === category,
    appearances: experience.filter(row => row.player_id === player.id && row.category === category).reduce((sum, row) => sum + row.appearances, 0),
    onBench: lineup.bench.includes(player.id),
  })).filter(item => item.rosterMatch || item.appearances > 0)
    .sort((a, b) => Number(b.rosterMatch) - Number(a.rosterMatch) || b.appearances - a.appearances || Number(b.onBench) - Number(a.onBench) || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id));
}
