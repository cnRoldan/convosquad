import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { endDeviceSession, logoutErrorMessage } from '../src/features/auth/logout.ts';
import { deactivateOwnedDevice } from '../src/features/notifications/device-deactivation.ts';

const userId = '00000000-0000-4000-8000-000000000901';
async function fixture(status = 204) {
  const storage = new Map(), operations = [];
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp })).toString('base64url')}.fixture`;
  const client = createClient('https://logout.example.test', 'test-public-key', {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, storage: {
      getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
    } },
    global: { fetch: async (url) => {
      const target = new URL(url);
      if (target.pathname === '/auth/v1/user') return Response.json(user);
      assert.equal(target.pathname, '/auth/v1/logout');
      operations.push(`logout:${target.searchParams.get('scope')}`);
      return status === 204 ? new Response(null, { status }) : Response.json({ msg: 'private server details' }, { status });
    } },
  });
  await client.auth.setSession({ access_token: token, refresh_token: 'fixture' });
  return { client, storage, operations, unlink: async id => { assert.equal(id, userId); operations.push('unlink'); } };
}

test('cierra solo este dispositivo, desvincula primero las notificaciones y elimina credenciales persistidas', async () => {
  const f = await fixture();
  await endDeviceSession(f.client, f.unlink);
  assert.deepEqual(f.operations, ['unlink', 'logout:local']);
  assert.equal((await f.client.auth.getSession()).data.session, null);
  assert.equal([...f.storage.values()].some(value => value.includes('refresh_token')), false);
});

test('un error de revocación remota no anuncia un fallo si el SDK ya eliminó la sesión local', async () => {
  for (const status of [401, 403, 503]) {
    const f = await fixture(status);
    await endDeviceSession(f.client, f.unlink);
    assert.deepEqual(f.operations, ['unlink', 'logout:local']);
    assert.equal((await f.client.auth.getSession()).data.session, null);
  }
});

test('sesión ya eliminada permite cerrar sin intentar una desvinculación que requiere autenticación', async () => {
  const f = await fixture();
  await f.client.auth.signOut({ scope: 'local' }); f.operations.length = 0;
  await endDeviceSession(f.client, async () => assert.fail('No debe desvincular sin sesión'));
  assert.deepEqual(f.operations, []);
});

test('un fallo al desvincular un dispositivo con sesión vigente permite reintentar sin dejar notificaciones de otra cuenta', async () => {
  const f = await fixture();
  await assert.rejects(endDeviceSession(f.client, async () => { throw new Error('private RPC error'); }), { code: 'device_unlink_failed' });
  assert.equal((await f.client.auth.getSession()).data.session.user.id, userId);
  assert.deepEqual(f.operations, []);
  await endDeviceSession(f.client, f.unlink);
  assert.equal((await f.client.auth.getSession()).data.session, null);
});

test('no presenta éxito si la sesión sigue presente tras un error del SDK', async () => {
  const f = await fixture();
  const client = { auth: { getSession: () => f.client.auth.getSession(), signOut: async () => ({ error: new Error('local cleanup failed') }) } };
  await assert.rejects(endDeviceSession(client, f.unlink), { code: 'session_logout_failed' });
  assert.equal((await f.client.auth.getSession()).data.session.user.id, userId);
  assert.equal(logoutErrorMessage(new Error('secret detail')).includes('secret'), false);
});

test('un dispositivo antiguo de otra cuenta o ya eliminado no bloquea cerrar sesión ni se modifica', async () => {
  const f = await fixture(); const requests = [];
  const client = createClient('https://devices.example.test', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async url => {
      const target = new URL(url); requests.push(target);
      assert.equal(target.pathname, '/rest/v1/push_devices');
      assert.equal(target.searchParams.get('user_id'), `eq.${userId}`);
      return Response.json([]);
    } },
  });
  await endDeviceSession(f.client, id => deactivateOwnedDevice(client, id, 'old-device', true));
  assert.equal(requests.length, 1);
  assert.deepEqual(f.operations, ['logout:local']);
});

test('el dispositivo propio sí se desvincula mediante RPC y un fallo de consulta no se confunde con ausencia', async () => {
  for (const lookupFails of [false, true]) {
    const requests = [];
    const client = createClient('https://devices.example.test', 'test-public-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (url, init) => {
        const path = new URL(url).pathname; requests.push(path);
        if (path === '/rest/v1/push_devices') return lookupFails
          ? Response.json({ code: '42501', message: 'private detail' }, { status: 403 })
          : Response.json([{ device_id: 'own-device' }]);
        assert.equal(path, '/rest/v1/rpc/deactivate_push_device');
        assert.deepEqual(JSON.parse(init.body), { p_device_id: 'own-device', p_unlink: true });
        return new Response(null, { status: 204 });
      } },
    });
    if (lookupFails) await assert.rejects(deactivateOwnedDevice(client, userId, 'own-device', true));
    else await deactivateOwnedDevice(client, userId, 'own-device', true);
    assert.equal(requests.length, lookupFails ? 1 : 2);
  }
});
