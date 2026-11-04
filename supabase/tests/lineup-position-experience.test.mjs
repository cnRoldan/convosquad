import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
import { preset } from '../../src/features/lineups/model.ts';
import { slotCategory } from '../../src/features/lineups/suggestions.ts';
const owner='93000000-0000-4000-8000-000000000001',other='93000000-0000-4000-8000-000000000002';
let db,club,current,player;
const players=[];
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
before(async()=>{
 db=await createTestDatabase();
 for(const [id,username] of [[owner,'SuggestionsCaptain'],[other,'SuggestionsOther']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username}]);
 club=(await query(owner,"select * from public.create_club('Position experience')")).rows[0];
 for(let i=0;i<11;i++) players.push((await query(owner,"select * from public.add_or_restore_player(p_club_id=>$1,p_ea_id=>$2,p_category=>'midfielders')",[club.id,`Experienced${i}`])).rows[0]);
 player=players[0];
 current=(await query(owner,"select * from public.create_call_up($1,'2035-12-01T20:00:00Z','open')",[club.id])).rows[0];
 await query(owner,'select public.activate_lineup_access($1)',[current.id]);
});
after(async()=>db?.close());
test('aggregates published past positions using the same roles as the selector, without exposing lineups',async()=>{
 const expected=new Map();
 for(const [index,formation] of ['4-3-3','4-4-2','4-2-3-1','3-5-2'].entries()) {
  const call=(await query(owner,'select * from public.create_call_up($1,$2,\'open\')',[club.id,`2035-11-${String(index+1).padStart(2,'0')}T20:00:00Z`])).rows[0];
  const slots=preset(formation).map(s=>({...s,playerId:players[s.id].id}));
  await db.query('insert into public.call_up_lineups(call_up_id,club_id,draft,published) values($1,$2,$3,$3)',[call.id,club.id,{formation,slots,bench:[]}]);
  await db.query("update public.call_ups set starts_at=clock_timestamp()-(10+$2::integer)*interval '1 day',ends_at=clock_timestamp()-(9+$2::integer)*interval '1 day' where id=$1",[call.id,index]);
  for(const slot of slots){const key=slot.playerId+':'+slotCategory(formation,slot);expected.set(key,(expected.get(key)??0)+1);}
 }
 const rows=(await query(owner,'select * from public.lineup_position_experience($1)',[current.id])).rows;
 assert.equal(rows.length,expected.size);
 for(const row of rows){assert.equal(Number(row.appearances),expected.get(row.player_id+':'+row.category));assert.deepEqual(Object.keys(row).sort(),['appearances','category','player_id']);}
});
test('rejects outsiders and players, requires current lineup access, and excludes future/cancelled appearances',async()=>{
 await assert.rejects(query(other,'select * from public.lineup_position_experience($1)',[current.id]),{code:'42501'});
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,other]);
 await assert.rejects(query(other,'select * from public.lineup_position_experience($1)',[current.id]),{code:'42501'});
 const before=(await query(owner,'select * from public.lineup_position_experience($1)',[current.id])).rows;
 const call=(await query(owner,"select * from public.create_call_up($1,'2035-11-20T20:00:00Z','open')",[club.id])).rows[0];
 const doc={formation:'4-3-3',slots:preset('4-3-3').map(s=>({...s,playerId:s.id===10?player.id:null})),bench:[]};
 await db.query('insert into public.call_up_lineups(call_up_id,club_id,draft,published) values($1,$2,$3,$3)',[call.id,club.id,doc]);
 assert.deepEqual((await query(owner,'select * from public.lineup_position_experience($1)',[current.id])).rows,before);
 await db.query("update public.call_ups set status='cancelled',starts_at=clock_timestamp()-interval '3 days',ends_at=clock_timestamp()-interval '2 days' where id=$1",[call.id]);
 assert.deepEqual((await query(owner,'select * from public.lineup_position_experience($1)',[current.id])).rows,before);
 await db.query("update public.call_ups set status='closed' where id=$1",[call.id]);
 await db.query('update public.call_up_lineups set published=null where call_up_id=$1',[call.id]);
 assert.deepEqual((await query(owner,'select * from public.lineup_position_experience($1)',[current.id])).rows,before,'an unpublished draft must not count as experience');
 await db.query('delete from public.club_lineup_accesses where call_up_id=$1',[current.id]);
 await assert.rejects(query(owner,'select * from public.lineup_position_experience($1)',[current.id]),{code:'42501'});
});
