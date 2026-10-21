import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestRatingCalls, ratingCutoff, ratingDeadline, ratingWindowOpen } from '../src/features/ratings/window.ts';
import { endInstant } from '../src/features/call-ups/end-time.ts';
test('finalización respeta Madrid/Canarias y pasa a mañana tras medianoche',()=>{
 assert.equal(endInstant('2026-10-18','23:45','Europe/Madrid','2026-10-18T19:50:00Z'),'2026-10-18T21:45:00.000Z');
 assert.equal(endInstant('2026-10-18','23:45','Atlantic/Canary','2026-10-18T20:50:00Z'),'2026-10-18T22:45:00.000Z');
 assert.equal(endInstant('2026-10-18','01:00','Europe/Madrid','2026-10-18T19:50:00Z'),'2026-10-18T23:00:00.000Z');
 assert.equal(endInstant('2026-12-31','01:00','Europe/London','2026-12-31T21:50:00Z'),'2027-01-01T01:00:00.000Z');
});
test('no inventa horas inexistentes durante el cambio de horario ni admite entradas inválidas',()=>{
 assert.throws(()=>endInstant('2026-03-28','02:30','Europe/Madrid','2026-03-28T21:00:00Z'));
 assert.throws(()=>endInstant('2026-10-18','25:30','Europe/Madrid','2026-10-18T19:50:00Z'));
});

test('el límite de tres meses coincide con meses naturales incluso en fin de mes y año bisiesto',()=>{
 assert.equal(new Date(ratingCutoff(Date.parse('2026-05-31T12:00:00Z'))).toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(new Date(ratingCutoff(Date.parse('2024-05-31T12:00:00Z'))).toISOString(),'2024-02-29T12:00:00.000Z');
});

test('medianoche por defecto, igualdad con el inicio y cambios de hora usan días locales reales',()=>{
 assert.equal(endInstant('2026-10-20','00:00','Europe/Madrid','2026-10-20T19:50:00Z'),'2026-10-20T22:00:00.000Z');
 assert.equal(endInstant('2026-10-20','00:00','Atlantic/Canary','2026-10-20T20:50:00Z'),'2026-10-20T23:00:00.000Z');
 assert.equal(endInstant('2026-12-31','21:50','Europe/Madrid','2026-12-31T20:50:00Z'),'2027-01-01T20:50:00.000Z');
 assert.equal(endInstant('2026-03-28','04:00','Europe/Madrid','2026-03-28T20:50:00Z'),'2026-03-29T02:00:00.000Z');
 assert.equal(endInstant('2026-10-24','04:00','Europe/Madrid','2026-10-24T19:50:00Z'),'2026-10-25T03:00:00.000Z');
});

test('valoración abre al finalizar y vence exactamente tras 24 horas reales, incluso con cambio de horario',()=>{
 const call={id:'call',status:'closed',starts_at:'2026-10-24T19:50:00Z',ends_at:'2026-10-24T22:00:00Z',evaluation_at:'2026-10-24T22:00:00Z'};
 const end=Date.parse(call.ends_at);assert.equal(ratingDeadline(call),Date.parse('2026-10-25T22:00:00Z'));
 assert.equal(ratingWindowOpen(call,end-1),false);assert.equal(ratingWindowOpen(call,end),true);
 assert.equal(ratingWindowOpen(call,ratingDeadline(call)-1),true);assert.equal(ratingWindowOpen(call,ratingDeadline(call)),false);
 assert.equal(ratingWindowOpen({...call,evaluation_at:null},end),false);
 assert.equal(ratingWindowOpen({...call,status:'cancelled'},end),false);
});

test('solo la última finalizada, sin recuperar una anterior si la última no habilita valoración o ha vencido',()=>{
 const now=Date.parse('2026-10-21T12:00:00Z');
 const old={id:'old',status:'closed',starts_at:'2026-10-20T08:00:00Z',ends_at:'2026-10-20T23:00:00Z',evaluation_at:'2026-10-20T23:00:00Z'};
 const latest={...old,id:'latest',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T10:00:00Z',evaluation_at:'2026-10-21T10:00:00Z'};
 const active={...latest,id:'active',ends_at:'2026-10-21T13:00:00Z'};
 assert.deepEqual(latestRatingCalls([old,active,latest],now),[latest]);
 assert.deepEqual(latestRatingCalls([old,{...latest,evaluation_at:null}],now),[]);
 assert.deepEqual(latestRatingCalls([latest],Date.parse('2026-10-22T10:00:00Z')),[]);
});
