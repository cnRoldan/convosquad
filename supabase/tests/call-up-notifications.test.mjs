import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const ids=Array.from({length:6},(_,i)=>`90000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [owner,player,other,optout,outsider,unlinked]=ids;
let db;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(user,sql,args=[])=>(await query(user,sql,args)).rows[0];
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
before(async()=>{
  db=await createTestDatabase();
  for(const [i,id] of ids.entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Notify_${i}`}]);
  for(const [i,user] of [owner,player,other,other,optout,outsider].entries()) await query(user,'select public.register_push_device($1,$2,$3)',[`91000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`ExpoPushToken[Notice_${i}]`,'android']);
});
after(async()=>{await db?.close();});
async function setup(timezone='Europe/Madrid'){
  const club=await row(owner,'select * from public.create_club($1,null,$2)',[`Club_${randomUUID().slice(0,8)}`,timezone]);
  for(const user of [player,other,optout,unlinked]) await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,user]);
  for(const [i,user] of [owner,player,other,optout].entries()){
    const p=await row(owner,"insert into public.players(club_id,ea_id,category,jersey_number) values($1,$2,'midfielders',$3) returning *",[club.id,`EA_${i}`,i+1]);
    await query(owner,'select * from public.link_player_account($1,$2)',[p.id,user]);
  }
  const call=await row(owner,"select * from public.create_call_up_with_notice($1,'2035-06-01T19:50:00Z','2035-06-01T16:45:00Z','open')",[club.id]);
  const entry=await row(player,'select * from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,player]);
  for(const user of [owner,player,other,optout]) await query(user,'select public.set_notification_preferences(true)');
  return {club,call,entry};
}
test('aviso pertenece a la convocatoria, respeta día/zona y edición atómica sin duplicar fechas',async()=>{
  const {club,call}=await setup();
  assert.equal(new Date(call.last_notice_at).toISOString(),'2035-06-01T16:45:00.000Z');
  await assert.rejects(query(owner,"select * from public.create_call_up_with_notice($1,'2035-06-02T19:50:00Z','2035-06-02T20:00:00Z','open')",[club.id]),{code:'23514'});
  assert.equal((await query(owner,'select * from public.call_ups where club_id=$1',[club.id])).rows.length,1);
  await assert.rejects(query(player,"select * from public.update_call_up_with_notice($1,'2035-06-01T19:50:00Z','open',null)",[call.id]),{code:'42501'});
  const moved=await row(owner,"select * from public.update_call_up_with_notice($1,'2035-06-02T19:50:00Z','open','2035-06-02T16:45:00Z')",[call.id]);
  assert.equal(moved.local_date.toISOString().slice(0,10),'2035-06-02');
  await assert.rejects(query(owner,"select * from public.create_call_up_with_notice($1,'2035-06-02T20:50:00Z',null,'open')",[club.id]),{code:'23505'});
});
test('preferencia propia: RLS oculta otras cuentas y ningún cliente escribe preferencias ajenas',async()=>{
  await setup();await query(player,'select public.set_notification_preferences(false)');
  const prefs=(await query(player,'select * from public.notification_preferences')).rows;
  assert.equal(prefs.length,1);assert.equal(prefs[0].user_id,player);assert.equal(prefs[0].vote_notifications,false);
  await assert.rejects(query(player,'update public.notification_preferences set vote_notifications=false where user_id=$1',[other]),{code:'42501'});
  await assert.rejects(query(player,'insert into public.notification_preferences(user_id) values($1)',[outsider]),{code:'42501'});
  await assert.rejects(asUser(db,null,tx=>tx.query('select public.set_notification_preferences(true)'),'anon'),{code:'42501'});
});
test('voto avisa a otros jugadores registrados y sus dispositivos, excluye autor, opt-out y otro club',async()=>{
  const {call,entry}=await setup();await query(optout,'select public.set_notification_preferences(false)');
  await query(player,"select public.respond_to_call_up($1,'available')",[entry.id]);
  const event=(await db.query("select * from public.push_events where call_up_id=$1 and kind='vote'",[call.id])).rows[0];
  assert.equal(event.actor_user_id,player);assert.equal(event.actor_ea_id,'EA_1');assert.equal(event.vote_availability,'available');
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[event.id])).rows;
  assert.equal(deliveries.length,3);assert.deepEqual(new Set(deliveries.map(d=>d.user_id)),new Set([owner,other]));
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[event.id])).rows.length,0);
});
test('30 segundos se aplican en servidor; voto igual es idempotente y no retrasa el desbloqueo',async()=>{
  const {call,entry}=await setup();
  const first=await row(player,"select * from public.respond_to_call_up($1,'available')",[entry.id]);
  await assert.rejects(query(player,"select public.respond_to_call_up($1,'backup')",[entry.id]),{code:'P0030'});
  const repeat=await row(player,"select * from public.respond_to_call_up($1,'available')",[entry.id]);
  assert.equal(repeat.responded_at.getTime(),first.responded_at.getTime());
  assert.equal((await db.query("select * from public.push_events where call_up_id=$1 and kind='vote'",[call.id])).rows.length,1);
  await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[entry.id]);
  assert.equal((await row(player,"select * from public.respond_to_call_up($1,'backup')",[entry.id])).availability,'backup');
  assert.equal((await db.query("select * from public.push_events where call_up_id=$1 and kind='vote'",[call.id])).rows.length,2);
});
test('preferencia revocada y membresía retirada después del voto cancelan envíos todavía pendientes',async()=>{
  const {club,call,entry}=await setup();
  await query(player,"select public.respond_to_call_up($1,'available')",[entry.id]);
  await query(other,'select public.set_notification_preferences(false)');
  await query(optout,'select public.set_notification_preferences(false)');
  await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2',[club.id,other]);
  const event=(await db.query("select id from public.push_events where call_up_id=$1 and kind='vote'",[call.id])).rows[0];
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[event.id])).rows;
  assert.deepEqual(deliveries.map(d=>d.user_id),[owner]);
});
test('acciones push responden solo por uno mismo, rechazan ajenos, Disponible tras el cierre y usuarios sin ficha y no repiten eventos',async()=>{
  const {club,call,entry}=await setup();
  const respond=(user,state,key='notification:available')=>query(user,'select * from public.respond_from_notification($1,$2,$3,$4)',[club.id,call.id,state,key]);
  for(const user of [outsider,unlinked])await assert.rejects(respond(user,'available'),{code:'42501'});
  await respond(player,'available');
  assert.equal((await row(player,'select availability from public.call_up_players where id=$1',[entry.id])).availability,'available');
  await assert.rejects(respond(player,'backup','notification:backup'),{code:'P0030'});
  await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[entry.id]);
  await query(player,"select public.respond_to_call_up($1,'unavailable')",[entry.id]);
  await respond(player,'available');
  assert.equal((await row(player,'select availability from public.call_up_players where id=$1',[entry.id])).availability,'unavailable');
  await query(owner,'select * from public.update_call_up_with_notice($1,$2,$3,$4)',[call.id,call.starts_at,'closed',call.last_notice_at]);
  await assert.rejects(respond(player,'available','new-action'),{code:'P0031'});
  await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[entry.id]);
  await respond(player,'backup','late-backup');
  await assert.rejects(query(player,'select * from public.prepare_due_call_up_reminders()'),{code:'42501'});
});
test('último aviso es puntual, solo pendientes y no depende ya del ajuste de club',async()=>{
  const {club,call,entry}=await setup('UTC');
  await query(owner,"select * from public.update_call_up_with_notice($1,date_trunc('day',now())+interval '23 hours 59 minutes 59 seconds','open',date_trunc('day',now()))",[call.id]);
  await query(player,"select public.respond_to_call_up($1,'available')",[entry.id]);
  const events=(await server('select * from public.prepare_due_call_up_reminders()')).rows;
  assert.equal(events.length,1);
  assert.equal((await server('select * from public.prepare_due_call_up_reminders()')).rows.length,0);
  const eventId=Object.values(events[0])[0];
  // Desactivar los avisos de votos no desactiva el último aviso para votar.
  await query(other,'select public.set_notification_preferences(false)');
  await query(owner,'update public.clubs set reminder_minutes=null where id=$1',[club.id]);
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[eventId])).rows;
  assert.equal(deliveries.length,4);assert.ok(deliveries.every(d=>d.user_id!==player&&d.user_id!==outsider));
});
