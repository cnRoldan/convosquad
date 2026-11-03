import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preset } from '../src/features/lineups/model.ts';
import { posterPlayers } from '../src/features/lineups/poster-layout.ts';

const candidates = Array.from({ length: 11 }, (_, i) => ({ id: String(i), name: ['Selu', 'Salsinhes', 'juannma_CR24', 'alexinstic23'][i % 4], eligible: true, active: true }));
for (const formation of ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-5-2-one-pivot', '3-5-2-two-pivots', '4-4-2-diamond']) {
  test(`${formation}: exported shirts and name badges have separate bounds`, () => {
    const lineup = { formation, slots: preset(formation).map(slot => ({ ...slot, playerId: String(slot.id) })), bench: [] };
    const players = posterPlayers(lineup, candidates);
    assert.equal(players.length, 11);
    for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) {
      const a = players[i], b = players[j];
      const [upper, lower] = a.y <= b.y ? [a, b] : [b, a];
      const horizontalGap = Math.abs(a.x - b.x) - (a.halfWidth * a.scale + b.halfWidth * b.scale);
      const verticalGap = Math.abs(a.y - b.y) - (78 * upper.scale + 46 * lower.scale);
      assert.ok(horizontalGap > 0 || verticalGap > 0, `Overlap between slots ${a.slot.id} and ${b.slot.id}`);
    }
    assert.deepEqual(lineup.slots, preset(formation).map(slot => ({ ...slot, playerId: String(slot.id) })));
  });
}

test('coincident custom positions keep visible players and missing players are omitted', () => {
  const lineup = { formation: '4-4-2', slots: [0, 1, 2].map(id => ({ id, x: .5, y: .5, playerId: String(id) })), bench: [] };
  const players = posterPlayers(lineup, candidates.slice(0, 2));
  assert.equal(players.length, 2);
  assert.ok(players.every(player => Number.isFinite(player.scale) && player.scale >= .5));
});
