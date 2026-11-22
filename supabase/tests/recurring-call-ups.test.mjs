import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const id=n=>`97000000-0000-4000-8000-${String(n).padStart(12,'0')}`;const captain=id(1),member=id(2),outsider=id(3);
let db;const query=(u,sql,args=[])=>asUser(db,u,tx=>tx.query(sql,args));
const create=async(name='Recurring',tz='UTC')=>{
 const c=(await query(captain,'select * from public.create_club($1,null,$2)',[name,tz])).rows[0];
 await db.query('insert into public.club_feature_entitlements(club_id,club_activated_at) values($1,now())',[c.id]);return c;
};
before(async()=>{db=await createTestDatabase();for(const [u,name]of[[captain,'RepeatCaptain'],[member,'RepeatPlayer'],[outsider,'RepeatOther']])await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[u,{username:name}]);});
after(async()=>db?.close());
const schedule=(u,club,date='2030-01-07',days=[1,3,5])=>query(u,"select * from public.create_recurring_call_up($1,$2,$3,'21:50','00:00','18:45','19:00',true)",[club,date,days]);
test('only captains can create/read/stop; first occurrence is atomic, weekly rule is unique and stop preserves calls',async()=>{
 const c=await create();await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[c.id,member]);
 for(const u of[member,outsider])await assert.rejects(schedule(u,c.id),e=>e.code==='42501');
 await assert.rejects(query(member,'select private.generate_recurring_call_ups()'));
 const call=(await schedule(captain,c.id)).rows[0];assert.equal(call.status,'open');assert.equal(call.ends_at.toISOString(),'2030-01-08T00:00:00.000Z');
 assert.equal((await query(member,'select * from public.recurring_call_ups')).rows.length,0);
 assert.equal((await query(outsider,'select * from public.recurring_call_ups')).rows.length,0);
 let rule=(await query(captain,'select * from public.recurring_call_ups where club_id=$1',[c.id])).rows[0];assert.equal(rule.next_date.toISOString().slice(0,10),'2030-01-09');
 await assert.rejects(schedule(captain,c.id),e=>e.code==='P0050');
 await assert.rejects(query(member,'select public.stop_recurring_call_up($1)',[c.id]));
 await query(captain,'select public.stop_recurring_call_up($1)',[c.id]);
 assert.equal((await db.query('select count(*)::int n from public.call_ups where club_id=$1',[c.id])).rows[0].n,1);
 await assert.rejects(schedule(captain,c.id,'2030-01-08',[1]),e=>e.code==='22023');
 await assert.rejects(schedule(captain,c.id,'2030-01-08',[]),e=>e.code==='22023');
});
test('local times follow daylight saving and reject missing or ambiguous hours',async()=>{
 const instant=async(date,time)=>(await db.query("select private.recurring_local_instant($1,$2,'Europe/Madrid') as instant",[date,time])).rows[0].instant.toISOString();
 assert.equal(await instant('2027-01-04','21:50'),'2027-01-04T20:50:00.000Z');
 assert.equal(await instant('2027-07-05','21:50'),'2027-07-05T19:50:00.000Z');
 for(const date of['2027-03-28','2027-10-31'])await assert.rejects(instant(date,'02:30'),e=>e.code==='22023');
});
test('server generates once with fresh roster, does not overwrite manual dates and restores identity',async()=>{
 let offset=-new Date().getUTCHours();if(offset < -12)offset+=24;
 const tz=offset===0?'UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
 const c=await create('Daily worker',tz);
 const {rows:[clock]}=await db.query("select (clock_timestamp() at time zone $1)::date as today,extract(isodow from clock_timestamp() at time zone $1)::int as day",[tz]);
 const today=clock.today.toISOString().slice(0,10);const next=new Date(clock.today);next.setUTCDate(next.getUTCDate()+7);
 await schedule(captain,c.id,next.toISOString().slice(0,10),[clock.day]);
 await db.query("insert into public.players(club_id,ea_id,category) values($1,'Fresh roster','midfielders')",[c.id]);
 await db.query('update public.recurring_call_ups set next_date=$1 where club_id=$2',[today,c.id]);
 const before=(await db.query("select current_setting('request.jwt.claim.sub',true) v")).rows[0].v;
 assert.equal((await db.query('select private.generate_recurring_call_ups() n')).rows[0].n,1);
 assert.equal((await db.query('select private.generate_recurring_call_ups() n')).rows[0].n,0);
 const calls=(await db.query('select * from public.call_ups where club_id=$1 and local_date=$2',[c.id,today])).rows;assert.equal(calls.length,1);assert.equal(calls[0].created_by,captain);
 assert.equal((await db.query('select count(*)::int n from public.call_up_players where call_up_id=$1',[calls[0].id])).rows[0].n,1);
 assert.equal((await db.query("select coalesce(current_setting('request.jwt.claim.sub',true),'') v")).rows[0].v,before??'');
 await db.query('update public.recurring_call_ups set next_date=$1 where club_id=$2',[today,c.id]);assert.equal((await db.query('select private.generate_recurring_call_ups() n')).rows[0].n,0);
 await db.query("update public.clubs set timezone='Pacific/Honolulu' where id=$1",[c.id]);await db.query('update public.recurring_call_ups set next_date=$1 where club_id=$2',[today,c.id]);await db.query('select private.generate_recurring_call_ups()');
 const rule=(await db.query('select * from public.recurring_call_ups where club_id=$1',[c.id])).rows[0];assert.equal(rule.enabled,false);assert.equal(rule.last_error,'timezone_changed');
});

