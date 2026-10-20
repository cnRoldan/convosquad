import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const [owner,captain,player,applicant,outsider]=[1,2,3,4,5].map(n=>`6b000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const server=(sql,args=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,args);});
before(async()=>{
 db=await createTestDatabase();
 for(const [index,user] of [owner,captain,player,applicant,outsider].entries()){
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[user,{username:`Request_${index}`}]);
  await row(user,"select public.register_push_device($1,$2,'ios')",[randomUUID(),`ExpoPushToken[JoinRequest_${index}]`]);
 }
 await row(owner,'select public.set_notification_preferences(false)');
});
after(async()=>{await db?.close();});
async function setup(){
 const club=await row(owner,"select * from public.create_club($1,null,'UTC',true)",[`Request club ${randomUUID().slice(0,8)}`]);
 for(const [user,role] of [[captain,'admin'],[player,'player']])await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)',[club.id,user,role]);
 const request=await row(applicant,'select * from public.request_to_join($1)',[club.id]);
 const event=(await db.query("select * from public.push_events where admission_request_id=$1 and kind='club_join_request'",[request.id])).rows[0];
 return {club,request,event};
}
test('nueva solicitud avisa a todos los capitanes activos del club, sin ficha ni convocatoria ni preferencia de votos',async()=>{
 const {club,request,event}=await setup();
 assert.equal(event.club_name_snapshot,club.name);assert.equal(event.actor_ea_id,'Request_3');assert.equal(event.call_up_id,null);assert.equal(event.recipient_user_id,null);
 const deliveries=(await server('select * from public.claim_push_deliveries($1)',[event.id])).rows;
 assert.deepEqual(deliveries.map(row=>row.user_id).sort(),[owner,captain].sort());assert.ok(deliveries.every(row=>!row.can_vote));
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[event.id])).rows.length,0);
 await assert.rejects(row(applicant,'select * from public.request_to_join($1)',[club.id]),{code:'23505'});
 assert.equal((await db.query("select * from public.push_events where admission_request_id=$1 and kind='club_join_request'",[request.id])).rows.length,1);
});
test('revisar antes del envío descarta avisos antiguos; volver a solicitar después de rechazo genera un nuevo aviso',async()=>{
 for(const approve of [true,false]){
  const {club,request,event}=await setup();
  await row(owner,'select * from public.review_join_request($1,$2)',[request.id,approve]);
  assert.equal((await server('select * from public.claim_push_deliveries($1)',[event.id])).rows.length,0);
  assert.ok((await db.query('select state from public.push_deliveries where event_id=$1',[event.id])).rows.every(row=>row.state==='skipped'));
  if(!approve){
   const again=await row(applicant,'select * from public.request_to_join($1)',[club.id]);assert.notEqual(again.id,request.id);
   assert.equal((await db.query("select * from public.push_events where club_id=$1 and kind='club_join_request'",[club.id])).rows.length,2);
  }
 }
});
test('capitán degradado, inactivo o token revocado no recibe la solicitud',async()=>{
 for(const state of ['demoted','inactive','token']){
  const {club,event}=await setup();
  if(state==='token')await db.query('update public.push_devices set is_active=false where user_id=$1',[captain]);
  else await db.query('update public.club_members set role=$3,is_active=$4 where club_id=$1 and user_id=$2',[club.id,captain,state==='demoted'?'player':'admin',state!=='inactive']);
  assert.deepEqual((await server('select * from public.claim_push_deliveries($1)',[event.id])).rows.map(row=>row.user_id),[owner]);
 }
 await db.query('update public.push_devices set is_active=true where user_id=$1',[captain]);
});
test('RLS permite solicitudes al solicitante y capitanes; otros jugadores, otros clubes y anónimos no acceden a datos ni cola',async()=>{
 const {request,event}=await setup();
 for(const user of [owner,captain,applicant])assert.equal((await query(user,'select id from public.join_requests where id=$1',[request.id])).rows.length,1);
 for(const user of [player,outsider])assert.equal((await query(user,'select id from public.join_requests where id=$1',[request.id])).rows.length,0);
 for(const user of [owner,captain,player,applicant,outsider]){
  await assert.rejects(query(user,'select * from public.push_events'),{code:'42501'});
  await assert.rejects(query(user,'select * from public.claim_push_deliveries($1)',[event.id]),{code:'42501'});
  if(user!==owner && user!==captain)await assert.rejects(row(user,'select * from public.review_join_request($1,true)',[request.id]),{code:'42501'});
 }
 await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.join_requests'),'anon'),{code:'42501'});
 const tables=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'")).rows.map(row=>row.tablename);
 assert.ok(tables.includes('join_requests'));assert.ok(tables.includes('club_members'));
});
