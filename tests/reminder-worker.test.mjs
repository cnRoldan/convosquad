import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatchReminders } from '../supabase/functions/_shared/reminder-worker.ts';

function fixture() {
  const event = { id: 'event', club_id: 'club', call_up_id: 'call', event_key: 'reminder' };
  const pending = new Map([['one', 'ExpoPushToken[one]'], ['two', 'ExpoPushToken[two]']]);
  const results = [];
  const store = {
    async prepare() {}, async events() { return [event]; },
    async claim() { const rows = [...pending].map(([id, token_snapshot]) => ({ id, token_snapshot })); pending.clear(); return rows; },
    async finish(id, state, ticketId) { results.push({ id, state, ticketId }); },
  };
  return { store, results };
}
test('worker envía mensajes del club y convocatoria reservados, con tickets y sin duplicar', async () => {
  const f = fixture(); const messages = [];
  const send = async batch => { messages.push(...batch); return { data: [{ status: 'ok', id: 'ticket' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }] }; };
  const counts = await dispatchReminders(f.store, send);
  assert.deepEqual(counts, { attempted: 2, accepted: 1, failed: 1, unknown: 0 });
  assert.deepEqual(messages[0].data, { type: 'call_up', clubId: 'club', callUpId: 'call' });
  assert.match(messages[0].title, /Último aviso/);
  assert.deepEqual(f.results.map(row => row.state), ['sent','failed']);
  await dispatchReminders(f.store, send);
  assert.equal(messages.length, 2);
});
test('fallos de red y respuestas ambiguas no provocan reenvíos automáticos', async () => {
  for (const send of [async () => { throw new Error('network'); }, async () => ({ data: [] }), async () => ({ data: [{ status: 'ok' }, {}] })]) {
    const f = fixture(); const counts = await dispatchReminders(f.store, send);
    assert.equal(counts.unknown, 2); assert.equal(counts.accepted, 0);
    assert.ok(f.results.every(row => row.state === 'unknown'));
    const retry = await dispatchReminders(f.store, send); assert.equal(retry.attempted, 0);
  }
});
