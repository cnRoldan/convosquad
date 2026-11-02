import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createTestDatabase,asUser } from '../../scripts/database-test-utils.mjs';
const ids=Array.from({length:6},(_,i)=>`87000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [admin,exact,fuzzy,fresh,other,outsider]=ids;
let db,club,exactPlayer,fuzzyPlayer;
const q=(u,sql,args=[])=>asUser(db,u,tx=>tx.query(sql,args));
const prep=async u=>(await q(u,'select public.prepare_player_onboarding($1) data',[club.id])).rows[0].data;
before(async()=>{
 db=await createTestDatabase();
 const names=['OnboardCaptain','ExactPlayer','PlayerFuzzy','FreshNew','AnotherNew','Outsider'];
 for(let i=0;i<ids.length;i++)await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[ids[i],{username:names[i]}]);
 club=(await q(admin,"select * from public.create_club('Invitation onboarding')")).rows[0];
 for(const u of [exact,fuzzy,fresh,other])await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,u]);
 exactPlayer=(await db.query("insert into public.players(club_id,ea_id,category,jersey_number,nickname) values($1,'Exact Player','midfielders',8,'Original') returning *",[club.id])).rows[0];
 fuzzyPlayer=(await db.query("insert into public.players(club_id,ea_id,category,jersey_number) values($1,'PlayerFuzxy','attackers',9) returning *",[club.id])).rows[0];
});
after(async()=>db?.close());
test('exact EA ID links the existing record without overwriting roster data',async()=>{
 const result=await prep(exact);assert.equal(result.status,'linked');assert.equal(result.playerId,exactPlayer.id);
 const p=(await db.query('select * from public.players where id=$1',[exactPlayer.id])).rows[0];
 assert.equal(p.nickname,'Original');assert.equal(p.jersey_number,8);assert.equal(p.user_id,exact);
 assert.deepEqual(await prep(exact),result);
});
test('similarity suggests only: confirmation requires a captain',async()=>{
 const result=await prep(fuzzy);assert.equal(result.status,'new');assert.ok(result.suggestions.some(p=>p.id===fuzzyPlayer.id && p.score>=.75));
 assert.equal((await db.query('select user_id from public.players where id=$1',[fuzzyPlayer.id])).rows[0].user_id,null);
 await q(fuzzy,'select public.request_player_link($1,$2)',[club.id,fuzzyPlayer.id]);
 assert.equal((await prep(fuzzy)).status,'pending');
 await assert.rejects(q(fuzzy,'select public.review_player_link($1,$2,true)',[club.id,fuzzy]),{code:'42501'});
 await assert.rejects(q(fuzzy,"select public.complete_player_onboarding($1,10,'midfielders','Duplicate')",[club.id]),{code:'22023'});
 await q(admin,'select public.review_player_link($1,$2,true)',[club.id,fuzzy]);
 assert.equal((await prep(fuzzy)).playerId,fuzzyPlayer.id);
});
test('new member creates one linked profile and occupied jersey numbers are rejected',async()=>{
 await assert.rejects(q(outsider,'select public.prepare_player_onboarding($1)',[club.id]),{code:'42501'});
 await assert.rejects(q(fresh,"select public.complete_player_onboarding($1,8,'midfielders','Fresh')",[club.id]),{code:'23505'});
 const player=(await q(fresh,"select public.complete_player_onboarding($1,22,'midfielders','Fresh') id",[club.id])).rows[0].id;
 assert.equal((await prep(fresh)).playerId,player);
 await assert.rejects(q(other,"select public.complete_player_onboarding($1,22,'midfielders','Other')",[club.id]),{code:'23505'});
 assert.equal((await q(fresh,"select public.complete_player_onboarding($1,22,'midfielders','Fresh') id",[club.id])).rows[0].id,player);
});
test('an exact record already owned by another account is never reassigned',async()=>{
 await db.query("insert into public.players(club_id,ea_id,category,user_id) values($1,'AnotherNew','midfielders',$2)",[club.id,admin]);
 assert.equal((await prep(other)).status,'blocked');
 await assert.rejects(q(other,"select public.complete_player_onboarding($1,30,'midfielders','Other')",[club.id]),{code:'22023'});
 await assert.rejects(q(other,'select public.request_player_link($1,$2)',[club.id,exactPlayer.id]),{code:'22023'});
 assert.equal((await db.query('select user_id from public.players where id=$1',[exactPlayer.id])).rows[0].user_id,exact);
});
