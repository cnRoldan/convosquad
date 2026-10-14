import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const admin = '50000000-0000-4000-8000-000000000001';
const member = '50000000-0000-4000-8000-000000000002';
const outsider = '50000000-0000-4000-8000-000000000003';
let db, club, other;
const query = (actor, sql, params = []) => asUser(db, actor, tx => tx.query(sql, params));
const row = async (...args) => (await query(...args)).rows[0];
const player = name => row(admin, "insert into public.players(club_id,ea_id,jersey_number,category) values ($1,$2,10,'backups') returning *", [club.id, name]);
const activity = (actor, id, active) => query(actor, 'update public.players set is_active=$1 where club_id=$2 and id=$3 returning *', [active, club.id, id]);

before(async () => {
  db = await createTestDatabase();
  for (const [id, username] of [[admin, 'ActivityAdmin'], [member, 'ActivityMember'], [outsider, 'ActivityOther']]) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [id, { username }]);
  }
  club = await row(admin, "select * from public.create_club('Activity Club',null,'Europe/Madrid',true)");
  other = await row(outsider, "select * from public.create_club('Activity Other')");
  const request = await row(member, 'select * from public.request_to_join($1)', [club.id]);
  await query(admin, 'select * from public.review_join_request($1,true)', [request.id]);
});
after(async () => { await db?.close(); });

test('quitar conserva ficha, cuenta, membresía y snapshots completos; excluye nuevas convocatorias', async () => {
  const original = await player('Historical Activity');
  const linked = await row(admin, 'select * from public.link_player_account($1,$2)', [original.id, member]);
  const call = await row(admin, "select * from public.create_call_up($1,'2028-02-01T20:00:00Z','open')", [club.id]);
  const entry = await row(member, 'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2', [call.id, linked.id]);
  await query(member, "select * from public.respond_to_call_up($1,'available')", [entry.id]);
  await query(admin, "select * from public.update_call_up($1,'2028-02-01T20:00:00Z','closed')", [call.id]);
  const before = await row(admin, 'select * from public.call_up_players where id=$1', [entry.id]);
  const accountBefore = (await db.query('select * from auth.users where id=$1', [member])).rows[0];
  const membershipBefore = await row(admin, 'select * from public.club_members where club_id=$1 and user_id=$2', [club.id, member]);
  const removed = (await activity(admin, linked.id, false)).rows[0];
  assert.equal(removed.is_active, false);
  for (const key of Object.keys(linked).filter(key => key !== 'is_active')) assert.deepEqual(removed[key], linked[key]);
  assert.equal((await query(member, 'select id from public.players where club_id=$1 and is_active and id=$2', [club.id, linked.id])).rows.length, 0);
  assert.equal((await query(admin, 'select id from public.players where club_id=$1 and not is_active and id=$2', [club.id, linked.id])).rows.length, 1);
  const next = await row(admin, "select * from public.create_call_up($1,'2028-02-02T20:00:00Z','open')", [club.id]);
  assert.equal((await query(admin, 'select id from public.call_up_players where call_up_id=$1 and source_player_id=$2', [next.id, linked.id])).rows.length, 0);
  assert.deepEqual(await row(admin, 'select * from public.call_up_players where id=$1', [entry.id]), before);
  assert.deepEqual((await db.query('select * from auth.users where id=$1', [member])).rows[0], accountBefore);
  assert.deepEqual(await row(admin, 'select * from public.club_members where club_id=$1 and user_id=$2', [club.id, member]), membershipBefore);
});

test('reincorporar conserva identidad, dorsal y categoría y solo afecta nuevas convocatorias', async () => {
  const original = await player('Restored Activity');
  await activity(admin, original.id, false);
  const whileInactive = await row(admin, "select * from public.create_call_up($1,'2028-03-01T20:00:00Z','open')", [club.id]);
  const latest = await player('Append Activity');
  const restored = (await activity(admin, original.id, true)).rows[0];
  for (const key of ['id', 'club_id', 'ea_id', 'jersey_number', 'category', 'user_id', 'created_at']) assert.deepEqual(restored[key], original[key]);
  assert.equal(restored.is_active, true);
  assert.ok(restored.sort_order > latest.sort_order);
  assert.equal((await query(admin, 'select id from public.players where id=$1 and not is_active', [original.id])).rows.length, 0);
  assert.equal((await query(admin, 'select id from public.call_up_players where call_up_id=$1 and source_player_id=$2', [whileInactive.id, original.id])).rows.length, 0);
  const after = await row(admin, "select * from public.create_call_up($1,'2028-03-02T20:00:00Z','open')", [club.id]);
  const snapshot = await row(admin, 'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2', [after.id, original.id]);
  assert.equal(snapshot.ea_id_snapshot, original.ea_id);
  assert.equal(snapshot.jersey_number_snapshot, original.jersey_number);
  assert.equal(snapshot.category_snapshot, original.category);
  assert.equal(snapshot.availability, 'unanswered');
});

test('RLS bloquea desactivación y reincorporación por jugador, admin de otro club y anónimo', async () => {
  const own = await row(admin, 'select * from public.players where user_id=$1 and club_id=$2', [member, club.id]);
  const target = await player('Permission Activity');
  for (const active of [false, true]) {
    await activity(admin, target.id, !active);
    for (const actor of [member, outsider]) {
      assert.equal((await activity(actor, target.id, active)).rows.length, 0);
      assert.equal((await row(admin, 'select is_active from public.players where id=$1', [target.id])).is_active, !active);
    }
    assert.equal((await activity(member, own.id, active)).rows.length, 0);
  }
  const foreign = await row(outsider, "insert into public.players(club_id,ea_id,category) values ($1,'Foreign Activity','attackers') returning *", [other.id]);
  assert.equal((await query(admin, 'update public.players set is_active=false where id=$1 returning id', [foreign.id])).rows.length, 0);
  await assert.rejects(asUser(db, null, tx => tx.query('update public.players set is_active=false where id=$1', [target.id]), 'anon'), error => error.code === '42501');
});

test('EA ID y cuenta siguen reservados al desactivar; dorsales compartidos no bloquean reincorporación', async () => {
  const original = await player('Reserved Activity');
  await activity(admin, original.id, false);
  await assert.rejects(player('reserved activity'), error => error.code === '23505');
  const linked = await row(admin, 'select * from public.players where club_id=$1 and user_id=$2', [club.id, member]);
  assert.equal(linked.is_active, false);
  const another = await player('Other Account Activity');
  await assert.rejects(query(admin, 'select * from public.link_player_account($1,$2)', [another.id, member]), error => ['23505', '22023'].includes(error.code));
  const restored = (await activity(admin, original.id, true)).rows[0];
  assert.equal(restored.jersey_number, another.jersey_number);
  assert.equal(restored.ea_id, original.ea_id);
});
