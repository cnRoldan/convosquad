import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before,after,test } from 'node:test';
import { createTestDatabase,asUser } from '../../scripts/database-test-utils.mjs';
const [owner,applicant,other]=[1,2,3].map(i=>`c1000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
let db;
const row=async(user,sql,args=[]) => (await asUser(db,user,t=>t.query(sql,args))).rows[0];
const server=(sql,args=[])=>db.transaction(async t=>{await t.exec('set local role service_role');return t.query(sql,args);});
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [owner,applicant,other].entries()){
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Admission_${i}`}]);
  await row(id,"select public.register_push_device($1,$2,'ios')",[randomUUID(),`ExpoPushToken[Admission_${i}]`]);
 }
 await row(applicant,'select public.set_notification_preferences(false)');
});
after(async()=>{await db?.close();});
async function setup(){
 const club=await row(owner,"select * from public.create_club($1,null,'UTC',true)",[`Wabi Sabi ${randomUUID().slice(0,8)}`]);
 const request=await row(applicant,'select * from public.request_to_join($1)',[club.id]);return {club,request};
}
const approve=(request,user=owner,player=null)=>row(user,'select * from public.review_join_request($1,true,$2)',[request.id,player]);
const event=async club=>(await db.query("select * from public.push_events where club_id=$1 and kind='club_approved'",[club.id])).rows[0];
test('aprobar sin convocatoria ni ficha avisa solo al admitido, independientemente de avisos de votos',async()=>{
 const {club,request}=await setup();await approve(request);
 const e=await event(club);assert.equal(e.recipient_user_id,applicant);assert.equal(e.call_up_id,null);assert.equal(e.club_name_snapshot,club.name);
 const d=(await server('select * from public.claim_push_deliveries($1)',[e.id])).rows;
 assert.equal(d.length,1);assert.equal(d[0].user_id,applicant);assert.equal(d[0].can_vote,false);
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[e.id])).rows.length,0);
 await assert.rejects(approve(request),{code:'22023'});
 assert.equal((await db.query("select * from public.push_events where admission_request_id=$1 and kind='club_approved'",[request.id])).rows.length,1);
});
test('rechazo y aprobación no autorizada no generan avisos; fallo de vinculación revierte la admisión',async()=>{
 const a=await setup();await assert.rejects(approve(a.request,other),{code:'42501'});assert.equal(await event(a.club),undefined);
 await assert.rejects(approve(a.request,owner,randomUUID()),{code:'22023'});assert.equal(await event(a.club),undefined);
 await row(owner,'select * from public.review_join_request($1,false)',[a.request.id]);assert.equal(await event(a.club),undefined);
});
test('si se revoca la pertenencia antes de enviar, la entrega se descarta',async()=>{
 const {club,request}=await setup();await approve(request);const e=await event(club);
 await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2',[club.id,applicant]);
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[e.id])).rows.length,0);
 assert.equal((await db.query('select state from public.push_deliveries where event_id=$1',[e.id])).rows[0].state,'skipped');
});
test('token invalidado y cuenta ajena nunca reciben avisos; usuarios no pueden leer ni fabricar eventos',async()=>{
 const {club,request}=await setup();await approve(request);const e=await event(club);
 await db.query('update public.push_devices set is_active=false where user_id=$1',[applicant]);
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[e.id])).rows.length,0);
 for(const user of [applicant,owner,other]){
  await assert.rejects(row(user,'select * from public.push_events'),{code:'42501'});
  await assert.rejects(row(user,'select * from public.claim_push_deliveries($1)',[e.id]),{code:'42501'});
 }
});
