import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,member,other]=[1,2,3].map(n=>`8d000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const club=()=>row(captain,"select * from public.create_club('My player',null,'UTC')");
const create=(user,clubId,category='midfielders',jersey=null)=>row(user,'select * from public.create_my_player($1,$2,$3)',[clubId,category,jersey]);
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [captain,member,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`MyPlayer_${i}`}]);
});
after(async()=>{await db?.close();});

test('crear mi ficha deriva el ID y la cuenta del capitán y permite votar en una convocatoria abierta ya existente',async()=>{
 const c=await club();
 const call=await row(captain,"select * from public.create_call_up($1,date_trunc('day',now())+interval '1 day 18 hours','open')",[c.id]);
 const player=await create(captain,c.id,'goalkeepers',12);
 assert.equal(player.ea_id,'MyPlayer_0');assert.equal(player.user_id,captain);assert.equal(player.category,'goalkeepers');assert.equal(player.jersey_number,12);
 const snapshot=await row(captain,'select * from public.call_up_players where call_up_id=$1',[call.id]);
 assert.equal(snapshot.source_player_id,player.id);assert.equal(snapshot.user_id,captain);
 assert.equal((await row(captain,"select * from public.respond_to_call_up($1,'available')",[snapshot.id])).availability,'available');
 const repeated=await create(captain,c.id,'attackers',99);
 assert.equal(repeated.id,player.id);assert.equal(repeated.category,'goalkeepers');assert.equal(repeated.jersey_number,12);
 assert.equal((await row(captain,'select count(*)::int n from public.players where club_id=$1',[c.id])).n,1);
});

test('vincula una ficha existente sin duplicarla y restaura una inactiva conservando identidad e histórico',async()=>{
 const c=await club();
 const existing=await row(captain,"select * from public.add_or_restore_player($1,'myplayer_0','centre_backs',4::smallint)",[c.id]);
 const linked=await create(captain,c.id,'attackers');
 assert.equal(linked.id,existing.id);assert.equal(linked.user_id,captain);assert.equal(linked.jersey_number,4);
 await query(captain,'update public.players set is_active=false where id=$1',[linked.id]);
 const restored=await create(captain,c.id,'wide_backs',8);
 assert.equal(restored.id,existing.id);assert.equal(restored.is_active,true);assert.equal(restored.category,'wide_backs');assert.equal(restored.jersey_number,8);
 assert.deepEqual(restored.created_at,existing.created_at);
});

test('otra cuenta vinculada nunca se reasigna ni se modifica al intentar crear mi ficha',async()=>{
 const c=await club();
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[c.id,member]);
 const existing=await row(captain,"select * from public.add_or_restore_player($1,'MyPlayer_0','centre_backs',4::smallint)",[c.id]);
 await query(captain,'select public.link_player_account($1,$2)',[existing.id,member]);
 await assert.rejects(create(captain,c.id,'attackers',9),e=>e.code==='23505');
 const unchanged=await row(captain,'select * from public.players where id=$1',[existing.id]);
 assert.equal(unchanged.user_id,member);assert.equal(unchanged.category,'centre_backs');assert.equal(unchanged.jersey_number,4);
});

test('jugadores, capitanes ajenos y anónimos no pueden crear ni vincular fichas mediante esta función',async()=>{
 const c=await club();await row(other,"select * from public.create_club('Other')");
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[c.id,member]);
 for(const user of [member,other]) await assert.rejects(create(user,c.id),e=>e.code==='42501');
 await assert.rejects(asUser(db,null,tx=>tx.query("select public.create_my_player($1,'attackers')",[c.id]),'anon'),e=>e.code==='42501');
 assert.equal((await row(captain,'select count(*)::int n from public.players where club_id=$1',[c.id])).n,0);
});

test('datos inválidos no dejan fichas, vínculos ni candidatos parciales',async()=>{
 const c=await club();
 for(const [category,jersey] of [[null,null],['attackers',0],['attackers',100]]) await assert.rejects(create(captain,c.id,category,jersey),e=>e.code==='22023');
 assert.equal((await row(captain,'select count(*)::int n from public.players where club_id=$1',[c.id])).n,0);
});
