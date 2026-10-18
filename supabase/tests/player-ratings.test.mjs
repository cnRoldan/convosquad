import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [admin,member,other,captain] = [1,2,3,4].map(n=>`7a000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,foreign,calls=[],entries=[];
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const save=(user,callId,values)=>query(user,'select public.save_player_ratings($1,$2)',[callId,values]);
const rating=(id,score,expected=null)=>({entry_id:id,score,expected_updated_at:expected});
const when=(days,hour=12)=>{const date=new Date();date.setUTCDate(date.getUTCDate()-days);date.setUTCHours(hour,0,0,0);return date.toISOString();};
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [admin,member,other,captain].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Rating_${i}`}]);
 club=await row(admin,"select * from public.create_club('Performance club')");foreign=await row(other,"select * from public.create_club('Other performance')");
 for(const user of [member,captain]) await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)',[club.id,user,user===captain?'admin':'player']);
 for(const name of ['Player A','Player B']) await row(admin,"insert into public.players(club_id,ea_id,category) values($1,$2,'midfielders') returning *",[club.id,name]);
 for(const days of [1,8,15,100,2,3]) {
  const starts=when(days);const evaluation=days===2?new Date(Date.now()+3600000).toISOString():days===3?null:when(days,14);
  const call=await row(admin,"select * from public.create_call_up_with_evaluation($1,$2,null,'open',null,$3)",[club.id,starts,evaluation]);calls.push(call);
  entries.push((await query(admin,'select * from public.call_up_players where call_up_id=$1 order by ea_id_snapshot',[call.id])).rows);
 }
});
after(async()=>{await db?.close();});
test('privacidad y permisos: solo capitanes del mismo club pueden leer o valorar, sin escrituras directas',async()=>{
 for(const user of [member,other]) await assert.rejects(save(user,calls[0].id,[rating(entries[0][0].id,8)]),e=>e.code==='42501');
 await assert.rejects(query(admin,"insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score) values($1,$2,$3,$4,'Forged',8)",[entries[0][0].id,club.id,calls[0].id,entries[0][0].source_player_id]),e=>e.code==='42501');
 await assert.rejects(asUser(db,null,tx=>tx.query('select public.get_player_performance($1)',[club.id]),'anon'),e=>e.code==='42501');
 await assert.rejects(query(admin,"select * from public.get_player_performance($1,'3m')",[foreign.id]),e=>e.code==='42501');
 await save(admin,calls[0].id,[rating(entries[0][0].id,0)]);
 for(const user of [member,other]) {
  assert.equal((await query(user,'select * from public.player_ratings')).rows.length,0);
  await assert.rejects(query(user,"select * from public.get_player_performance($1,'3m')",[club.id]),e=>e.code==='42501');
  await assert.rejects(query(user,'select * from public.get_player_rating_history($1,$2)',[club.id,entries[0][0].source_player_id]),e=>e.code==='42501');
 }
 assert.equal((await query(captain,'select * from public.player_ratings')).rows.length,1);
});
test('cero cuenta en la media y No convocado queda fuera; filtros de semana/mes y nombres históricos',async()=>{
 await save(admin,calls[1].id,[rating(entries[1][0].id,10)]);
 await save(admin,calls[2].id,[{entry_id:entries[2][0].id,not_selected:true,expected_updated_at:null}]);
 const performance=await row(admin,"select * from public.get_player_performance($1,'3m')",[club.id]);
 assert.equal(Number(performance.average_score),5);assert.equal(performance.rated_matches,2);assert.equal(performance.not_selected_matches,1);
 assert.equal(Number((await row(captain,"select * from public.get_player_performance($1,'7d')",[club.id])).average_score),0);
 const history=(await query(admin,'select * from public.get_player_rating_history($1,$2)',[club.id,performance.player_id])).rows;
 assert.equal(history.length,3);assert.equal(history[0].score,0);assert.equal(history[2].not_selected,true);
 await assert.rejects(query(admin,"select * from public.get_player_performance($1,'all')",[club.id]),e=>e.code==='22023');
});
test('hora de valoración y tres meses se validan en servidor, también aunque se invoque RPC directamente',async()=>{
 for(const index of [3,4,5]) await assert.rejects(save(admin,calls[index].id,[rating(entries[index][0].id,8)]),e=>e.code==='P0041');
 await assert.rejects(save(admin,calls[0].id,[rating(entries[1][1].id,8)]),e=>e.code==='42501');
 for(const score of [-1,11,5.5]) await assert.rejects(save(admin,calls[0].id,[rating(entries[0][1].id,score)]),e=>e.code==='22023');
 await assert.rejects(save(admin,calls[0].id,[{entry_id:entries[0][1].id,not_selected:true,score:8,expected_updated_at:null}]),e=>e.code==='22023');
});
test('lotes inválidos son atómicos y dos capitanes no se sobrescriben cambios silenciosamente',async()=>{
 const previous=await row(admin,'select * from public.player_ratings where call_up_player_id=$1',[entries[0][0].id]);
 await assert.rejects(save(admin,calls[0].id,[rating(entries[0][0].id,8,previous.updated_at),rating(entries[0][1].id,11)]),e=>e.code==='22023');
 assert.equal((await row(admin,'select * from public.player_ratings where call_up_player_id=$1',[entries[0][0].id])).score,0);
 await save(captain,calls[0].id,[rating(entries[0][0].id,9,previous.updated_at)]);
 await assert.rejects(save(admin,calls[0].id,[rating(entries[0][0].id,3,previous.updated_at)]),e=>e.code==='40001');
 const current=await row(admin,'select * from public.player_ratings where call_up_player_id=$1',[entries[0][0].id]);assert.equal(current.score,9);assert.equal(current.rated_by,captain);
 await assert.rejects(save(admin,calls[0].id,[rating(entries[0][1].id,8),rating(entries[0][1].id,9)]),e=>e.code==='22023');
 assert.equal((await query(admin,'select * from public.player_ratings where call_up_player_id=$1',[entries[0][1].id])).rows.length,0);
});
test('se pueden quitar notas y los registros vencidos se ocultan y purgan sin borrar convocatorias',async()=>{
 const record=await row(admin,'select * from public.player_ratings where call_up_player_id=$1',[entries[2][0].id]);
 await save(admin,calls[2].id,[{entry_id:record.call_up_player_id,clear:true,expected_updated_at:record.updated_at}]);
 assert.equal((await query(admin,'select * from public.player_ratings where call_up_player_id=$1',[record.call_up_player_id])).rows.length,0);
 await db.query("insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score) values($1,$2,$3,$4,'Old player',7)",[entries[3][0].id,club.id,calls[3].id,entries[3][0].source_player_id]);
 assert.equal((await query(admin,'select * from public.player_ratings where call_up_id=$1',[calls[3].id])).rows.length,0);
 await assert.rejects(query(admin,'select private.purge_expired_player_ratings()'),e=>e.code==='42501');
 assert.equal((await db.query('select private.purge_expired_player_ratings() count')).rows[0].count,1);
 assert.equal((await row(admin,'select * from public.call_ups where id=$1',[calls[3].id])).id,calls[3].id);
});
test('configuración de horario es atómica y no publica ni crea una convocatoria con valoración anterior al partido',async()=>{
 const before=(await db.query('select count(*)::int count from public.call_ups where club_id=$1',[club.id])).rows[0].count;
 await assert.rejects(query(admin,"select public.create_call_up_with_evaluation($1,$2,null,'open',null,$3)",[club.id,when(5),when(5,11)]),e=>e.code==='23514');
 assert.equal((await db.query('select count(*)::int count from public.call_ups where club_id=$1',[club.id])).rows[0].count,before);
 const list=(await query(admin,'select * from public.list_rating_call_ups($1)',[club.id])).rows;
 assert.equal(list.some(call=>call.id===calls[3].id),false);assert.equal(list.some(call=>call.id===calls[5].id),false);
});

