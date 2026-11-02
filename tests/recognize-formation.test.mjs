import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preset } from '../src/features/lineups/model.ts';
import { recognizeFormation } from '../src/features/lineups/recognize-formation.ts';

test('recognizes every preset independently of the stored formation and array order', () => {
  for (const name of ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2']) {
    const result = recognizeFormation(preset(name).reverse());
    assert.equal(result.formation, name);
    assert.equal(result.positions.length, 11);
    assert.equal(result.positions.find(p => p.slotId === 0).category, 'goalkeepers');
  }
});
test('small positional adjustments preserve the line while a tactical move changes it', () => {
  const slots = preset('3-5-2');
  assert.equal(recognizeFormation(slots.map(s => s.id === 4 ? {...s, y: s.y + 0.04} : s)).formation, '3-5-2');
  assert.equal(recognizeFormation(slots.map(s => s.id === 4 ? {...s, y: 0.62} : s)).formation, '4-4-2');
});
test('recognizes a custom diamond without a predefined preset', () => {
  const slots = preset('4-4-2');
  [0.53, 0.43, 0.43, 0.30].forEach((y, i) => { slots[5 + i].y = y; });
  // Distinct lines need sufficient depth separation for tolerance.
  slots[5].y = 0.56;
  slots[6].y = slots[7].y = 0.41;
  slots[8].y = 0.28;
  assert.equal(recognizeFormation(slots).formation, '4-1-2-1-2');
});
test('uses app categories, retaining wide defenders and grouping all forwards', () => {
  const category = (slots, id) => recognizeFormation(slots).positions.find(p => p.slotId === id).category;
  const slots = preset('3-5-2');
  slots[1].x = 0.08;
  slots[3].x = 0.92;
  assert.equal(category(slots, 1), 'centre_backs');
  assert.equal(category(slots, 3), 'centre_backs');
  assert.equal(category(slots, 4), 'wide_backs');
  assert.equal(category(slots, 8), 'wide_backs');
  assert.equal(category(slots, 6), 'midfielders');
  assert.equal(category(slots, 9), 'attackers');
  const advanced = preset('4-2-3-1');
  for (const slot of advanced.filter(s => s.y < 0.40)) assert.equal(category(advanced, slot.id), 'attackers');
  assert.equal(recognizeFormation(slots).formation, '3-5-2');
});
test('does not invent a formation for invalid, incomplete or unstructured layouts', () => {
  assert.equal(recognizeFormation(preset('4-3-3').slice(1)).formation, 'Personalizada');
  assert.equal(recognizeFormation(preset('4-3-3').map(s => ({...s, y: 0.4}))).formation, 'Personalizada');
  assert.equal(recognizeFormation(preset('4-3-3').map(s => s.id === 1 ? {...s, y: NaN} : s)).formation, 'Personalizada');
});
