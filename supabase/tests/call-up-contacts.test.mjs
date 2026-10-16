import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [admin,member,other] = [1,2,3].map(n=>`74000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
const phone='+34600000000';
let db, club, foreign, call, trial, aid;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
before(async()=>{
  db=await createTestDatabase();
  for(const [i,id] of [admin,member,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Contacts_${i}`}]);
  club=await row(admin,"select * from public.create_club('Contact Club',null,'Europe/Madrid')");
  foreign=await row(other,"select * from public.create_club('Other Contact Club')");
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
  call=await row(admin,"select * from public.create_call_up($1,'2035-01-01T20:00:00Z','open')",[club.id]);
});
after(async()=>{await db?.close();});
test('altas con teléfono son atómicas y no incluyen datos privados en las filas públicas',async()=>{
  trial=await row(admin,'select * from public.add_call_up_trial_with_contact($1,$2,$3)',[call.id,'Prueba libre',phone]);
  aid=await row(admin,'select * from public.save_call_up_aid_with_contact($1,$2,$3)',[call.id,'Ayuda libre',phone]);
  assert.equal(JSON.stringify(trial).includes(phone),false); assert.equal(JSON.stringify(aid).includes(phone),false);
  assert.equal((await query(admin,'select * from public.call_up_contacts where call_up_id=$1',[call.id])).rows.length,2);
  assert.equal((await query(admin,'select * from public.club_trial_contacts')).rows.length,1);
  await assert.rejects(query(admin,'select * from public.add_call_up_trial_with_contact($1,$2,$3)',[call.id,'Invalid contact','bad-phone']),e=>e.code==='22023');
  assert.equal((await row(admin,'select count(*)::int n from public.club_trials where club_id=$1',[club.id])).n,1);
});
test('RLS impide consultar teléfonos o escribir contactos a jugadores, otros clubes y anónimos',async()=>{
  for(const user of [member,other]){
    assert.equal((await query(user,'select * from public.call_up_contacts')).rows.length,0);
    assert.equal((await query(user,'select * from public.club_trial_contacts')).rows.length,0);
    await assert.rejects(query(user,"select public.save_call_up_contact($1,'trial',$2,$3)",[call.id,trial.id,phone]),e=>e.code==='42501');
    await assert.rejects(query(user,'insert into public.call_up_contacts(club_id,call_up_id,trial_id,phone) values($1,$2,$3,$4)',[club.id,call.id,trial.id,phone]),e=>e.code==='42501');
  }
  await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.call_up_contacts'),'anon'),e=>e.code==='42501');
  const another=await row(other,"select * from public.create_call_up($1,'2035-01-01T20:00:00Z','open')",[foreign.id]);
  await assert.rejects(query(other,"select public.save_call_up_contact($1,'trial',$2,$3)",[another.id,trial.id,phone]),e=>e.code==='42501');
  const publicTrial=(await query(member,'select * from public.call_up_trials where id=$1',[trial.id])).rows[0];
  assert.ok(publicTrial); assert.equal(JSON.stringify(publicTrial).includes(phone),false);
});
test('actualizar o vaciar teléfono no modifica nombres ni contamina las fotografías anteriores',async()=>{
  const next=await row(admin,"select * from public.create_call_up($1,'2035-01-02T20:00:00Z','open')",[club.id]);
  assert.equal((await row(admin,'select * from public.call_up_contacts where call_up_id=$1',[next.id])).phone,phone);
  await query(admin,"select public.save_call_up_contact($1,'trial',$2,null)",[call.id,trial.id]);
  assert.equal((await query(admin,'select * from public.call_up_contacts where trial_id=$1',[trial.id])).rows.length,0);
  assert.equal((await query(admin,'select * from public.club_trial_contacts')).rows.length,0);
  assert.equal((await row(admin,'select * from public.call_up_contacts where call_up_id=$1',[next.id])).phone,phone);
  assert.equal((await row(admin,'select * from public.call_up_trials where id=$1',[trial.id])).ea_id_snapshot,'Prueba libre');
});
test('quitar prueba solo afecta a su convocatoria y no reaparece al actualizar o reiniciar',async()=>{
  for(const user of [member,other]) await assert.rejects(query(user,'select public.remove_call_up_trial($1)',[trial.id]),e=>e.code==='42501');
  await query(admin,'select public.remove_call_up_trial($1)',[trial.id]);
  await query(admin,'select public.refresh_call_up_roster($1,false)',[call.id]);
  const current=await row(admin,'select * from public.call_ups where id=$1',[call.id]);
  await query(admin,'select public.restart_call_up($1,$2)',[call.id,current.status_version]);
  assert.equal((await query(admin,'select * from public.call_up_trials where call_up_id=$1',[call.id])).rows.length,0);
  assert.equal((await row(admin,'select status from public.club_trials where id=$1',[trial.source_trial_id])).status,'active');
  const future=await row(admin,"select * from public.create_call_up($1,'2035-01-03T20:00:00Z','open')",[club.id]);
  assert.equal((await query(admin,'select * from public.call_up_trials where call_up_id=$1',[future.id])).rows.length,1);
});
test('eliminar ayuda elimina su teléfono; cerradas e históricas no admiten cambios',async()=>{
  await query(admin,'delete from public.call_up_aids where id=$1',[aid.id]);
  assert.equal((await query(admin,'select * from public.call_up_contacts where aid_id=$1',[aid.id])).rows.length,0);
  const past=await row(admin,"select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')",[club.id]);
  await assert.rejects(query(admin,'select public.save_call_up_aid_with_contact($1,$2,$3)',[past.id,'Old',phone]),e=>e.code==='42501');
  await query(admin,'select public.update_call_up($1,$2,$3)',[call.id,call.starts_at,'closed']);
  await assert.rejects(query(admin,'select public.save_call_up_aid_with_contact($1,$2,$3)',[call.id,'Closed',phone]),e=>e.code==='42501');
});
