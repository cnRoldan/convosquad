import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { asUser } from '../../scripts/database-test-utils.mjs';
const [admin,member,other] = [1,2,3].map(n=>`78000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db, club, trial, historical;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
before(async()=>{
  db=new PGlite();
  await db.exec(await readFile(new URL('./auth-fixture.sql',import.meta.url),'utf8'));
  const dir=new URL('../migrations/',import.meta.url);
  const target='20261017000400_private_trial_notes.sql';
  const migrations=(await readdir(dir)).filter(n=>n.endsWith('.sql')).sort();
  for(const name of migrations.filter(n=>n<target)) await db.exec(await readFile(new URL(name,dir),'utf8'));
  for(const [i,id] of [admin,member,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`PrivateNotes_${i}`}]);
  club=await row(admin,"select * from public.create_club('Private notes')");
  await row(other,"select * from public.create_club('Other notes')");
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
  trial=await row(admin,"insert into public.club_trials(club_id,ea_id,notes) values($1,'Legacy trial','Valoración anterior') returning *",[club.id]);
  historical=await row(admin,"select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')",[club.id]);
  for(const name of migrations.filter(n=>n>=target)) await db.exec(await readFile(new URL(name,dir),'utf8'));
});
after(async()=>{await db?.close();});
test('migración conserva observaciones existentes en privado y vacía filas públicas e históricas',async()=>{
  assert.equal((await row(member,'select notes from public.club_trials where id=$1',[trial.id])).notes,null);
  assert.equal((await row(admin,'select notes_snapshot from public.call_up_trials where call_up_id=$1',[historical.id])).notes_snapshot,null);
  assert.equal((await row(admin,'select notes from public.club_trial_notes where trial_id=$1',[trial.id])).notes,'Valoración anterior');
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where call_up_id=$1',[historical.id])).notes,'Valoración anterior');
  for(const user of [member,other]) for(const table of ['club_trial_notes','call_up_trial_notes'])
    assert.equal((await query(user,`select * from public.${table}`)).rows.length,0);
  for(const table of ['club_trial_notes','call_up_trial_notes'])
    await assert.rejects(asUser(db,null,tx=>tx.query(`select * from public.${table}`),'anon'),e=>e.code==='42501');
});
test('solo capitanes activos del mismo club consultan notas; ni capitanes escriben las tablas privadas directamente',async()=>{
  await db.query("update public.club_members set role='admin' where club_id=$1 and user_id=$2",[club.id,member]);
  assert.equal((await query(member,'select * from public.club_trial_notes')).rows.length,1);
  await db.query("update public.club_members set role='player' where club_id=$1 and user_id=$2",[club.id,member]);
  assert.equal((await query(member,'select * from public.club_trial_notes')).rows.length,0);
  for(const user of [admin,member,other])
    await assert.rejects(query(user,"update public.club_trial_notes set notes='Forged' where trial_id=$1",[trial.id]),e=>e.code==='42501');
});
test('guardado, borrado e importación de observaciones nunca escriben texto en filas públicas',async()=>{
  await query(admin,'select * from public.save_club_trial_with_contact($1,$2,$3,$4,$5)',[club.id,'Legacy trial','Nueva valoración',null,trial.id]);
  assert.equal((await row(admin,'select notes from public.club_trial_notes where trial_id=$1',[trial.id])).notes,'Nueva valoración');
  assert.equal((await row(member,'select notes from public.club_trials where id=$1',[trial.id])).notes,null);
  await query(admin,'select * from public.save_club_trial_with_contact($1,$2,$3,$4,$5)',[club.id,'Legacy trial',null,null,trial.id]);
  assert.equal((await query(admin,'select * from public.club_trial_notes where trial_id=$1',[trial.id])).rows.length,0);
  await query(admin,'select public.import_roster($1,$2,$3)',[club.id,[],[{ea_id:'Imported private trial',notes:'Valoración importada'}]]);
  const imported=await row(member,"select * from public.club_trials where ea_id='Imported private trial'");
  assert.equal(imported.notes,null);
  assert.equal((await row(admin,'select notes from public.club_trial_notes where trial_id=$1',[imported.id])).notes,'Valoración importada');
});
test('fotografías privadas se actualizan al refrescar sin huérfanos y preservan el historial',async()=>{
  await query(admin,"update public.club_trials set notes='Actual' where id=$1",[trial.id]);
  const call=await row(admin,"select * from public.create_call_up($1,'2038-01-01T20:00:00Z','open')",[club.id]);
  await query(admin,"update public.club_trials set notes='Actualizada' where id=$1",[trial.id]);
  await query(admin,'select public.refresh_call_up_roster($1,false)',[call.id]);
  const snapshot=await row(member,'select * from public.call_up_trials where call_up_id=$1 and source_trial_id=$2',[call.id,trial.id]);
  assert.equal(snapshot.notes_snapshot,null);
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where trial_id=$1',[snapshot.id])).notes,'Actualizada');
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where call_up_id=$1',[historical.id])).notes,'Valoración anterior');
  await query(admin,'select public.remove_call_up_trial($1)',[snapshot.id]);
  await query(admin,'select public.refresh_call_up_roster($1,false)',[call.id]);
  assert.equal((await query(admin,'select * from public.call_up_trial_notes where trial_id=$1',[snapshot.id])).rows.length,0);
  const current=await row(admin,'select * from public.call_ups where id=$1',[call.id]);
  await query(admin,'select public.restart_call_up($1,$2)',[call.id,current.status_version]);
  assert.equal((await query(admin,'select * from public.call_up_trials where call_up_id=$1 and source_trial_id=$2',[call.id,trial.id])).rows.length,0);
});
test('entradas inválidas o sin permiso revierten también las notas privadas',async()=>{
  await assert.rejects(query(admin,"insert into public.club_trials(club_id,ea_id,notes) values($1,'Invalid private trial',$2)",[club.id,'x'.repeat(1001)]),e=>e.code==='23514');
  for(const user of [member,other])
    await assert.rejects(query(user,"insert into public.club_trials(club_id,ea_id,notes) values($1,'Forbidden private trial','Forbidden')",[club.id]),e=>e.code==='42501');
  assert.equal((await row(admin,"select count(*)::int n from public.club_trial_notes where notes='Forbidden'")).n,0);
  assert.equal((await row(admin,"select count(*)::int n from public.club_trials where ea_id in ('Invalid private trial','Forbidden private trial')")).n,0);
  await assert.rejects(query(admin,"insert into public.club_trials(club_id,ea_id,notes) values($1,'Legacy trial','Duplicate')",[club.id]),e=>e.code==='23505');
});
