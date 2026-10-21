import assert from 'node:assert/strict';
import { before, after, afterEach, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const [captain, second, player, outsider] = [1,2,3,4].map(n=>`7c000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db, sequence=0;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
const prepare=async()=> (await server('select * from public.prepare_due_call_up_reminders()')).rows.map(row=>Object.values(row)[0]);
const claim=async(id)=>(await server('select * from public.claim_push_deliveries($1)',[id])).rows;
async function fixture(age='20 hours') {
 const club=(await query(captain,"select * from public.create_club($1)",[`Deadline ${++sequence}`])).rows[0];
 for(const [user,role] of [[second,'admin'],[player,'player']]) await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)',[club.id,user,role]);
 await query(captain,"insert into public.players(club_id,ea_id,category) values($1,'Available player','midfielders')",[club.id]);
 const call=await create(club.id,age);
 const entry=(await db.query('select * from public.call_up_players where call_up_id=$1',[call.id])).rows[0];
 return {club,call,entry};
}
async function create(clubId,age,enabled=true) {
 const call=(await query(captain,"select * from public.create_call_up_with_end($1,((now() at time zone 'UTC')::date-((select count(*) from public.call_ups where club_id=$1)+3)::integer)::timestamp at time zone 'UTC',now()-$2::interval,null,'open',null,$3)",[clubId,age,enabled])).rows[0];
 await db.query("update public.call_ups set status='closed' where id=$1",[call.id]);return call;
}
const save=(user,call,entry,expected=null)=>query(user,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,score:8,expected_updated_at:expected}]]);
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,second,player,outsider].entries()) {
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Deadline_${index}`}]);
  await query(id,'select public.register_push_device($1,$2,$3)',[`7c000000-1111-4000-8000-${String(index).padStart(12,'0')}`,`ExpoPushToken[Deadline_${index}]`,'ios']);
 }
});
afterEach(async()=>{await db.query("update public.call_ups set status='cancelled'");});
after(async()=>{await db?.close();});

test('solo la última finalizada: una activa no desplaza y una finalizada sin valoración no recupera la anterior',async()=>{
 const {club,call,entry}=await fixture('2 hours');
 await create(club.id,'-1 hour');
 assert.deepEqual((await query(captain,'select * from public.list_rating_call_ups($1)',[club.id])).rows.map(c=>c.id),[call.id]);
 const latest=await create(club.id,'1 hour');
 assert.deepEqual((await query(captain,'select * from public.list_rating_call_ups($1)',[club.id])).rows.map(c=>c.id),[latest.id]);
 await assert.rejects(save(captain,call,entry),e=>e.code==='P0041');
 await create(club.id,'30 minutes',false);
 assert.equal((await query(captain,'select * from public.list_rating_call_ups($1)',[club.id])).rows.length,0);
 await assert.rejects(query(player,'select * from public.list_rating_call_ups($1)',[club.id]),e=>e.code==='42501');
});

test('límites exactos: abre al finalizar y cierra a las 24 horas; el RPC tampoco permite editar o borrar después',async()=>{
 const {club,call,entry}=await fixture('1 hour');
 const bounds=(await db.query("select private.can_rate_call_up($1,ends_at-interval '1 millisecond') before,private.can_rate_call_up($1,ends_at) opens,private.can_rate_call_up($1,ends_at+interval '24 hours'-interval '1 millisecond') last,private.can_rate_call_up($1,ends_at+interval '24 hours') expired from public.call_ups where id=$1",[call.id])).rows[0];
 assert.deepEqual(bounds,{before:false,opens:true,last:true,expired:false});
 await save(captain,call,entry);
 const rating=(await db.query('select * from public.player_ratings where call_up_player_id=$1',[entry.id])).rows[0];
 await db.query("update public.call_ups set starts_at=now()-interval '26 hours',ends_at=now()-interval '24 hours' where id=$1",[call.id]);
 await assert.rejects(save(captain,call,entry,rating.updated_at),e=>e.code==='P0041');
 await assert.rejects(query(captain,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,clear:true,expected_updated_at:rating.updated_at}]]),e=>e.code==='P0041');
 assert.equal((await query(captain,'select * from public.list_rating_call_ups($1)',[club.id])).rows.length,0);
 assert.equal((await query(captain,'select * from public.get_player_performance($1)',[club.id])).rows.length,1);
});

