import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const captain = 'de000000-0000-4000-8000-000000000001';
let db, club;
const query = (sql, args = []) => asUser(db, captain, tx => tx.query(sql, args));
const row = async (sql, args = []) => (await query(sql, args)).rows[0];

before(async () => {
  db = await createTestDatabase();
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [captain, { username: 'RefinementsCaptain' }]);
  club = await row("select * from public.create_club('Refinements',null,'UTC')");
});
after(async () => { await db?.close(); });

test('el historial gratuito conserva seis pruebas durante doce meses y permite liberar una plaza', async () => {
  const trials = [];
  for (let index = 1; index <= 7; index++) trials.push(await row("insert into public.club_trials(club_id,ea_id) values($1,$2) returning *", [club.id, `Trial_${index}`]));
  for (const trial of trials.slice(0, 6)) await row('select * from public.withdraw_trial($1)', [trial.id]);
  await assert.rejects(row('select * from public.withdraw_trial($1)', [trials[6].id]), error => error.code === 'P0043');
  await query('select public.delete_trial_history($1)', [trials[0].id]);
  assert.equal((await row('select * from public.withdraw_trial($1)', [trials[6].id])).status, 'withdrawn');
  const history = (await query("select * from public.club_trials where club_id=$1 and status<>'active' and resolved_at>=now()-interval '12 months'", [club.id])).rows;
  assert.equal(history.length, 6);
});

test('editar desde una convocatoria sincroniza la fotografía de la prueba y su contacto', async () => {
  const trial = await row("select * from public.save_club_trial_with_contact($1,'Before',null,'+34111111111')", [club.id]);
  const call = await row("select * from public.create_call_up($1,'2035-01-01T20:00:00Z','open')", [club.id]);
  await row("select * from public.save_club_trial_with_contact($1,'After','Useful note','+34222222222',$2)", [club.id, trial.id]);
  const snapshot = await row('select * from public.sync_call_up_trial_from_roster($1,$2)', [call.id, trial.id]);
  assert.equal(snapshot.ea_id_snapshot, 'After');
  assert.equal((await row('select notes from public.call_up_trial_notes where trial_id=$1', [snapshot.id])).notes, 'Useful note');
  assert.equal((await row('select phone from public.call_up_contacts where trial_id=$1', [snapshot.id])).phone, '+34222222222');
});

test('totales por jugador calculan disponibilidad, pendientes y tiempo de respuesta solo en convocatorias finalizadas', async () => {
  const player = await row("select * from public.add_or_restore_player($1,'Stats Player','midfielders',8::smallint)", [club.id]);
  const call = await row("select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')", [club.id]);
  await db.query("update public.call_up_players set availability='available',responded_at=created_at+interval '15 minutes',auto_response=false where call_up_id=$1 and source_player_id=$2", [call.id, player.id]);
  const total = await row('select * from public.get_call_up_player_totals($1) where player_id=$2', [club.id, player.id]);
  assert.equal(total.available_count, 1);
  assert.equal(total.unanswered_count, 0);
  assert.equal(Number(total.average_response_seconds), 900);
});
