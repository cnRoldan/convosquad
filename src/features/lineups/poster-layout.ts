import type { Candidate, Lineup } from './model';
import { posterPoint } from './poster-geometry.ts';

export function posterPlayers(lineup: Lineup, candidates: Candidate[]) {
  const players = lineup.slots.flatMap(slot => {
    const player = candidates.find(candidate => candidate.id === slot.playerId);
    if (!player) return [];
    const depth = Math.max(0, Math.min(1, slot.y));
    const fontSize = player.name.length > 17 ? 18 : player.name.length > 12 ? 22 : 26;
    // Approximate Arial Bold glyph advances for compact badges on every platform.
    const nameWidth = 20 + Array.from(player.name).reduce((width, character) => {
      const advance = /[ilIjtfr.,' ]/.test(character) ? 0.32 : /[MW@%]/.test(character) ? 0.9 : /[A-Z0-9]/.test(character) ? 0.7 : 0.59;
      return width + advance * fontSize;
    }, 0);
    return [{ slot, player, fontSize, nameWidth,
      ...posterPoint(slot.x, depth),
      halfWidth: Math.max(102, nameWidth) / 2,
    }];
  });
  // One scale for the entire team. Per-player perspective/collision scaling
  // made neighbours look tactically closer and gave shirts different sizes.
  let scale = 1.05;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!, b = players[j]!;
      // Keep a six-pixel gap between badges/shirts without moving any slot.
      const horizontal = (Math.abs(a.x - b.x) - 6) / (a.halfWidth + b.halfWidth);
      const vertical = (Math.abs(a.y - b.y) - 6) / (78 + 46);
      scale = Math.min(scale, Math.max(horizontal, vertical));
    }
  }
  // Truly coincident custom positions remain coincident; keep shirts legible.
  return players.map(player => ({ ...player, scale: Math.max(0.5, scale) }));
}
