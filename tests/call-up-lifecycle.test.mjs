import assert from 'node:assert/strict';
import {test} from 'node:test';
import {callUpStatusLabel} from '../src/features/call-ups/lifecycle.ts';
const now=Date.parse('2026-10-20T17:59:59Z');
const call={status:'open',local_date:'2026-10-20',timezone:'Europe/Madrid',closes_at:'2026-10-20T18:00:00Z'};
test('cerrar votación por plazo o manualmente mantiene la convocatoria activa antes y después del inicio',()=>{
 assert.equal(callUpStatusLabel(call,now),'Activa · Votación abierta');
 assert.equal(callUpStatusLabel(call,now+1000),'Activa · Votación cerrada');
 assert.equal(callUpStatusLabel({...call,status:'closed',closes_at:null},now),'Activa · Votación cerrada');
 assert.equal(callUpStatusLabel({...call,status:'closed'},Date.parse('2026-10-20T21:00:00Z')),'Activa · Votación cerrada');
});
test('histórico, borrador y cancelación no se confunden con votación cerrada',()=>{
 assert.equal(callUpStatusLabel(call,now,true),'Finalizada');
 assert.equal(callUpStatusLabel({...call,local_date:'2026-10-19'},now),'Finalizada');
 assert.equal(callUpStatusLabel({...call,status:'draft'},now),'Borrador');
 assert.equal(callUpStatusLabel({...call,status:'cancelled'},now),'Cancelada');
 assert.equal(callUpStatusLabel({...call,status:'cancelled'},now,true),'Cancelada');
});
test('el cambio de día utiliza la zona horaria del club y no UTC',()=>{
 assert.equal(callUpStatusLabel({...call,status:'closed'},Date.parse('2026-10-20T22:00:00Z')),'Finalizada');
 assert.equal(callUpStatusLabel({...call,status:'closed',timezone:'Atlantic/Canary'},Date.parse('2026-10-20T22:00:00Z')),'Activa · Votación cerrada');
});

test('la finalización exacta sustituye al cambio de día y cierra incluso sin plazo de voto',()=>{
 const extended={...call,status:'closed',ends_at:'2026-10-20T23:00:00Z'};
 assert.equal(callUpStatusLabel(extended,Date.parse('2026-10-20T22:30:00Z')),'Activa · Votación cerrada');
 assert.equal(callUpStatusLabel(extended,Date.parse(extended.ends_at)-1),'Activa · Votación cerrada');
 assert.equal(callUpStatusLabel(extended,Date.parse(extended.ends_at)),'Finalizada');
 assert.equal(callUpStatusLabel({...extended,status:'open',closes_at:null},Date.parse(extended.ends_at)),'Finalizada');
 const early={...call,ends_at:'2026-10-20T21:30:00Z'};
 assert.equal(callUpStatusLabel(early,Date.parse('2026-10-20T21:30:00Z')),'Finalizada');
});
