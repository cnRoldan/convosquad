import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DeviceWriteGate } from '../src/features/notifications/device-write-gate.ts';
import { registerDeviceWithPermission } from '../src/features/notifications/device-registration.ts';
import { readPushIntent, notificationDestination } from '../src/features/notifications/intent.ts';
import { parsePushEvent, authorizedWorker, pushMessage } from '../supabase/functions/_shared/push-event.ts';
const clubId='80000000-0000-4000-8000-000000000010', callUpId='80000000-0000-4000-8000-000000000020';
const intent={clubId,callUpId};
function device(allowed=true) {
  const calls=[];let current=true;let permission=allowed;
  return {calls, changeUser:()=>{current=false;},deps:{supported:true,current:async()=>current,permission:async()=>permission,
    requestPermission:async()=>{calls.push('permission');return permission;},token:async()=>{calls.push('token');return 'ExpoPushToken[unit_only]';},
    register:async token=>{calls.push(['register',token]);},deactivate:async()=>{calls.push('deactivate');}}, allow:()=>{permission=true;}};
}
test('registro con permiso y actualizaciones utilizan Expo tokens y usuario actual',async()=>{
  const d=device();assert.equal(await registerDeviceWithPermission(d.deps,true),'enabled');assert.deepEqual(d.calls,['token',['register','ExpoPushToken[unit_only]']]);
  d.deps.token=async()=> 'ExpoPushToken[rotated_unit_only]';await registerDeviceWithPermission(d.deps,false);assert.deepEqual(d.calls.at(-1),['register','ExpoPushToken[rotated_unit_only]']);
});
test('permiso rechazado desactiva y no obtiene token; sincronizar no vuelve a solicitar permiso',async()=>{
  const d=device(false);assert.equal(await registerDeviceWithPermission(d.deps,true),'denied');assert.deepEqual(d.calls,['permission','deactivate']);
  d.calls.length=0;assert.equal(await registerDeviceWithPermission(d.deps,false),'denied');assert.deepEqual(d.calls,['deactivate']);
});
test('web y sesión cerrada no piden permisos ni registran tokens',async()=>{
  const d=device();d.deps.supported=false;assert.equal(await registerDeviceWithPermission(d.deps,true),'unsupported');assert.deepEqual(d.calls,[]);
  d.deps.supported=true;d.changeUser();assert.equal(await registerDeviceWithPermission(d.deps,true),'cancelled');assert.deepEqual(d.calls,[]);
});
test('cambio de usuario/cierre durante la obtención del token impide registro tardío',async()=>{
  const d=device();d.deps.token=async()=>{d.changeUser();return 'ExpoPushToken[late_unit_only]';};assert.equal(await registerDeviceWithPermission(d.deps,true),'cancelled');assert.deepEqual(d.calls,[]);
});
test('payload malformado o URL arbitraria no permite navegación; IDs válidos se normalizan',()=>{
  for(const bad of [null,{url:'https://external.invalid'}, {type:'call_up',clubId,callUpId:'invalid'},{type:'availability',...intent}])assert.equal(readPushIntent(bad),null);
  assert.deepEqual(readPushIntent({type:'call_up',...intent,url:'https://ignored.invalid'}),intent);
});
test('navegación exige sesión, club propio, convocatoria del mismo club y estado accesible',()=>{
  const clubs=[{id:clubId}],call={club_id:clubId,status:'open'};
  assert.equal(notificationDestination(intent,false,clubs,call),'login');assert.equal(notificationDestination(intent,true,[],call),'no-membership');
  assert.equal(notificationDestination(intent,true,clubs,null),'unavailable');assert.equal(notificationDestination(intent,true,clubs,{...call,club_id:callUpId}),'unavailable');
  assert.equal(notificationDestination(intent,true,clubs,{...call,status:'cancelled'}),'cancelled');assert.equal(notificationDestination(intent,true,clubs,call),'call-up');
});
test('solo el secreto de worker autoriza preparar eventos; no hay destinatarios/mensajes arbitrarios',()=>{
  const secret='unit-only-worker-secret-not-a-real-credential';assert.equal(authorizedWorker(null,secret),false);assert.equal(authorizedWorker('Bearer user-jwt',secret),false);assert.equal(authorizedWorker(`Bearer ${secret}`,undefined),false);assert.equal(authorizedWorker(`Bearer ${secret}`,secret),true);
  const event={...intent,eventKey:'published:unit',kind:'published'};assert.deepEqual(parsePushEvent(event),event);
  assert.equal(parsePushEvent({...event,to:'another-user'}),null);assert.equal(parsePushEvent({...event,body:'arbitrary'}),null);assert.equal(parsePushEvent({...event,kind:'arbitrary'}),null);
  const message=pushMessage(event,'ExpoPushToken[unit_only]');assert.deepEqual(readPushIntent(message.data),intent);assert.equal(message.channelId,'call-ups');assert.equal(message.categoryId,'call-up-availability');
});

test('logout bloquea registros tardíos y desvincula después de escrituras pendientes',async()=>{
  const gate=new DeviceWriteGate(),operations=[];let release;const wait=new Promise(resolve=>{release=resolve;});
  const started=gate.run(async()=>{operations.push('register-start');await wait;operations.push('register-finish');});
  await Promise.resolve();gate.pause('user');const cleanup=gate.run(async()=>{operations.push('unlink');});
  const late=gate.run(async()=>{if(gate.allowed('user'))operations.push('late-register');});release();await Promise.all([started,cleanup,late]);
  assert.deepEqual(operations,['register-start','register-finish','unlink']);assert.equal(gate.allowed('user'),false);assert.equal(gate.allowed('other'),true);
});
test('fallo de desvinculación no habilita de nuevo el dispositivo ni bloquea un reintento explícito',async()=>{
  const gate=new DeviceWriteGate();gate.pause('user');await assert.rejects(gate.run(async()=>{throw new Error('offline');}));
  assert.equal(gate.allowed('user'),false);await gate.run(async()=>{});gate.resume('user');assert.equal(gate.allowed('user'),true);
});
