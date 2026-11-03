import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeIncidents, lineupIncidents } from '../src/features/incidents/model.ts';

const start = Date.parse('2026-11-03T12:00:00Z');
const week = 7 * 24 * 60 * 60 * 1000;
const incident = (id, player, created = start) => ({ id, player_id: player, created_at: new Date(created).toISOString(), expires_at: new Date(created + week).toISOString() });
test('incidents are active from registration until exactly 168 hours later', () => {
  const rows = [incident('a', 'player')];
  assert.equal(activeIncidents(rows, start - 1).length, 0);
  assert.equal(activeIncidents(rows, start).length, 1);
  assert.equal(activeIncidents(rows, start + week - 1).length, 1);
  assert.equal(activeIncidents(rows, start + week).length, 0);
  assert.equal(rows.length, 1); // Expiry does not delete the historical record.
});
test('only current starting players activate consultation and publication warnings', () => {
  const rows = [incident('starting', 'a'), incident('benched', 'b'), incident('archived', 'a', start - week), incident('deleted', null)];
  const lineup = { slots: [{ id: 0, playerId: 'a' }], bench: ['b'] };
  assert.deepEqual(lineupIncidents(lineup, rows, start).map(row => row.id), ['starting']);
  assert.deepEqual(lineupIncidents(null, rows, start), []);
  assert.deepEqual(lineupIncidents({ slots: [], bench: ['a', 'b'] }, rows, start), []);
});
