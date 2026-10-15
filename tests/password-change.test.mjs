import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { changeOwnPassword } from '../src/features/auth/password-change.ts';
import { authErrorMessage } from '../src/features/auth/errors.ts';

const userId = '00000000-0000-4000-8000-000000000901';
const input = { currentPassword: 'old-fixture-password', newPassword: 'new-fixture-password', confirmation: 'new-fixture-password' };
function fixture(options = {}) {
  const requests = []; const storage = new Map();
  const user = { id: userId, email: 'ea.player@accounts.convosquad.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: { username: 'Player' }, created_at: new Date().toISOString() };
  let password = input.currentPassword;
  const token = id => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.${id}`;
  const session = id => ({ user: options.otherUser && id === 'verification' ? { ...user, id: 'other-user' } : user, access_token: token(id), refresh_token: `fixture-${id}`, expires_in: 3600, token_type: 'bearer' });
  const fetch = async (url, init) => {
    const path = new URL(url).pathname; const body = JSON.parse(init.body ?? '{}');
    requests.push({ path, method: init.method, body, authorization: new Headers(init.headers).get('authorization') });
    if (path === '/auth/v1/token') {
      if (body.password !== password) return new Response(JSON.stringify({ code: 'invalid_credentials', msg: 'private-detail' }), { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
      return Response.json(session('verification'));
    }
    if (path === '/auth/v1/user' && init.method === 'GET') return Response.json(user);
    if (path === '/auth/v1/user' && init.method === 'PUT') {
      if (options.updateError) return new Response(JSON.stringify({ code: options.updateError, msg: 'private-detail' }), { status: 422, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
      password = body.password; return Response.json(user);
    }
    if (path === '/auth/v1/logout') return Response.json({});
    throw new Error('Unexpected fixture request');
  };
  const client = createClient('https://auth.example.test', 'test-public-key', {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, storage: {
      getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key),
    } }, global: { fetch },
  });
  const verifier = createClient('https://auth.example.test', 'test-public-key', {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false, storageKey: 'test-password-verifier' }, global: { fetch },
  });
  return { client, verifier, requests, storage, async login() { await client.auth.setSession(session('original')); requests.length = 0; } };
}

test('SDK: verifica la contraseña anterior y cambia únicamente la contraseña de la sesión original', async () => {
  const f = fixture(); await f.login();
  await changeOwnPassword(f.client, f.verifier, userId, input);
  const update = f.requests.find(r => r.method === 'PUT');
  assert.equal(update.body.password, input.newPassword);
  assert.equal(update.body.current_password, input.currentPassword);
  assert.equal(update.body.email, undefined);
  assert.match(update.authorization, /original$/);
  assert.equal(f.requests.find(r => r.path.endsWith('/token')).body.email, 'ea.player@accounts.convosquad.invalid');
  assert.equal((await f.client.auth.getSession()).data.session.user.id, userId);
  assert.equal((await f.verifier.auth.getSession()).data.session, null);
  assert.equal(f.requests.filter(r => r.path.endsWith('/logout')).length, 1);
  assert.equal(JSON.stringify([...f.storage]).includes(input.newPassword), false);
  assert.equal(JSON.stringify([...f.storage]).includes(input.currentPassword), false);
  await assert.rejects(f.verifier.auth.signInWithPassword({ email: 'ea.player@accounts.convosquad.invalid', password: input.currentPassword }).then(r => { if (r.error) throw r.error; }), { code: 'invalid_credentials' });
  assert.equal((await f.verifier.auth.signInWithPassword({ email: 'ea.player@accounts.convosquad.invalid', password: input.newPassword })).error, null);
});
test('contraseña anterior incorrecta no modifica la cuenta ni sustituye la sesión abierta', async () => {
  const f = fixture(); await f.login();
  await assert.rejects(changeOwnPassword(f.client, f.verifier, userId, { ...input, currentPassword: 'incorrect' }), { code: 'current_password_incorrect' });
  assert.equal(f.requests.some(r => r.method === 'PUT'), false);
  assert.match((await f.client.auth.getSession()).data.session.access_token, /original$/);
});
test('validación de longitud, confirmación y contraseña diferente antes de enviar datos', async () => {
  for (const [patch, code] of [
    [{ currentPassword: '' }, 'current_password_required'], [{ newPassword: 'short' }, 'password_too_short'],
    [{ confirmation: 'different' }, 'password_mismatch'], [{ newPassword: input.currentPassword, confirmation: input.currentPassword }, 'same_password'],
  ]) {
    const f = fixture(); await f.login();
    await assert.rejects(changeOwnPassword(f.client, f.verifier, userId, { ...input, ...patch }), { code });
    assert.equal(f.requests.length, 0);
  }
});
test('sesión ausente, usuario cambiado o verificación de otra cuenta impiden actualizar', async () => {
  const absent = fixture();
  await assert.rejects(changeOwnPassword(absent.client, absent.verifier, userId, input));
  for (const options of [{ otherUser: true }, {}]) {
    const f = fixture(options); await f.login();
    await assert.rejects(changeOwnPassword(f.client, f.verifier, options.otherUser ? userId : 'other-user', input), { code: 'session_expired' });
    assert.equal(f.requests.some(r => r.method === 'PUT'), false);
    assert.equal((await f.verifier.auth.getSession()).data.session, null);
  }
});
test('rechazo del servidor no anuncia éxito y los errores no revelan detalles internos', async () => {
  const f = fixture({ updateError: 'weak_password' }); await f.login();
  await assert.rejects(changeOwnPassword(f.client, f.verifier, userId, input), { code: 'weak_password' });
  for (const code of ['current_password_incorrect', 'weak_password', 'session_expired', 'unexpected']) {
    const message = authErrorMessage({ code, message: 'private-detail' }, 'password');
    assert.equal(message.includes('private-detail'), false); assert.equal(message.includes('recuperación'), false);
  }
});
