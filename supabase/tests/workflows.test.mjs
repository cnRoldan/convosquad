import assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const admin = '30000000-0000-4000-8000-000000000001';
const foreignAdmin = '30000000-0000-4000-8000-000000000002';
const requester = '30000000-0000-4000-8000-000000000003';
const player = '30000000-0000-4000-8000-000000000004';
let database;
let club;
let otherClub;
const query = (user, sql, params = []) => asUser(database, user, (db) => db.query(sql, params));
const row = async (...args) => (await query(...args)).rows[0];
const rejected = (user, sql, params, code) => assert.rejects(query(user, sql, params), (error) => error.code === code);
const countPlayers = async () => Number((await row(admin, 'select count(*) as count from public.players where club_id = $1', [club.id])).count);
const payload = (eaId, jersey = 10) => ({ ea_id: eaId, jersey_number: jersey, position: 'MCO' });

before(async () => {
  database = await createTestDatabase();
  for (const [id, username] of [[admin, 'Admin'], [foreignAdmin, 'OtherAdmin'], [requester, 'Applicant'], [player, 'Player']]) {
    await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [id, { username }]);
  }
  club = await row(admin, "select * from public.create_club('Public_% Club', 'Descripción', 'Europe/Madrid', true)");
  otherClub = await row(foreignAdmin, "select * from public.create_club('Private Club')");
  const request = await row(player, 'select * from public.request_to_join($1)', [club.id]);
  await query(admin, 'select * from public.review_join_request($1, true)', [request.id]);
});
after(async () => { await database?.close(); });

describe('Flujos de incorporaciones e importación', { concurrency: false }, () => {
  test('búsqueda literal y pública sin eliminar caracteres del nombre', async () => {
    const result = await asUser(database, null, (db) => db.query('select * from public.search_clubs($1)', ['_%']), 'anon');
    assert.deepEqual(result.rows.map((club) => club.name), ['Public_% Club']);
    assert.equal((await query(requester, "select * from public.search_clubs('Private')")).rows.length, 0);
  });
  test('solo un admin del club puede ver el username de su solicitante pendiente', async () => {
    await query(requester, 'select * from public.request_to_join($1)', [club.id]);
    assert.equal((await row(admin, 'select username from public.profiles where id = $1', [requester])).username, 'Applicant');
    assert.equal((await query(foreignAdmin, 'select username from public.profiles where id = $1', [requester])).rows.length, 0);
    assert.equal((await query(player, 'select username from public.profiles where id = $1', [requester])).rows.length, 0);
  });
  test('el solicitante conserva el nombre público original y pierde el admin acceso al perfil tras rechazo', async () => {
    await query(admin, "update public.clubs set name = 'Private renamed', is_public = false where id = $1", [club.id]);
    const request = await row(requester, 'select * from public.join_requests where club_id = $1', [club.id]);
    assert.equal(request.club_name_snapshot, 'Public_% Club');
    await query(admin, 'select * from public.review_join_request($1, false)', [request.id]);
    assert.equal((await query(admin, 'select * from public.profiles where id = $1', [requester])).rows.length, 0);
    assert.equal((await row(requester, 'select status from public.join_requests where id = $1', [request.id])).status, 'rejected');
  });
  test('importa nuevos jugadores sin cuenta sin reemplazar la plantilla', async () => {
    await query(admin, "insert into public.players(club_id, ea_id, position) values ($1, 'Existing', 'POR')", [club.id]);
    const imported = (await query(admin, 'select * from public.import_players($1, $2)', [club.id, [payload('AlexR10'), payload('Luis', 3)]])).rows;
    assert.equal(imported.length, 2);
    assert.ok(imported.every((player) => player.user_id === null && player.is_active));
    assert.equal(await countPlayers(), 3);
  });
  test('normaliza espacios y no admite EA IDs duplicados', async () => {
    const imported = await row(admin, 'select * from public.import_players($1, $2)', [club.id, [payload(' Trimmed ', 8)]]);
    assert.equal(imported.ea_id, 'Trimmed');
    await rejected(admin, 'select * from public.import_players($1, $2)', [club.id, [payload('TRIMMED')]], '23505');
  });
  test('revierte todo el lote si hay un duplicado al final', async () => {
    const before = await countPlayers();
    await rejected(admin, 'select * from public.import_players($1, $2)', [club.id, [payload('MustRollback'), payload('AlexR10')]], '23505');
    assert.equal(await countPlayers(), before);
    assert.equal((await query(admin, "select id from public.players where ea_id = 'MustRollback'")).rows.length, 0);
  });
  test('jugadores, admins ajenos y anónimos no pueden importar', async () => {
    await rejected(player, 'select * from public.import_players($1, $2)', [club.id, [payload('NotAllowed')]], '42501');
    await rejected(foreignAdmin, 'select * from public.import_players($1, $2)', [club.id, [payload('NotAllowed')]], '42501');
    await rejected(admin, 'select * from public.import_players($1, $2)', [otherClub.id, [payload('NotAllowed')]], '42501');
    await assert.rejects(asUser(database, null, (db) => db.query('select * from public.import_players($1, $2)', [club.id, [payload('NotAllowed')]]), 'anon'), (error) => error.code === '42501');
  });
  test('rechaza campos sensibles y lotes inválidos sin escrituras parciales', async () => {
    const before = await countPlayers();
    for (const invalid of [[], Array.from({ length: 101 }, (_, i) => payload(`TooMany${i}`)), [payload('First'), { ...payload('Forged'), user_id: requester }], [payload('First'), { ...payload('Bad'), jersey_number: '10' }], [payload('Bad', 100)], [null]]) {
      await rejected(admin, 'select * from public.import_players($1, $2)', [club.id, invalid], '22023');
    }
    assert.equal(await countPlayers(), before);
  });
  test('la caducidad de las invitaciones usa el reloj del servidor y valida permisos', async () => {
    const invitation = await row(admin, 'select id, extract(epoch from (expires_at - now())) as lifetime from public.create_invitation_for_hours($1, 720)', [club.id]);
    assert.equal(Number(invitation.lifetime), 720 * 3600);
    await rejected(admin, 'select * from public.create_invitation_for_hours($1, 721)', [club.id], '22023');
    await rejected(player, 'select * from public.create_invitation_for_hours($1, 24)', [club.id], '42501');
    await rejected(foreignAdmin, 'select * from public.create_invitation_for_hours($1, 24)', [club.id], '42501');
  });
  test('editar, desactivar y vincular conserva la ficha y sus campos originales', async () => {
    const original = await row(admin, "select * from public.players where ea_id = 'AlexR10'");
    const linked = await row(admin, 'select * from public.link_player_account($1, $2)', [original.id, player]);
    assert.equal(linked.id, original.id);
    assert.equal(linked.ea_id, original.ea_id);
    assert.equal(linked.jersey_number, original.jersey_number);
    assert.equal(linked.position, original.position);
    await query(admin, "update public.players set jersey_number = 9, position = 'DC', is_active = false where id = $1", [original.id]);
    const updated = await row(admin, 'select * from public.players where id = $1', [original.id]);
    assert.equal(updated.is_active, false);
    assert.equal(updated.jersey_number, 9);
    assert.equal(updated.user_id, player);
    await rejected(player, 'select * from public.link_player_account($1, $2)', [original.id, player], '42501');
  });
});
