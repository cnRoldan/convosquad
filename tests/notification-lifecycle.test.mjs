import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performNotificationAction, submitNotificationAction } from '../src/features/notifications/perform-action.ts';
import { readNotificationResponse, notificationActions, availabilityCategory } from '../src/features/notifications/actions.ts';
import { notificationDestination, readPushIntent } from '../src/features/notifications/intent.ts';
import { pushMessage } from '../supabase/functions/_shared/push-event.ts';
const clubId='b0000000-0000-4000-8000-000000000001',callUpId='b0000000-0000-4000-8000-000000000002',userId='b0000000-0000-4000-8000-000000000003';
const payload={type:'call_up',clubId,callUpId,userId};
const intent=()=>readNotificationResponse(payload,notificationActions[0].identifier,'notice-1','default');

test('las tres acciones se guardan con la sesión del destinatario sin depender de navegación',async()=>{
  for(const action of notificationActions){
    const selected=readNotificationResponse(payload,action.identifier,'notice-1','default');let writes=0;
    const result=await performNotificationAction(selected,{
      async session(){return {userId,accessToken:'fixture-session-token'};},
      async respond(request,session){writes++;assert.equal(session.userId,userId);assert.equal(session.accessToken,'fixture-session-token');assert.equal(request.response.availability,action.availability);assert.match(request.response.actionId,/notice-1/);return action.availability;},
    });
    assert.equal(result.saved,true);assert.match(result.message,/Tu respuesta/);assert.equal(writes,1);
  }
});
test('sin sesión o con otra cuenta nunca se solicita guardar el voto',async()=>{
  for(const session of [null,{userId:clubId,accessToken:'fixture-other-session'}]){
    const result=await performNotificationAction(intent(),{async session(){return session;},async respond(){assert.fail('Must not write');}});
    assert.equal(result.saved,false);assert.match(result.message,/sesión|otra cuenta/);
  }
});
test('errores de red, cooldown y convocatoria cerrada no anuncian un voto guardado ni se reintentan',async()=>{
  for(const error of [new TypeError('network'),{code:'P0030'},{code:'42501'}]){
    let writes=0;
    const result=await performNotificationAction(intent(),{async session(){return {userId,accessToken:'fixture'};},async respond(){writes++;throw error;}});
    assert.equal(result.saved,false);assert.equal(writes,1);assert.equal(result.message.includes('fixture'),false);
    if(error.code==='P0030')assert.match(result.message,/30 segundos/);
  }
});
test('publicación tiene botones para fichas vinculadas; cancelación informa sin acciones y mantiene el club',async()=>{
  const event={clubId,callUpId,eventKey:'lifecycle',kind:'published'};
  assert.equal(pushMessage(event,'ExpoPushToken[fixture]',userId,true).categoryId,'call_up_availability');
  assert.equal(pushMessage(event,'ExpoPushToken[fixture]',userId,false).categoryId,undefined);
  const cancelled=pushMessage({...event,kind:'cancelled'},'ExpoPushToken[fixture]',userId,false);
  assert.equal(cancelled.categoryId,undefined);assert.match(cancelled.title,/cancelada/);
  const navigation=readNotificationResponse(cancelled.data,'default','cancelled-1','default');
  assert.equal(navigation.cancelled,true);
  assert.deepEqual(readPushIntent({type:'call_up',...navigation}),navigation);
  assert.equal(notificationDestination(navigation,true,[{id:clubId}],null),'cancelled');
  assert.equal(notificationDestination(navigation,true,[],null),'no-membership');
  assert.equal(readNotificationResponse(cancelled.data,notificationActions[0].identifier,'cancelled-1','default'),null);
  const result=await performNotificationAction({...intent(),cancelled:true},{async session(){assert.fail('Must not read session');},async respond(){assert.fail('Must not vote');}});
  assert.equal(result.saved,false);
});

