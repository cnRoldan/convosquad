import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [admin,member,other,backup] = [1,2,3,4].map(n=>`79000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,foreign,call,own,backupEntry;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const create=day=>row(admin,"select * from public.create_call_up($1,$2,'open')",[club.id,`2038-01-${String(day).padStart(2,'0')}T20:00:00Z`]);
const entry=(callId,user=member)=>row(admin,'select * from public.call_up_players where call_up_id=$1 and user_id=$2',[callId,user]);
const toggle=(user,enabled,id=own.id,clubId=club.id)=>query(user,'select public.set_club_decision_lock($1,$2,$3)',[clubId,enabled,id]);
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [admin,member,other,backup].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`KeepVote_${i}`}]);
 club=await row(admin,"select * from public.create_club('Kept decisions')");foreign=await row(other,"select * from public.create_club('Other decisions')");
 for(const user of [member,backup]){
  await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,user]);
  const player=await row(admin,"insert into public.players(club_id,ea_id,category) values($1,$2,$3) returning *",[club.id,user===member?'Official':'Backup',user===member?'midfielders':'backups']);
  await row(admin,'select * from public.link_player_account($1,$2)',[player.id,user]);
 }
 call=await create(1);own=await entry(call.id);backupEntry=await entry(call.id,backup);
});
after(async()=>{await db?.close();});
test('se exige un voto propio y no se pueden fijar decisiones ajenas ni escribir la preferencia directamente',async()=>{
 await assert.rejects(toggle(member,true),e=>e.code==='22023');
 for(const user of [admin,other]) await assert.rejects(toggle(user,true),e=>e.code==='42501');
 await assert.rejects(toggle(other,true,own.id,foreign.id),e=>e.code==='42501');
 await assert.rejects(query(member,"insert into public.club_decision_locks(club_id,user_id,availability) values($1,$2,'available')",[club.id,member]),e=>e.code==='42501');
 await query(member,"select public.respond_to_call_up($1,'unavailable')",[own.id]);
 await toggle(member,true);
 assert.equal((await row(member,'select * from public.club_decision_locks')).availability,'unavailable');
 assert.equal((await query(admin,'select * from public.club_decision_locks')).rows.length,0);
 await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.club_decision_locks'),'anon'),e=>e.code==='42501');
});
test('nueva convocatoria copia el voto sin eventos de voto ni bloqueo artificial de 30 segundos',async()=>{
 const next=await create(2),auto=await entry(next.id);
 assert.equal(auto.availability,'unavailable');assert.equal(auto.auto_response,true);assert.ok(auto.responded_at);
 assert.equal((await db.query("select count(*)::int n from public.push_events where call_up_id=$1 and kind='vote'",[next.id])).rows[0].n,0);
 await query(member,"select public.respond_to_call_up($1,'available')",[auto.id]);
 assert.equal((await entry(next.id)).auto_response,false);
 assert.equal((await row(member,'select * from public.club_decision_locks')).availability,'available');
 await assert.rejects(query(member,"select public.respond_to_call_up($1,'backup')",[auto.id]),e=>e.code==='P0030');
 const future=await create(3);assert.equal((await entry(future.id)).availability,'available');
});
test('publicación y último aviso excluyen al voto mantenido; cancelación se conserva y backups siguen sus reglas',async()=>{
 await query(backup,"select public.respond_to_call_up($1,'backup')",[backupEntry.id]);await toggle(backup,true,backupEntry.id);
 const next=await create(4);
 const allowed=(user,kind)=>db.query('select private.notification_recipient_allowed($1,$2,$3,$4) ok',[club.id,next.id,user,kind]).then(r=>r.rows[0].ok);
 for(const kind of ['published','pending','reminder']) assert.equal(await allowed(member,kind),false);
 assert.equal(await allowed(member,'cancelled'),true);
 for(const kind of ['published','pending','reminder','vote']) assert.equal(await allowed(backup,kind),false);
 assert.equal(await allowed(backup,'cancelled'),true);
 assert.equal((await entry(next.id,backup)).availability,'backup');
});
test('reiniciar respeta candados y las preferencias no modifican convocatorias anteriores',async()=>{
 const next=await create(5),original=await entry(call.id);
 await query(admin,'select public.restart_call_up($1,$2)',[next.id,next.status_version]);
 assert.equal((await entry(next.id)).availability,'available');
 assert.equal((await entry(next.id)).auto_response,true);
 assert.deepEqual(await entry(call.id),original);
 await toggle(member,false);
 const future=await create(6);assert.equal((await entry(future.id)).availability,'unanswered');
 assert.equal((await entry(next.id)).availability,'available');
});
test('abrir un borrador aplica decisiones nuevas sin sobrescribir respuestas existentes',async()=>{
 const draft=await row(admin,"select * from public.create_call_up($1,'2038-01-07T20:00:00Z','draft')",[club.id]);
 await toggle(member,true);
 await query(admin,"select public.update_call_up($1,$2,'open')",[draft.id,draft.starts_at]);
 assert.equal((await entry(draft.id)).availability,'unavailable');
 const past=await row(admin,"select * from public.create_call_up($1,'2020-01-01T20:00:00Z','open')",[club.id]);
 assert.equal((await entry(past.id)).availability,'unanswered');
});
test('la misma cuenta mantiene decisiones independientes en clubes distintos',async()=>{
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[foreign.id,member]);
 const player=await row(other,"insert into public.players(club_id,ea_id,category) values($1,'Second club','midfielders') returning *",[foreign.id]);
 await row(other,'select * from public.link_player_account($1,$2)',[player.id,member]);
 const call=await row(other,"select * from public.create_call_up($1,'2038-01-09T20:00:00Z','open')",[foreign.id]);
 const foreignEntry=await row(other,'select * from public.call_up_players where call_up_id=$1',[call.id]);
 await query(member,"select public.respond_to_call_up($1,'available')",[foreignEntry.id]);
 await toggle(member,true,foreignEntry.id,foreign.id);
 const next=await row(other,"select * from public.create_call_up($1,'2038-01-10T20:00:00Z','open')",[foreign.id]);
 assert.equal((await row(other,'select * from public.call_up_players where call_up_id=$1',[next.id])).availability,'available');
 assert.equal((await row(member,'select * from public.club_decision_locks where club_id=$1',[club.id])).availability,'unavailable');
});
test('retirar la ficha o la membresía elimina el candado y no afecta a otros clubes',async()=>{
 await query(admin,'select public.set_club_member($1,$2,\'player\',false)',[club.id,member]);
 assert.equal((await db.query('select count(*)::int n from public.club_decision_locks where club_id=$1 and user_id=$2',[club.id,member])).rows[0].n,0);
 const future=await create(8);const unlinked=await row(admin,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[future.id,own.source_player_id]);assert.equal(unlinked.availability,'unanswered');assert.equal(unlinked.user_id,null);
 await query(admin,'update public.players set is_active=false where club_id=$1 and user_id=$2',[club.id,backup]);
 assert.equal((await db.query('select count(*)::int n from public.club_decision_locks where club_id=$1',[club.id])).rows[0].n,0);
});
