import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const admin='60000000-0000-4000-8000-000000000001', member='60000000-0000-4000-8000-000000000002', other='60000000-0000-4000-8000-000000000003';
let db, club, foreign, own, unsigned, inactive, call;
const query=(actor,sql,params=[])=>asUser(db,actor,tx=>tx.query(sql,params));
const row=async(...args)=>(await query(...args)).rows[0];
const reject=(actor,sql,params,code)=>assert.rejects(query(actor,sql,params),error=>error.code===code);
before(async()=>{
  db=await createTestDatabase();
  for(const [id,username] of [[admin,'PhaseAdmin'],[member,'PhaseMember'],[other,'PhaseOther']]) await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)',[id,{username}]);
  club=await row(admin,"select * from public.create_club('Phase Club',null,'Europe/Madrid',true)");foreign=await row(other,"select * from public.create_club('Phase Foreign')");
  const request=await row(member,'select * from public.request_to_join($1)',[club.id]);await query(admin,'select * from public.review_join_request($1,true)',[request.id]);
  own=await row(admin,"insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'Registered Phase',7,'backups') returning *",[club.id]);
  await query(admin,'select * from public.link_player_account($1,$2)',[own.id,member]);
  unsigned=await row(admin,"insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'Unsigned Phase',9,'attackers') returning *",[club.id]);
  inactive=await row(admin,"insert into public.players(club_id,ea_id,category,is_active) values ($1,'Inactive Phase','midfielders',false) returning *",[club.id]);
  await query(admin,"insert into public.club_trials(club_id,ea_id,notes) values ($1,'Informative Trial','Original')",[club.id]);
});
after(async()=>{await db?.close();});
test('creación incluye fotografía activa y pruebas, todos sin responder y ayudas vacías',async()=>{
  call=await row(admin,"select * from public.create_call_up($1,'2035-06-01T22:30:00Z','open')",[club.id]);
  assert.equal(call.local_date.toISOString().slice(0,10),'2035-06-02');
  const players=(await query(member,'select * from public.call_up_players where call_up_id=$1',[call.id])).rows;
  assert.equal(players.length,2);assert.ok(players.every(p=>p.availability==='unanswered' && p.responded_at===null));
  const entry=players.find(p=>p.source_player_id===own.id);assert.equal(entry.ea_id_snapshot,own.ea_id);assert.equal(entry.jersey_number_snapshot,7);assert.equal(entry.category_snapshot,'backups');assert.equal(entry.sort_order_snapshot,own.sort_order);
  assert.ok(!players.some(p=>p.source_player_id===inactive.id));
  assert.equal((await query(member,'select * from public.call_up_trials where call_up_id=$1',[call.id])).rows.length,1);
  assert.equal((await query(member,'select * from public.call_up_aids where call_up_id=$1',[call.id])).rows.length,0);
});
test('duplicados por fecha local se rechazan incluso al editar o cancelar y conservan respuestas',async()=>{
  await reject(admin,"select * from public.create_call_up($1,'2035-06-02T20:00:00Z','open')",[club.id],'23505');
  const second=await row(admin,"select * from public.create_call_up($1,'2035-06-03T20:00:00Z','open')",[club.id]);
  await reject(admin,"select * from public.update_call_up($1,'2035-06-02T18:00:00Z','open')",[second.id],'23505');
  const before=(await query(admin,'select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows;
  const changed=await row(admin,"select * from public.update_call_up($1,'2035-06-04T19:15:00Z','open')",[call.id]);
  assert.equal(changed.starts_at.toISOString(),'2035-06-04T19:15:00.000Z');
  assert.equal(changed.local_date.toISOString().slice(0,10),'2035-06-04'); call=changed;
  assert.deepEqual((await query(admin,'select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows,before);
  await query(admin,"select * from public.update_call_up($1,'2035-06-03T20:00:00Z','cancelled')",[second.id]);
  await reject(admin,"select * from public.create_call_up($1,'2035-06-03T21:00:00Z','open')",[club.id],'23505');
});
test('solo el propietario miembro puede responder; ni admin puede responder por otra ficha',async()=>{
  const mine=await row(member,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[call.id,own.id]);
  const noAccount=await row(member,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[call.id,unsigned.id]);
  for(const state of ['available','unavailable','backup']) {
    await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1 and responded_at is not null",[mine.id]);
    assert.equal((await row(member,'select * from public.respond_to_call_up($1,$2)',[mine.id,state])).availability,state);
  }
  for(const actor of [admin,other,member]) await reject(actor,"select * from public.respond_to_call_up($1,'available')",[noAccount.id],'42501');
  for(const actor of [admin,other]) await reject(actor,"select * from public.respond_to_call_up($1,'available')",[mine.id],'42501');
  await reject(member,"select * from public.respond_to_call_up($1,'unanswered')",[mine.id],'22023');
  assert.equal((await row(member,'select availability from public.call_up_players where id=$1',[noAccount.id])).availability,'unanswered');
  await reject(member,"update public.call_up_players set availability='available',responded_at=now() where id=$1",[noAccount.id],'42501');
});
test('cerrar, cancelar y reabrir protege respuestas y administración; otros clubes aislados',async()=>{
  const mine=await row(admin,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[call.id,own.id]);
  for(const status of ['closed','cancelled']){
    await query(admin,'select * from public.update_call_up($1,$2,$3)',[call.id,call.starts_at,status]);
    await reject(member,"select * from public.respond_to_call_up($1,'available')",[mine.id],status==='closed'?'P0031':'42501');
    assert.equal((await query(member,'select * from public.call_up_players where call_up_id=$1',[call.id])).rows.length,status==='closed'?2:0);
  }
  for(const actor of [member,other]){
    await reject(actor,'select * from public.update_call_up($1,$2,$3)',[call.id,call.starts_at,'open'],'42501');
    await reject(actor,"select * from public.create_call_up($1,'2035-08-01T20:00:00Z','open')",[club.id],'42501');
  }
  await query(admin,'select * from public.update_call_up($1,$2,$3)',[call.id,call.starts_at,'open']);
  await reject(member,"select * from public.respond_to_call_up($1,'available')",[mine.id],'P0030');
  await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1",[mine.id]);
  assert.equal((await row(member,"select * from public.respond_to_call_up($1,'available')",[mine.id])).availability,'available');
  assert.equal((await query(other,'select * from public.call_ups where club_id=$1',[club.id])).rows.length,0);
  assert.equal((await query(member,'select * from public.call_ups where club_id=$1',[foreign.id])).rows.length,0);
});
test('historial devuelve diez anteriores en orden y bloquea acceso de jugadores incluso si siguen abiertas',async()=>{
  for(let i=1;i<=12;i++) await query(admin,"select * from public.create_call_up($1,(((now() at time zone 'Europe/Madrid')::date-$2::int)+time '20:00') at time zone 'Europe/Madrid','open')",[club.id,i]);
  const history=(await query(admin,'select * from public.list_call_up_history($1)',[club.id])).rows;
  assert.equal(history.length,10);assert.ok(history.every((c,i)=>i===0||history[i-1].starts_at>c.starts_at));
  for(const actor of [member,other]) await reject(actor,'select * from public.list_call_up_history($1)',[club.id],'42501');
  await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.list_call_up_history($1)',[club.id]),'anon'),e=>e.code==='42501');
  const past=history[0];
  for(const table of ['call_ups','call_up_players','call_up_trials','call_up_aids']) {
    const sql=table==='call_ups'?'select * from public.call_ups where id=$1':`select * from public.${table} where call_up_id=$1`;
    assert.equal((await query(member,sql,[past.id])).rows.length,0);
  }
  const entry=await row(admin,'select id from public.call_up_players where call_up_id=$1 and user_id=$2',[past.id,member]);
  await reject(member,"select * from public.respond_to_call_up($1,'available')",[entry.id],'42501');
});
test('historial conserva fotografía, respuesta, pruebas y ayudas al cambiar plantilla',async()=>{
  await query(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Original aid')",[club.id,call.id]);
  await query(admin,'select * from public.update_call_up($1,$2,$3)',[call.id,call.starts_at,'closed']);
  const before=(await query(admin,'select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows;
  await query(admin,"update public.players set ea_id='Changed Phase',jersey_number=44,category='goalkeepers',is_active=false where id=$1",[own.id]);
  await query(admin,"update public.club_trials set notes='Changed' where club_id=$1",[club.id]);
  assert.deepEqual((await query(admin,'select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows,before);
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where call_up_id=$1',[call.id])).notes,'Original');
  assert.equal((await row(admin,'select body from public.call_up_aids where call_up_id=$1',[call.id])).body,'Original aid');
});
test('publicación Realtime incluye convocatorias, solicitudes y membresías con RLS',async()=>{
  const published=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime' order by tablename")).rows.map(x=>x.tablename);
  assert.deepEqual(published,['call_up_aids','call_up_players','call_up_trials','call_ups','club_members','join_requests']);
  const tables=(await db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname=any($1)",[published])).rows;
  assert.equal(tables.length,6);assert.ok(tables.every(x=>x.relrowsecurity));
});

test('restaurar historial recupera la función ausente, admite repetición y mantiene datos y permisos', async () => {
  const before = (await query(admin, 'select * from public.list_call_up_history($1)', [club.id])).rows;
  const migration = await readFile(new URL('../migrations/20261016180000_restore_call_up_history.sql', import.meta.url), 'utf8');
  await db.exec('drop function public.list_call_up_history(uuid)');
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual((await query(admin, 'select * from public.list_call_up_history($1)', [club.id])).rows, before);
  for (const actor of [member, other]) await reject(actor, 'select * from public.list_call_up_history($1)', [club.id], '42501');
  await assert.rejects(asUser(db, null, tx => tx.query('select * from public.list_call_up_history($1)', [club.id]), 'anon'), e => e.code === '42501');
});
