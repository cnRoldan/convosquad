import assert from 'node:assert/strict';
import { test } from 'node:test';
import { closingInstant, votingDeadlinePassed } from '../src/features/call-ups/closing-time.ts';
import { canRespondToPlayer } from '../src/features/call-ups/list-model.ts';
const start='2035-07-15T21:00:00Z';
test('cierre se interpreta en la zona de la convocatoria con horario de invierno y verano',()=>{
 assert.equal(closingInstant(true,'2035-07-15','20:45','Europe/Madrid',start,null),'2035-07-15T18:45:00.000Z');
 assert.equal(closingInstant(true,'2035-01-15','20:45','Europe/Madrid','2035-01-15T22:00:00Z',null),'2035-01-15T19:45:00.000Z');
 for(const zone of ['Atlantic/Canary','Europe/London']) assert.equal(closingInstant(true,'2035-07-15','20:45',zone,start,null),'2035-07-15T19:45:00.000Z');
 assert.throws(()=>closingInstant(true,'2026-03-29','02:30','Europe/Madrid','2026-03-29T12:00:00Z',null),/no existe/);
 assert.throws(()=>closingInstant(true,'2026-10-25','02:30','Europe/Madrid','2026-10-25T12:00:00Z',null),/se repite/);
});
test('aviso anterior al cierre, cierre hasta el inicio, opción sin cierre y bloqueo exacto',()=>{
 assert.equal(closingInstant(false,'','','',start,null),null);
 assert.throws(()=>closingInstant(true,'2035-07-15','23:30','Europe/Madrid',start,null),/anterior o igual/);
 assert.throws(()=>closingInstant(true,'2035-07-15','20:45','Europe/Madrid',start,'2035-07-15T18:45:00Z'),/aviso/);
 const closes_at='2035-07-15T18:45:00Z',deadline=Date.parse(closes_at);
 assert.equal(votingDeadlinePassed({closes_at},deadline-1),false);assert.equal(votingDeadlinePassed({closes_at},deadline),true);
 const call={status:'open',local_date:'2035-07-15',closes_at};
 assert.equal(canRespondToPlayer({userId:'me'},'me',call,'2035-07-15',false,deadline-1),true);
 assert.equal(canRespondToPlayer({userId:'me'},'me',call,'2035-07-15',false,deadline),false);
});
