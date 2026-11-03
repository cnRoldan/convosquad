import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const [captain, peer, member, outsider] = [1, 2, 3, 4].map(i => `89000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
let db, club, past, next, entries, players, first;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
const row = async (...args) => (await query(...args)).rows[0];
const record = async (user, entry, kind = 'late', note = 'Llegó tarde') => (await row(user, 'select public.record_player_incident($1,$2,$3,$4) incident', [past.id, entry, kind, note])).incident;
const list = (user, active = true, offset = 0) => query(user, 'select * from public.list_player_incidents($1,$2,null,$3)', [club.id, active, offset]);
const document = () => ({ formation: '4-4-2', slots: players.slice(0, 11).map((p, id) => ({ id, x: .5, y: id === 0 ? .9 : .3, playerId: p.id })), bench: [players[11].id] });

before(async () => {
  db = await createTestDatabase();
  for (const [i, id] of [captain, peer, member, outsider].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username: `IncidentCaptain_${i}` }]);
  club = await row(captain, "select * from public.create_club('Incidents club')");
  for (const user of [peer, member]) await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)', [club.id, user, user === peer ? 'admin' : 'player']);
  for (let i = 0; i < 12; i++) await row(captain, "insert into public.players(club_id,ea_id,category) values($1,$2,'midfielders') returning *", [club.id, `Incident_Player_${i}`]);
  players = (await db.query('select * from public.players where club_id=$1 order by ea_id', [club.id])).rows;
  const before = new Date(Date.now() - 7200000).toISOString(), ended = new Date(Date.now() - 3600000).toISOString();
  past = await row(captain, "select * from public.create_call_up_with_evaluation($1,$2,null,'open',null,$3)", [club.id, before, ended]);
  next = await row(captain, "select * from public.create_call_up($1,$2,'open')", [club.id, new Date(Date.now() + 86400000).toISOString()]);
  entries = (await db.query('select * from public.call_up_players where call_up_id=$1 order by ea_id_snapshot', [past.id])).rows;
});
after(async () => db?.close());

test('captains record real snapshots without rating the player or changing availability', async () => {
  first = await record(captain, entries[0].id);
  assert.equal(first.player_id, players[0].id);
  assert.equal(first.player_name, entries[0].ea_id_snapshot);
  assert.equal(first.captain_name, 'IncidentCaptain_0');
  assert.equal(Date.parse(first.expires_at) - Date.parse(first.created_at), 168 * 3600000);
  assert.equal((await db.query('select count(*)::int n from public.player_ratings')).rows[0].n, 0);
  assert.equal((await db.query('select availability from public.call_up_players where id=$1', [entries[0].id])).rows[0].availability, entries[0].availability);
  assert.equal((await list(peer)).rows.length, 1);
});

test('incidents stay private even when ratings are visible to members; RPCs and direct writes enforce permissions', async () => {
  await query(captain, "select public.set_rating_visibility($1,'members')", [club.id]);
  for (const user of [member, outsider]) {
    await assert.rejects(record(user, entries[1].id), { code: '42501' });
    await assert.rejects(list(user), { code: '42501' });
    assert.equal((await query(user, 'select * from public.player_incidents')).rows.length, 0);
  }
  await assert.rejects(asUser(db, null, tx => tx.query('select * from public.list_player_incidents($1)', [club.id]), 'anon'), { code: '42501' });
  await assert.rejects(query(captain, 'delete from public.player_incidents where id=$1', [first.id]), { code: '42501' });
  await assert.rejects(query(captain, "update public.player_incidents set expires_at=now()+interval '1 year' where id=$1", [first.id]), { code: '42501' });
  await assert.rejects(query(captain, 'select private.publish_lineup_draft_before_incidents($1)', [next.id]), { code: '42501' });
});

test('recording respects the rating window, membership, valid reasons and duplicate prevention', async () => {
  await assert.rejects(record(captain, entries[0].id), { code: '23505' });
  await assert.rejects(record(captain, entries[1].id, 'invented'), { code: '22023' });
  await assert.rejects(record(captain, entries[1].id, 'other', ' '), { code: '22023' });
  await assert.rejects(record(captain, entries[1].id, 'late', 'x'.repeat(501)), { code: '22023' });
  const futureEntry = (await db.query('select id from public.call_up_players where call_up_id=$1 limit 1', [next.id])).rows[0].id;
  await assert.rejects(record(captain, futureEntry), { code: '42501' });
  await assert.rejects(query(captain, "select public.record_player_incident($1,$2,'late','')", [next.id, futureEntry]), { code: 'P0041' });
});

test('publication requires confirmation for active starters; a newly recorded incident invalidates prior consent', async () => {
  const doc = document();
  const saved = (await row(captain, "select public.save_lineup_draft($1,null,0,'Incidents XI',$2,false) draft", [next.id, doc])).draft;
  await assert.rejects(query(captain, 'select public.publish_lineup_draft($1)', [saved.id]), { code: 'P0052' });
  await assert.rejects(query(captain, 'select public.save_lineup($1,0,$2,true)', [next.id, doc]), { code: 'P0052' });
  assert.equal((await db.query('select count(*)::int n from public.call_up_lineups where call_up_id=$1', [next.id])).rows[0].n, 0);
  const second = await record(peer, entries[1].id, 'no_show', 'No entró al partido');
  await assert.rejects(query(captain, 'select public.publish_lineup_draft($1,$2)', [saved.id, [first.id]]), { code: 'P0052' });
  await query(captain, 'select public.publish_lineup_draft($1,$2)', [saved.id, [first.id, second.id]]);
  assert.ok((await db.query('select published from public.call_up_lineups where call_up_id=$1', [next.id])).rows[0].published);
  // Moving affected players to the bench removes the need to acknowledge them.
  const clean = document();
  clean.slots[0].playerId = players[11].id;
  clean.slots[1].playerId = null;
  // Use a second club player for slot 1 after expiring their own incident.
  await db.query("update public.player_incidents set created_at=now()-interval '169 hours',expires_at=now()-interval '1 hour' where id=$1", [second.id]);
  clean.slots[1].playerId = players[1].id;
  clean.bench = [players[0].id];
  const cleanDraft = (await row(captain, "select public.save_lineup_draft($1,null,0,'Clean XI',$2,false) draft", [next.id, clean])).draft;
  await query(captain, 'select public.publish_lineup_draft($1)', [cleanDraft.id]);
});

test('expired incidents leave the active list but remain in history and survive removal of their call-up', async () => {
  await db.query("update public.player_incidents set created_at=now()-interval '169 hours',expires_at=now()-interval '1 hour'");
  assert.equal((await list(captain)).rows.length, 0);
  const historical = (await list(captain, false)).rows;
  assert.equal(historical.length, 2);
  await db.query('delete from public.call_ups where id=$1', [past.id]);
  const retained = (await list(peer, false)).rows;
  assert.equal(retained.length, 2);
  assert.ok(retained.every(incident => !incident.call_up_id && !incident.call_up_player_id && incident.player_name && incident.match_starts_at));
  await db.query('delete from public.players where id=$1', [players[0].id]);
  const removed = (await list(peer, false)).rows.find(incident => incident.id === first.id);
  assert.equal(removed.player_id, null);
  assert.equal(removed.player_name, entries[0].ea_id_snapshot);
  await assert.rejects(list(captain, false, -1), { code: '22023' });
});

test('historical pagination preserves older entries and active incidents are never truncated', async () => {
  await db.query("insert into public.player_incidents(club_id,player_name,match_starts_at,match_timezone,kind,note,captain_name) select $1,'Historical player '||n,now(),'UTC','other','Historical observation','Captain' from generate_series(1,105) n", [club.id]);
  assert.equal((await list(captain, false)).rows.length, 100);
  assert.equal((await list(captain, false, 100)).rows.length, 7);
  assert.equal((await list(captain)).rows.length, 105);
});
