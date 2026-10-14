import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readSupabaseConfiguration } from '../src/lib/supabase-config.ts';

const key = 'sb_publishable_test_only';
test('una configuración incompleta no inicia un cliente real', () => {
  for (const [url, value] of [[undefined, undefined], ['https://project.supabase.co', undefined], [undefined, key], [' ', key]]) {
    const result = readSupabaseConfiguration(url, value);
    assert.equal(result.configuration, null);
    assert.ok(result.error);
  }
});
test('acepta una clave publicable moderna y normaliza el origen', () => {
  assert.deepEqual(readSupabaseConfiguration(' https://project.supabase.co/ ', ` ${key} `), {
    configuration: { url: 'https://project.supabase.co', publishableKey: key }, error: null,
  });
  assert.ok(readSupabaseConfiguration('http://127.0.0.1:54321', key).configuration);
});
test('rechaza claves secretas y JWT heredados sin revelar su valor en el error', () => {
  for (const value of ['sb_secret_test_only', 'eyJtest.invalid.signature', `${key}\nextra`]) {
    const result = readSupabaseConfiguration('https://project.supabase.co', value);
    assert.equal(result.configuration, null);
    assert.ok(result.error);
    assert.ok(!result.error.includes(value));
  }
  assert.equal(readSupabaseConfiguration('https://project.supabase.co', 'sb_publishable_').configuration, null);
});
test('rechaza URLs con credenciales, rutas, consultas o HTTP externo', () => {
  for (const url of ['invalid', 'http://project.supabase.co', 'https://user:pass@project.supabase.co', 'https://project.supabase.co/rest/v1', 'https://project.supabase.co?key=test', 'https://project.supabase.co#test']) {
    assert.equal(readSupabaseConfiguration(url, key).configuration, null);
  }
});
