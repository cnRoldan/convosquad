import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const [captain,player,outsider]=[1,2,3].map(n=>`97000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,call;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const read=(user,fn)=>query(user,`select public.${fn}($1) value`,[call.id]).then(r=>r.rows[0].value);
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,player,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`CaptainView${index}`}]);
 club=(await query(captain,"select * from public.create_club('Captain lineup view')")).rows[0];
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,player]);
 call=(await query(captain,"select * from public.create_call_up($1,'2035-11-01T20:00:00Z','open')",[club.id])).rows[0];
 await query(captain,'select public.activate_lineup_access($1)',[call.id]);
 const document={formation:'4-4-2',slots:[],bench:[]};
 await db.query('insert into public.call_up_lineups(call_up_id,club_id,draft,published) values($1,$2,$3,$3)',[call.id,club.id,document]);
});
after(async()=>db?.close());
test('only a club captain can read the lineup document and generation access, including published lineups',async()=>{
 assert.equal((await read(captain,'read_lineup_access')).allowed,true);
 assert.deepEqual((await read(captain,'read_lineup')).document,{formation:'4-4-2',slots:[],bench:[]});
 for(const fn of ['read_lineup','read_lineup_access']){
  for(const user of [player,outsider])await assert.rejects(read(user,fn),{code:'42501'});
  await assert.rejects(asUser(db,null,tx=>tx.query(`select public.${fn}($1)`,[call.id]),'anon'),{code:'42501'});
 }
 await assert.rejects(query(player,'select * from public.call_up_lineups'),{code:'42501'});
 await assert.rejects(query(player,'select private.read_lineup_before_captain_gate($1)',[call.id]),{code:'42501'});
});
test('Premium never grants players access and captains retain the historical Premium gate',async()=>{
 await db.query("update public.call_ups set starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where id=$1",[call.id]);
 await assert.rejects(read(captain,'read_lineup'),{code:'42501'});
 await db.query("insert into public.club_feature_entitlements(club_id,lineup_premium_until) values($1,'infinity') on conflict(club_id) do update set lineup_premium_until='infinity'",[club.id]);
 assert.ok((await read(captain,'read_lineup')).document);
 await assert.rejects(read(player,'read_lineup'),{code:'42501'});
 await assert.rejects(read(player,'read_historical_lineup'),{code:'42501'});
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'admin')",[club.id,outsider]);
 await db.query("update public.club_members set role='player' where club_id=$1 and user_id=$2",[club.id,captain]);
 for(const fn of ['read_lineup','read_lineup_access'])await assert.rejects(read(captain,fn),{code:'42501'});
});
