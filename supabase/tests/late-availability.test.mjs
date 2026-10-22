import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';

const [captain, player, teammate, outsider, unlinked] = [1, 2, 3, 4, 5].map(n => `9b000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
let db;
const query = (user, sql, args = []) => asUser(db, user, tx => tx.query(sql, args));
const row = async (...args) => (await query(...args)).rows[0];
const server = (sql, args = []) => db.transaction(async tx => { await tx.exec('set local role service_role'); return tx.query(sql, args); });
before(async () => {
  db = await createTestDatabase();
  for (const [i, id] of [captain, player, teammate, outsider, unlinked].entries()) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [id, { username: `LateVote_${i}` }]);
    await query(id, "select public.register_push_device($1,$2,'ios')", [randomUUID(), `ExpoPushToken[late_vote_${i}]`]);
  }
});
after(async () => { await db?.close(); });

async function setup(timed = false) {
  const club = await row(captain, "select * from public.create_club($1,null,'UTC')", [`Late ${randomUUID().slice(0, 8)}`]);
  for (const user of [player, teammate, unlinked]) await db.query('insert into public.club_members(club_id,user_id) values($1,$2)', [club.id, user]);
  for (const [i, user] of [captain, player, teammate].entries()) {
    await db.query("insert into public.players(club_id,user_id,ea_id,category) values($1,$2,$3,'midfielders')", [club.id, user, `Late_${i}`]);
    await query(user, 'select public.set_notification_preferences(true)');
  }
  const call = await row(captain, "select * from public.create_call_up_with_end($1,now()-interval '1 hour',now()+interval '2 hours',null,'open')", [club.id]);
  const entry = await row(player, 'select * from public.call_up_players where call_up_id=$1 and user_id=$2', [call.id, player]);
  if (timed) {
    await db.exec('alter table public.call_ups disable trigger validate_call_up_closing');
    try { await db.query("update public.call_ups set closes_at=starts_at-interval '1 second' where id=$1", [call.id]); }
    finally { await db.exec('alter table public.call_ups enable trigger validate_call_up_closing'); }
  } else await query(captain, "select public.update_call_up($1,$2,'closed')", [call.id, call.starts_at]);
  return { club, call, entry };
}
const ageVote = entry => db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1", [entry.id]);

test('tras el cierre manual o automático, cualquier voto previo puede pasar a No disponible o Backup; Disponible queda bloqueado', async () => {
  for (const timed of [false, true]) {
    const { entry } = await setup(timed);
    for (const previous of ['available', 'unavailable', 'backup', 'unanswered']) {
      for (const next of ['unavailable', 'backup']) {
        await db.query("update public.call_up_players set availability=$2::public.availability_status,responded_at=case when $2::public.availability_status='unanswered' then null else clock_timestamp()-interval '31 seconds' end where id=$1", [entry.id, previous]);
        const saved = await row(player, 'select * from public.respond_to_call_up($1,$2)', [entry.id, next]);
        assert.equal(saved.availability, next);
        await assert.rejects(query(player, "select public.respond_to_call_up($1,'available')", [entry.id]), { code: 'P0031' });
        assert.equal((await row(player, 'select availability from public.call_up_players where id=$1', [entry.id])).availability, next);
      }
    }
  }
});

test('notificación y app comparten restricciones, cooldown e idempotencia después del cierre', async () => {
  const { club, call, entry } = await setup();
  const respond = (user, value, key) => query(user, 'select * from public.respond_from_notification($1,$2,$3,$4)', [club.id, call.id, value, key]);
  for (const user of [captain, outsider, unlinked]) await assert.rejects(query(user, "select public.respond_to_call_up($1,'backup')", [entry.id]), { code: '42501' });
  for (const user of [outsider, unlinked]) await assert.rejects(respond(user, 'backup', 'unauthorized'), { code: '42501' });
  await query(player, "select public.respond_to_call_up($1,'unavailable')", [entry.id]);
  await assert.rejects(respond(player, 'backup', 'late-backup'), { code: 'P0030' });
  await ageVote(entry);
  await respond(player, 'backup', 'late-backup');
  const version = (await row(player, 'select availability_version from public.call_up_players where id=$1', [entry.id])).availability_version;
  await respond(player, 'backup', 'late-backup');
  assert.equal((await row(player, 'select availability_version from public.call_up_players where id=$1', [entry.id])).availability_version, version);
  await assert.rejects(respond(player, 'unavailable', 'late-backup'), { code: '22023' });
  await assert.rejects(respond(player, 'available', 'too-late'), { code: 'P0031' });
  await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2', [club.id, player]);
  await assert.rejects(respond(player, 'backup', 'removed-member'), { code: '42501' });
});

test('los cambios tardíos actualizan el candado y notifican al equipo respetando preferencias', async () => {
  const { club, call, entry } = await setup(true);
  await query(player, "select public.respond_to_call_up($1,'unavailable')", [entry.id]);
  await query(player, 'select public.set_club_decision_lock($1,true,$2)', [club.id, entry.id]);
  await ageVote(entry);
  await query(teammate, 'select public.set_notification_preferences(false)');
  await query(player, "select public.respond_from_notification($1,$2,'backup','late-locked-backup')", [club.id, call.id]);
  assert.equal((await row(player, 'select availability from public.club_decision_locks where club_id=$1', [club.id])).availability, 'backup');
  // Cron has now changed the row to closed; the queued late change still sends.
  await db.query('select private.close_due_call_ups()');
  const event = (await db.query("select id from public.push_events where call_up_id=$1 and kind='vote' and vote_availability='backup'", [call.id])).rows[0];
  const deliveries = (await server('select * from public.claim_push_deliveries($1)', [event.id])).rows;
  assert.deepEqual(deliveries.map(item => item.user_id), [captain]);
  assert.equal((await server('select * from public.claim_push_deliveries($1)', [event.id])).rows.length, 0);
});

test('finalización y cancelación bloquean todos los votos tardíos y sus avisos pendientes', async () => {
  for (const ended of [false, true]) {
    const { club, call, entry } = await setup();
    await query(player, "select public.respond_to_call_up($1,'unavailable')", [entry.id]);
    const event = (await db.query("select id from public.push_events where call_up_id=$1 and kind='vote'", [call.id])).rows[0];
    if (ended) await db.query("update public.call_ups set ends_at=clock_timestamp()-interval '1 second' where id=$1", [call.id]);
    else await db.query("update public.call_ups set status='cancelled' where id=$1", [call.id]);
    for (const value of ['available', 'unavailable', 'backup']) {
      await assert.rejects(query(player, 'select public.respond_to_call_up($1,$2)', [entry.id, value]), { code: '42501' });
      await assert.rejects(query(player, 'select public.respond_from_notification($1,$2,$3,$4)', [club.id, call.id, value, `ended-${value}`]), { code: '42501' });
    }
    assert.equal((await server('select * from public.claim_push_deliveries($1)', [event.id])).rows.length, 0);
  }
});