test('visibilidad editable: solo capitanes por defecto, notas propias o miembros; solo capitanes pueden cambiarla',async()=>{
 assert.equal((await row(admin,'select ratings_visibility from public.clubs where id=$1',[club.id])).ratings_visibility,'captains');
 await query(admin,'select public.link_player_account($1,$2)',[entries[0][0].source_player_id,member]);
 await save(admin,calls[0].id,[rating(entries[0][1].id,6)]);
 for(const user of [member,other]) await assert.rejects(query(user,"select public.set_rating_visibility($1,'members')",[club.id]),e=>e.code==='42501');
 await query(admin,"select public.set_rating_visibility($1,'self')",[club.id]);
 const own=(await query(member,'select * from public.player_ratings')).rows;
 assert.ok(own.length>0);assert.ok(own.every(rating=>rating.player_id===entries[0][0].source_player_id));
 const stats=(await query(member,"select * from public.get_player_performance($1,'3m')",[club.id])).rows;assert.equal(stats.length,1);
 assert.equal((await query(member,'select * from public.get_player_rating_history($1,$2)',[club.id,entries[0][1].source_player_id])).rows.length,0);
 await query(captain,"select public.set_rating_visibility($1,'members')",[club.id]);
 assert.equal((await query(member,"select * from public.get_player_performance($1,'3m')",[club.id])).rows.length,2);
 assert.equal((await query(other,'select * from public.player_ratings')).rows.length,0);
 await assert.rejects(save(member,calls[0].id,[rating(entries[0][1].id,10)]),e=>e.code==='42501');
 await query(admin,"select public.set_rating_visibility($1,'captains')",[club.id]);
 assert.equal((await query(member,'select * from public.player_ratings')).rows.length,0);
 await assert.rejects(query(member,"select * from public.get_player_performance($1,'3m')",[club.id]),e=>e.code==='42501');
});
