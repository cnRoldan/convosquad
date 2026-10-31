import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const captain='81000000-0000-4000-8000-000000000001';
const outsider='81000000-0000-4000-8000-000000000002';
let db,call;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const doc={formation:'4-3-3',slots:Array.from({length:11},(_,id)=>({id,x:0.5,y:id===0?0.9:0.3,playerId:null})),bench:[]};
before(async()=>{
 db=await createTestDatabase();
 for(const [id,username] of [[captain,'LineupCaptain'],[outsider,'LineupOutsider']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username}]);
 const club=(await query(captain,"select * from public.create_club('Lineup club')")).rows[0];
 call=(await query(captain,"select * from public.create_call_up($1,'2035-09-01T20:00:00Z','open')",[club.id])).rows[0];
});
after(async()=>db?.close());
test('manual guests create snapshots and retain roster entries without exposing contacts',async()=>{
 for(const kind of ['aid','trial']) {
 const guest=(await query(captain,'select public.add_lineup_guest($1,$2,$3,$4,$5,true) id',[call.id,kind,`Guest ${kind}`,'private note','+34600111222'])).rows[0].id;
 const row=(await db.query('select * from public.lineup_guests where id=$1',[guest])).rows[0];
 assert.ok(kind==='aid'?row.aid_id:row.trial_id);
 if(kind==='trial') assert.ok(row.source_trial_id);
 const list=(await query(captain,'select * from public.list_lineup_guests($1)',[call.id])).rows;
 assert.equal(list.some(g=>g.id===guest),true);assert.equal('phone' in list[0],false);
 }
 await assert.rejects(query(outsider,"select public.add_lineup_guest($1,'aid','No',null,null,false)",[call.id]),{code:'42501'});
 await assert.rejects(query(captain,"select public.add_lineup_guest($1,'aid','Bad',null,'bad phone',false)",[call.id]));
});
test('drafts are revisioned, reject unauthorized access and incomplete publication',async()=>{
 await assert.rejects(query(outsider,'select public.read_lineup($1)',[call.id]),{code:'42501'});
 await assert.rejects(query(outsider,'select public.save_lineup($1,0,$2,false)',[call.id,doc]),{code:'42501'});
 const access=(await query(captain,'select public.activate_lineup_access($1) access',[call.id])).rows[0].access;
 assert.deepEqual(access,{activated:true,premium:false,remaining:5,allowed:true});
 assert.deepEqual((await query(captain,'select public.activate_lineup_access($1) access',[call.id])).rows[0].access,access);
 assert.equal((await query(captain,'select public.save_lineup($1,0,$2,false) revision',[call.id,doc])).rows[0].revision,1);
 await assert.rejects(query(captain,'select public.save_lineup($1,0,$2,false)',[call.id,doc]),{code:'40001'});
 await assert.rejects(query(captain,'select public.save_lineup($1,1,$2,true)',[call.id,doc]));
 const result=(await query(captain,'select public.read_lineup($1) state',[call.id])).rows[0].state;
 assert.equal(result.revision,1);assert.deepEqual(result.document,doc);
});
test('six free generations are shared by the club and a seventh remains locked',async()=>{
 const club=(await db.query('select club_id from public.call_ups where id=$1',[call.id])).rows[0].club_id;
 for(let index=2;index<=6;index++) {
   const next=(await query(captain,"select * from public.create_call_up($1,$2,'open')",[club,`2035-09-0${index}T20:00:00Z`])).rows[0];
   const access=(await query(captain,'select public.activate_lineup_access($1) access',[next.id])).rows[0].access;
   assert.equal(access.allowed,true); assert.equal(access.remaining,6-index);
 }
 const seventh=(await query(captain,"select * from public.create_call_up($1,'2035-09-07T20:00:00Z','open')",[club])).rows[0];
 const locked=(await query(captain,'select public.activate_lineup_access($1) access',[seventh.id])).rows[0].access;
 assert.deepEqual(locked,{activated:false,premium:false,remaining:0,allowed:false});
 await assert.rejects(query(captain,'select public.read_lineup($1)',[seventh.id]),{code:'42501'});
});
test('custom field layout belongs to the club and is only writable by captains',async()=>{
 const club=(await db.query('select club_id from public.call_ups where id=$1',[call.id])).rows[0].club_id;
 const slots=doc.slots.map(({id,x,y})=>({id,x,y}));
 assert.deepEqual((await query(captain,'select public.read_lineup_preference($1) preference',[club])).rows[0].preference,{playerColor:'#B4F16C',jerseyColor:'#0B1210',positionLocked:true});
 await assert.rejects(query(outsider,'select public.save_lineup_preference($1,$2,$3)',[club,'4-3-3',slots]),{code:'42501'});
 const saved=(await query(captain,'select public.save_lineup_preference($1,$2,$3) preference',[club,'4-3-3',slots])).rows[0].preference;
 assert.equal(saved.formation,'4-3-3');assert.deepEqual(saved.slots,slots);
 assert.deepEqual((await query(captain,'select public.read_lineup_preference($1) preference',[club])).rows[0].preference,{...saved,playerColor:'#B4F16C',jerseyColor:'#0B1210',positionLocked:true});
 await assert.rejects(query(outsider,"select public.set_lineup_player_color($1,'#70B7FF')",[club]),{code:'42501'});
 assert.equal((await query(captain,"select public.set_lineup_player_color($1,'#70B7FF') color",[club])).rows[0].color,'#70B7FF');
 await assert.rejects(query(outsider,'select public.delete_lineup_preference($1)',[club]),{code:'42501'});
 await query(captain,'select public.delete_lineup_preference($1)',[club]);
 assert.deepEqual((await query(captain,'select public.read_lineup_preference($1) preference',[club])).rows[0].preference,{playerColor:'#70B7FF',jerseyColor:'#0B1210',positionLocked:true});
});
test('rejects moved goalkeeper and missing coordinates',async()=>{
 const moved=structuredClone(doc);moved.slots[0].x=0.6;
 await assert.rejects(query(captain,'select public.save_lineup($1,1,$2,false)',[call.id,moved]));
 delete moved.slots[0].x;
 await assert.rejects(query(captain,'select public.save_lineup($1,1,$2,false)',[call.id,moved]));
});
test('late additions work after voting closes and are rejected after finalization',async()=>{
 await db.query("update public.call_ups set status='closed' where id=$1",[call.id]);
 for(const kind of ['aid','trial']) await query(captain,'select public.add_lineup_guest($1,$2,$3,null,null,false)',[call.id,kind,`Late ${kind}`]);
 await db.query("update public.call_ups set ends_at=clock_timestamp()-interval '1 minute',starts_at=clock_timestamp()-interval '2 hours' where id=$1",[call.id]);
 await assert.rejects(query(captain,"select public.add_lineup_guest($1,'aid','Too late',null,null,false)",[call.id]));
});
