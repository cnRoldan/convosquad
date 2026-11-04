import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,second,third,member,outsider]=[1,2,3,4,5].map(n=>`96000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,sequence=0;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const read=(user,call)=>query(user,'select * from public.read_my_player_ratings($1)',[call.id]).then(r=>r.rows);
const averages=(user,call)=>query(user,'select * from public.read_call_up_rating_averages($1)',[call.id]).then(r=>r.rows);
const save=(user,call,entry,value,expected=null)=>query(user,'select public.save_my_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,...value,expected_updated_at:expected}]]);
async function fixture(){
 const club=(await query(captain,'select * from public.create_club($1)',[`Captain averages ${++sequence}`])).rows[0];
 await db.query('insert into public.club_feature_entitlements(club_id,club_activated_at) values($1,now()) on conflict(club_id) do update set club_activated_at=now()',[club.id]);
 for(const [user,role] of [[second,'admin'],[third,'admin'],[member,'player']])await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)',[club.id,user,role]);
 await query(captain,"insert into public.players(club_id,ea_id,category) values($1,'Average player','midfielders')",[club.id]);
 const call=(await query(captain,"select * from public.create_call_up_with_end($1,now()-interval '2 hours',now()-interval '1 hour',null,'open',null,true)",[club.id])).rows[0];
 const entry=(await db.query('select * from public.call_up_players where call_up_id=$1',[call.id])).rows[0];
 return {club,call,entry};
}
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,second,third,member,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`CaptainAverage${index}`}]);
});
after(async()=>db?.close());

test('independent captain scores produce the exact per-match mean and one performance match',async()=>{
 const {club,call,entry}=await fixture();
 await save(captain,call,entry,{score:7});
 const own=(await read(captain,call))[0];
 assert.deepEqual(await read(second,call),[]);
 await save(second,call,entry,{score:8});
 assert.equal(Number((await read(captain,call))[0].score),7);
 assert.equal(Number((await read(second,call))[0].score),8);
 assert.deepEqual((await read(captain,call))[0].updated_at,own.updated_at);
 assert.deepEqual(await averages(captain,call),[{call_up_player_id:entry.id,average_score:'7.50',rating_count:2}]);
 const performance=(await query(captain,'select * from public.get_player_performance($1)',[club.id])).rows[0];
 assert.equal(Number(performance.average_score),7.5);assert.equal(performance.rated_matches,1);
 const history=(await query(captain,'select * from public.get_player_rating_history($1,$2)',[club.id,entry.source_player_id])).rows;
 assert.equal(Number(history[0].score),7.5);
 // Editing my vote remains valid after another captain has saved.
 await save(captain,call,entry,{score:0},own.updated_at);
 assert.equal(Number((await averages(captain,call))[0].average_score),4);
 await assert.rejects(save(captain,call,entry,{score:10},own.updated_at),{code:'40001'});
});

test('not selected and empty votes do not count as zero; clearing only removes the caller vote',async()=>{
 const {call,entry}=await fixture();
 await save(captain,call,entry,{score:0});await save(second,call,entry,{score:9});await save(third,call,entry,{not_selected:true});
 assert.equal(Number((await averages(captain,call))[0].average_score),4.5);
 assert.equal((await averages(captain,call))[0].rating_count,2);
 let own=(await read(captain,call))[0];
 await save(captain,call,entry,{clear:true},own.updated_at);
 assert.equal(Number((await averages(captain,call))[0].average_score),9);
 assert.equal(Number((await read(second,call))[0].score),9);
 own=(await read(second,call))[0];await save(second,call,entry,{clear:true},own.updated_at);
 assert.deepEqual(await averages(captain,call),[{call_up_player_id:entry.id,average_score:null,rating_count:0}]);
 own=(await read(third,call))[0];await save(third,call,entry,{clear:true},own.updated_at);
 assert.deepEqual(await averages(captain,call),[]);
});

test('permissions, retention, deadlines and validation remain enforced',async()=>{
 const {club,call,entry}=await fixture();
 for(const user of [member,outsider]){
  await assert.rejects(read(user,call),{code:'42501'});
  await assert.rejects(averages(user,call),{code:'42501'});
  await assert.rejects(save(user,call,entry,{score:8}),{code:'42501'});
 }
 await assert.rejects(query(captain,'select * from private.captain_player_ratings'),{code:'42501'});
 for(const score of [-1,11,5.5])await assert.rejects(save(captain,call,entry,{score}),{code:'22023'});
 await save(captain,call,entry,{score:6});
 await db.query("update public.call_ups set starts_at=now()-interval '26 hours',ends_at=now()-interval '25 hours' where id=$1",[call.id]);
 await assert.rejects(save(second,call,entry,{score:8}),{code:'P0041'});
 await db.query("update public.call_ups set starts_at=now()-interval '4 months' where id=$1",[call.id]);
 assert.deepEqual(await averages(captain,call),[]);
 await db.query('select private.purge_expired_player_ratings()');
 assert.equal((await db.query('select count(*) from private.captain_player_ratings where call_up_player_id=$1',[entry.id])).rows[0].count,0);
 assert.ok(club.id);
});

test('legacy clients keep working and cannot clear another captain vote',async()=>{
 const {call,entry}=await fixture();
 await save(captain,call,entry,{score:7});
 const shared=()=>db.query('select * from public.player_ratings where call_up_player_id=$1',[entry.id]).then(r=>r.rows[0]);
 let current=await shared();
 await query(second,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,score:8,expected_updated_at:current.updated_at}]]);
 assert.equal(Number((await shared()).score),7.5);
 current=await shared();
 await query(second,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,clear:true,expected_updated_at:current.updated_at}]]);
 assert.equal(Number((await shared()).score),7);
 assert.equal(Number((await read(captain,call))[0].score),7);
});

test('averages are isolated by match and performance weights each match once',async()=>{
 const {club,call,entry}=await fixture();
 await save(captain,call,entry,{score:7});await save(second,call,entry,{score:8});
 const next=(await query(captain,"select * from public.create_call_up_with_end($1,now()-interval '26 hours',now()-interval '30 minutes',null,'open',null,true)",[club.id])).rows[0];
 const nextEntry=(await db.query('select * from public.call_up_players where call_up_id=$1',[next.id])).rows[0];
 await save(captain,next,nextEntry,{score:10});
 assert.equal(Number((await averages(captain,call))[0].average_score),7.5);
 assert.equal(Number((await averages(captain,next))[0].average_score),10);
 const performance=(await query(captain,'select * from public.get_player_performance($1)',[club.id])).rows[0];
 assert.equal(Number(performance.average_score),8.75);assert.equal(performance.rated_matches,2);
});

test('migration preserves the last saved legacy vote and its owner',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const {readFile,readdir}=await import('node:fs/promises');
 const previous=db;const legacy=new PGlite();
 try {
  await legacy.exec(await readFile(new URL('./auth-fixture.sql',import.meta.url),'utf8'));
  const directory=new URL('../migrations/',import.meta.url);
  const migration='20261104000500_captain_rating_averages.sql';
  for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')&&n<migration).sort())await legacy.exec(await readFile(new URL(name,directory),'utf8'));
  db=legacy;
  for(const [index,id] of [captain,second,third,member,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`LegacyAverage${index}`}]);
  const {call,entry}=await fixture();
  await query(captain,'select public.save_player_ratings($1,$2)',[call.id,[{entry_id:entry.id,score:8,expected_updated_at:null}]]);
  await db.exec(await readFile(new URL(migration,directory),'utf8'));
  assert.equal(Number((await read(captain,call))[0].score),8);
  assert.deepEqual(await read(second,call),[]);
  assert.equal(Number((await averages(captain,call))[0].average_score),8);
  await save(second,call,entry,{score:7});
  assert.equal(Number((await averages(captain,call))[0].average_score),7.5);
 } finally {db=previous;await legacy.close();}
});
