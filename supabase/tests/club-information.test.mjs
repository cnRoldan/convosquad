import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [owner, captain, player, other] = [1, 2, 3, 4].map(n => `76000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
let db, club, call;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
before(async () => {
  db = await createTestDatabase();
  for (const [i, id] of [owner, captain, player, other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username: `Information_${i}` }]);
  club = (await query(owner, "select * from public.create_club('Original',null,'Europe/Madrid',true)")).rows[0];
  for (const [user, role] of [[captain, 'admin'], [player, 'player']]) await db.query('insert into public.club_members(club_id,user_id,role) values($1,$2,$3)', [club.id, user, role]);
  call = (await query(owner, "select * from public.create_call_up($1,'2035-06-01T22:30:00Z','open')", [club.id])).rows[0];
});
after(async () => { await db?.close(); });
test('capitán edita información y directorio; el nombre requiere Prémium', async () => {
  await assert.rejects(query(captain, "update public.clubs set name='Actualizado' where id=$1", [club.id]), e => e.code === '42501');
  const result = await query(captain, "update public.clubs set description='Descripción',timezone='Atlantic/Canary' where id=$1 returning *", [club.id]);
  assert.equal(result.rows[0].timezone, 'Atlantic/Canary');
  await db.query("insert into public.club_feature_entitlements(club_id,lineup_premium_until) values($1,'infinity')", [club.id]);
  await query(captain, "update public.clubs set name='Actualizado' where id=$1", [club.id]);
  const directory = (await db.query('select * from public.club_directory where club_id=$1', [club.id])).rows[0];
  assert.equal(directory.name, 'Actualizado'); assert.equal(directory.description, 'Descripción');
  assert.deepEqual((await db.query('select * from public.call_ups where id=$1', [call.id])).rows[0], call);
  const next = (await query(captain, "select * from public.create_call_up($1,'2035-06-04T22:30:00Z','open')", [club.id])).rows[0];
  assert.equal(next.timezone, 'Atlantic/Canary'); assert.equal(next.local_date.toISOString().slice(0, 10), '2035-06-04');
  await assert.rejects(query(captain, "select * from public.create_call_up($1,'2035-06-02T10:00:00Z','open')", [club.id]), e => e.code === '23505');
  await query(captain, 'update public.clubs set is_public=false where id=$1', [club.id]);
  assert.equal((await db.query('select * from public.club_directory where club_id=$1', [club.id])).rows.length, 0);
});
test('RLS impide editar a jugadores y otros clubes; solo creador elimina; zona inválida rechazada', async () => {
  for (const user of [player, other]) assert.equal((await query(user, "update public.clubs set name='Intruso' where id=$1 returning *", [club.id])).rows.length, 0);
  await assert.rejects(query(captain, "update public.clubs set timezone='Invalid/Zone' where id=$1", [club.id]), e => e.code === '22023');
  await assert.rejects(query(captain, 'select public.delete_club($1)', [club.id]), e => e.code === '42501');
  await assert.rejects(query(player, 'select public.delete_club($1)', [club.id]), e => e.code === '42501');
  assert.equal((await db.query('select name from public.clubs where id=$1', [club.id])).rows[0].name, 'Actualizado');
});
test('la prueba es única por creador y al vencer bloquea nuevas convocatorias', async () => {
  const second = (await query(owner, "select * from public.create_club('Segundo club')")).rows[0];
  const access = (await query(owner, 'select public.read_club_activation($1) access', [second.id])).rows[0].access;
  assert.equal(access.canCreateCallUps, false);
  await assert.rejects(query(owner, "select * from public.create_call_up($1,'2035-07-01T20:00:00Z','open')", [second.id]), e => e.code === 'P0045');
  const expiring = (await query(other, "select * from public.create_club('Club de prueba')")).rows[0];
  await db.query("update public.clubs set trial_ends_at=clock_timestamp()-interval '1 minute' where id=$1", [expiring.id]);
  await assert.rejects(query(other, "select * from public.create_call_up($1,'2035-07-02T20:00:00Z','open')", [expiring.id]), e => e.code === 'P0045');
});
