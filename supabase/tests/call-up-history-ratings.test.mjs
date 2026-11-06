import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,second,member,outsider]=[1,2,3,4].map(n=>`99080000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,sequence=0;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const read=(club,user=captain)=>query(user,'select * from public.list_call_up_history_ratings($1)',[club.id]).then(r=>r.rows);
const save=(user,call,entry,value)=>query(user,'select public.save_my_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,...value,expected_updated_at:null}]]);
async function fixture(){
  const club=(await query(captain,'select * from public.create_club($1)',[`History rating ${++sequence}`])).rows[0];
  await db.query("insert into public.club_feature_entitlements(club_id,club_activated_at,lineup_premium_until) values($1,now(),'infinity') on conflict(club_id) do update set club_activated_at=now(),lineup_premium_until='infinity'",[club.id]);
  await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'admin'),($1,$3,'player')",[club.id,second,member]);
  for(const name of ['Player A','Player B','Player C'])await query(captain,"insert into public.players(club_id,ea_id,category) values($1,$2,'midfielders')",[club.id,name]);
  const call=(await query(captain,"select * from public.create_call_up_with_end($1,now()-interval '2 hours',now()-interval '1 hour',null,'open',null,true)",[club.id])).rows[0];
  const entries=(await db.query('select * from public.call_up_players where call_up_id=$1 order by ea_id_snapshot',[call.id])).rows;
  return {club,call,entries};
}
before(async()=>{
  db=await createTestDatabase();
  for(const [i,id] of [captain,second,member,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`TeamHistoryRating${i}`}]);
});
after(async()=>db?.close());

test('team match mean includes every numeric captain vote, including zero, excluding not selected and unrated',async()=>{
  const {club,call,entries}=await fixture();
  assert.deepEqual(await read(club),[]);
  await save(captain,call,entries[0],{score:7});await save(second,call,entries[0],{score:9});
  await save(captain,call,entries[1],{score:0});await save(second,call,entries[1],{not_selected:true});
  const result=await read(club);
  assert.deepEqual(result,[{call_up_id:call.id,average_score:'5.33'}]);
  // If a legacy entry has no vote breakdown, its stored numeric score counts once.
  await db.query('delete from private.captain_player_ratings where call_up_player_id=$1',[entries[0].id]);
  assert.equal(Number((await read(club))[0].average_score),4);
});

test('zero remains a real team average; only not-selected votes produce no summary',async()=>{
  const {club,call,entries}=await fixture();
  await save(captain,call,entries[0],{not_selected:true});assert.deepEqual(await read(club),[]);
  await save(second,call,entries[1],{score:0});assert.equal(Number((await read(club))[0].average_score),0);
});

test('Premium is checked on the server and cannot be bypassed by members, outsiders or expired clubs',async()=>{
  const {club,call,entries}=await fixture();await save(captain,call,entries[0],{score:8});
  assert.equal(Number((await read(club))[0].average_score),8);
  for(const user of [member,outsider,null])await assert.rejects(read(club,user),{code:'42501'});
  await db.query("update public.club_feature_entitlements set lineup_premium_until=now()-interval '1 second' where club_id=$1",[club.id]);
  assert.deepEqual(await read(club),[]);
  assert.ok((await query(captain,'select * from public.list_call_up_history($1)',[club.id])).rows.some(c=>c.id===call.id),'free clubs retain ordinary history');
});

test('cancelled, retained-out and calls outside the latest ten history entries do not expose a mean',async()=>{
  const {club,call,entries}=await fixture();await save(captain,call,entries[0],{score:9});
  await db.query("update public.call_ups set status='cancelled' where id=$1",[call.id]);assert.deepEqual(await read(club),[]);
  await db.query("update public.call_ups set status='closed',starts_at=now()-interval '4 months',ends_at=now()-interval '4 months'+interval '1 hour',local_date=(now()-interval '4 months')::date where id=$1",[call.id]);assert.deepEqual(await read(club),[]);
  await db.query("update public.call_ups set starts_at=now()-interval '14 days',ends_at=now()-interval '14 days'+interval '1 hour',local_date=(now()-interval '14 days')::date where id=$1",[call.id]);
  assert.equal((await read(club)).length,1);
  await db.query("insert into public.call_ups(club_id,starts_at,ends_at,local_date,timezone,status,created_by) select $1,now()-n*interval '1 day',now()-n*interval '1 day'+interval '1 hour',(now()-n*interval '1 day')::date,'Europe/Madrid','closed',$2 from generate_series(1,11) n",[club.id,captain]);
  assert.deepEqual(await read(club),[]);
});
