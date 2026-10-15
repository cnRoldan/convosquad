import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const users=Array.from({length:12},(_,i)=>`c0000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
const official=users.slice(0,5), backups=users.slice(5,9), [trial,aid,foreign]=users.slice(9);
const categories=['goalkeepers','centre_backs','wide_backs','midfielders','attackers'];
let db;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(user,sql,args=[])=>(await query(user,sql,args)).rows[0];
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
before(async()=>{
  db=await createTestDatabase();
  for(const [i,user] of users.entries()){
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[user,{username:`Recipient_${i}`}]);
    await query(user,"select public.register_push_device($1,$2,'android')",[`c1000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`ExpoPushToken[Recipient_${i}]`]);
  }
  await query(backups[0],"select public.register_push_device('c1000000-0000-4000-8000-999999999999','ExpoPushToken[Recipient_extra]','ios')");
});
after(async()=>{await db?.close();});
async function setup(due=false){
  const club=await row(official[0],'select * from public.create_club($1,null,$2)',[`Recipients_${randomUUID().slice(0,8)}`,'UTC']);
  for(const user of users.slice(1,11))await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,user]);
  for(const [i,user] of users.slice(0,9).entries()){
    const player=await row(official[0],"insert into public.players(club_id,ea_id,category) values($1,$2,$3) returning *",[club.id,`Recipient_${i}`,categories[i]??'backups']);
    await query(official[0],'select public.link_player_account($1,$2)',[player.id,user]);
  }
  await query(official[0],"insert into public.club_trials(club_id,ea_id,position) values($1,'Recipient_9','MC')",[club.id]);
  const call=await row(official[0],due
    ? "select * from public.create_call_up_with_notice($1,date_trunc('day',now())+interval '23 hours 59 minutes 59 seconds',date_trunc('day',now()),'open')"
    : "select * from public.create_call_up_with_notice($1,'2035-07-01T21:00:00Z','2035-07-01T18:45:00Z','open')",[club.id]);
  await query(official[0],"insert into public.call_up_aids(club_id,call_up_id,body) values($1,$2,'AYUDA: Recipient_10')",[club.id,call.id]);
  const entries=(await query(official[0],'select * from public.call_up_players where call_up_id=$1',[call.id])).rows;
  for(const [user,status] of [[official[0],'backup'],[backups[0],'available'],[backups[1],'unavailable'],[backups[2],'backup']]){
    await query(user,'select public.respond_to_call_up($1,$2)',[entries.find(p=>p.user_id===user).id,status]);
  }
  return {club,call,entries};
}
async function event(call,kind){return (await db.query('select * from public.push_events where call_up_id=$1 and kind=$2 order by created_at,id',[call.id,kind])).rows[0];}
const claim=async id=>(await server('select * from public.claim_push_deliveries($1)',[id])).rows;
function recipients(rows){return new Set(rows.map(r=>r.user_id));}
test('publicación: solo cinco categorías oficiales; estado Backup no equivale a categoría BACKUPS',async()=>{
  const {call}=await setup();const deliveries=await claim((await event(call,'published')).id);
  assert.deepEqual(recipients(deliveries),new Set(official));assert.equal(deliveries.length,5);
  assert.ok(deliveries.every(d=>d.can_vote));
});
test('pendientes y último aviso excluyen BACKUPS, PRUEBAS y AYUDAS aunque tengan dispositivos',async()=>{
  const {club,call}=await setup(true);
  const pending=(await server("select public.prepare_call_up_push($1,$2,'pending:rules','pending') as id",[club.id,call.id])).rows[0].id;
  assert.deepEqual(recipients(await claim(pending)),new Set(official.slice(1)));
  await server('select * from public.prepare_due_call_up_reminders()');
  assert.deepEqual(recipients(await claim((await event(call,'reminder')).id)),new Set(official.slice(1)));
});
test('avisos de votos nunca llegan a categoría BACKUPS, aunque ya haya respondido',async()=>{
  const {call}=await setup();const vote=(await db.query("select * from public.push_events where call_up_id=$1 and kind='vote' and actor_user_id=$2",[call.id,official[0]])).rows[0];
  const deliveries=await claim(vote.id);
  assert.deepEqual(recipients(deliveries),new Set(official.slice(1)));
  for(const user of [...backups,trial,aid,foreign])assert.ok(deliveries.every(d=>d.user_id!==user));
});
test('cancelación: BACKUPS solo si votó Disponible, No disponible o Backup; sin responder queda fuera',async()=>{
  const {call,entries}=await setup();
  for(const user of [...official,...backups])await query(user,'select public.set_notification_preferences(false)');
  await query(official[0],'select * from public.update_call_up_with_notice($1,$2,$3,$4)',[call.id,call.starts_at,'cancelled',call.last_notice_at]);
  const deliveries=await claim((await event(call,'cancelled')).id);
  assert.deepEqual(recipients(deliveries),new Set([...official,...backups.slice(0,3)]));
  assert.equal(deliveries.length,9);assert.ok(deliveries.every(d=>!d.can_vote));
  assert.ok(deliveries.every(d=>![backups[3],trial,aid,foreign].includes(d.user_id)));
  const preserved=(await query(official[0],'select * from public.call_up_players where call_up_id=$1',[call.id])).rows;
  assert.equal(preserved.length,entries.length);
  assert.equal(preserved.find(p=>p.user_id===backups[1]).availability,'unavailable');
});
test('una entrega ya en cola se descarta si la fotografía pasa a categoría BACKUPS',async()=>{
  const {club,call,entries}=await setup();
  await query(official[0],"update public.players set category='backups' where id=$1",[entries.find(p=>p.user_id===official[1]).source_player_id]);
  await query(official[0],'select public.refresh_call_up_roster($1,false)',[call.id]);
  const published=await event(call,'published');
  assert.deepEqual(recipients(await claim(published.id)),new Set(official.filter(user=>user!==official[1])));
  const skipped=(await db.query("select * from public.push_deliveries where event_id=$1 and user_id=$2",[published.id,official[1]])).rows;
  assert.equal(skipped[0].state,'skipped');assert.equal(skipped[0].club_id,club.id);
});
test('la regla privada no puede invocarla un jugador para consultar elegibilidad ajena',async()=>{
  const {club,call}=await setup();
  await assert.rejects(query(official[1],"select private.notification_recipient_allowed($1,$2,$3,'cancelled')",[club.id,call.id,backups[0]]),{code:'42501'});
});
