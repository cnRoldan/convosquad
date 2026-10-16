import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [admin,member,other] = [1,2,3].map(n=>`77000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db, club, foreign, trial, snapshot;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const save=(user,clubId,name,notes,phone,id=null)=>row(user,'select * from public.save_club_trial_with_contact($1,$2,$3,$4,$5)',[clubId,name,notes,phone,id]);
before(async()=>{
  db=await createTestDatabase();
  for(const [i,id] of [admin,member,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`RosterPhone_${i}`}]);
  club=await row(admin,"select * from public.create_club('Roster phones')");
  foreign=await row(other,"select * from public.create_club('Foreign phones')");
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
});
after(async()=>{await db?.close();});
test('crear prueba guarda contacto privado y deja observaciones separadas',async()=>{
  trial=await save(admin,club.id,'Prueba contacto','Delantero','+34600000000');
  assert.equal(trial.notes,'Delantero');
  assert.equal(JSON.stringify(trial).includes('+34600000000'),false);
  assert.equal((await row(admin,'select phone from public.club_trial_contacts where trial_id=$1',[trial.id])).phone,'+34600000000');
  assert.equal((await query(member,'select * from public.club_trial_contacts')).rows.length,0);
  const call=await row(admin,"select * from public.create_call_up($1,'2038-01-01T20:00:00Z','open')",[club.id]);
  snapshot=await row(admin,'select * from public.call_up_contacts where call_up_id=$1',[call.id]);
});
test('actualizar y vaciar teléfono conserva las fotografías de convocatorias existentes',async()=>{
  const updated=await save(admin,club.id,'Prueba editada',null,'+447000000000',trial.id);
  assert.equal(updated.sort_order,trial.sort_order);
  assert.deepEqual(updated.created_at,trial.created_at);
  assert.equal((await row(admin,'select phone from public.club_trial_contacts where trial_id=$1',[trial.id])).phone,'+447000000000');
  const call=await row(admin,"select * from public.create_call_up($1,'2038-01-02T20:00:00Z','open')",[club.id]);
  assert.equal((await row(admin,'select phone from public.call_up_contacts where call_up_id=$1',[call.id])).phone,'+447000000000');
  await save(admin,club.id,'Prueba editada',null,'   ',trial.id);
  assert.equal((await query(admin,'select * from public.club_trial_contacts where trial_id=$1',[trial.id])).rows.length,0);
  assert.deepEqual(await row(admin,'select * from public.call_up_contacts where id=$1',[snapshot.id]),snapshot);
});
test('sin permisos, teléfono inválido o prueba ajena/retirada no se escribe ningún dato',async()=>{
  for(const user of [member,other]) await assert.rejects(save(user,club.id,'No permitido',null,'+34600000000',trial.id),e=>e.code==='42501');
  await assert.rejects(save(other,foreign.id,'Ajena',null,null,trial.id),e=>e.code==='42501');
  await assert.rejects(save(admin,club.id,'No guardar',null,'666666666',trial.id),e=>e.code==='22023');
  await assert.rejects(save(admin,club.id,'No crear',null,'bad'),e=>e.code==='22023');
  assert.equal((await row(admin,'select ea_id from public.club_trials where id=$1',[trial.id])).ea_id,'Prueba editada');
  assert.equal((await row(admin,'select count(*)::int n from public.club_trials where club_id=$1',[club.id])).n,1);
  await query(admin,'select public.withdraw_trial($1)',[trial.id]);
  await assert.rejects(save(admin,club.id,'Retirada',null,null,trial.id),e=>e.code==='42501');
  await assert.rejects(asUser(db,null,tx=>tx.query('select public.save_club_trial_with_contact($1,$2)',[club.id,'Anon']),'anon'),e=>e.code==='42501');
});
