import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const users = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
const [adminA, adminB, player, teammate, invitee, outsider, secondInvitee] = users;
let database;
let clubA;
let clubB;
let playerRow;
let teammateRow;
let unregistered;
let callUp;
let response;
let teammateResponse;

const sqlAs = (user, sql, params = []) => asUser(database, user, (db) => db.query(sql, params));
const rowAs = async (user, sql, params = []) => (await sqlAs(user, sql, params)).rows[0];
const rejectsAs = (user, sql, params, code) => assert.rejects(sqlAs(user, sql, params), (error) => error.code === code);

async function admit(user, club, admin) {
  const request = await rowAs(user, 'select * from public.request_to_join($1)', [club.id]);
  await sqlAs(admin, 'select * from public.review_join_request($1, true)', [request.id]);
}

before(async () => {
  database = await createTestDatabase();
  for (const [index, user] of users.entries()) {
    await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [user, { username: `User_${index + 1}` }]);
  }
  clubA = await rowAs(adminA, "select * from public.create_club('Club A', null, 'Europe/Madrid', true)");
  clubB = await rowAs(adminB, "select * from public.create_club('Club B', null, 'Europe/Madrid', true)");
  await admit(player, clubA, adminA);
  await admit(player, clubB, adminB);
  await admit(teammate, clubA, adminA);
  await sqlAs(adminB, 'update public.clubs set is_public = false where id = $1', [clubB.id]);
  playerRow = await rowAs(adminA, "insert into public.players(club_id, ea_id, jersey_number, position) values ($1, 'EA_Player', 8, 'MC') returning *", [clubA.id]);
  teammateRow = await rowAs(adminA, "insert into public.players(club_id, ea_id, jersey_number, position) values ($1, 'EA_Teammate', 9, 'DC') returning *", [clubA.id]);
  unregistered = await rowAs(adminA, "insert into public.players(club_id, ea_id, position) values ($1, 'EA_Guest', 'POR') returning *", [clubA.id]);
  await sqlAs(adminA, 'select * from public.link_player_account($1, $2)', [playerRow.id, player]);
  await sqlAs(adminA, 'select * from public.link_player_account($1, $2)', [teammateRow.id, teammate]);
  callUp = await rowAs(adminA, "select * from public.create_call_up($1, '2030-01-02T20:00:00Z', 'open')", [clubA.id]);
  response = await rowAs(player, 'select * from public.call_up_players where call_up_id = $1 and user_id = $2', [callUp.id, player]);
  teammateResponse = await rowAs(player, 'select * from public.call_up_players where call_up_id = $1 and user_id = $2', [callUp.id, teammate]);
});
after(async () => { await database?.close(); });

