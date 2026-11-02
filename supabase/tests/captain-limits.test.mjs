import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const [owner, first, second] = [1, 2, 3].map(n => `83000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
let db, club;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));

before(async () => {
  db = await createTestDatabase();
  for (const [id, username] of [[owner, 'CaptainOwner'], [first, 'CaptainOne'], [second, 'CaptainTwo']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username }]);
  club = (await query(owner, "select * from public.create_club('Captain limits')")).rows[0];
  await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player'),($1,$3,'player')", [club.id, first, second]);
});
after(async () => db?.close());

test('free clubs allow two captains and Premium removes the quota', async () => {
  await query(owner, "select public.set_club_member($1,$2,'admin',true)", [club.id, first]);
  await assert.rejects(query(owner, "select public.set_club_member($1,$2,'admin',true)", [club.id, second]), { code: 'P0001' });
  await db.query("insert into public.club_feature_entitlements(club_id,lineup_premium_until) values($1,'infinity')", [club.id]);
  await query(owner, "select public.set_club_member($1,$2,'admin',true)", [club.id, second]);
  assert.equal((await db.query("select count(*)::integer count from public.club_members where club_id=$1 and role='admin' and is_active", [club.id])).rows[0].count, 3);
  await db.query("update public.club_feature_entitlements set lineup_premium_until='epoch' where club_id=$1", [club.id]);
  const captains = (await db.query("select user_id from public.club_members where club_id=$1 and role='admin' and is_active order by created_at", [club.id])).rows.map(row => row.user_id);
  assert.deepEqual(captains, [owner, first]);
});
