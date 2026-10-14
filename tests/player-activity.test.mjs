import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityErrorMessage } from '../src/features/players/activity.ts';

test('los errores de actividad explican conflicto, permisos y ficha no disponible en español', () => {
  assert.match(activityErrorMessage({ code: '23505' }), /EA ID.*conflicto/);
  assert.match(activityErrorMessage({ code: '42501' }), /No tienes permiso/);
  assert.match(activityErrorMessage({ code: 'PGRST116' }), /Actualiza la plantilla/);
  assert.match(activityErrorMessage(new Error('private server detail')), /Comprueba tu conexión/);
  assert.ok(!activityErrorMessage(new Error('private server detail')).includes('private server detail'));
});
