import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clubLocalDateTime, clubLocalTimeToInstant } from '../src/features/call-ups/local-time.ts';
import { countAvailability, callUpErrorMessage } from '../src/features/call-ups/availability.ts';
import { startCallUpSync } from '../src/features/call-ups/realtime-sync.ts';

test('fecha inicial y edición usan la zona del club incluso junto a medianoche y cambio de horario', () => {
  assert.deepEqual(clubLocalDateTime('Europe/Madrid', new Date('2026-10-14T23:30:00Z')), { date: '2026-10-15', time: '01:30' });
  assert.deepEqual(clubLocalDateTime('America/Los_Angeles', new Date('2026-10-14T01:30:00Z')), { date: '2026-10-13', time: '18:30' });
  assert.equal(clubLocalTimeToInstant('2026-10-15', '01:30', 'Europe/Madrid'), '2026-10-14T23:30:00.000Z');
  assert.throws(() => clubLocalTimeToInstant('2026-10-25', '02:30', 'Europe/Madrid'), /se repite/);
});
test('contadores usan las cuatro respuestas de la plantilla y explican duplicados y cierres en español', () => {
  assert.deepEqual(countAvailability([{ availability: 'available' }, { availability: 'backup' }, { availability: 'unavailable' }, { availability: 'unanswered' }, { availability: 'unanswered' }]), { available: 1, unavailable: 1, backup: 1, unanswered: 2 });
  assert.deepEqual(countAvailability([]), { available: 0, unavailable: 0, backup: 0, unanswered: 0 });
  assert.match(callUpErrorMessage({ code: '23505' }), /fecha local/);
  assert.match(callUpErrorMessage({ code: '42501' }), /cerrado o cancelado/);
  assert.ok(!callUpErrorMessage(new Error('private data')).includes('private data'));
});
function harness() {
  let nextId = 0, now = 0; const timers = new Map(), channels = [], statuses = []; let reads = 0;
  const timer = (fn, delay, repeat = false) => { const id = ++nextId; timers.set(id, { fn, due: now + delay, delay, repeat }); return id; };
  const clock = { timeout: timer, cancelTimeout: id => timers.delete(id), interval: (fn, delay) => timer(fn, delay, true), cancelInterval: id => timers.delete(id) };
  const sync = startCallUpSync({ clock, reload: () => reads++, status: state => statuses.push(state), connect: (change, status) => { const channel = { change, status, removed: false }; channels.push(channel); return () => { channel.removed = true; channel.status('CLOSED'); }; } });
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const candidates = [...timers.entries()].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due);
      if (!candidates.length) break;
      const [id, entry] = candidates[0]; now = entry.due;
      if (entry.repeat) entry.due += entry.delay; else timers.delete(id);
      entry.fn();
    }
    now = end;
  }
  return { sync, channels, statuses, advance, timers, reads: () => reads };
}
test('Realtime recupera datos inicialmente, al suscribirse y ante ráfagas de respuestas', () => {
  const h = harness(); h.advance(150); assert.equal(h.reads(), 1);
  h.channels[0].status('SUBSCRIBED'); h.advance(150); assert.equal(h.reads(), 2);
  h.channels[0].change(); h.channels[0].change(); h.channels[0].change(); h.advance(150); assert.equal(h.reads(), 3);
  assert.equal(h.statuses.at(-1), 'live'); h.sync.stop();
});
test('Realtime reconecta, recupera eventos perdidos y descarta callbacks de canales antiguos', () => {
  const h = harness(); h.advance(150); h.channels[0].status('TIMED_OUT'); h.advance(1000);
  assert.equal(h.channels.length, 2); assert.equal(h.channels[0].removed, true);
  h.channels[1].status('SUBSCRIBED'); h.advance(150); const count = h.reads();
  h.channels[0].status('CHANNEL_ERROR'); h.channels[0].change(); h.advance(2000); assert.equal(h.channels.length, 2); assert.equal(h.reads(), count);
  h.channels[1].change(); h.advance(150); assert.equal(h.reads(), count + 1);
  h.sync.stop();
});
test('sondeo y recuperación al volver a la app funcionan sin eventos; desmontar elimina timers/canales', () => {
  const h = harness(); h.advance(30150); assert.equal(h.reads(), 2);
  h.sync.refresh(); h.advance(150); assert.equal(h.reads(), 3);
  h.channels[0].status('CHANNEL_ERROR'); h.sync.stop(); const count = h.reads();
  h.advance(60000); h.channels[0].change(); h.channels[0].status('SUBSCRIBED'); h.advance(150);
  assert.equal(h.reads(), count); assert.equal(h.channels.length, 1); assert.equal(h.timers.size, 0);
});