test('transporte de background fija el JWT y solo envía su respuesta mediante el RPC autorizado',async()=>{
  const request=intent();
  const status=await submitNotificationAction({url:'https://auth.example.test',publishableKey:'public-fixture-key'},request,{userId,accessToken:'fixture-bound-user-token'},async(url,init)=>{
    assert.equal(url,'https://auth.example.test/rest/v1/rpc/respond_from_notification');
    assert.equal(init.headers.Authorization,'Bearer fixture-bound-user-token');
    assert.equal(init.headers.apikey,'public-fixture-key');
    assert.equal(init.headers.Accept,'application/vnd.pgrst.object+json');
    assert.deepEqual(JSON.parse(init.body),{p_club_id:clubId,p_call_up_id:callUpId,p_availability:'available',p_action_id:request.response.actionId});
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({availability:'available'});
  });
  assert.equal(status,'available');
});
test('respuesta inválida o rechazo de Auth no se trata como éxito ni expone el mensaje del servidor',async()=>{
  const config={url:'https://auth.example.test',publishableKey:'public-fixture-key'},session={userId,accessToken:'fixture-token'};
  for(const reply of [Response.json({unexpected:true}),Response.json({code:'42501',message:'private-server-detail'},{status:403})]){
    const result=await performNotificationAction(intent(),{async session(){return session;},respond:(action,account)=>submitNotificationAction(config,action,account,async()=>reply)});
    assert.equal(result.saved,false);assert.equal(result.message.includes('private-server-detail'),false);
  }
});

test('la categoría del emisor coincide con la registrada y usa un identificador compatible con Expo', () => {
  assert.match(availabilityCategory, /^[A-Za-z0-9_]+$/);
  assert.equal(notificationActions.length, 3);
  assert.equal(new Set(notificationActions.map(action => action.identifier)).size, 3);
  for (const kind of ['published', 'pending', 'reminder']) {
    const message = pushMessage({clubId, callUpId, eventKey: 'actions', kind}, 'ExpoPushToken[fixture]', userId, true);
    assert.equal(message.categoryId, availabilityCategory);
    for (const action of notificationActions) {
      const intent = readNotificationResponse(message.data, action.identifier, 'notification', 'default');
      assert.equal(intent.response.availability, action.availability);
    }
  }
  assert.equal(pushMessage({clubId, callUpId, eventKey: 'vote', kind: 'vote'}, 'ExpoPushToken[fixture]', userId, true).categoryId, undefined);
});

test('admisión abre el club sin permitir votos y rechaza payloads sin cuenta o manipulados',()=>{
 const payload={type:'club_approved',clubId,userId};
 const intent=readNotificationResponse(payload,'default','admission-1','default');
 assert.equal(intent.membership,true);assert.equal(intent.clubId,clubId);assert.equal(intent.userId,userId);assert.equal(intent.callUpId,'');
 assert.equal(readNotificationResponse(payload,'availability-available','admission-1','default'),null);
 assert.equal(readPushIntent({type:'club_approved',clubId}),null);
 assert.equal(readPushIntent({...payload,response:{availability:'available',userId,actionId:'fake'}}),null);
});

test('solicitud a capitanes valida cuenta y club, persiste intención y solo acepta abrir sin acciones de voto',()=>{
 const payload={type:'club_join_request',clubId,userId};
 const intent=readNotificationResponse(payload,'default','join-1','default');
 assert.deepEqual(intent,{clubId,callUpId:'',joinRequest:true,userId});
 assert.deepEqual(readPushIntent(JSON.parse(JSON.stringify({type:'club_join_request',...intent}))),intent);
 for(const action of notificationActions)assert.equal(readNotificationResponse(payload,action.identifier,'join-1','default'),null);
 for(const bad of [{...payload,userId:'invalid'},{...payload,clubId:'invalid'},{type:'club_join_request',clubId},{...payload,response:{availability:'available',userId,actionId:'fake'}}])assert.equal(readPushIntent(bad),null);
});
