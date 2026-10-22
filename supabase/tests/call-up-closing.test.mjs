import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const [owner,member,other]=[1,2,3].map(n=>`77000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,call,entry;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [owner,member,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Closing_${i}`}]);
 const zone=new Date().getUTCHours()<20?'UTC':'Pacific/Honolulu';
 club=await row(owner,'select * from public.create_club($1,null,$2)', ['Closing Club',zone]);
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
 await db.query("insert into public.players(club_id,user_id,ea_id,category) values($1,$2,'Closing Player','attackers')",[club.id,member]);
});
after(async()=>{await db?.close();});
test('creación y edición atómicas respetan aviso, zona y fecha; jugador y otro club no editan',async()=>{
 call=await row(owner,"select * from public.create_call_up_with_schedule($1,clock_timestamp()+interval '2 hours',null,'open',clock_timestamp()+interval '1 hour')",[club.id]);
 assert.equal(call.timezone,club.timezone);assert.ok(call.closes_at<call.starts_at);
 entry=await row(member,'select * from public.call_up_players where call_up_id=$1',[call.id]);
 for(const actor of [member,other]) await assert.rejects(query(actor,"select * from public.update_call_up_with_schedule($1,$2,'open',null,$3)",[call.id,call.starts_at,call.closes_at]),e=>e.code==='42501');
 await assert.rejects(query(owner,"select * from public.update_call_up_with_schedule($1,$2,'open',null,$2::timestamptz+interval '1 hour')",[call.id,call.starts_at]),e=>e.code==='23514');
 assert.equal((await row(owner,'select * from public.call_ups where id=$1',[call.id])).closes_at.toISOString(),call.closes_at.toISOString());
 await assert.rejects(query(owner,"select * from public.update_call_up_with_schedule($1,$2,'open',$3,$3)",[call.id,call.starts_at,call.closes_at]),e=>e.code==='23514');
 await assert.rejects(query(member,'update public.call_ups set closes_at=null where id=$1',[call.id]),e=>e.code==='42501');
});
test('app y notificación permiten bajas y backup tras el cierre, incluso antes de Cron',async()=>{
 await query(member,"select public.respond_to_call_up($1,'available')",[entry.id]);
 // Simula el paso del tiempo sin esperar una hora, únicamente en la base de pruebas.
 await db.exec('alter table public.call_ups disable trigger validate_call_up_closing');
 try {await db.query("update public.call_ups set closes_at=clock_timestamp()-interval '1 second' where id=$1",[call.id]);}
 finally {await db.exec('alter table public.call_ups enable trigger validate_call_up_closing');}
 await assert.rejects(query(member,"select public.respond_to_call_up($1,'available')",[entry.id]),e=>e.code==='P0031');
 await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[entry.id]);
 await query(member,"select public.respond_to_call_up($1,'unavailable')",[entry.id]);
 await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[entry.id]);
 await query(member,"select public.respond_from_notification($1,$2,'backup','closed-action')",[club.id,call.id]);
 assert.equal((await row(owner,'select availability from public.call_up_players where id=$1',[entry.id])).availability,'backup');
 await assert.rejects(query(owner,'select public.restart_call_up($1,$2)',[call.id,call.status_version]),e=>e.code==='P0031');
 assert.equal((await row(owner,'select availability from public.call_up_players where id=$1',[entry.id])).availability,'backup');
});
test('cierre automático idempotente conserva votos, bloquea acceso cliente al worker y permite reprogramar',async()=>{
 for(const actor of [owner,member,other]) await assert.rejects(query(actor,'select private.close_due_call_ups()'),e=>e.code==='42501');
 assert.equal((await db.query('select private.close_due_call_ups() n')).rows[0].n,1);
 assert.equal((await db.query('select private.close_due_call_ups() n')).rows[0].n,0);
 assert.equal((await row(owner,'select status from public.call_ups where id=$1',[call.id])).status,'closed');
 assert.equal((await row(owner,'select availability from public.call_up_players where id=$1',[entry.id])).availability,'backup');
 await assert.rejects(query(owner,"select public.update_call_up($1,$2,'open')",[call.id,call.starts_at]),e=>e.code==='P0031');
 const reopened=await row(owner,"select * from public.update_call_up_with_schedule($1,$2,'open',null,clock_timestamp()+interval '1 hour')",[call.id,call.starts_at]);
 assert.equal(reopened.status,'open');assert.ok(reopened.closes_at>new Date());
});
