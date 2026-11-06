import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const [captain, member, linked, inactive, outsider, secondCaptain] = [1,2,3,4,5,6].map(n => `99060000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db, club, otherClub, player;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
const list = (user = captain) => query(user, 'select * from public.list_unlinked_club_members($1)', [club.id]);
const remove = (user, target, clubId = club.id) => query(user, 'select public.remove_unlinked_club_member($1,$2)', [clubId,target]);
before(async () => {
  db = await createTestDatabase();
  for (const [i,id] of [captain, member, linked, inactive, outsider, secondCaptain].entries()) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id,{ username:`UnlinkedMember${i}` }]);
  }
  club = (await query(captain,"select * from public.create_club('Unlinked members')")).rows[0];
  otherClub = (await query(outsider,"select * from public.create_club('Other club')")).rows[0];
  for (const id of [member, linked, inactive, secondCaptain]) {
    await db.query('insert into public.club_members(club_id,user_id,role,is_active) values($1,$2,$3,$4)', [club.id,id,id===secondCaptain?'admin':'player',id!==inactive]);
  }
  player = (await db.query("insert into public.players(club_id,ea_id,category,user_id,is_active) values($1,'Linked account','midfielders',$2,false) returning *",[club.id,linked])).rows[0];
  await db.query("insert into public.players(club_id,ea_id,category,user_id) values($1,'Other club player','midfielders',$2)",[otherClub.id,outsider]);
});
after(async () => db?.close());

test('only active club members without any linked player card are listed, including captains', async () => {
  const rows = (await list()).rows;
  assert.deepEqual(new Set(rows.map(r=>r.user_id)), new Set([captain,member,secondCaptain]));
  assert.deepEqual(Object.keys(rows[0]).sort(), ['joined_at','role','user_id','username']);
  for (const user of [member,outsider,inactive]) await assert.rejects(list(user), {code:'42501'});
  await assert.rejects(query(null,'select * from public.list_unlinked_club_members($1)',[club.id]), {code:'42501'});
});

test('removal checks captain, club, own account and newly linked cards', async () => {
  await assert.rejects(remove(member,secondCaptain), {code:'42501'});
  await assert.rejects(remove(outsider,member), {code:'42501'});
  await assert.rejects(remove(captain,captain), {code:'42501'});
  await assert.rejects(remove(captain,linked), {code:'22023'});
  await db.query("insert into public.players(club_id,ea_id,category,user_id) values($1,'Linked while dialog open','midfielders',$2)",[club.id,member]);
  await assert.rejects(remove(captain,member), {code:'22023'});
  await db.query('update public.players set user_id=null where club_id=$1 and user_id=$2',[club.id,member]);
  await remove(captain,outsider);
  assert.equal((await db.query('select is_active from public.club_members where club_id=$1 and user_id=$2',[otherClub.id,outsider])).rows[0].is_active,true);
});

test('removal revokes access, rejects pending links and preserves accounts, cards and other clubs', async () => {
  await db.query("insert into public.player_link_requests(club_id,user_id,player_id) values($1,$2,$3)",[club.id,member,player.id]);
  await remove(captain,member);
  await remove(captain,member); // retry is idempotent
  assert.equal((await db.query('select is_active from public.club_members where club_id=$1 and user_id=$2',[club.id,member])).rows[0].is_active,false);
  assert.equal((await query(member,'select private.is_member($1) value',[club.id])).rows[0].value,false);
  assert.equal((await db.query('select status from public.player_link_requests where club_id=$1 and user_id=$2',[club.id,member])).rows[0].status,'rejected');
  assert.equal((await db.query('select count(*) from public.profiles where id=$1',[member])).rows[0].count,1);
  assert.equal((await db.query('select user_id from public.players where id=$1',[player.id])).rows[0].user_id,linked);
  assert.ok(!(await list()).rows.some(r=>r.user_id===member));
  await remove(captain,secondCaptain);
  assert.equal((await db.query("select count(*) from public.club_members where club_id=$1 and role='admin' and is_active",[club.id])).rows[0].count,1);
});
