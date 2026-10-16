import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendErrorMessage } from '../src/lib/backend-result.ts';

test('una función ausente no se presenta como un problema de conexión ni expone detalles técnicos', () => {
  const message = backendErrorMessage({code: 'PGRST202', message: 'Missing private RPC details'});
  assert.match(message, /no está disponible/);
  assert.doesNotMatch(message, /conexión|PGRST|RPC|private/);
});
