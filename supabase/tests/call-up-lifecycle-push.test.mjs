import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [owner,player,unlinked,foreign]=Array.from({length:4},(_,i)=>`a0000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
let db;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(user,sql,args=[])=>(await query(user,sql,args)).rows[0];
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
before(async()=>{
  db=await createTestDatabase();
  for(const [i,user] of [owner,player,unlinked,foreign].entries()){
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[user,{username:`Lifecycle_${i}`}]);
    await query(user,"select public.register_push_device($1,$2,'android')",[`a1000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`ExpoPushToken[Lifecycle_${i}]`]);
  }
});
after(async()=>{await db?.close();});
async function setup(status='open'){
  const club=await row(owner,'select * from public.create_club($1,null,$2)',[`Lifecycle_${randomUUID().slice(0,8)}`,'Europe/Madrid']);
  for(const user of [player,unlinked])await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,user]);
  const p=await row(owner,"insert into public.players(club_id,ea_id,category) values($1,'Linked_Player','backups') returning *",[club.id]);
  await query(owner,'select public.link_player_account($1,$2)',[p.id,player]);
  const call=await row(owner,"select * from public.create_call_up_with_notice($1,'2035-06-01T19:50:00Z','2035-06-01T16:45:00Z',$2)",[club.id,status]);
  return {club,call};
}
async function events(callId,kind){return (await db.query('select * from public.push_events where call_up_id=$1 and kind=$2 order by created_at,id',[callId,kind])).rows;}
async function update(call,status){return row(owner,'select * from public.update_call_up_with_notice($1,$2,$3,$4)',[call.id,call.starts_at,status,call.last_notice_at]);}
test('publicar genera un único evento transaccional y avisa a todos los miembros activos con dispositivos',async()=>{
  const {call}=await setup();const published=await events(call.id,'published');
  assert.equal(published.length,1);
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[published[0].id])).rows;
  assert.deepEqual(new Set(deliveries.map(d=>d.user_id)),new Set([owner,player,unlinked]));
  assert.equal(deliveries.find(d=>d.user_id===player).can_vote,true);
  assert.ok(deliveries.filter(d=>d.user_id!==player).every(d=>!d.can_vote));
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[published[0].id])).rows.length,0);
});
test('borrador no avisa; abrirlo sí; guardar o cambiar fecha/hora no duplica el aviso',async()=>{
  const {call}=await setup('draft');assert.equal((await events(call.id,'published')).length,0);
  const open=await update(call,'open');await update(open,'open');
  await row(owner,"select * from public.update_call_up_with_notice($1,'2035-06-02T19:50:00Z','open','2035-06-02T16:45:00Z')",[call.id]);
  assert.equal((await events(call.id,'published')).length,1);
});
test('cancelar avisa a todos, incluso sin ficha y con avisos de votos desactivados, sin repetir al guardar',async()=>{
  const {call}=await setup();await query(player,'select public.set_notification_preferences(false)');
  await update(call,'cancelled');await update(call,'cancelled');
  const cancelled=await events(call.id,'cancelled');assert.equal(cancelled.length,1);
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[cancelled[0].id])).rows;
  assert.deepEqual(new Set(deliveries.map(d=>d.user_id)),new Set([owner,player,unlinked]));
  assert.ok(deliveries.every(d=>!d.can_vote));
  const published=await events(call.id,'published');assert.equal((await server('select * from public.claim_push_deliveries($1)',[published[0].id])).rows.length,0);
});
test('reanudar crea una nueva publicación y descarta cancelaciones/publicaciones obsoletas',async()=>{
  const {call}=await setup();await update(call,'cancelled');await update(call,'open');
  const published=await events(call.id,'published');assert.equal(published.length,2);
  const current=published.find(e=>e.call_status_version===3),stale=published.find(e=>e.call_status_version===1);
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[stale.id])).rows.length,0);
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[(await events(call.id,'cancelled'))[0].id])).rows.length,0);
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[current.id])).rows.length,3);
});
test('RLS, tokens rotados y membresías retiradas se revalidan antes de enviar cancelaciones',async()=>{
  const {club,call}=await setup();
  for(const user of [player,foreign])await assert.rejects(query(user,'select * from public.update_call_up_with_notice($1,$2,$3,$4)',[call.id,call.starts_at,'cancelled',call.last_notice_at]),{code:'42501'});
  await update(call,'cancelled');
  await query(player,"select public.register_push_device($1,'ExpoPushToken[Lifecycle_rotated]','android')",['a1000000-0000-4000-8000-000000000001']);
  await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2',[club.id,unlinked]);
  const deliveries=(await server('select * from public.claim_push_deliveries($1)',[(await events(call.id,'cancelled'))[0].id])).rows;
  assert.deepEqual(deliveries.map(d=>d.user_id),[owner]);
  await assert.rejects(query(player,'select * from public.push_events'),{code:'42501'});
});
test('si falla la creación se revierte también el aviso y la cancelación no borra respuestas históricas',async()=>{
  const {club,call}=await setup();
  const before=(await events(call.id,'published')).length;
  await assert.rejects(query(owner,"select * from public.create_call_up_with_notice($1,'2035-06-01T19:50:00Z',null,'open')",[club.id]),{code:'23505'});
  assert.equal((await events(call.id,'published')).length,before);
  const entry=await row(player,'select * from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,player]);
  await query(player,"select public.respond_to_call_up($1,'available')",[entry.id]);
  await update(call,'cancelled');
  assert.equal((await row(owner,'select * from public.call_up_players where id=$1',[entry.id])).availability,'available');
});