describe('Modelo multiclub y seguridad PostgreSQL', { concurrency: false }, () => {
  test('el creador es el primer administrador y la creación es atómica', async () => {
    const member = await rowAs(adminA, 'select * from public.club_members where club_id = $1 and user_id = $2', [clubA.id, adminA]);
    assert.equal(member.role, 'admin');
    assert.equal(clubA.created_by, adminA);
    assert.equal(clubA.timezone, 'Europe/Madrid');
    await rejectsAs(adminA, "select * from public.create_club('Inválido', null, 'Invalid/Timezone')", [], '22023');
    assert.equal((await sqlAs(adminA, "select * from public.clubs where name = 'Inválido'")).rows.length, 0);
  });

  test('un usuario pertenece a dos clubes sin permisos globales', async () => {
    const memberships = (await sqlAs(player, 'select * from public.club_members where user_id = $1', [player])).rows;
    assert.equal(memberships.length, 2);
    assert.ok(memberships.every((member) => member.role === 'player'));
  });

  test('un jugador no puede crear, modificar ni eliminar fichas', async () => {
    await rejectsAs(player, "insert into public.players(club_id, ea_id, position) values ($1, 'Forbidden', 'MC')", [clubA.id], '42501');
    assert.equal((await sqlAs(player, "update public.players set ea_id = 'Changed' where id = $1 returning id", [teammateRow.id])).rows.length, 0);
    assert.equal((await sqlAs(player, 'delete from public.players where id = $1 returning id', [teammateRow.id])).rows.length, 0);
  });

  test('un administrador no puede administrar otro club', async () => {
    await rejectsAs(adminA, "select * from public.create_call_up($1, '2030-02-01T20:00:00Z')", [clubB.id], '42501');
    await rejectsAs(adminA, "select * from public.set_club_member($1, $2, 'admin', true)", [clubB.id, player], '42501');
    assert.equal((await sqlAs(adminA, "update public.clubs set name = 'Hack' where id = $1 returning id", [clubB.id])).rows.length, 0);
    await rejectsAs(adminA, "insert into public.players(club_id, ea_id, position) values ($1, 'Intruder', 'MC')", [clubB.id], '42501');
  });

  test('solo el titular modifica su disponibilidad', async () => {
    const updated = await rowAs(player, "select * from public.respond_to_call_up($1, 'backup')", [response.id]);
    assert.equal(updated.availability, 'backup');
    assert.ok(updated.responded_at);
    await rejectsAs(player, "select * from public.respond_to_call_up($1, 'available')", [teammateResponse.id], '42501');
    await rejectsAs(adminA, "select * from public.respond_to_call_up($1, 'available')", [teammateResponse.id], '42501');
    await rejectsAs(player, "update public.call_up_players set availability = 'available' where id = $1", [response.id], '42501');
    assert.equal((await sqlAs(player, 'select * from public.call_up_players where call_up_id = $1', [callUp.id])).rows.length, 3);
  });

  test('no admite duplicados del mismo día local, incluso cruzando medianoche UTC', async () => {
    const summer = await rowAs(adminA, "select * from public.create_call_up($1, '2030-06-01T22:30:00Z')", [clubA.id]);
    assert.equal(summer.local_date.toISOString().slice(0, 10), '2030-06-02');
    await rejectsAs(adminA, "select * from public.create_call_up($1, '2030-06-02T20:00:00Z')", [clubA.id], '23505');
    await rejectsAs(adminA, "select * from public.update_call_up($1, '2030-06-02T20:00:00Z', 'open')", [callUp.id], '23505');
  });

  test('la zona es configurable sin alterar convocatorias existentes ni invalidar la unicidad local', async () => {
    const club = await rowAs(adminA, "select * from public.create_club('Zona configurable')");
    const changed = await rowAs(adminA, "update public.clubs set timezone = 'Asia/Tokyo' where id = $1 returning timezone", [club.id]);
    assert.equal(changed.timezone, 'Asia/Tokyo');
    const scheduled = await rowAs(adminA, "select * from public.create_call_up($1, '2030-10-01T23:00:00Z')", [club.id]);
    assert.equal(scheduled.local_date.toISOString().slice(0, 10), '2030-10-02');
    await sqlAs(adminA, "update public.clubs set timezone = 'America/New_York' where id = $1", [club.id]);
    assert.deepEqual(await rowAs(adminA, 'select * from public.call_ups where id=$1', [scheduled.id]), scheduled);
    await rejectsAs(adminA, "select * from public.create_call_up($1, '2030-10-02T05:00:00Z')", [club.id], '23505');
  });

  test('distintos clubes pueden convocar el mismo día', async () => {
    const other = await rowAs(adminB, "select * from public.create_call_up($1, '2030-01-02T20:00:00Z', 'open')", [clubB.id]);
    assert.equal(other.local_date.toISOString(), callUp.local_date.toISOString());
  });

  test('una ficha sin registrar existe y comienza sin responder', async () => {
    const guest = await rowAs(player, 'select * from public.players where id = $1', [unregistered.id]);
    assert.equal(guest.user_id, null);
    const entry = await rowAs(player, 'select * from public.call_up_players where source_player_id = $1', [unregistered.id]);
    assert.equal(entry.availability, 'unanswered');
    await rejectsAs(player, "select * from public.respond_to_call_up($1, 'available')", [entry.id], '42501');
  });

  test('vinculación posterior autorizada, sin robar fichas ni enlazar cuentas de otro club', async () => {
    await rejectsAs(player, 'select * from public.link_player_account($1, $2)', [unregistered.id, player], '42501');
    await rejectsAs(adminA, 'select * from public.link_player_account($1, $2)', [unregistered.id, outsider], '22023');
    await rejectsAs(adminA, 'select * from public.link_player_account($1, $2)', [playerRow.id, teammate], '23505');
    await rejectsAs(adminA, 'select * from public.link_player_account($1, $2)', [unregistered.id, player], '23505');
    await admit(invitee, clubA, adminA);
    const linked = await rowAs(adminA, 'select * from public.link_player_account($1, $2)', [unregistered.id, invitee]);
    assert.equal(linked.user_id, invitee);
    const entry = await rowAs(invitee, 'select * from public.call_up_players where source_player_id = $1', [unregistered.id]);
    assert.equal(entry.user_id, invitee);
    await sqlAs(invitee, "select * from public.respond_to_call_up($1, 'available')", [entry.id]);
    await rejectsAs(adminA, 'update public.players set user_id = $1 where id = $2', [player, unregistered.id], '42501');
  });

  test('RLS impide leer datos privados, incluso a usuarios anónimos', async () => {
    for (const table of ['clubs', 'club_members', 'players', 'call_ups', 'call_up_players']) {
      assert.equal((await sqlAs(outsider, `select * from public.${table}`)).rows.length, 0);
    }
    assert.equal((await sqlAs(outsider, 'select * from public.profiles')).rows.length, 1);
    await assert.rejects(asUser(database, null, (db) => db.query('select * from public.clubs'), 'anon'), (error) => error.code === '42501');
    const directory = await asUser(database, null, (db) => db.query('select * from public.club_directory'), 'anon');
    assert.deepEqual(directory.rows.map((club) => club.club_id), [clubA.id]);
    assert.deepEqual(Object.keys(directory.rows[0]).sort(), ['club_id', 'description', 'name']);
  });

  test('no permite escalar roles, falsificar pertenencias ni eliminar el último admin', async () => {
    await rejectsAs(player, "update public.club_members set role = 'admin' where user_id = $1", [player], '42501');
    await rejectsAs(player, 'insert into public.club_members(club_id, user_id) values ($1, $2)', [clubB.id, outsider], '42501');
    await rejectsAs(player, "select * from public.set_club_member($1, $2, 'admin', true)", [clubA.id, player], '42501');
    await rejectsAs(adminA, "select * from public.set_club_member($1, $2, 'player', true)", [clubA.id, adminA], '23514');
    await rejectsAs(adminA, 'update public.clubs set created_by = $1 where id = $2', [player, clubA.id], '42501');
  });

  test('usuarios inactivos no leen ni responden; activar membresía exige admin', async () => {
    await sqlAs(adminA, "select * from public.set_club_member($1, $2, 'player', false)", [clubA.id, teammate]);
    assert.equal((await sqlAs(teammate, 'select * from public.players where club_id = $1', [clubA.id])).rows.length, 0);
    await rejectsAs(teammate, "select * from public.respond_to_call_up($1, 'available')", [teammateResponse.id], '42501');
    await sqlAs(adminA, "select * from public.set_club_member($1, $2, 'player', true)", [clubA.id, teammate]);
  });

  test('votación cerrada sigue visible para miembros, pero no permite responder', async () => {
    await sqlAs(adminA, 'select * from public.update_call_up($1, $2, $3)', [callUp.id, callUp.starts_at, 'closed']);
    assert.equal((await sqlAs(player, 'select * from public.call_ups where id = $1', [callUp.id])).rows.length, 1);
    assert.equal((await sqlAs(player, 'select * from public.call_up_players where call_up_id = $1', [callUp.id])).rows.length, 3);
    await rejectsAs(player, "select * from public.respond_to_call_up($1, 'available')", [response.id], '42501');
    assert.equal((await sqlAs(adminA, 'select * from public.call_up_players where call_up_id = $1', [callUp.id])).rows.length, 3);
  });

  test('la copia histórica sobrevive a modificaciones y eliminación de la ficha', async () => {
    await sqlAs(adminA, "update public.players set ea_id = 'EA_Renamed', position = 'DC' where id = $1", [playerRow.id]);
    await sqlAs(adminA, 'delete from public.players where id = $1', [playerRow.id]);
    const entry = await rowAs(adminA, 'select * from public.call_up_players where id = $1', [response.id]);
    assert.equal(entry.source_player_id, null);
    assert.equal(entry.ea_id_snapshot, 'EA_Player');
    assert.equal(entry.position_snapshot, 'MC');
    assert.equal(entry.availability, 'backup');
  });

  test('nombre de usuario único sin distinguir mayúsculas', async () => {
    await assert.rejects(database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', ['10000000-0000-4000-8000-000000000001', { username: 'uSeR_1' }]), (error) => error.code === '23505');
    await rejectsAs(player, "update public.profiles set username = 'USER_1' where id = $1", [player], '42501');
    await rejectsAs(player, "update public.profiles set username = 'Stolen' where id = $1 returning id", [adminA], '42501');
  });

  test('solicitudes privadas: aprobaciones autorizadas y resolución atómica', async () => {
    const request = await rowAs(outsider, 'select * from public.request_to_join($1)', [clubA.id]);
    await rejectsAs(outsider, 'select * from public.review_join_request($1, true)', [request.id], '42501');
    await rejectsAs(adminB, 'select * from public.review_join_request($1, true)', [request.id], '42501');
    await rejectsAs(outsider, 'select * from public.request_to_join($1)', [clubA.id], '23505');
    const rejected = await rowAs(adminA, 'select * from public.review_join_request($1, false)', [request.id]);
    assert.equal(rejected.status, 'rejected');
    assert.equal((await sqlAs(outsider, 'select * from public.clubs')).rows.length, 0);
    await rejectsAs(adminA, 'select * from public.review_join_request($1, true)', [request.id], '22023');
    await rejectsAs(outsider, 'select * from public.request_to_join($1)', [clubB.id], '42501');
  });

  test('invitaciones con hash, ámbito de club y consumo limitado', async () => {
    const invitation = await rowAs(adminB, "select * from public.create_club_invitation($1, now() + interval '1 day')", [clubB.id]);
    const stored = (await database.query('select token_hash from public.club_invitations where id = $1', [invitation.id])).rows[0];
    assert.notEqual(stored.token_hash, invitation.token);
    assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
    await rejectsAs(adminB, 'select token_hash from public.club_invitations where id = $1', [invitation.id], '42501');
    await rejectsAs(outsider, 'select * from public.redeem_club_invitation($1, $2)', [clubA.id, invitation.token], '22023');
    const member = await rowAs(secondInvitee, 'select * from public.redeem_club_invitation($1, $2)', [clubB.id, invitation.token]);
    assert.equal(member.club_id, clubB.id);
    assert.equal(member.user_id, secondInvitee);
    assert.equal(member.role, 'player');
    await rejectsAs(outsider, 'select * from public.redeem_club_invitation($1, $2)', [clubB.id, invitation.token], '22023');
    await rejectsAs(player, "select * from public.create_club_invitation($1, now() + interval '1 day')", [clubB.id], '42501');
  });

  test('invitaciones revocadas, caducadas y llamadas anónimas se rechazan', async () => {
    const revoked = await rowAs(adminB, "select * from public.create_club_invitation($1, now() + interval '1 day')", [clubB.id]);
    await sqlAs(adminB, 'select public.revoke_club_invitation($1)', [revoked.id]);
    await rejectsAs(outsider, 'select * from public.redeem_club_invitation($1, $2)', [clubB.id, revoked.token], '22023');
    const expired = await rowAs(adminB, "select * from public.create_club_invitation($1, now() + interval '1 day')", [clubB.id]);
    await database.query("update public.club_invitations set created_at = now() - interval '2 days', expires_at = now() - interval '1 day' where id = $1", [expired.id]);
    await rejectsAs(outsider, 'select * from public.redeem_club_invitation($1, $2)', [clubB.id, expired.token], '22023');
    await assert.rejects(asUser(database, null, (db) => db.query("select * from public.create_club('Anonymous')"), 'anon'), (error) => error.code === '42501');
    await rejectsAs(null, "select * from public.create_club('No JWT')", [], '42501');
  });

  test('claves compuestas impiden enlazar históricos de clubes distintos', async () => {
    await assert.rejects(database.query("insert into public.call_up_players(club_id, call_up_id, ea_id_snapshot, position_snapshot) values ($1, $2, 'CrossClub', 'DC')", [clubB.id, callUp.id]), (error) => error.code === '23503');
    const enabled = (await database.query("select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' and not relrowsecurity")).rows;
    assert.deepEqual(enabled, []);
  });
  test('el cliente no puede ejecutar helpers privados ni insertar permisos o históricos', async () => {
    await rejectsAs(adminA, 'select * from private.link_player($1, $2, $3)', [clubA.id, teammateRow.id, teammate], '42501');
    await rejectsAs(adminA, "insert into public.call_ups(club_id, starts_at, created_by) values ($1, now(), $2)", [clubA.id, player], '42501');
    await rejectsAs(adminA, 'update public.club_directory set name = $1 where club_id = $2', ['Forged', clubA.id], '42501');
  });

  test('aprobar una solicitud con una ficha ya vinculada revierte toda la operación', async () => {
    const request = await rowAs(outsider, 'select * from public.request_to_join($1)', [clubA.id]);
    await rejectsAs(adminA, 'select * from public.review_join_request($1, true, $2)', [request.id, teammateRow.id], '23505');
    assert.equal((await sqlAs(outsider, 'select * from public.clubs')).rows.length, 0);
    const unchanged = await rowAs(outsider, 'select * from public.join_requests where id = $1', [request.id]);
    assert.equal(unchanged.status, 'pending');
  });

  test('los metadatos de signup no conceden roles y los perfiles inválidos revierten el alta', async () => {
    const forgedUser = '20000000-0000-4000-8000-000000000001';
    await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [forgedUser, { username: 'ForgedAdmin', role: 'admin', club_id: clubA.id }]);
    assert.equal((await sqlAs(forgedUser, 'select * from public.clubs')).rows.length, 0);
    await rejectsAs(forgedUser, "select * from public.set_club_member($1, $2, 'admin', true)", [clubA.id, forgedUser], '42501');
    const invalidUser = '20000000-0000-4000-8000-000000000002';
    await assert.rejects(database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [invalidUser, { username: 'bad name' }]), (error) => error.code === '23514');
    assert.equal((await database.query('select id from auth.users where id = $1', [invalidUser])).rows.length, 0);
  });

  test('eliminar una cuenta conserva sus respuestas históricas y protege al último admin', async () => {
    await assert.rejects(database.query('delete from auth.users where id = $1', [adminA]), (error) => error.code === '23514');
    await database.query('delete from auth.users where id = $1', [player]);
    const historic = await rowAs(adminA, 'select * from public.call_up_players where id = $1', [response.id]);
    assert.equal(historic.user_id, null);
    assert.equal(historic.availability, 'backup');
    assert.equal(historic.ea_id_snapshot, 'EA_Player');
  });

});
