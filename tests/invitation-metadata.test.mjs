import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { readInvitation, invitationFragmentToken, invitationAppUrl } from '../src/features/invitations/links.ts';

const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/app/invite.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
});
const club = '00000000-0000-4000-8000-000000000001', token = 'a'.repeat(64);
function render(platform, loading, valid = true) {
  let headRenders = 0, redemptions = 0;
  const wrap = ({ children }) => createElement('section', null, children);
  const modules = {
    react: require('react'), 'react/jsx-runtime': require('react/jsx-runtime'),
    'react-native': { Platform: { OS: platform }, Linking: { openURL: async () => undefined } },
    'expo-router/head': { __esModule: true, default: ({ children }) => {
      headRenders++;
      if (platform !== 'web') throw new Error('Native Head attempted to configure Handoff without an origin');
      return createElement('header', null, children);
    } },
    'expo-linking': { useURL: () => `https://convosquad.com/invite?club=${club}#token=${token}` },
    'expo-router': { router: { replace() { throw new Error('Invitation must not navigate automatically'); } }, useLocalSearchParams: () => ({ club: valid ? club : 'invalid' }) },
    '@/features/i18n/runtime': { useLanguage: () => 'es', t: text => text },
    '@/components/ui': { Screen: wrap, Body: wrap, Card: wrap, Message: wrap, Heading: ({ title }) => createElement('h1', null, title), Button: ({ label }) => createElement('button', null, label) },
    '@/components/loading': { LoadingScreen: ({ label }) => createElement('p', null, label) },
    '@/features/auth/auth-context': { useAuth: () => ({ session: null, isLoading: loading, isDemo: false }) },
    '@/features/clubs/club-context': { useClub: () => ({ availableClubs: [] }) },
    '@/features/invitations/pending-invite-context': { usePendingInvite: () => ({ pendingInvite: null, isRestoring: false }) },
    '@/features/invitations/links': { readInvitation, invitationFragmentToken, invitationAppUrl },
    '@/features/invitations/service': { redeemClubInvitation: () => { redemptions++; } },
    '@/lib/backend-result': { backendErrorMessage: () => 'Fixture backend error' },
  };
  const module = { exports: {} };
  const load = name => { assert.ok(Object.hasOwn(modules, name), `Unexpected dependency: ${name}`); return modules[name]; };
  new Function('require', 'module', 'exports', outputText)(load, module, module.exports);
  const html = renderToStaticMarkup(createElement(module.exports.default));
  return { html, headRenders, redemptions };
}
test('native invitation renders loading, valid and invalid links without mounting Expo Head or redeeming an invite', () => {
  for (const platform of ['ios', 'android']) for (const [loading, valid] of [[true, true], [false, true], [false, false]]) {
    const result = render(platform, loading, valid);
    assert.equal(result.headRenders, 0); assert.equal(result.redemptions, 0);
    assert.ok(!result.html.includes('og:image'));
    assert.ok(result.html.includes(loading ? 'Comprobando tu sesión' : valid ? 'Te han invitado a un club' : 'El enlace está incompleto'));
  }
});
test('web invitation keeps generic preview metadata during loading and after session restoration without exposing the token', () => {
  for (const loading of [true, false]) {
    const result = render('web', loading);
    assert.equal(result.headRenders, 1); assert.equal(result.redemptions, 0);
    assert.ok(result.html.includes('Invitación a ConvoSquad')); assert.ok(result.html.includes('og:image'));
    assert.ok(result.html.includes('no-referrer')); assert.ok(!result.html.includes(token));
  }
});
