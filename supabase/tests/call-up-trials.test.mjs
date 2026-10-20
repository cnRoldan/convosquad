import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const admin = '71000000-0000-4000-8000-000000000001', member = '71000000-0000-4000-8000-000000000002', outsider = '71000000-0000-4000-8000-000000000003';
let db, club, call, trial;
const query = (user, sql, params = []) => asUser(db, user, tx => tx.query(sql, params));
const row = async (...args) => (await query(...args)).rows[0];
before(async () => {
  db = await createTestDatabase();
  for (const [id, username] of [[admin, 'TrialCaptain'], [member, 'NombreLibre'], [outsider, 'TrialOutsider']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, {username}]);
  club = await row(admin, "select * from public.create_club('Trial Club',null,'Europe/Madrid',true)");
  const request = await row(member, 'select * from public.request_to_join($1)', [club.id]);
  await query(admin, 'select * from public.review_join_request($1,true)', [request.id]);
  call = await row(admin, "select * from public.create_call_up($1,'2035-08-01T20:00:00Z','open')", [club.id]);
});
after(async () => { await db?.close(); });

test('añadir prueba crea anotación y prueba persistente sin dorsal, ficha ni cuenta vinculada', async () => {
  trial = await row(admin, "select * from public.add_call_up_trial($1,' NombreLibre ',null)", [call.id]);
  const saved = await row(admin, 'select * from public.club_trials where id=$1', [trial.source_trial_id]);
  assert.equal(saved.ea_id, 'NombreLibre');
  assert.equal(saved.player_id, null);
  assert.equal(saved.jersey_number, null);
  assert.equal(saved.position, null);
  assert.equal(saved.status, 'active');
  assert.equal(trial.jersey_number_snapshot, null);
  assert.equal(trial.ea_id_snapshot, 'NombreLibre');
  assert.equal((await db.query('select count(*)::int as n from public.players')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int as n from public.call_up_players')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int as n from auth.users')).rows[0].n, 3);
  assert.equal((await db.query('select count(*)::int as n from public.push_events where call_up_id=$1',[call.id])).rows[0].n, 1);
});

test('jugadores, otros clubes y anónimos no pueden añadir pruebas ni escribir fotografías', async () => {
  for (const user of [member, outsider]) await assert.rejects(query(user, "select * from public.add_call_up_trial($1,'Forbidden',null)", [call.id]), e => e.code === '42501');
  await assert.rejects(asUser(db, null, tx => tx.query("select * from public.add_call_up_trial($1,'Forbidden',null)", [call.id]), 'anon'), e => e.code === '42501');
  await assert.rejects(query(member, "insert into public.call_up_trials(club_id,call_up_id,ea_id_snapshot,trial_created_at) values($1,$2,'Forbidden',now())", [club.id, call.id]), e => e.code === '42501');
});

test('duplicados e inválidos no dejan pruebas parciales en la convocatoria ni en el club', async () => {
  for (const [name, code] of [['nombrelibre', '23505'], ['', '22023'], ['x'.repeat(65), '22023']]) await assert.rejects(query(admin, 'select * from public.add_call_up_trial($1,$2,null)', [call.id, name]), e => e.code === code);
  assert.equal((await row(admin, 'select count(*)::int as n from public.club_trials where club_id=$1', [club.id])).n, 1);
  assert.equal((await row(admin, 'select count(*)::int as n from public.call_up_trials where call_up_id=$1', [call.id])).n, 1);
});

test('siguientes convocatorias incluyen pruebas; editar la plantilla no cambia fotografías anteriores', async () => {
  await query(admin, "update public.club_trials set ea_id='Nombre nuevo' where id=$1", [trial.source_trial_id]);
  const next = await row(admin, "select * from public.create_call_up($1,'2035-08-02T20:00:00Z','open')", [club.id]);
  assert.equal((await row(admin, 'select * from public.call_up_trials where call_up_id=$1', [next.id])).ea_id_snapshot, 'Nombre nuevo');
  assert.equal((await row(admin, 'select * from public.call_up_trials where id=$1', [trial.id])).ea_id_snapshot, 'NombreLibre');
});

test('convocatorias cerradas, canceladas y antiguas no admiten nuevas pruebas', async () => {
  for (const status of ['closed', 'cancelled']) {
    await query(admin, 'select * from public.update_call_up($1,$2,$3)', [call.id, call.starts_at, status]);
    await assert.rejects(query(admin, "select * from public.add_call_up_trial($1,'Blocked',null)", [call.id]), e => e.code === '42501');
  }
  const past = await row(admin, "select * from public.create_call_up($1,'2020-08-01T20:00:00Z','open')", [club.id]);
  await assert.rejects(query(admin, "select * from public.add_call_up_trial($1,'Blocked',null)", [past.id]), e => e.code === '42501');
});
