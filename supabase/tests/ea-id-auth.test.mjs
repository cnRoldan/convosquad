import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const user = '00000000-0000-4000-8000-000000000901';
const duplicate = '00000000-0000-4000-8000-000000000902';
let db;
before(async () => { db = await createTestDatabase(); });
after(async () => { await db?.close(); });
const available = async value => (await asUser(db, null, tx => tx.query('select public.is_ea_id_available($1) as available', [value]), 'anon')).rows[0].available;

test('registro crea perfil con ID de EA, sin asignar club ni rol de administrador', async () => {
  await db.query('insert into auth.users(id, raw_user_meta_data) values ($1,$2)', [user, { username: '  EA-Player_9  ' }]);
  assert.equal((await asUser(db, user, tx => tx.query('select username from public.profiles where id = $1', [user]))).rows[0].username, 'EA-Player_9');
  assert.equal((await db.query('select count(*)::int as count from public.club_members where user_id = $1', [user])).rows[0].count, 0);
});
test('disponibilidad ignora mayúsculas y espacios exteriores sin exponer perfiles', async () => {
  assert.equal(await available('  ea-PLAYER_9  '), false);
  assert.equal(await available('Other-Player'), true);
  for (const invalid of [null, '', 'ab', 'ID con espacios', 'a@b.test', 'a'.repeat(25)]) assert.equal(await available(invalid), false);
  await assert.rejects(asUser(db, null, tx => tx.query('select * from public.profiles'), 'anon'), { code: '42501' });
});
test('la restricción única evita carreras y revierte la cuenta duplicada', async () => {
  await assert.rejects(db.query('insert into auth.users(id, raw_user_meta_data) values ($1,$2)', [duplicate, { username: 'ea-player_9' }]), { code: '23505' });
  assert.equal((await db.query('select count(*)::int as count from auth.users where id = $1', [duplicate])).rows[0].count, 0);
});
test('ningún usuario puede cambiar el identificador de acceso por la API de perfiles', async () => {
  await assert.rejects(asUser(db, user, tx => tx.query("update public.profiles set username = 'Other-Player' where id = $1", [user])), { code: '42501' });
  assert.equal(await available('EA-Player_9'), false);
});
