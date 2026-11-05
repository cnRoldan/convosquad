import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
import {preset} from '../../src/features/lineups/model.ts';
const [captain,member,other]=[1,2,3].map(n=>`99010000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,trials=[],calls=[];
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const history=(user=captain,offset=0)=>query(user,'select public.read_trial_history($1,$2) value',[club.id,offset]).then(r=>r.rows[0].value);
before(async()=>{
 db=await createTestDatabase();
 for(const [index,id] of [captain,member,other].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`TrialHelperFix${index}`}]);
 club=(await query(captain,"select * from public.create_club('Trial helper fixes')")).rows[0];
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,member]);
 await db.query('insert into public.club_feature_entitlements(club_id,club_activated_at) values($1,now()) on conflict(club_id) do update set club_activated_at=now()',[club.id]);
 for(let i=0;i<8;i++)trials.push((await query(captain,'select * from public.save_club_trial_with_contact($1,$2,$3,null)',[club.id,`RosterTrial${i}`,'Private history note'])).rows[0]);
 for(let i=1;i<=3;i++)calls.push((await query(captain,"select * from public.create_call_up($1,$2,'open')",[club.id,`2035-11-0${i}T20:00:00Z`])).rows[0]);
});
after(async()=>db?.close());
test('free history still limits six; Premium allows withdrawal and promotion beyond six and returns every entry',async()=>{
 for(const trial of trials.slice(0,6))await query(captain,'select public.withdraw_trial($1)',[trial.id]);
 await assert.rejects(query(captain,'select public.withdraw_trial($1)',[trials[6].id]),{code:'P0043'});
 assert.equal((await history()).entries.length,6);assert.equal((await history()).premium,false);
 await db.query("update public.club_feature_entitlements set lineup_premium_until='infinity' where club_id=$1",[club.id]);
 await query(captain,'select public.withdraw_trial($1)',[trials[6].id]);
 await query(captain,"select public.promote_trial($1,'midfielders')",[trials[7].id]);
 const result=await history();assert.equal(result.premium,true);assert.equal(result.total,8);assert.equal(result.entries.length,8);
 assert.ok(result.entries.every(t=>t.notes==='Private history note'));
 for(const user of [member,other])await assert.rejects(history(user),{code:'42501'});
 await assert.rejects(history(captain,-1),{code:'22023'});
});
test('Premium history paginates beyond a hundred and expiry restores the free limit',async()=>{
 await db.query("insert into public.club_trials(club_id,ea_id,status,resolved_at) select $1,'HistoricalTrial'||n,'withdrawn',now() from generate_series(1,101) n",[club.id]);
 assert.equal((await history()).entries.length,100);assert.equal((await history()).hasMore,true);assert.equal((await history(captain,100)).entries.length,9);
 const active=(await query(captain,"select * from public.save_club_trial_with_contact($1,'Expiry trial',null,null)",[club.id])).rows[0];
 await db.query("update public.club_feature_entitlements set lineup_premium_until=now()-interval '1 minute' where club_id=$1",[club.id]);
 await assert.rejects(query(captain,'select public.withdraw_trial($1)',[active.id]),{code:'P0043'});
 assert.equal((await history()).entries.length,6);
 await db.query("update public.club_feature_entitlements set lineup_premium_until='infinity' where club_id=$1",[club.id]);
});
test('removing a roster helper preserves captured calls and allows their lineups to be saved',async()=>{
 const guest=(await query(captain,"select public.add_lineup_guest($1,'aid','Retained helper',null,null,true) value",[calls[0].id])).rows[0].value;
 await db.query('select private.materialize_lineup_candidates($1,$2)',[calls[1].id,[guest]]);
 for(const user of [member,other])await assert.rejects(query(user,'select public.remove_roster_helper($1)',[guest]),{code:'42501'});
 await query(captain,'select public.remove_roster_helper($1)',[guest]);
 assert.equal((await query(captain,'select * from public.list_roster_helpers($1)',[club.id])).rows.length,0);
 for(const call of calls.slice(0,2))assert.ok((await query(captain,'select * from public.list_lineup_guests($1)',[call.id])).rows.some(g=>g.id===guest));
 assert.ok(!(await query(captain,'select * from public.list_lineup_guests($1)',[calls[2].id])).rows.some(g=>g.id===guest));
 assert.equal((await db.query('select count(*) from public.call_up_aids where lineup_guest_id=$1',[guest])).rows[0].count,2);
 const document={formation:'4-4-2',slots:preset('4-4-2'),bench:[guest]};
 await query(captain,'select public.save_lineup($1,0,$2,false)',[calls[1].id,document]);
 await query(captain,'select public.remove_roster_helper($1)',[guest]);
});
test('withdrawn retained trials do not reappear as guests in new call-ups',async()=>{
 const guest=(await query(captain,"select public.add_lineup_guest($1,'trial','Retained trial',null,null,true) value",[calls[0].id])).rows[0].value;
 const source=(await db.query('select source_trial_id from public.lineup_guests where id=$1',[guest])).rows[0].source_trial_id;
 await query(captain,'select public.withdraw_trial($1)',[source]);
 assert.ok(!(await query(captain,'select * from public.list_lineup_guests($1)',[calls[2].id])).rows.some(g=>g.id===guest));
 assert.ok((await query(captain,'select * from public.list_lineup_guests($1)',[calls[0].id])).rows.some(g=>g.id===guest));
});
