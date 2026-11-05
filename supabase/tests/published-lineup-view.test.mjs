import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const [captain,member,outsider]=[1,2,3].map(n=>`98000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,call,players,published,draft;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const read=(user=member)=>query(user,'select public.read_published_lineup($1) value',[call.id]).then(r=>r.rows[0].value);
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,member,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`PosterMember${index}`}]);
 club=(await query(captain,"select * from public.create_club('Published poster club')")).rows[0];
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,member]);
 players=[];
 for(const name of ['PublishedStarter','UnpublishedStarter'])players.push((await query(captain,"select * from public.add_or_restore_player(p_club_id=>$1,p_ea_id=>$2,p_category=>'midfielders')",[club.id,name])).rows[0]);
 call=(await query(captain,"select * from public.create_call_up($1,'2035-11-01T20:00:00Z','open')",[club.id])).rows[0];
 published={formation:'4-4-2',slots:[{id:0,x:.5,y:.9,playerId:players[0].id}],bench:[]};
 draft={...published,slots:[{id:0,x:.5,y:.9,playerId:players[1].id}]};
 await db.query('insert into public.call_up_lineups(call_up_id,club_id,draft) values($1,$2,$3)',[call.id,club.id,draft]);
});
after(async()=>db?.close());
test('unpublished lineups return no snapshot even when a draft exists',async()=>{
 assert.deepEqual(await read(),{allowed:true,snapshot:null});
 await assert.rejects(query(member,'select public.read_lineup($1)',[call.id]),{code:'42501'});
 await assert.rejects(query(member,'select public.read_lineup_access($1)',[call.id]),{code:'42501'});
});
test('members receive only published poster fields without activation or editor access',async()=>{
 await db.query('update public.call_up_lineups set published=$2 where call_up_id=$1',[call.id,published]);
 const image=await read();assert.equal(image.allowed,true);assert.deepEqual(image.snapshot.lineup,published);
 assert.deepEqual(image.snapshot.candidates.map(p=>p.name),['PublishedStarter']);
 assert.deepEqual(Object.keys(image.snapshot).sort(),['clubName','crestPath','lineup','candidates','shirtColor','numberColor','goalkeeperColor'].sort());
 await db.query("update public.call_up_lineups set historical_snapshot=historical_snapshot||'{\"privateNotes\":\"secret\",\"ratings\":\"secret\"}'::jsonb where call_up_id=$1",[call.id]);
 assert.ok(!JSON.stringify(await read()).includes('secret'));
 assert.ok(!JSON.stringify(await read()).includes('UnpublishedStarter'));
 assert.equal((await db.query('select count(*) from public.club_lineup_accesses where call_up_id=$1',[call.id])).rows[0].count,0);
 for(const fn of ['read_lineup','read_lineup_access'])await assert.rejects(query(member,`select public.${fn}($1)`,[call.id]),{code:'42501'});
 await assert.rejects(read(outsider),{code:'42501'});
 await assert.rejects(asUser(db,null,tx=>tx.query('select public.read_published_lineup($1)',[call.id]),'anon'),{code:'42501'});
});
test('draft edits keep the published image; republication replaces it',async()=>{
 await db.query('update public.call_up_lineups set draft=$2 where call_up_id=$1',[call.id,draft]);
 assert.deepEqual((await read()).snapshot.lineup,published);
 await db.query('update public.call_up_lineups set published=$2 where call_up_id=$1',[call.id,draft]);
 assert.deepEqual((await read()).snapshot.lineup,draft);
});
test('cancelled calls, revoked membership and historical Premium restrictions remain protected',async()=>{
 await db.query("update public.call_ups set status='cancelled' where id=$1",[call.id]);
 await assert.rejects(read(),{code:'42501'});
 await db.query("update public.call_ups set status='closed',starts_at=now()-interval '2 days',ends_at=now()-interval '1 day' where id=$1",[call.id]);
 assert.deepEqual(await read(),{allowed:false});
 await db.query("insert into public.club_feature_entitlements(club_id,lineup_premium_until) values($1,'infinity') on conflict(club_id) do update set lineup_premium_until='infinity'",[club.id]);
 assert.ok((await read()).snapshot);
 await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2',[club.id,member]);
 await assert.rejects(read(),{code:'42501'});
});
