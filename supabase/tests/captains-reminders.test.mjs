import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';

const ids = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-${String(800 + i).padStart(12, '0')}`);
const [owner, captain, second, unlinked, inactive, foreign] = ids;
let db, club, other, call;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
const row = async (user, sql, args = []) => (await query(user, sql, args)).rows[0];
const server = (sql, args = []) => db.transaction(async tx => { await tx.exec('set local role service_role'); return tx.query(sql, args); });
before(async () => {
  db = await createTestDatabase();
  for (const [index, id] of ids.entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [id, { username: `CaptainTest_${index}` }]);
  club = await row(owner, "select * from public.create_club('Capitanes',null,'UTC')");
  other = await row(foreign, "select * from public.create_club('Otro club',null,'UTC')");
  for (const user of [captain, second, unlinked, inactive]) await db.query('insert into public.club_members(club_id,user_id) values ($1,$2)', [club.id, user]);
  for (const user of [captain, second, inactive]) {
    const player = await row(owner, "insert into public.players(club_id,ea_id,category) values ($1,$2,'backups') returning *", [club.id, user]);
    await query(owner, 'select * from public.link_player_account($1,$2)', [player.id, user]);
    if (user === inactive) await query(owner, 'update public.players set is_active=false where id=$1', [player.id]);
  }
});
after(async () => { await db?.close(); });

test('varios capitanes registrados pueden nombrar otros y crear convocatorias', async () => {
  await query(owner, "select * from public.set_club_member($1,$2,'admin',true)", [club.id, captain]);
  await query(captain, "select * from public.set_club_member($1,$2,'admin',true)", [club.id, second]);
  call = await row(second, "select * from public.create_call_up($1,now()+interval '30 minutes','open')", [club.id]);
  assert.equal(call.created_by, second);
  assert.equal((await query(owner, "select * from public.club_members where club_id=$1 and role='admin'", [club.id])).rows.length, 3);
});
test('no se designan cuentas sin ficha activa ni se modifican capitanes de otro club', async () => {
  for (const user of [unlinked, inactive]) await assert.rejects(query(captain, "select * from public.set_club_member($1,$2,'admin',true)", [club.id, user]), { code: '23514' });
  await assert.rejects(query(unlinked, "select * from public.set_club_member($1,$2,'admin',true)", [club.id, unlinked]), { code: '42501' });
  await assert.rejects(query(foreign, "select * from public.set_club_member($1,$2,'admin',true)", [club.id, captain]), { code: '42501' });
});
test('el creador conserva el control y solo él puede eliminar el club', async () => {
  await assert.rejects(query(captain, "select * from public.set_club_member($1,$2,'player',true)", [club.id, owner]), { code: '23514' });
  await assert.rejects(query(captain, "select * from public.set_club_member($1,$2,'admin',false)", [club.id, owner]), { code: '23514' });
  await assert.rejects(query(captain, 'select public.delete_club($1)', [club.id]), { code: '42501' });
  await assert.rejects(query(foreign, 'select public.delete_club($1)', [club.id]), { code: '42501' });
  const disposable = await row(owner, "select * from public.create_club('Temporal',null,'UTC')");
  await query(owner, "select * from public.create_call_up($1,now()+interval '1 day','open')", [disposable.id]);
  await query(owner, 'select public.delete_club($1)', [disposable.id]);
  assert.equal((await db.query('select * from public.clubs where id=$1', [disposable.id])).rows.length, 0);
  assert.equal((await db.query('select * from auth.users where id=$1', [owner])).rows.length, 1);
});
test('capitanes guardan avisos de su club; RLS bloquea jugadores y clubes ajenos', async () => {
  await query(captain, 'update public.clubs set reminder_minutes=60 where id=$1', [club.id]);
  assert.equal((await query(unlinked, 'update public.clubs set reminder_minutes=15 where id=$1 returning id', [club.id])).rows.length, 0);
  assert.equal((await query(foreign, 'update public.clubs set reminder_minutes=15 where id=$1 returning id', [club.id])).rows.length, 0);
  assert.equal((await query(captain, 'update public.clubs set reminder_minutes=15 where id=$1 returning id', [other.id])).rows.length, 0);
  await assert.rejects(query(captain, 'update public.clubs set reminder_minutes=61 where id=$1', [club.id]), { code: '23514' });
});
test('servidor prepara una sola vez y por dispositivo, incluyendo jugadores que respondieron', async () => {
  for (const [index, user] of [captain, captain, second, foreign].entries()) {
    await query(user, 'select public.register_push_device($1,$2,$3)', [`20000000-0000-4000-8000-${String(index).padStart(12, '0')}`, `ExpoPushToken[Reminder_${index}]`, 'android']);
  }
  const snapshot = await row(second, 'select * from public.call_up_players where call_up_id=$1 and user_id=$2', [call.id, second]);
  await query(second, "select * from public.respond_to_call_up($1,'available')", [snapshot.id]);
  await assert.rejects(query(captain, 'select * from public.prepare_due_call_up_reminders()'), { code: '42501' });
  const events = (await server('select * from public.prepare_due_call_up_reminders()')).rows;
  assert.equal(events.length, 1);
  assert.equal((await server('select * from public.prepare_due_call_up_reminders()')).rows.length, 0);
  const eventId = Object.values(events[0])[0];
  const deliveries = (await server('select * from public.claim_push_deliveries($1)', [eventId])).rows;
  assert.equal(deliveries.length, 3);
  assert.ok(deliveries.every(d => d.club_id === club.id && d.user_id !== foreign));
  assert.equal((await server('select * from public.claim_push_deliveries($1)', [eventId])).rows.length, 0);
  await assert.rejects(query(captain, "select public.finish_push_delivery($1,'sent','fake')", [deliveries[0].id]), { code: '42501' });
  await server("select public.finish_push_delivery($1,'sent','ticket')", [deliveries[0].id]);
});
test('desactivar avisos, cambiar hora y cancelar descarta los envíos pendientes', async () => {
  for (const action of ['disable', 'reschedule', 'cancel']) {
    await query(captain, 'update public.clubs set reminder_minutes=60 where id=$1', [club.id]);
    await query(captain, "select * from public.update_call_up($1,now()+interval '30 minutes','open')", [call.id]);
    const eventId = (await server("select public.prepare_call_up_push($1,$2,$3,'reminder') as id", [club.id, call.id, `test:${action}`])).rows[0].id;
    if (action === 'disable') await query(captain, 'update public.clubs set reminder_minutes=null where id=$1', [club.id]);
    if (action === 'reschedule') await query(captain, "select * from public.update_call_up($1,now()+interval '40 minutes','open')", [call.id]);
    if (action === 'cancel') await query(captain, "select * from public.update_call_up($1,now()+interval '30 minutes','cancelled')", [call.id]);
    assert.equal((await server('select * from public.claim_push_deliveries($1)', [eventId])).rows.length, 0);
  }
});