test('recordatorio a las 19 horas: solo capitanes pendientes, sin duplicados aunque otro complete todas las notas',async()=>{
 const {call,entry}=await fixture();
 await save(captain,call,entry);
 const events=await prepare();assert.equal(events.length,1);assert.equal((await prepare()).length,0);
 const event=(await db.query('select * from public.push_events where id=$1',[events[0]])).rows[0];
 assert.equal(event.kind,'evaluation_deadline');
 const deliveries=await claim(event.id);assert.deepEqual(deliveries.map(d=>d.user_id),[second]);assert.ok(deliveries.every(d=>!d.can_vote));
 assert.equal((await claim(event.id)).length,0);
 await assert.rejects(query(second,'select * from private.rating_submissions'),e=>e.code==='42501');
});

test('una petición inválida o borrar una nota vacía no silencia el recordatorio pendiente',async()=>{
 const {call,entry}=await fixture();
 await assert.rejects(query(second,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,score:11,expected_updated_at:null}]]),e=>e.code==='22023');
 await query(second,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,clear:true,expected_updated_at:null}]]);
 assert.equal((await db.query('select * from private.rating_submissions where call_up_id=$1',[call.id])).rows.length,0);
 const events=await prepare();assert.equal(events.length,1);
 assert.deepEqual((await claim(events[0])).map(d=>d.user_id).sort(),[captain,second].sort());
});

test('no adelanta el aviso de las cinco horas y no avisa al expirar, cancelar o finalizar otra convocatoria',async()=>{
 const {club,call}=await fixture('18 hours 59 minutes');
 const opening=await prepare();assert.equal(opening.length,1);
 assert.equal((await db.query('select kind from public.push_events where id=$1',[opening[0]])).rows[0].kind,'evaluation');
 await db.query("update public.call_ups set ends_at=now()-interval '19 hours' where id=$1",[call.id]);
 const events=await prepare();assert.equal(events.length,1);
 assert.equal((await db.query('select kind from public.push_events where id=$1',[events[0]])).rows[0].kind,'evaluation_deadline');
 await create(club.id,'1 hour');
 assert.equal((await claim(events[0])).length,0);
 const expired=await fixture('24 hours');assert.equal((await query(captain,'select * from public.list_rating_call_ups($1)',[expired.club.id])).rows.length,0);
 const prepared=await prepare();assert.ok((await db.query('select * from public.push_events where id=any($1)',[prepared])).rows.every(e=>e.call_up_id!==expired.call.id));
});

test('revalida al enviar: guardar, perder el rol, cambiar hora o vencer el plazo descarta una entrega ya preparada',async()=>{
 for(const action of ['save','demote','retime','expire','cancel']) {
  const {call,entry}=await fixture();await save(captain,call,entry);
  const events=await prepare();assert.equal(events.length,1);
  if(action==='save') {
   const rating=(await db.query('select * from public.player_ratings where call_up_player_id=$1',[entry.id])).rows[0];
   await save(second,call,entry,rating.updated_at);
   assert.equal((await db.query('select * from private.rating_submissions where call_up_id=$1',[call.id])).rows.length,2);
  }
  if(action==='demote') await db.query("update public.club_members set role='player' where club_id=$1 and user_id=$2",[call.club_id,second]);
  if(action==='retime') await db.query("update public.call_ups set ends_at=now()-interval '2 hours' where id=$1",[call.id]);
  if(action==='expire') await db.query("update public.call_ups set starts_at=now()-interval '26 hours',ends_at=now()-interval '24 hours' where id=$1",[call.id]);
  if(action==='cancel') await db.query("update public.call_ups set status='cancelled' where id=$1",[call.id]);
  assert.equal((await claim(events[0])).length,0,action);
  await db.query("update public.call_ups set status='cancelled' where id=$1",[call.id]);
 }
});
