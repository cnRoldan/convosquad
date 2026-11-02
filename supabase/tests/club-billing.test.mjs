import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const captain = '82000000-0000-4000-8000-000000000001';
const player = '82000000-0000-4000-8000-000000000002';
let db, club;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));

before(async () => {
  db = await createTestDatabase();
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4)', [captain, { username: 'BillingCaptain' }, player, { username: 'BillingPlayer' }]);
  club = (await query(captain, "select * from public.create_club('Billing club')")).rows[0];
  await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')", [club.id, player]);
});
after(async () => db?.close());

test('only a captain can create an intent and a RevenueCat purchase grants the intended club', async () => {
  await assert.rejects(query(player, "select public.begin_club_purchase($1,'com.convosquad.premium.monthly')", [club.id]), { code: '42501' });
  await query(captain, "select public.begin_club_purchase($1,'com.convosquad.premium.monthly')", [club.id]);
  const expiry = '2035-01-01T00:00:00Z';
  const applied = (await db.query("select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7) event", [captain, captain, 'com.convosquad.premium.monthly', 'subscription-1', 'APP_STORE', 'INITIAL_PURCHASE', expiry])).rows[0].event;
  assert.deepEqual(applied, { applied: true, clubId: club.id, kind: 'premium' });
  const entitlement = (await db.query('select lineup_premium_until from public.club_feature_entitlements where club_id=$1', [club.id])).rows[0];
  assert.equal(new Date(entitlement.lineup_premium_until).toISOString(), '2035-01-01T00:00:00.000Z');
  const renewal = (await db.query("select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,$7) event", [captain, captain, 'com.convosquad.premium.monthly', 'subscription-1', 'APP_STORE', 'RENEWAL', '2035-02-01T00:00:00Z'])).rows[0].event;
  assert.equal(renewal.applied, true);
  assert.equal(new Date((await db.query('select lineup_premium_until from public.club_feature_entitlements where club_id=$1', [club.id])).rows[0].lineup_premium_until).toISOString(), '2035-02-01T00:00:00.000Z');
});

test('activation is permanent until a refunded purchase is received', async () => {
  await query(captain, "select public.begin_club_purchase($1,'com.convosquad.club.activation')", [club.id]);
  assert.equal((await db.query("select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,null) event", [captain, captain, 'com.convosquad.club.activation', 'activation-1', 'APP_STORE', 'INITIAL_PURCHASE'])).rows[0].event.applied, true);
  assert.ok((await db.query('select club_activated_at from public.club_feature_entitlements where club_id=$1', [club.id])).rows[0].club_activated_at);
  await db.query("select public.apply_revenuecat_event($1,$2,$3,$4,$5,$6,null)", [captain, captain, 'com.convosquad.club.activation', 'activation-1', 'APP_STORE', 'REFUND']);
  assert.equal((await db.query('select club_activated_at from public.club_feature_entitlements where club_id=$1', [club.id])).rows[0].club_activated_at, null);
});
