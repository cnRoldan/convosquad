import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activityErrorMessage, playerActivityCopy } from '../src/features/players/activity.ts';

test('los errores de actividad explican conflicto, permisos y ficha no disponible en español', () => {
  assert.match(activityErrorMessage({ code: '23505' }), /EA ID.*conflicto/);
  assert.match(activityErrorMessage({ code: '42501' }), /No tienes permiso/);
  assert.match(activityErrorMessage({ code: 'PGRST116' }), /Actualiza la plantilla/);
  assert.match(activityErrorMessage(new Error('private server detail')), /Comprueba tu conexión/);
  assert.ok(!activityErrorMessage(new Error('private server detail')).includes('private server detail'));
});

test('ficha y papelera comparten la confirmación de retirada y reincorporación con historial protegido', () => {
  const removal = playerActivityCopy(true);
  assert.equal(removal.description, '¿Quieres quitar a este jugador de la plantilla? Sus convocatorias anteriores se conservarán.');
  assert.equal(removal.confirmLabel, 'Quitar de la plantilla');
  const restoration = playerActivityCopy(false);
  assert.equal(restoration.confirmLabel, 'Reincorporar');
  assert.match(restoration.description, /EA ID, dorsal, categoría y cuenta vinculada/);
  assert.match(restoration.description, /se incluirá también en las convocatorias abiertas/);
});
