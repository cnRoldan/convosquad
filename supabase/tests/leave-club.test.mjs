import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const captain = '65000000-0000-4000-8000-000000000001';
const player = '65000000-0000-4000-8000-000000000002';
let db, club, playerRow, currentCall, finishedCall;
const query = (actor, sql, params = []) => asUser(db, actor, tx => tx.query(sql, params));
const row = async (...args) => (await query(...args)).rows[0];

before(async () => {
  db = await createTestDatabase();
  for (const [id, username] of [[captain, 'LeaveCaptain'], [player, 'LeavePlayer']]) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username }]);
  }
  club = await row(captain, "select * from public.create_club('Leave Club',null,'Europe/Madrid',true)");
  const request = await row(player, 'select * from public.request_to_join($1)', [club.id]);
  await query(captain, 'select * from public.review_join_request($1,true)', [request.id]);
  const createdPlayer = await row(captain, "insert into public.players(club_id,ea_id,category) values($1,'Leaving Player','midfielders') returning *", [club.id]);
  playerRow = await row(captain, 'select * from public.link_player_account($1,$2)', [createdPlayer.id, player]);
  finishedCall = await row(captain, "select * from public.create_call_up_with_end($1,'2030-01-01T20:00:00Z','2030-01-02T00:00:00Z',null,'open')", [club.id]);
  currentCall = await row(captain, "select * from public.create_call_up_with_end($1,'2030-01-02T20:00:00Z','2030-01-03T00:00:00Z',null,'open')", [club.id]);
  await db.query("update public.call_ups set starts_at=clock_timestamp()-interval '2 days',ends_at=clock_timestamp()-interval '1 day' where id=$1", [finishedCall.id]);
});

after(async () => { await db?.close(); });

test('un jugador abandona el club sin borrar su historial', async () => {
  const historical = await row(captain, 'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2', [finishedCall.id, playerRow.id]);
  assert.ok(await row(captain, 'select id from public.call_up_players where call_up_id=$1 and source_player_id=$2', [currentCall.id, playerRow.id]));

  await query(player, 'select public.leave_club($1)', [club.id]);

  assert.equal((await row(captain, 'select is_active from public.club_members where club_id=$1 and user_id=$2', [club.id, player])).is_active, false);
  assert.equal((await row(captain, 'select is_active from public.players where id=$1', [playerRow.id])).is_active, false);
  assert.equal((await query(captain, 'select id from public.call_up_players where call_up_id=$1 and source_player_id=$2', [currentCall.id, playerRow.id])).rows.length, 0);
  assert.deepEqual(await row(captain, 'select * from public.call_up_players where id=$1', [historical.id]), historical);
  await assert.rejects(query(player, 'select public.leave_club($1)', [club.id]), error => error.code === '22023');
});

test('un capitán no puede abandonar el club mediante esta acción', async () => {
  await assert.rejects(query(captain, 'select public.leave_club($1)', [club.id]), error => error.code === '42501');
  assert.equal((await row(captain, 'select is_active from public.club_members where club_id=$1 and user_id=$2', [club.id, captain])).is_active, true);
});
