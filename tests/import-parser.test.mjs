import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseRosterText, validateImportRows } from '../src/features/players/import-parser.ts';

const sample = '1 - AlexR10 (POR)\n3 - Luis (DFC)\n5 - Sergio (DFC)\n6 - Dani (LI)\n8 - Javi (MCD)\n10 - Mario (MCO)\n11 - Carlos (DC)';
test('analiza la plantilla de WhatsApp completa y conserva los IDs', () => {
  const result = parseRosterText(sample);
  assert.equal(result.error, null);
  const checked = validateImportRows(result.rows, []);
  assert.equal(checked.length, 7);
  assert.ok(checked.every((entry) => entry.player && !entry.errors.length));
  assert.deepEqual(checked[0].player, { eaId: 'AlexR10', jerseyNumber: 1, position: 'POR' });
});
test('tolera CRLF, espacios, guiones largos, viñetas y formato de WhatsApp', () => {
  const rows = parseRosterText('  • *10* – *Alex_R10* ( mco )\r\n\r\n#3: Luis [dfc]\n5. Gamer Name - DC\n6 Dani LI').rows;
  const checked = validateImportRows(rows, []);
  assert.ok(checked.every((entry) => entry.player));
  assert.equal(checked[0].player.eaId, 'Alex_R10');
  assert.equal(checked[2].player.eaId, 'Gamer Name');
  assert.equal(rows[1].lineNumber, 3);
});
test('las líneas inválidas permanecen visibles y se pueden corregir', () => {
  const parsed = parseRosterText('cabecera de plantilla\n0 - Bad (XYZ)');
  const checked = validateImportRows(parsed.rows, []);
  assert.equal(checked.length, 2);
  assert.ok(checked.every((entry) => entry.errors.length));
  const fixed = parsed.rows.map((row, index) => ({ ...row, eaId: `Corrected_${index}`, jerseyText: String(index + 1), positionText: 'MC' }));
  assert.ok(validateImportRows(fixed, []).every((entry) => entry.player));
});
test('detecta EA IDs duplicados sin distinguir mayúsculas ni espacios', () => {
  const rows = parseRosterText('1 - Alex (MC)\n2 - aLeX (DC)').rows;
  assert.ok(validateImportRows(rows, []).every((entry) => entry.errors.some((error) => error.includes('duplicado'))));
  rows[1].selected = false;
  assert.equal(validateImportRows(rows, [])[0].errors.length, 0);
});
test('detecta duplicados de la plantilla existente y avisa de dorsales repetidos', () => {
  const rows = parseRosterText('10 - Alex (MC)\n11 - New (DC)').rows;
  const checked = validateImportRows(rows, [{ eaId: ' ALEX ', jerseyNumber: 11 }]);
  assert.ok(checked[0].errors.length);
  assert.ok(checked[1].warnings.length);
  assert.ok(checked[1].player);
});
test('rechaza dorsales fuera de rango y formatos incompletos', () => {
  const rows = parseRosterText('100 - TooBig (MC)\n1 - NoPosition\n2 - Valid (MC)').rows;
  const checked = validateImportRows(rows, []);
  assert.ok(checked[0].errors.length);
  assert.ok(checked[1].errors.length);
  assert.ok(checked[2].player);
});
test('limita el tamaño del lote y rechaza entradas vacías', () => {
  assert.ok(parseRosterText(' \n\r\n').error);
  assert.ok(parseRosterText('x'.repeat(20_001)).error);
  assert.ok(parseRosterText(Array.from({ length: 101 }, (_, i) => `${i + 1} - ID${i} (MC)`).join('\n')).error);
});
