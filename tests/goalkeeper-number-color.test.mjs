import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goalkeeperNumberColor } from '../src/features/lineups/kit-colors.ts';
test('light shirts have black numbers and dark shirts have white numbers', () => {
  for (const color of ['#FFFFFF', '#FFFF00', '#F4A83A', '#B3FF61']) assert.equal(goalkeeperNumberColor(color), '#000000');
  for (const color of ['#000000', '#4C000B', '#000080', '#555555']) assert.equal(goalkeeperNumberColor(color), '#FFFFFF');
});
test('uses perceptual luminosity rather than the average of RGB channels', () => {
  assert.equal(goalkeeperNumberColor('#00FF00'), '#000000');
  assert.equal(goalkeeperNumberColor('#0000FF'), '#FFFFFF');
  assert.equal(goalkeeperNumberColor('#ffffff'), '#000000');
});
