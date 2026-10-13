import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invitationUrl, invitationFragmentToken, readInvitation, webInviteBase } from '../src/features/invitations/links.ts';

const invitation = { clubId: '00000000-0000-4000-8000-000000000001', token: 'a'.repeat(64) };
test('valida el enlace sin aceptar parámetros duplicados o IDs ambiguos', () => {
  assert.deepEqual(readInvitation(invitation.clubId, invitation.token), invitation);
  assert.equal(readInvitation([invitation.clubId], invitation.token), null);
  assert.equal(readInvitation(invitation.clubId, [invitation.token]), null);
  assert.equal(readInvitation('not-a-club', invitation.token), null);
  assert.equal(readInvitation(invitation.clubId, 'short'), null);
});
test('los enlaces HTTPS mantienen el token en el fragmento, fuera de peticiones y referrers', () => {
  const url = new URL(invitationUrl(webInviteBase('https://club.example.test'), invitation));
  assert.equal(url.pathname, '/invite');
  assert.equal(url.searchParams.get('club'), invitation.clubId);
  assert.equal(url.searchParams.get('token'), null);
  assert.equal(invitationFragmentToken(url.href), invitation.token);
});
test('los deep links de desarrollo preservan club y token', () => {
  const url = new URL(invitationUrl('convosquad://invite', invitation));
  assert.equal(url.searchParams.get('token'), invitation.token);
  assert.deepEqual(readInvitation(url.searchParams.get('club'), url.searchParams.get('token')), invitation);
  const expoGo = new URL(invitationUrl('exp://127.0.0.1:8081/--/invite', invitation));
  assert.equal(expoGo.pathname, '/--/invite');
});
test('no acepta un origen web con credenciales, rutas, fragmentos ni HTTP', () => {
  for (const value of ['http://club.example.test', 'https://user:password@club.example.test', 'https://club.example.test/other', 'https://club.example.test/#secret', 'invalid']) {
    assert.throws(() => webInviteBase(value));
  }
});
test('un fragmento malformado no produce una invitación válida', () => {
  assert.equal(invitationFragmentToken(null), null);
  assert.equal(invitationFragmentToken('invalid'), null);
  assert.equal(invitationFragmentToken(`https://club.example.test/invite#token=${invitation.token}&token=other`), null);
  assert.equal(readInvitation(invitation.clubId, invitationFragmentToken('https://club.example.test/invite#token=bad')), null);
});
