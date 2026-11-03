import type { Candidate, Lineup } from './model';

export function posterPlayers(lineup: Lineup, candidates: Candidate[]) {
  const players = lineup.slots.flatMap(slot => {
    const player = candidates.find(candidate => candidate.id === slot.playerId);
    if (!player) return [];
    const depth = Math.max(0, Math.min(1, slot.y));
    const fontSize = player.name.length > 17 ? 14 : player.name.length > 12 ? 17 : 21;
    // Approximate Arial Bold glyph advances for compact badges on every platform.
    const nameWidth = 20 + Array.from(player.name).reduce((width, character) => {
      const advance = /[ilIjtfr.,' ]/.test(character) ? 0.32 : /[MW@%]/.test(character) ? 0.9 : /[A-Z0-9]/.test(character) ? 0.7 : 0.59;
      return width + advance * fontSize;
    }, 0);
    return [{ slot, player, fontSize, nameWidth,
      x: 662 + (slot.x - 0.5) * (850 + 300 * depth),
      y: 340 + depth * 710 + (slot.id === 0 ? 24 : 0),
      scale: 0.85 + depth * 0.22,
      halfWidth: Math.max(102, nameWidth) / 2,
    }];
  });
  const sizes = players.map(() => 1);
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!, b = players[j]!;
      const [upper, lower] = a.y <= b.y ? [a, b] : [b, a];
      // The shirt starts at -46 and the name badge ends at 78. Compact
      // nearby players together while keeping their tactical coordinates.
      const horizontal = Math.abs(a.x - b.x) / (a.halfWidth * a.scale + b.halfWidth * b.scale + 6);
      const vertical = Math.abs(a.y - b.y) / (78 * upper.scale + 46 * lower.scale + 6);
      const size = Math.max(0.6, Math.min(1, Math.max(horizontal, vertical)));
      sizes[i] = Math.min(sizes[i]!, size);
      sizes[j] = Math.min(sizes[j]!, size);
    }
  }
  // Keep a minimum size for custom lineups with coincident player positions.
  return players.map((player, i) => ({ ...player, scale: player.scale * sizes[i]! }));
}
