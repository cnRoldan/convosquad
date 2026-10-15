import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { eaAccountEmail, loginEaAccount, registerEaAccount } from '../src/features/auth/ea-account.ts';
import { authErrorMessage } from '../src/features/auth/errors.ts';

const input = { eaId: '  EA-Player_9  ', password: 'test-only-password' };
const ready = { mailer_autoconfirm: true, disable_signup: false };

function fixture(options = {}) {
  const requests = []; const events = []; const storage = new Map();
  let checks = 0;
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, flowType: 'pkce', storage: {
      getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => { storage.set(key, value); }, removeItem: async key => { storage.delete(key); },
    } },
    global: { async fetch(url, init) {
      const parsed = new URL(url); const body = JSON.parse(init.body ?? '{}');
      requests.push({ path: parsed.pathname, body, grant: parsed.searchParams.get('grant_type') });
      if (parsed.pathname === '/rest/v1/rpc/is_ea_id_available') {
        checks++;
        if (options.missingMigration) return new Response(JSON.stringify({ code: 'PGRST202', message: 'Missing function' }), { status: 404 });
        return new Response(JSON.stringify(options.taken || (options.race && checks > 1) ? false : true), { status: 200 });
      }
      if (!['/auth/v1/signup', '/auth/v1/token', '/auth/v1/logout'].includes(parsed.pathname)) throw new Error('Unexpected request');
      if (parsed.pathname === '/auth/v1/logout') return new Response('{}', { status: 200 });
      if (options.error) return new Response(JSON.stringify({ code: options.error, msg: 'private server detail' }), { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } });
      const user = { id: '00000000-0000-4000-8000-000000000901', aud: 'authenticated', role: 'authenticated', email: body.email, user_metadata: body.data ?? {}, app_metadata: {}, created_at: new Date().toISOString() };
      if (options.noSession) return new Response(JSON.stringify(user), { status: 200 });
      const jwt = `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`;
      return new Response(JSON.stringify({ user, access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600 }), { status: 200 });
    } },
  });
  client.auth.onAuthStateChange(event => { events.push(event); });
  return { client, requests, events, storage };
}

test('el ID normalizado produce el mismo identificador interno, sin aceptar correos', () => {
  assert.equal(eaAccountEmail('  EA-Player_9  '), eaAccountEmail('ea-player_9'));
  assert.notEqual(eaAccountEmail('EA-Player_9'), eaAccountEmail('EA_Player_9'));
  for (const value of ['', 'ab', 'a@b.test', 'a b', 'a'.repeat(25), 'ééé']) assert.throws(() => eaAccountEmail(value), { code: 'invalid_ea_id' });
});
test('SDK: registro sin correo visible inicia sesión y persiste la sesión', async () => {
  const f = fixture(); const result = await registerEaAccount(f.client, input, ready);
  assert.ok(result.session); assert.ok(f.events.includes('SIGNED_IN')); assert.ok(f.storage.size > 0);
  const request = f.requests.find(r => r.path === '/auth/v1/signup');
  assert.equal(request.body.email, eaAccountEmail(input.eaId));
  assert.equal(request.body.data.username, 'EA-Player_9');
  assert.equal(request.body.data.login_type, 'ea_id');
  assert.equal(request.body.password, input.password);
  assert.equal(request.body.email_redirect_to, undefined);
  assert.equal((await f.client.auth.getSession()).data.session.user.id, result.user.id);
  await f.client.auth.signOut();
  assert.equal((await f.client.auth.getSession()).data.session, null);
});
test('SDK: login usa contraseña de Supabase y no convierte disponibilidad en autenticación', async () => {
  const f = fixture(); await loginEaAccount(f.client, input.eaId, input.password);
  assert.equal(f.requests.length, 1); assert.equal(f.requests[0].grant, 'password');
  assert.equal(f.requests[0].body.email, eaAccountEmail(input.eaId));
});
test('registro bloqueado antes de crear usuarios si falta configurar Auth o la migración', async () => {
  for (const settings of [null, {}, { mailer_autoconfirm: false }, { mailer_autoconfirm: true, disable_signup: true }]) {
    const f = fixture(); await assert.rejects(registerEaAccount(f.client, input, settings), { code: 'ea_registration_unavailable' });
    assert.equal(f.requests.length, 0);
  }
  const f = fixture({ missingMigration: true });
  await assert.rejects(registerEaAccount(f.client, input, ready), { code: 'ea_registration_unavailable' });
  assert.equal(f.requests.some(r => r.path === '/auth/v1/signup'), false);
});
test('rechaza duplicados antes del alta y también ante carreras en Auth o PostgreSQL', async () => {
  for (const options of [{ taken: true }, { error: 'user_already_exists' }, { error: 'unexpected_failure', race: true }]) {
    const f = fixture(options); await assert.rejects(registerEaAccount(f.client, input, ready), { code: 'ea_id_taken' });
    assert.equal((await f.client.auth.getSession()).data.session, null);
    if (options.taken) assert.equal(f.requests.length, 1);
  }
});
test('no anuncia éxito sin sesión y muestra errores seguros en español', async () => {
  const f = fixture({ noSession: true }); await assert.rejects(registerEaAccount(f.client, input, ready), { code: 'ea_registration_unavailable' });
  assert.match(authErrorMessage({ code: 'ea_id_taken', message: 'private server detail' }, 'register'), /ya está registrado/);
  assert.match(authErrorMessage({ code: 'ea_registration_unavailable' }, 'register'), /todavía no está habilitado/);
  const invalid = fixture({ error: 'invalid_credentials' });
  await assert.rejects(loginEaAccount(invalid.client, input.eaId, 'incorrect'), { code: 'invalid_credentials' });
  assert.equal((await invalid.client.auth.getSession()).data.session, null);
});
