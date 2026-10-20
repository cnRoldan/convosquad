import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatchReminders } from '../supabase/functions/_shared/reminder-worker.ts';
import { pushMessage } from '../supabase/functions/_shared/push-event.ts';

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
test('el recordatorio de valoración se traduce y abre la convocatoria sin botones de voto', () => {
  const titles = new Set();
  for (const language of ['es','en','de','fr']) {
    const message = pushMessage({ clubId:'club',callUpId:'call',eventKey:'evaluation',kind:'evaluation' },'token','captain',true,language);
    assert.equal('categoryId' in message,false);
    assert.deepEqual(message.data,{type:'call_up',clubId:'club',callUpId:'call',userId:'captain'});
    assert.ok(message.body.length>20);titles.add(message.title);
  }
  assert.equal(titles.size,4);
});

test('admisión: nombre del club, cuatro idiomas y sin acciones de voto ni convocatoria inventada',async()=>{
 const titles=new Set();
 for(const language of ['es','en','de','fr']) {
  const msg=pushMessage({clubId:'club',callUpId:null,eventKey:'club-approved:request',kind:'club_approved',clubName:'Wabi Sabi'},'token','new-member',true,language);
  assert.match(msg.body,/Wabi Sabi/);assert.equal('categoryId' in msg,false);assert.equal(msg.data.type,'club_approved');assert.equal('callUpId' in msg.data,false);titles.add(msg.title);
  if(language==='es') assert.equal(msg.body,'Wabi Sabi te ha admitido en su club. Ya puedes acceder a sus convocatorias.');
 }
 assert.equal(titles.size,4);
 let captured;
 await dispatchReminders({async prepare(){},async events(){return [{id:'e',club_id:'club',call_up_id:null,event_key:'club-approved:r',kind:'club_approved',club_name_snapshot:'Wabi Sabi'}]},async claim(){return [{id:'d',token_snapshot:'token',user_id:'u',preferred_language:'es',can_vote:false}]},async finish(){}},async messages=>{captured=messages[0];return {data:[{status:'ok',id:'ticket'}]}});
 assert.match(captured.body,/Wabi Sabi/);assert.equal(captured.data.userId,'u');
});

test('solicitud entrante usa nombres reales e idioma del capitán, sin botones de voto',async()=>{
 const titles=new Set();
 for(const language of ['es','en','de','fr']){
  const message=pushMessage({clubId:'club',callUpId:null,eventKey:'club-join-request:r',kind:'club_join_request',clubName:'Wabi Sabi',actorEaId:'NuevoEA'},'token','captain',true,language);
  assert.match(message.body,/NuevoEA/);assert.match(message.body,/Wabi Sabi/);assert.equal('categoryId' in message,false);assert.deepEqual(message.data,{type:'club_join_request',clubId:'club',userId:'captain'});titles.add(message.title);
  if(language==='es')assert.equal(message.body,'NuevoEA quiere unirse a Wabi Sabi. Revisa las solicitudes pendientes.');
 }
 assert.equal(titles.size,4);
 let captured;
 await dispatchReminders({async prepare(){},async events(){return [{id:'e',club_id:'club',call_up_id:null,event_key:'club-join-request:r',kind:'club_join_request',club_name_snapshot:'Wabi Sabi',actor_ea_id:'NuevoEA'}]},async claim(){return [{id:'d',token_snapshot:'token',user_id:'captain',can_vote:false,preferred_language:'en'}]},async finish(){}},async messages=>{captured=messages[0];return {data:[{status:'ok',id:'ticket'}]}});
 assert.equal(captured.body,'NuevoEA wants to join Wabi Sabi. Review the pending requests.');
});
