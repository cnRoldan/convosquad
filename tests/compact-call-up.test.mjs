import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callUpList, canRespondToPlayer } from '../src/features/call-ups/list-model.ts';
import { jerseyLabel, jerseyAccessibilityLabel } from '../src/features/players/jersey.ts';
import { categories } from '../src/features/players/categories.ts';
const player = (id, category, availability, sortOrder = 0) => ({ id, category, availability, sortOrder, eaId: id, userId: null, jersey: 20 });
const players = [player('g', 'goalkeepers', 'available'), player('c', 'centre_backs', 'unavailable'), player('w', 'wide_backs', 'backup'), player('m', 'midfielders', 'unanswered'), player('a', 'attackers', 'available'), player('b', 'backups', 'unanswered')];
test('Todos conserva orden de las seis categorías y contadores oficiales', () => {
  const model = callUpList(players, 'all');
  assert.deepEqual(model.groups.map(group => group.category), categories);
  assert.equal(model.total, 6); assert.equal(model.visibleTotal, 6);
  assert.deepEqual(model.counts, { available: 2, unavailable: 1, backup: 1, unanswered: 2 });
  for (const group of model.groups) { assert.equal(group.total, 1); assert.equal(Object.values(group.counts).reduce((a, b) => a + b, 0), group.total); }
});
for (const [status, ids] of [['available', ['g', 'a']], ['unavailable', ['c']], ['backup', ['w']], ['unanswered', ['m', 'b']]]) test(`filtro ${status} agrupa exclusivamente coincidencias sin alterar totales`, () => {
  const model = callUpList(players, status);
  assert.deepEqual(model.groups.flatMap(group => group.players.map(row => row.id)), ids);
  assert.equal(model.visibleTotal, ids.length); assert.equal(model.total, 6);
  assert.deepEqual(model.counts, callUpList(players, 'all').counts);
  assert.ok(model.groups.every(group => group.players.length > 0));
});
test('Todos conserva categorías vacías; un filtro sin coincidencias produce estado vacío', () => {
  assert.equal(callUpList([], 'all').groups.length, 6);
  assert.equal(callUpList([], 'available').groups.length, 0);
  assert.equal(callUpList(players.filter(row => row.availability !== 'backup'), 'backup').visibleTotal, 0);
});
test('PRUEBAS y AYUDAS quedan fuera de filtros y contadores incluso ante entradas incorrectas', () => {
  const mixed = [...players, player('trial', 'trials', 'available'), player('aid', 'aids', 'unanswered')];
  assert.deepEqual(callUpList(mixed, 'all'), callUpList(players, 'all'));
  assert.deepEqual(callUpList(mixed, 'unanswered'), callUpList(players, 'unanswered'));
});
test('una respuesta elimina al jugador del filtro anterior y actualiza su categoría y resumen', () => {
  const updated = players.map(row => row.id === 'm' ? { ...row, availability: 'available' } : row);
  const filtered = callUpList(updated, 'unanswered');
  assert.deepEqual(filtered.groups.flatMap(group => group.players.map(row => row.id)), ['b']);
  assert.equal(filtered.counts.available, 3); assert.equal(filtered.counts.unanswered, 1);
  assert.deepEqual(callUpList(updated, 'all').groups.find(group => group.category === 'midfielders').counts, { available: 1, unavailable: 0, backup: 0, unanswered: 0 });
});
test('ordena sin mutar los snapshots y maneja 40 jugadores', () => {
  const rows = Array.from({ length: 40 }, (_, index) => player(String(index), categories[index % 6], 'available', 40 - index));
  const before = structuredClone(rows); const model = callUpList(rows, 'all');
  assert.deepEqual(rows, before); assert.equal(model.visibleTotal, 40);
  assert.ok(model.groups.every(group => group.players.every((row, index) => !index || group.players[index - 1].sortOrder <= row.sortOrder)));
});
test('solo la ficha propia, registrada, en convocatoria abierta y vigente permite respuesta', () => {
  const call = { status: 'open', local_date: '2026-10-14' };
  assert.equal(canRespondToPlayer({ userId: 'own' }, 'own', call, '2026-10-14', false), true);
  for (const owner of [null, 'other']) assert.equal(canRespondToPlayer({ userId: owner }, 'own', call, '2026-10-14', false), false);
  assert.equal(canRespondToPlayer({ userId: 'own' }, undefined, call, '2026-10-14', false), false);
  assert.equal(canRespondToPlayer({ userId: 'own' }, 'own', call, '2026-10-14', true), false);
  assert.equal(canRespondToPlayer({ userId: 'own' }, 'own', call, '2026-10-15', false), false);
  for (const status of ['draft', 'closed', 'cancelled']) assert.equal(canRespondToPlayer({ userId: 'own' }, 'own', { ...call, status }, '2026-10-14', false), false);
});
test('dorsales compactos mantienen la descripción completa accesible', () => {
  for (const jersey of [1, 6, 20, 99]) { assert.equal(jerseyLabel(jersey), `#${jersey}`); assert.equal(jerseyAccessibilityLabel(jersey), `Dorsal ${jersey}`); }
  assert.equal(jerseyLabel(null), 'Sin dorsal'); assert.equal(jerseyAccessibilityLabel(null), 'Sin dorsal');
});
