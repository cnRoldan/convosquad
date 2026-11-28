import assert from 'node:assert/strict';
import {before,after,test}from'node:test';
import{createTestDatabase,asUser}from'../../scripts/database-test-utils.mjs';
const one='98000000-0000-4000-8000-000000000001',other='98000000-0000-4000-8000-000000000002';let db,club,player,call;
const recent=()=>[{method:'password',timestamp:Math.floor(Date.now()/1000)}];
const rename=(user,old,name,amr=recent())=>asUser(db,user,async tx=>{await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({amr})]);return tx.query('select public.change_my_ea_id($1,$2) name',[old,name]);});
const account=async id=>(await db.query('select u.email,u.raw_user_meta_data,p.username,i.identity_data,u.email_change from auth.users u join public.profiles p on p.id=u.id join auth.identities i on i.user_id=u.id where u.id=$1',[id])).rows[0];
before(async()=>{db=await createTestDatabase();for(const[id,name]of[[one,'Typo_Player'],[other,'Taken_Player']]){const email=`ea.${name.toLowerCase()}@accounts.convosquad.invalid`;await db.query('insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)',[id,email,{username:name,login_type:'ea_id',other:'preserved'}]);await db.query("insert into auth.identities(user_id,provider,identity_data)values($1,'email',$2)",[id,{sub:id,email,email_verified:true}]);}
 club=(await asUser(db,one,t=>t.query("select * from public.create_club('Rename fixture')"))).rows[0];await db.query('insert into public.club_feature_entitlements(club_id,club_activated_at)values($1,now())',[club.id]);
 player=(await db.query("insert into public.players(club_id,user_id,ea_id,category,jersey_number)values($1,$2,'Roster_Player','midfielders',7) returning *",[club.id,one])).rows[0];
 call=(await asUser(db,one,t=>t.query("select * from public.create_call_up($1,date_trunc('day',now())+interval '1 day 18 hours','open')",[club.id]))).rows[0];
 const snapshot=(await db.query('select id from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,one])).rows[0];await asUser(db,one,t=>t.query("select public.respond_to_call_up($1,'available')",[snapshot.id]));});
after(async()=>db?.close());
test('fresh password authentication, owner, format and uniqueness are enforced on direct RPC',async()=>{
 const initial=await account(one);
 for(const amr of[[],[{method:'otp',timestamp:Date.now()/1000}],[{method:'password',timestamp:Date.now()/1000-600}],[{method:'password',timestamp:Date.now()/1000+120}],[{method:'password',timestamp:'invalid'}]])await assert.rejects(rename(one,'Typo_Player','Correct_Player',amr),e=>e.code==='P4103');
 for(const name of[null,'ab','not an id','x'.repeat(25),'a@b.test'])await assert.rejects(rename(one,'Typo_Player',name),e=>e.code==='P4101');
 await assert.rejects(rename(one,'Typo_Player','taken_player'),e=>e.code==='P4102');
 await assert.rejects(rename(other,'Typo_Player','Correct_Player'),e=>e.code==='P4104');
 await assert.rejects(asUser(db,null,t=>t.query("select public.change_my_ea_id('Typo_Player','Correct_Player')"),'anon'),e=>e.code==='42501');
 assert.deepEqual(await account(one),initial);
});
test('a late uniqueness conflict rolls back Auth email, identity and public profile together',async()=>{
 await db.exec("create function public.fixture_rename_conflict() returns trigger language plpgsql as $$ begin if new.username='Race_Target' then raise unique_violation;end if;return new;end;$$;create trigger fixture_rename_conflict before update of username on public.profiles for each row execute function public.fixture_rename_conflict();");
 const initial=await account(one);await assert.rejects(rename(one,'Typo_Player','Race_Target'),e=>e.code==='P4102');assert.deepEqual(await account(one),initial);
 await db.exec('drop trigger fixture_rename_conflict on public.profiles;drop function public.fixture_rename_conflict();');
});
test('rename preserves UUID relationships, roster names, votes and historical snapshots and clears pending email changes',async()=>{
 const before=(await db.query('select row_to_json(p) player,row_to_json(c) snapshot from public.players p join public.call_up_players c on c.source_player_id=p.id where p.id=$1',[player.id])).rows;
 await db.query("update auth.users set email_change='pending@example.test',email_change_token_new='fixture-token' where id=$1",[one]);
 assert.equal((await rename(one,'Typo_Player','  Correct_Player  ')).rows[0].name,'Correct_Player');const updated=await account(one);assert.equal(updated.username,'Correct_Player');assert.equal(updated.email,'ea.correct_player@accounts.convosquad.invalid');assert.equal(updated.identity_data.email,updated.email);assert.equal(updated.identity_data.sub,one);assert.equal(updated.raw_user_meta_data.other,'preserved');assert.equal(updated.raw_user_meta_data.username,'Correct_Player');assert.equal(updated.email_change,'');
 assert.deepEqual((await db.query('select row_to_json(p) player,row_to_json(c) snapshot from public.players p join public.call_up_players c on c.source_player_id=p.id where p.id=$1',[player.id])).rows,before);
 assert.equal((await db.query('select user_id from public.club_members where club_id=$1',[club.id])).rows[0].user_id,one);
 assert.equal((await db.query("select public.is_ea_id_available('Typo_Player') available")).rows[0].available,true);
 assert.equal((await db.query("select public.is_ea_id_available('correct_player') available")).rows[0].available,false);
 await assert.rejects(rename(one,'Typo_Player','Another_Player'),e=>e.code==='P4104');
 await rename(one,'Correct_Player','CORRECT_PLAYER');assert.equal((await account(one)).email,updated.email);assert.equal((await account(one)).username,'CORRECT_PLAYER');
});
test('a real-email account is never silently converted to synthetic EA login',async()=>{
 await db.query("update auth.users set email='legacy@example.test' where id=$1",[other]);const initial=await account(other);await assert.rejects(rename(other,'Taken_Player','Other_Name'),e=>e.code==='P4105');assert.deepEqual(await account(other),initial);
});

test('captain can link a differently named member without changing either login or roster name',async()=>{
 const member='98000000-0000-4000-8000-000000000003';await db.query('insert into auth.users(id,email,raw_user_meta_data)values($1,$2,$3)',[member,'ea.another_account@accounts.convosquad.invalid',{username:'Another_Account'}]);await db.query('insert into public.club_members(club_id,user_id)values($1,$2)',[club.id,member]);const row=(await db.query("insert into public.players(club_id,ea_id,category)values($1,'Real_EA_Name','attackers')returning *",[club.id])).rows[0];
 const linked=(await asUser(db,one,t=>t.query('select * from public.link_player_account($1,$2)',[row.id,member]))).rows[0];assert.equal(linked.user_id,member);assert.equal(linked.ea_id,'Real_EA_Name');assert.equal((await db.query('select username from public.profiles where id=$1',[member])).rows[0].username,'Another_Account');
});
