import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const [owner, member, foreign, newcomer] = [1,2,3,4].map(i => `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
let db, club, current, history, closed, player, removed, trial, original, historyBefore;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
const row = async (user, sql, args = []) => (await query(user, sql, args)).rows[0];
const refresh = (user, id, reopen = false) => row(user, 'select * from public.refresh_call_up_roster($1,$2)', [id, reopen]);
const snapshots = async id => (await db.query('select * from public.call_up_players where call_up_id=$1 order by id', [id])).rows;
before(async () => {
  db = await createTestDatabase();
  for (const [index, id] of [owner,member,foreign,newcomer].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [id, { username: `Refresh_${index}` }]);
  club = await row(owner, "select * from public.create_club('Refrescar plantilla',null,'UTC')");
  await row(foreign, "select * from public.create_club('Otro club',null,'UTC')");
  for (const user of [member,newcomer]) await db.query('insert into public.club_members(club_id,user_id) values ($1,$2)', [club.id,user]);
  player = await row(owner, "insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'manoliko91',20,'midfielders') returning *", [club.id]);
  await query(owner, 'select * from public.link_player_account($1,$2)', [player.id,member]);
  removed = await row(owner, "insert into public.players(club_id,ea_id,category) values ($1,'Retirado','backups') returning *", [club.id]);
  trial = await row(owner, "insert into public.club_trials(club_id,ea_id,notes) values ($1,'Prueba','Antes') returning *", [club.id]);
  history = await row(owner, "select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')", [club.id]);
  await query(owner, "select * from public.update_call_up($1,$2,'closed')", [history.id,history.starts_at]);
  historyBefore = await snapshots(history.id);
  closed = await row(owner, "select * from public.create_call_up($1,'2030-01-02T20:00:00Z','open')", [club.id]);
  await query(owner, "select * from public.update_call_up($1,$2,'closed')", [closed.id,closed.starts_at]);
  current = await row(owner, "select * from public.create_call_up($1,'2030-01-01T20:00:00Z','open')", [club.id]);
  await query(owner, "insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Ayuda conservada')", [club.id,current.id]);
  original = await row(member, 'select * from public.call_up_players where call_up_id=$1 and user_id=$2', [current.id,member]);
  original = await row(member, "select * from public.respond_to_call_up($1,'backup')", [original.id]);
});
after(async () => { await db?.close(); });

test('actualiza categoría, dorsal, orden y pruebas conservando identidad y respuesta', async () => {
  await query(owner, "update public.players set category='attackers',jersey_number=9 where id=$1", [player.id]);
  await query(owner, "update public.club_trials set notes='Después' where id=$1", [trial.id]);
  assert.equal((await snapshots(current.id)).find(s => s.id === original.id).category_snapshot, 'midfielders');
  await refresh(owner,current.id);
  const updated = (await snapshots(current.id)).find(s => s.id === original.id);
  assert.equal(updated.category_snapshot,'attackers'); assert.equal(updated.jersey_number_snapshot,9);
  assert.equal(updated.availability,'backup'); assert.deepEqual(updated.responded_at,original.responded_at);
  assert.equal(updated.user_id,member); assert.equal(updated.source_player_id,player.id);
  const live = await row(owner,'select * from public.players where id=$1',[player.id]);
  assert.equal(updated.sort_order_snapshot,live.sort_order);
  assert.equal((await row(owner,'select * from public.call_up_trials where call_up_id=$1',[current.id])).notes_snapshot,'Después');
});
test('nuevos sin responder, retirados fuera, pruebas actualizadas y AYUDAS conservadas', async () => {
  await query(owner,'update public.players set is_active=false where id=$1',[removed.id]);
  await query(owner,"insert into public.players(club_id,ea_id,category) values ($1,'Nuevo_sin_cuenta','centre_backs')",[club.id]);
  const registered = await row(owner,"insert into public.players(club_id,ea_id,category) values ($1,'Nuevo_registrado','centre_backs') returning *",[club.id]);
  await query(owner,'select * from public.link_player_account($1,$2)',[registered.id,newcomer]);
  await query(owner,'select public.withdraw_trial($1)',[trial.id]);
  await query(owner,"insert into public.club_trials(club_id,ea_id) values ($1,'Prueba_nueva')",[club.id]);
  await refresh(owner,current.id);
  const rows = await snapshots(current.id);
  assert.equal(rows.some(s => s.source_player_id === removed.id),false);
  for (const s of rows.filter(s => s.source_player_id !== player.id)) { assert.equal(s.availability,'unanswered'); assert.equal(s.responded_at,null); }
  assert.equal(rows.find(s => s.source_player_id === registered.id).user_id,newcomer);
  assert.equal(rows.find(s => s.ea_id_snapshot === 'Nuevo_sin_cuenta').user_id,null);
  assert.deepEqual((await query(owner,'select ea_id_snapshot from public.call_up_trials where call_up_id=$1',[current.id])).rows,[{ ea_id_snapshot: 'Prueba_nueva' }]);
  assert.equal((await row(owner,'select body from public.call_up_aids where call_up_id=$1',[current.id])).body,'Ayuda conservada');
});
test('cancelar conserva; reanudar con actualización incorpora la plantilla en una operación', async () => {
  await query(owner,"select * from public.update_call_up($1,$2,'cancelled')",[current.id,current.starts_at]);
  await query(owner,"update public.players set category='midfielders' where id=$1",[player.id]);
  await assert.rejects(refresh(owner,current.id),{ code: '22023' });
  const resumed = await refresh(owner,current.id,true);
  assert.equal(resumed.status,'open'); assert.equal(resumed.id,current.id); assert.deepEqual(resumed.local_date,current.local_date);
  const updated = (await snapshots(current.id)).find(s => s.source_player_id === player.id);
  assert.equal(updated.category_snapshot,'midfielders'); assert.equal(updated.availability,'backup');
});
test('RLS y RPC impiden actualizar a jugadores, anónimos y capitanes de otro club', async () => {
  await assert.rejects(refresh(member,current.id),{ code: '42501' });
  await assert.rejects(refresh(foreign,current.id),{ code: '42501' });
  await assert.rejects(asUser(db,null,tx => tx.query('select * from public.refresh_call_up_roster($1)',[current.id]),'anon'),{ code: '42501' });
});
test('no modifica convocatorias cerradas ni históricas y conserva fotografías anteriores', async () => {
  for (const call of [history,closed]) for (const reopen of [true,false]) await assert.rejects(refresh(owner,call.id,reopen),{ code: '22023' });
  await query(owner,"select * from public.update_call_up($1,$2,'cancelled')",[history.id,history.starts_at]);
  await assert.rejects(refresh(owner,history.id,true),{ code: '22023' });
  assert.deepEqual(await snapshots(history.id),historyBefore);
  assert.equal((await snapshots(closed.id)).find(s => s.source_player_id === player.id).category_snapshot,'midfielders');
});
test('actualizar dos veces no duplica y una cuenta distinta nunca hereda respuestas', async () => {
  const before = await snapshots(current.id);
  await refresh(owner,current.id);
  assert.deepEqual((await snapshots(current.id)).map(s => s.id),before.map(s => s.id));
  await db.query('update public.players set user_id=$1 where id=$2',[owner,player.id]);
  await refresh(owner,current.id);
  const updated = (await snapshots(current.id)).find(s => s.source_player_id === player.id);
  assert.equal(updated.id,original.id); assert.equal(updated.user_id,owner);
  assert.equal(updated.availability,'unanswered'); assert.equal(updated.responded_at,null);
  assert.deepEqual(await snapshots(history.id),historyBefore);
});
