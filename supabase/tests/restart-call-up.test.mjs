import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [admin, player, backup, outsider] = [1,2,3,4].map(n => `72000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db, club, call, original, old, aid;
const query = (user, sql, args = []) => asUser(db,user,tx=>tx.query(sql,args));
const row = async (...args) => (await query(...args)).rows[0];
before(async () => {
  db = await createTestDatabase();
  for (const [i,user] of [admin,player,backup,outsider].entries()) {
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[user,{username:`Restart_${i}`}]);
    await query(user,"select public.register_push_device($1,$2,'android')",[`73000000-0000-4000-8000-${String(i).padStart(12,'0')}`,`ExpoPushToken[Restart_${i}]`]);
  }
  club = await row(admin,"select * from public.create_club('Restart Club',null,'Europe/Madrid')");
  for (const user of [player,backup]) await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,user]);
  for (const [user,category] of [[player,'midfielders'],[backup,'backups']]) {
    const p = await row(admin,'insert into public.players(club_id,ea_id,category) values($1,$2,$3) returning *',[club.id,user,category]);
    await query(admin,'select public.link_player_account($1,$2)',[p.id,user]);
  }
  old = await row(admin,"select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')",[club.id]);
  call = await row(admin,"select * from public.create_call_up($1,'2035-01-01T20:00:00Z','open')",[club.id]);
  original = await row(admin,'select * from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,player]);
  await query(player,"select public.respond_to_call_up($1,'available')",[original.id]);
  aid = await row(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values($1,$2,'Keep aid') returning *",[club.id,call.id]);
});
after(async () => { await db?.close(); });

test('reinicio actualiza plantilla, borra votos y prepara un único aviso elegible conservando ayudas e historial',async()=>{
  const oldSnapshot = (await query(admin,'select * from public.call_up_players where call_up_id=$1',[old.id])).rows;
  await query(admin,"update public.players set category='attackers' where id=$1",[original.source_player_id]);
  const reset = await row(admin,'select * from public.restart_call_up($1,$2)',[call.id,call.status_version]);
  assert.equal(reset.id,call.id); assert.equal(reset.status,'open'); assert.equal(reset.starts_at.getTime(),call.starts_at.getTime());
  const entries=(await query(admin,'select * from public.call_up_players where call_up_id=$1',[call.id])).rows;
  assert.ok(entries.every(p=>p.availability==='unanswered' && p.responded_at===null));
  assert.equal(entries.find(p=>p.user_id===player).category_snapshot,'attackers');
  assert.equal((await row(admin,'select * from public.call_up_aids where id=$1',[aid.id])).body,'Keep aid');
  assert.deepEqual((await query(admin,'select * from public.call_up_players where call_up_id=$1',[old.id])).rows,oldSnapshot);
  const events=(await db.query("select * from public.push_events where call_up_id=$1 and kind='published' order by call_status_version desc",[call.id])).rows;
  assert.equal(events.length,2);
  const deliveries=(await db.query('select * from public.push_deliveries where event_id=$1',[events[0].id])).rows;
  assert.deepEqual(deliveries.map(d=>d.user_id),[player]); assert.equal(deliveries[0].can_vote,true);
  const stale=(await db.query("select d.* from public.push_deliveries d join public.push_events e on e.id=d.event_id where e.call_up_id=$1 and e.id<>$2",[call.id,events[0].id])).rows;
  assert.ok(stale.every(d=>d.state==='skipped'));
  await assert.rejects(query(admin,'select public.restart_call_up($1,$2)',[call.id,call.status_version]),e=>e.code==='40001');
  assert.equal((await db.query("select count(*)::int n from public.push_events where call_up_id=$1 and kind='published'",[call.id])).rows[0].n,2);
  await query(player,"select public.respond_to_call_up($1,'backup')",[original.id]);
  assert.equal((await row(admin,'select availability from public.call_up_players where id=$1',[original.id])).availability,'backup');
});

test('jugadores, otros clubes, anónimos y fechas históricas no pueden reiniciar',async()=>{
  const current=await row(admin,'select * from public.call_ups where id=$1',[call.id]);
  for(const user of [player,backup,outsider]) await assert.rejects(query(user,'select public.restart_call_up($1,$2)',[call.id,current.status_version]),e=>e.code==='42501');
  await assert.rejects(asUser(db,null,tx=>tx.query('select public.restart_call_up($1,$2)',[call.id,current.status_version]),'anon'),e=>e.code==='42501');
  await assert.rejects(query(admin,'select public.restart_call_up($1,$2)',[old.id,old.status_version]),e=>e.code==='42501');
});

test('reinicia desde cancelada y cerrada sin enviar cancelaciones artificiales ni duplicar el día',async()=>{
  for(const status of ['cancelled','closed']){
    const changed=await row(admin,'select * from public.update_call_up($1,$2,$3)',[call.id,call.starts_at,status]);
    const before=(await db.query("select count(*)::int n from public.push_events where call_up_id=$1 and kind='cancelled'",[call.id])).rows[0].n;
    const reset=await row(admin,'select * from public.restart_call_up($1,$2)',[call.id,changed.status_version]);
    assert.equal(reset.status,'open');
    assert.equal((await db.query("select count(*)::int n from public.push_events where call_up_id=$1 and kind='cancelled'",[call.id])).rows[0].n,before);
    assert.equal((await row(admin,'select count(*)::int n from public.call_ups where club_id=$1 and local_date=$2',[club.id,call.local_date])).n,1);
  }
});
