import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const [captain, player, other] = [1,2,3].map(n=>`7b000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,callSequence=0;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
const create=async (due=true)=> {
 const call=(await query(captain,"select * from public.create_call_up_with_evaluation($1,now()-$3::interval,null,'open',null,now()+$2::interval)",[club.id,due?'-1 hour':'1 hour',`${++callSequence} days 2 hours`])).rows[0];
 await db.query("update public.call_ups set status='closed' where id=$1",[call.id]);
 return call;
};
const prepare=async()=> (await server('select * from public.prepare_due_call_up_reminders()')).rows.map(row=>Object.values(row)[0]);
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,player,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`RatingReminder_${index}`}]);
 club=(await query(captain,"select * from public.create_club('Evaluation reminders')")).rows[0];
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,player]);
 await query(captain,"insert into public.players(club_id,ea_id,category) values($1,'Rated player','midfielders')",[club.id]);
 for(const [index,user] of [captain,player,other].entries()) await query(user,'select public.register_push_device($1,$2,$3)',[`7b000000-1111-4000-8000-${String(index).padStart(12,'0')}`,`ExpoPushToken[RatingReminder_${index}]`,'android']);
});
after(async()=>{await db?.close();});
test('la hora habilita un único aviso privado a capitanes, incluso sin ficha y con votación cerrada',async()=>{
 const future=await create(false); const call=await create();
 await assert.rejects(query(player,'select * from public.prepare_due_call_up_reminders()'),e=>e.code==='42501');
 const events=await prepare();assert.equal(events.length,1);assert.equal((await prepare()).length,0);
 const event=(await db.query('select * from public.push_events where id=$1',[events[0]])).rows[0];assert.equal(event.kind,'evaluation');assert.equal(event.call_up_id,call.id);assert.notEqual(event.call_up_id,future.id);
 const deliveries=(await server('select * from public.claim_push_deliveries($1)',[event.id])).rows;
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].user_id,captain);assert.equal(deliveries[0].can_vote,false);
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[event.id])).rows.length,0);
});
test('se descartan avisos si se cancela, cambia la hora, se completan las notas o se retira al capitán',async()=>{
 for(const action of ['cancel','retime','complete','demote']) {
  const call=await create();const events=await prepare();assert.equal(events.length,1);
  if(action==='cancel') await db.query("update public.call_ups set status='cancelled' where id=$1",[call.id]);
  if(action==='retime') await db.query("update public.call_ups set evaluation_at=now()+interval '1 hour' where id=$1",[call.id]);
  if(action==='complete') {
   const entry=(await query(captain,'select id from public.call_up_players where call_up_id=$1',[call.id])).rows[0];
   await query(captain,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,score:7,expected_updated_at:null}]]);
  }
  if(action==='demote') {
   await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'admin')",[club.id,other]);
   await db.query("update public.club_members set role='player' where club_id=$1 and user_id=$2",[club.id,captain]);
  }
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[events[0]])).rows.length,0,action);
  if(action==='demote') await db.query("update public.club_members set role='admin' where club_id=$1 and user_id=$2",[club.id,captain]);
 }
});
