import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readAuthLink, completeAuthLink } from '../src/features/auth/callback.ts';
import { authErrorMessage } from '../src/features/auth/errors.ts';
import { RecoveryState } from '../src/features/auth/recovery-state.ts';

const base = 'https://club.example.test/auth/callback';
const hash = 'a'.repeat(64);
const session = { user: { id: '00000000-0000-4000-8000-000000000001' } };
function memoryStorage() {
  const values = new Map();
  return { values, async getItem(key) { return values.get(key) ?? null; }, async setItem(key, value) { values.set(key, value); }, async removeItem(key) { values.delete(key); } };
}

for (const prefix of [base, 'convosquad://auth/callback', 'exp://127.0.0.1:8081/--/auth/callback']) {
  test(`admite token_hash en fragmento y query: ${prefix}`, () => {
    for (const separator of ['#', '?']) assert.deepEqual(readAuthLink(`${prefix}${separator}token_hash=${hash}&type=recovery`), { kind: 'otp', tokenHash: hash, type: 'recovery' });
  });
}
test('rechaza credenciales duplicadas, tipos no permitidos y flujos ambiguos', () => {
  for (const suffix of [
    '?code=a&code=b', `?token_hash=${hash}#token_hash=${hash}&type=recovery`,
    `?code=a&token_hash=${hash}&type=recovery`, `#token_hash=${hash}&type=recovery&type=email`,
    `#token_hash=${hash}&type=invite`, `#token_hash=${hash}&type=email_change`, '?type=recovery',
    '?code=', '#access_token=secret&refresh_token=secret&type=recovery', '?code=a&sb_flow_id=a&sb_flow_id=b',
  ]) assert.equal(readAuthLink(base + suffix).kind, 'invalid');
  assert.equal(readAuthLink(null).kind, 'invalid');
  assert.equal(readAuthLink('invalid').kind, 'invalid');
});
test('conserva el identificador PKCE y nunca confía en type=recovery para un código', async () => {
  const link = readAuthLink(`${base}?code=valid&sb_flow_id=flow&type=recovery`);
  const result = await completeAuthLink({ async exchangeCodeForSession(code, options) {
    assert.equal(code, 'valid'); assert.deepEqual(options, { flowId: 'flow' });
    return { data: { session, redirectType: null }, error: null };
  } }, link);
  assert.equal(result.recovery, false);
});
test('reconoce recuperación PKCE únicamente después del intercambio correcto', async () => {
  const result = await completeAuthLink({ async exchangeCodeForSession() { return { data: { session, redirectType: 'recovery' }, error: null }; } }, readAuthLink(`${base}?code=valid`));
  assert.equal(result.recovery, true);
});
test('la confirmación de correo no concede modo recuperación', async () => {
  for (const type of ['email', 'signup']) {
    const result = await completeAuthLink({ async verifyOtp(params) {
      assert.deepEqual(params, { token_hash: hash, type });
      return { data: { session }, error: null };
    } }, readAuthLink(`${base}#token_hash=${hash}&type=${type}`));
    assert.equal(result.recovery, false);
  }
});
test('no navega con errores, enlaces incompletos o una respuesta sin sesión', async () => {
  let calls = 0;
  const auth = { async verifyOtp() { calls++; return { data: { session: null }, error: null }; } };
  await assert.rejects(completeAuthLink(auth, { kind: 'invalid' }));
  await assert.rejects(completeAuthLink(auth, { kind: 'error', code: 'otp_expired' }), { code: 'otp_expired' });
  assert.equal(calls, 0);
  await assert.rejects(completeAuthLink(auth, readAuthLink(`${base}#token_hash=${hash}&type=recovery`)));
  await assert.rejects(completeAuthLink({ async verifyOtp() { return { data: {}, error: { code: 'otp_expired' } }; } }, readAuthLink(`${base}#token_hash=${hash}&type=recovery`)), { code: 'otp_expired' });
});
test('traduce errores de Auth sin mostrar detalles o tokens del servidor', () => {
  for (const [code, match] of [['invalid_credentials', /ID de EA o la contraseña/], ['email_not_confirmed', /administrador/], ['pkce_code_verifier_not_found', /navegador y dispositivo/], ['bad_code_verifier', /navegador y dispositivo/], ['otp_expired', /caducado/], ['over_email_send_rate_limit', /Espera/], ['same_password', /diferente/], ['weak_password', /segura/]]) assert.match(authErrorMessage({ code, message: 'SECRET' }, 'callback'), match);
  assert.match(authErrorMessage(new TypeError('Failed to fetch'), 'recovery'), /conexión/);
  assert.doesNotMatch(authErrorMessage({ code: 'unknown', message: 'SECRET' }, 'callback'), /SECRET/);
  assert.deepEqual(readAuthLink(`${base}#error=access_denied&error_code=otp_expired&error_description=SECRET`), { kind: 'error', code: 'otp_expired' });
});
test('persiste recuperación, la restaura tras recargar y la conserva al refrescar tokens', async () => {
  const storage = memoryStorage();
  const first = new RecoveryState(storage, 'marker', () => {});
  await first.handle('PASSWORD_RECOVERY', session);
  const reload = new RecoveryState(storage, 'marker', () => {});
  await reload.handle('INITIAL_SESSION', session);
  assert.equal(reload.current, true);
  await reload.handle('TOKEN_REFRESHED', session);
  await reload.handle('USER_UPDATED', session);
  assert.equal(reload.current, true);
  await reload.handle('SIGNED_OUT', null);
  assert.equal(reload.current, false);
  assert.equal(storage.values.size, 0);
});
test('una sesión normal, ausente o de otro usuario no hereda recuperación', async () => {
  for (const nextSession of [null, { user: { id: 'other' } }]) {
    const storage = memoryStorage(); await storage.setItem('marker', JSON.stringify([session.user.id, null]));
    const state = new RecoveryState(storage, 'marker', () => {});
    await state.handle('INITIAL_SESSION', nextSession);
    assert.equal(state.current, false);
  }
  const storage = memoryStorage(); const state = new RecoveryState(storage, 'marker', () => {});
  await state.handle('PASSWORD_RECOVERY', session);
  await state.handle('SIGNED_IN', session);
  assert.equal(state.current, false); assert.equal(storage.values.size, 0);
});
test('una restauración lenta no sobrescribe un evento de cierre de sesión', async () => {
  let release;
  const storage = memoryStorage();
  storage.getItem = () => new Promise(resolve => { release = resolve; });
  const state = new RecoveryState(storage, 'marker', () => {});
  const restoring = state.handle('INITIAL_SESSION', session);
  await Promise.resolve();
  await state.handle('SIGNED_OUT', null);
  release(JSON.stringify([session.user.id, null])); await restoring;
  assert.equal(state.current, false);
});
test('los fallos de almacenamiento no conceden recuperación en el arranque', async () => {
  const state = new RecoveryState({ async getItem() { throw new Error('unavailable'); }, async setItem() { throw new Error('unavailable'); }, async removeItem() {} }, 'marker', () => {});
  await state.handle('INITIAL_SESSION', session); assert.equal(state.current, false);
  await state.handle('PASSWORD_RECOVERY', session); assert.equal(state.current, true);
});

