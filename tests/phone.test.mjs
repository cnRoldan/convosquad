import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePhone, whatsappUrl } from '../src/features/call-ups/phone.ts';
test('teléfono opcional normaliza formato internacional y genera solo enlaces WhatsApp válidos',()=>{
  assert.equal(normalizePhone(''),null);
  assert.equal(normalizePhone('0034 600-000-000'),'+34600000000');
  assert.equal(whatsappUrl('+34 (600) 000 000'),'https://wa.me/34600000000');
  for(const value of ['600000000','javascript:alert(1)','+123','+000000000','+1234567890123456']) assert.throws(()=>normalizePhone(value));
});
