import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lastNoticeInstant, responseCooldown } from '../src/features/call-ups/last-notice.ts';
import { readNotificationResponse, notificationActions, availabilityCategory } from '../src/features/notifications/actions.ts';
import { readPushIntent } from '../src/features/notifications/intent.ts';
import { callUpErrorMessage } from '../src/features/call-ups/availability.ts';
import { pushMessage } from '../supabase/functions/_shared/push-event.ts';
import { dispatchReminders } from '../supabase/functions/_shared/reminder-worker.ts';
const clubId='80000000-0000-4000-8000-000000000010',callUpId='80000000-0000-4000-8000-000000000020',userId='80000000-0000-4000-8000-000000000030';

test('recordatorios de valoración conservan destino y destinatario tras tocar, guardar y restaurar; no permiten votar',()=>{
 for(const kind of ['evaluation','evaluation_deadline']) {
  const data={type:'call_up',clubId,callUpId,userId,kind};
  const intent=readNotificationResponse(data,'default','notification','default');
  assert.deepEqual(intent,{clubId,callUpId,userId,rating:true});
  assert.deepEqual(readPushIntent({type:'call_up',...intent}),intent);
  assert.equal(readNotificationResponse(data,notificationActions[0].identifier,'notification','default'),null);
  assert.equal(readPushIntent({...data,userId:'invalid'}),null);
 }
});

test('último aviso usa zona del club, respeta horario de verano y admite desactivación', () => {
  assert.equal(lastNoticeInstant(true,'2026-10-15','18:45','Europe/Madrid','2026-10-15T19:50:00Z'),'2026-10-15T16:45:00.000Z');
  assert.equal(lastNoticeInstant(true,'2026-12-15','18:45','Europe/Madrid','2026-12-15T20:50:00Z'),'2026-12-15T17:45:00.000Z');
  assert.equal(lastNoticeInstant(false,'invalid','invalid','Europe/Madrid','invalid'),null);
  assert.throws(()=>lastNoticeInstant(true,'2026-10-15','22:00','Europe/Madrid','2026-10-15T19:50:00Z'),/anterior/);
  assert.throws(()=>lastNoticeInstant(true,'2026-10-15','25:00','Europe/Madrid','2026-10-15T19:50:00Z'));
});
test('cuenta atrás de cambios termina a los 30 segundos y tolera datos iniciales ausentes', () => {
  const time=Date.parse('2026-10-15T12:00:00Z');
  assert.equal(responseCooldown(null,time),0);assert.equal(responseCooldown('invalid',time),0);
  assert.equal(responseCooldown(new Date(time).toISOString(),time),30);
  assert.equal(responseCooldown(new Date(time).toISOString(),time+29_001),1);
  assert.equal(responseCooldown(new Date(time).toISOString(),time+30_000),0);
  assert.match(callUpErrorMessage({code:'P0030'}),/30 segundos/);
});
test('las tres acciones push incluyen destinatario e idempotencia; desconocidas y payloads falsos no votan', () => {
  const payload={type:'call_up',clubId,callUpId,userId};
  for(const action of notificationActions){
    const intent=readNotificationResponse(payload,action.identifier,'notification-1','default');
    assert.equal(intent.response.availability,action.availability);assert.equal(intent.response.userId,userId);
    assert.deepEqual(readPushIntent({type:'call_up',...intent}),intent);
  }
  assert.equal(readNotificationResponse(payload,'unknown','notification-1','default'),null);
  assert.equal(readNotificationResponse({...payload,userId:'invalid'},notificationActions[0].identifier,'notification-1','default'),null);
  assert.equal(readPushIntent({...payload,response:{availability:'admin',userId,actionId:'request'}}),null);
  assert.equal(readNotificationResponse(payload,'default','notification-1','default').response,undefined);
});
test('worker distingue votos y avisos pendientes, añade acciones y no reenvía el mismo evento', async () => {
  const messages=[];let claimed=false;
  const event={id:'event',club_id:clubId,call_up_id:callUpId,event_key:'vote:1:1',kind:'vote',actor_ea_id:'Jugador_1',vote_availability:'unavailable'};
  const store={async prepare(){},async events(){return [event];},async claim(){if(claimed)return [];claimed=true;return [{id:'delivery',token_snapshot:'ExpoPushToken[fixture]',user_id:userId}];},async finish(){}};
  await dispatchReminders(store,async batch=>{messages.push(...batch);return {data:[{status:'ok',id:'ticket'}]};});
  assert.match(messages[0].body,/Jugador_1.*No disponible/);assert.equal(messages[0].categoryId,undefined);
  assert.equal(messages[0].data.userId,userId);
  await dispatchReminders(store,async()=>{throw new Error('Must not send twice');});
  assert.equal(messages.length,1);
  const notice=pushMessage({clubId,callUpId,eventKey:'notice',kind:'reminder'},'ExpoPushToken[fixture]',userId);
  assert.match(notice.title,/Último aviso/);assert.equal(notice.categoryId,availabilityCategory);
});