// Real Auth SDK, isolated storage and intercepted fetch. No request can reach Supabase.
function mockClient(storage = memoryStorage()) {
  const requests = []; const events = [];
  const user = { ...session.user, aud: 'authenticated', role: 'authenticated', email: 'test@example.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const jwt = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.test`;
  const client = createClient('https://auth.example.test', 'public-test-key', { auth: { storage, storageKey: 'auth-test', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' }, global: { async fetch(url, init) {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body); requests.push({ path, body, url: String(url) });
    if (path === '/auth/v1/recover') return new Response('{}', { status: 200 });
    if (path !== '/auth/v1/verify' && path !== '/auth/v1/token') throw new Error('Unexpected request');
    if (body.token_hash === 'expired') return new Response(JSON.stringify({ code: 'otp_expired', msg: 'Expired' }), { status: 403, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
    return new Response(JSON.stringify({ access_token: jwt, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 3600, user }), { status: 200 });
  } } });
  client.auth.onAuthStateChange((event) => { events.push(event); });
  return { client, requests, events, storage };
}
test('SDK: token_hash verifica desde otro dispositivo sin verificador PKCE y persiste sesión', async () => {
  const origin = mockClient();
  const recovery = await origin.client.auth.resetPasswordForEmail('test@example.test', { redirectTo: base });
  assert.equal(recovery.error, null);
  assert.equal(origin.requests[0].body.code_challenge_method, 's256');
  const otherDevice = mockClient();
  const result = await completeAuthLink(otherDevice.client.auth, readAuthLink(`${base}#token_hash=${hash}&type=recovery`));
  assert.equal(result.recovery, true);
  assert.ok(otherDevice.events.includes('PASSWORD_RECOVERY'));
  assert.deepEqual(otherDevice.requests[0].body.token_hash, hash);
  assert.equal(otherDevice.requests[0].body.code_verifier, undefined);
  assert.equal((await otherDevice.client.auth.getSession()).data.session.user.id, session.user.id);
  const reload = mockClient(otherDevice.storage);
  assert.equal((await reload.client.auth.getSession()).data.session.user.id, session.user.id);
  assert.equal(reload.requests.length, 0);
});
test('SDK: PKCE sin verificador falla antes de pedir una sesión; el código OTP funciona', async () => {
  const otherDevice = mockClient();
  await assert.rejects(completeAuthLink(otherDevice.client.auth, readAuthLink(`${base}?code=legacy`)), { code: 'pkce_code_verifier_not_found' });
  assert.equal(otherDevice.requests.length, 0);
  const result = await otherDevice.client.auth.verifyOtp({ email: 'test@example.test', token: '123456', type: 'recovery' });
  assert.equal(result.error, null); assert.ok(otherDevice.events.includes('PASSWORD_RECOVERY'));
});
test('SDK: un token caducado no crea sesión ni emite PASSWORD_RECOVERY', async () => {
  const device = mockClient();
  await assert.rejects(completeAuthLink(device.client.auth, readAuthLink(`${base}#token_hash=expired&type=recovery`)), { code: 'otp_expired' });
  assert.equal((await device.client.auth.getSession()).data.session, null);
  assert.equal(device.events.includes('PASSWORD_RECOVERY'), false);
});


test('un SIGNED_IN de foco conserva recuperación, un nuevo login la elimina', async () => {
  const storage = memoryStorage(); const state = new RecoveryState(storage, 'marker', () => {});
  const verified = { user: { ...session.user, last_sign_in_at: '2026-10-14T12:00:00Z' } };
  await state.handle('PASSWORD_RECOVERY', verified);
  await state.handle('SIGNED_IN', verified);
  assert.equal(state.current, true);
  await state.handle('SIGNED_IN', { user: { ...verified.user, last_sign_in_at: '2026-10-14T12:05:00Z' } });
  assert.equal(state.current, false); assert.equal(storage.values.size, 0);
});
test('SDK: PKCE desde el navegador original intercambia el verificador y activa recuperación', async () => {
  const device = mockClient();
  await device.client.auth.resetPasswordForEmail('test@example.test', { redirectTo: base });
  const redirect = new URL(new URL(device.requests[0].url).searchParams.get('redirect_to'));
  redirect.searchParams.set('code', 'valid-code');
  const result = await completeAuthLink(device.client.auth, readAuthLink(redirect.href));
  assert.equal(result.recovery, true);
  assert.ok(device.events.includes('PASSWORD_RECOVERY'));
  const exchange = device.requests.find(request => request.path === '/auth/v1/token');
  assert.equal(exchange.body.auth_code, 'valid-code');
  assert.ok(exchange.body.code_verifier);
});
