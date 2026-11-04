import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const owner='94000000-0000-4000-8000-000000000001',member='94000000-0000-4000-8000-000000000002',other='94000000-0000-4000-8000-000000000003';
let db,club,call,players,entries;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const read=async(user=owner)=>(await query(user,'select public.read_rating_lineup($1) value',[call.id])).rows[0].value;
before(async()=>{
 db=await createTestDatabase();
 for(const [id,name] of [[owner,'RatingsLineupCaptain'],[member,'RatingsLineupMember'],[other,'RatingsLineupOther']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:name}]);
 club=(await query(owner,"select * from public.create_club('Official ratings lineup')")).rows[0];
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,member]);
 players=[];
 for(const name of ['Starter','Bench'])players.push((await query(owner,"select * from public.add_or_restore_player(p_club_id=>$1,p_ea_id=>$2,p_category=>'midfielders')",[club.id,name])).rows[0]);
 call=(await query(owner,"select * from public.create_call_up($1,'2035-11-01T20:00:00Z','open')",[club.id])).rows[0];
 entries=(await db.query('select * from public.call_up_players where call_up_id=$1 order by ea_id_snapshot',[call.id])).rows;
 await db.query("update public.call_up_players set responded_at=clock_timestamp(),availability=case when source_player_id=$2 then 'unavailable'::public.availability_status else 'available'::public.availability_status end where call_up_id=$1",[call.id,players[0].id]);
});
after(async()=>db?.close());
test('reads only the published starting XI, independently of votes, bench and draft',async()=>{
 const starter=entries.find(p=>p.source_player_id===players[0].id);
 const document={formation:'4-4-2',slots:[{id:0,x:.5,y:.9,playerId:players[0].id}],bench:[players[1].id]};
 const draft={...document,slots:[{id:0,x:.5,y:.9,playerId:players[1].id}]};
 await db.query('insert into public.call_up_lineups(call_up_id,club_id,draft) values($1,$2,$3)',[call.id,club.id,draft]);
 assert.deepEqual(await read(),{published:false,entryIds:[]});
 await db.query('update public.call_up_lineups set published=$2 where call_up_id=$1',[call.id,document]);
 assert.deepEqual(await read(),{published:true,entryIds:[starter.id]});
 await db.query("update public.call_up_players set responded_at=null,availability='unanswered' where call_up_id=$1",[call.id]);
 assert.deepEqual(await read(),{published:true,entryIds:[starter.id]});
 await db.query("update public.call_ups set starts_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 hour' where id=$1",[call.id]);
 assert.deepEqual(await read(),{published:true,entryIds:[starter.id]},'captains can rate without purchasing access to complete historical lineups');
 await assert.rejects(query(owner,'select public.read_lineup($1)',[call.id]),{code:'42501'});
});
test('restricts participant lookup to captains of the same club',async()=>{
 await assert.rejects(read(member),{code:'42501'});
 await assert.rejects(read(other),{code:'42501'});
 await assert.rejects(asUser(db,null,tx=>tx.query('select public.read_rating_lineup($1)',[call.id]),'anon'),{code:'42501'});
});
