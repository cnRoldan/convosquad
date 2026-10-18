import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,member,outsider]=[1,2,3].map(n=>`7c000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,calls=[],entry;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const remove=(user,call,version=call.status_version)=>query(user,'select public.delete_cancelled_call_up($1,$2)',[call.id,version]);
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [captain,member,outsider].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`DeleteCall_${i}`}]);
 club=await row(captain,"select * from public.create_club('Delete cancelled call')");
 await row(outsider,"select * from public.create_club('Another club')");
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
 const player=await row(captain,"insert into public.players(club_id,ea_id,category) values($1,'Official player','midfielders') returning *",[club.id]);
 await query(captain,'select public.link_player_account($1,$2)',[player.id,member]);
 await db.query("insert into public.club_trials(club_id,ea_id) values($1,'Trial name')",[club.id]);
 await query(member,"select public.register_push_device('7c000000-1111-4000-8000-000000000001','ExpoPushToken[DeleteCall]','android')");
 for(let day=1;day<=4;day++) calls.push(await row(captain,"select * from public.create_call_up($1,now()+$2::interval,'open')",[club.id,`${day} days`]));
 entry=await row(captain,'select * from public.call_up_players where call_up_id=$1',[calls[0].id]);
 await query(member,"select public.respond_to_call_up($1,'unavailable')",[entry.id]);
 await query(member,'select public.set_club_decision_lock($1,true,$2)',[club.id,entry.id]);
 await query(captain,"select public.save_call_up_aid_with_contact($1,'Helper','+34612345678')",[calls[0].id]);
 const trial=await row(captain,'select * from public.call_up_trials where call_up_id=$1',[calls[0].id]);
 await db.query("insert into public.call_up_trial_notes(club_id,call_up_id,trial_id,notes) values($1,$2,$3,'Private notes')",[club.id,calls[0].id,trial.id]);
 await db.query("insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score) values($1,$2,$3,$4,'Official player',8)",[entry.id,club.id,calls[0].id,player.id]);
 calls[0]=await row(captain,"select * from public.update_call_up($1,$2,'cancelled')",[calls[0].id,calls[0].starts_at]);
 calls[2]=await row(captain,"select * from public.update_call_up($1,$2,'closed')",[calls[2].id,calls[2].starts_at]);
 calls[3]=await row(captain,"select * from public.update_call_up($1,$2,'draft')",[calls[3].id,calls[3].starts_at]);
});
after(async()=>{await db?.close();});
test('solo capitanes del club pueden eliminar y exclusivamente una convocatoria cancelada con versión vigente',async()=>{
 for(const user of [member,outsider]) await assert.rejects(remove(user,calls[0]),e=>e.code==='42501');
 await assert.rejects(asUser(db,null,tx=>tx.query('select public.delete_cancelled_call_up($1,$2)',[calls[0].id,calls[0].status_version]),'anon'),e=>e.code==='42501');
 await assert.rejects(query(captain,'delete from public.call_ups where id=$1',[calls[0].id]),e=>e.code==='42501');
 for(const call of calls.slice(1)) await assert.rejects(remove(captain,call),e=>e.code==='22023');
 await assert.rejects(remove(captain,calls[0],calls[0].status_version-1),e=>e.code==='40001');
 assert.equal((await row(captain,'select * from public.call_ups where id=$1',[calls[0].id])).status,'cancelled');
});
test('borra datos y avisos de la convocatoria, conserva plantilla/candados y libera la fecha para crear otra',async()=>{
 const events=(await db.query('select id from public.push_events where call_up_id=$1',[calls[0].id])).rows.map(r=>r.id);
 assert.ok(events.length>0);
 await remove(captain,calls[0]);
 for(const table of ['call_ups','call_up_players','call_up_trials','call_up_aids','call_up_contacts','call_up_trial_notes','player_ratings','push_events']) {
  assert.equal((await db.query(`select count(*)::int n from public.${table} where ${table==='call_ups'?'id':'call_up_id'}=$1`,[calls[0].id])).rows[0].n,0,table);
 }
 assert.equal((await db.query('select count(*)::int n from public.push_deliveries where event_id=any($1::uuid[])',[events])).rows[0].n,0);
 for(const table of ['players','club_trials','club_decision_locks']) assert.equal((await db.query(`select count(*)::int n from public.${table} where club_id=$1`,[club.id])).rows[0].n,1,table);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,3);
 const replacement=await row(captain,"select * from public.create_call_up($1,$2,'open')",[club.id,calls[0].starts_at]);
 assert.notEqual(replacement.id,calls[0].id);assert.deepEqual(replacement.local_date,calls[0].local_date);
 assert.equal((await row(captain,'select availability from public.call_up_players where call_up_id=$1',[replacement.id])).availability,'unavailable');
 assert.equal((await row(captain,'select * from public.call_ups where id=$1',[calls[1].id])).id,calls[1].id);
});