test('expired activation or a removed creator pauses automation without bypassing club rules',async()=>{
 let offset=-new Date().getUTCHours();if(offset < -12)offset+=24;
 const tz=offset===0?'UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
 const {rows:[clock]}=await db.query("select (clock_timestamp() at time zone $1)::date today,extract(isodow from clock_timestamp() at time zone $1)::int as day",[tz]);
 const today=clock.today.toISOString().slice(0,10);const future=new Date(clock.today);future.setUTCDate(future.getUTCDate()+7);
 for(const reason of['activation_required','captain_unavailable']){
  const c=await create(reason,tz);await schedule(captain,c.id,future.toISOString().slice(0,10),[clock.day]);
  await db.query('update public.recurring_call_ups set next_date=$1 where club_id=$2',[today,c.id]);
  if(reason==='activation_required'){
   await db.query('delete from public.club_feature_entitlements where club_id=$1',[c.id]);await db.query("update public.clubs set trial_ends_at=now()-interval '1 day' where id=$1",[c.id]);
  }else{
   await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'admin')",[c.id,outsider]);await db.query("update public.club_members set role='player' where club_id=$1 and user_id=$2",[c.id,captain]);
  }
  await db.query('select private.generate_recurring_call_ups()');
  const rule=(await db.query('select * from public.recurring_call_ups where club_id=$1',[c.id])).rows[0];assert.equal(rule.enabled,false);assert.equal(rule.last_error,reason);
  assert.equal((await db.query('select count(*)::int n from public.call_ups where club_id=$1 and local_date=$2',[c.id,today])).rows[0].n,0);
 }
});

test('a midnight call-up is prepared the day before, not missed at its start time',async()=>{
 let offset=-new Date().getUTCHours();if(offset < -12)offset+=24;
 const tz=offset===0?'UTC':`Etc/GMT${offset>0?'-':'+'}${Math.abs(offset)}`;
 const c=await create('Midnight recurrence',tz);
 const today=(await db.query('select (clock_timestamp() at time zone $1)::date today',[tz])).rows[0].today;
 const tomorrow=new Date(today);tomorrow.setUTCDate(tomorrow.getUTCDate()+1);const first=new Date(tomorrow);first.setUTCDate(first.getUTCDate()+7);
 const day=((tomorrow.getUTCDay()+6)%7)+1;
 await query(captain,"select public.create_recurring_call_up($1,$2,$3,'00:00','02:00',null,null,false)",[c.id,first.toISOString().slice(0,10),[day]]);
 await db.query('update public.recurring_call_ups set next_date=$1 where club_id=$2',[tomorrow.toISOString().slice(0,10),c.id]);
 assert.equal((await db.query('select private.generate_recurring_call_ups() n')).rows[0].n,1);
 assert.equal((await db.query('select private.generate_recurring_call_ups() n')).rows[0].n,0);
 const call=(await db.query('select * from public.call_ups where club_id=$1 and local_date=$2',[c.id,tomorrow.toISOString().slice(0,10)])).rows[0];assert.ok(call);assert.ok(call.starts_at>new Date());assert.equal(call.evaluation_at,null);
});
