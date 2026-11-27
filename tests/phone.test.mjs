import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePhone, whatsappUrl } from '../src/features/call-ups/phone.ts';
test('teléfono opcional normaliza formato internacional y genera solo enlaces WhatsApp válidos',()=>{
  assert.equal(normalizePhone(''),null);
  assert.equal(normalizePhone('0034 600-000-000'),'+34600000000');
  assert.equal(whatsappUrl('+34 (600) 000 000'),'https://wa.me/34600000000');
  for(const value of ['600000000','javascript:alert(1)','+123','+000000000','+1234567890123456']) assert.throws(()=>normalizePhone(value));
});


test('copied WhatsApp numbers ignore invisible direction marks and contact formatting',()=>{
  for(const value of [
    '+34 612 34 56 78',
    '\u202a+34 612 34 56 78\u202c',
    '\u200e+34\u00a0612\u00a034\u00a056\u00a078\u200e',
    '\u2066+34\u202f612\u202f34\u202f56\u202f78\u2069',
    '\ufeff+34 (612) 34\u201156\u201178',
    '\u061c0034 612 34 56 78\u2060',
  ]) {
    assert.equal(normalizePhone(value),'+34612345678');
    assert.equal(whatsappUrl(value),'https://wa.me/34612345678');
  }
  assert.equal(normalizePhone('\u200e \u202c'),null);
  for(const value of ['\u200e612345678\u200e','\u202a+34 612 34 texto 56 78\u202c','+34 612345678 +44 7000000000','\u2066+1234567890123456\u2069']) assert.throws(()=>normalizePhone(value));
});
