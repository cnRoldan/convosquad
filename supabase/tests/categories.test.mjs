import assert from 'node:assert/strict';
import { before, after, describe, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const admin='40000000-0000-4000-8000-000000000001', member='40000000-0000-4000-8000-000000000002', outsider='40000000-0000-4000-8000-000000000003';
let db, club, other, first, second, linked, trial;
const query=(user,sql,params=[])=>asUser(db,user,t=>t.query(sql,params));
const row=async(...args)=>(await query(...args)).rows[0];
const reject=(user,sql,params,code)=>assert.rejects(query(user,sql,params),e=>e.code===code);
before(async()=>{
 db=await createTestDatabase();
 for(const [id,username] of [[admin,'CategoryAdmin'],[member,'CategoryMember'],[outsider,'CategoryOther']]) await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)',[id,{username}]);
 club=await row(admin,"select * from public.create_club('Category Club',null,'Europe/Madrid',true)"); other=await row(outsider,"select * from public.create_club('Other Club')");
 const request=await row(member,'select * from public.request_to_join($1)',[club.id]); await query(admin,'select * from public.review_join_request($1,true)',[request.id]);
 linked=await row(admin,"insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'BackupMember',1,'backups') returning *",[club.id]);
 await query(admin,'select * from public.link_player_account($1,$2)',[linked.id,member]);
 trial=await row(admin,"insert into public.club_trials(club_id,ea_id,jersey_number,position,notes) values ($1,'Trial One',23,'central zurdo','Observar varios días') returning *",[club.id]);
});
after(async()=>{await db?.close();});
describe('Categorías, pruebas y ayudas',{concurrency:false},()=>{
 test('las seis categorías tienen un orden interno fijo y BACKUPS no es disponibilidad',async()=>{
  const result=await db.query("select array(select unnest(enum_range(null::public.roster_category))::text) as values"); assert.deepEqual(result.rows[0].values,['goalkeepers','centre_backs','wide_backs','midfielders','attackers','backups']);
  assert.equal(linked.category,'backups'); assert.equal(linked.user_id,null);
 });
 test('el orden de jugadores es manual, completo y ajeno al dorsal',async()=>{
  const a=await row(admin,"insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'Order A',1,'goalkeepers') returning *",[club.id]);
  const b=await row(admin,"insert into public.players(club_id,ea_id,jersey_number,category) values ($1,'Order B',99,'goalkeepers') returning *",[club.id]);
  await query(admin,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[b.id,a.id]]);
  assert.deepEqual((await query(member,"select ea_id from public.players where club_id=$1 and category='goalkeepers' order by sort_order,id",[club.id])).rows.map(x=>x.ea_id),['Order B','Order A']);
  await reject(admin,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[a.id]],'22023');
  await reject(admin,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[a.id,a.id]],'22023');
  await reject(admin,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[a.id,linked.id]],'22023');
  await reject(member,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[b.id,a.id]],'42501');
  await reject(admin,'update public.players set sort_order=999 where id=$1',[a.id],'42501');
  await query(admin,'update public.players set is_active=false where id=$1',[b.id]);
  await query(admin,'select public.reorder_players($1,$2,$3)',[club.id,'goalkeepers',[a.id]]);
  await query(admin,'update public.players set is_active=true where id=$1',[b.id]);
  assert.deepEqual((await query(member,"select ea_id from public.players where club_id=$1 and category='goalkeepers' and is_active order by sort_order,id",[club.id])).rows.map(x=>x.ea_id),['Order A','Order B']);
 });
 test('pruebas persistentes: edición, orden y privacidad de club',async()=>{
  const b=await row(admin,"insert into public.club_trials(club_id,ea_id) values ($1,'Trial Two') returning *",[club.id]);
  await query(admin,'select public.reorder_trials($1,$2)',[club.id,[b.id,trial.id]]);
  await query(admin,"update public.club_trials set notes='Actualizado' where id=$1",[trial.id]);
  assert.equal((await row(member,'select * from public.club_trials where id=$1',[trial.id])).created_at.toISOString(),trial.created_at.toISOString());
  assert.equal((await query(outsider,'select * from public.club_trials where club_id=$1',[club.id])).rows.length,0);
  await reject(member,"insert into public.club_trials(club_id,ea_id) values ($1,'Forbidden')",[club.id],'42501');
  await reject(outsider,'select public.reorder_trials($1,$2)',[club.id,[b.id,trial.id]],'42501');
  await reject(member,'select public.withdraw_trial($1)',[trial.id],'42501');
  await reject(admin,"update public.club_trials set status='incorporated' where id=$1",[trial.id],'42501');
 });
 test('la convocatoria copia categorías, orden y pruebas; todos empiezan sin responder y sin ayudas',async()=>{
  first=await row(admin,"select * from public.create_call_up($1,'2027-01-01T21:00:00Z','open')",[club.id]);
  const players=(await query(member,'select * from public.call_up_players where call_up_id=$1',[first.id])).rows;
  assert.equal(players.length,3); assert.ok(players.every(x=>x.availability==='unanswered' && x.responded_at===null));
  assert.equal(players.find(x=>x.source_player_id===linked.id).category_snapshot,'backups');
  const trials=(await query(member,'select * from public.call_up_trials where call_up_id=$1 order by sort_order_snapshot',[first.id])).rows;
  assert.equal(trials.length,2); assert.equal(trials[0].ea_id_snapshot,'Trial Two'); assert.equal(trials[1].notes_snapshot,null);
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where trial_id=$1',[trials[1].id])).notes,'Actualizado');
  assert.equal((await query(member,'select * from public.call_up_aids where call_up_id=$1',[first.id])).rows.length,0);
  assert.equal((await query(outsider,'select * from public.call_up_trials where call_up_id=$1',[first.id])).rows.length,0);
 });
 test('un BACKUPS vinculado responde Disponible, No disponible o Backup como cualquier jugador',async()=>{
  const entry=await row(member,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[first.id,linked.id]);
  for(const state of ['available','unavailable','backup']) {
    await db.query("update public.call_up_players set responded_at=clock_timestamp()-interval '31 seconds' where id=$1 and responded_at is not null",[entry.id]);
    assert.equal((await row(member,'select * from public.respond_to_call_up($1,$2)',[entry.id,state])).availability,state);
  }
 });
 test('la promoción es atómica, no crea usuario y no modifica snapshots anteriores',async()=>{
  const before=Number((await db.query('select count(*) as n from auth.users')).rows[0].n);
  const player=await row(admin,"select * from public.promote_trial($1,'centre_backs')",[trial.id]);
  assert.equal(player.user_id,null); assert.equal(player.ea_id,'Trial One'); assert.equal(player.jersey_number,23);
  const converted=await row(admin,'select * from public.club_trials where id=$1',[trial.id]); assert.equal(converted.status,'incorporated'); assert.equal(converted.player_id,player.id); assert.ok(converted.incorporated_at);
  assert.equal(Number((await db.query('select count(*) as n from auth.users')).rows[0].n),before);
  const snapshot=await row(member,'select * from public.call_up_trials where call_up_id=$1 and source_trial_id=$2',[first.id,trial.id]); assert.equal(snapshot.ea_id_snapshot,'Trial One'); assert.equal(snapshot.position_snapshot,'central zurdo'); assert.equal(snapshot.notes_snapshot,null);
  assert.equal((await row(admin,'select notes from public.call_up_trial_notes where trial_id=$1',[snapshot.id])).notes,'Actualizado');
  assert.equal((await query(member,'select * from public.call_up_players where call_up_id=$1',[first.id])).rows.length,4);
  await reject(admin,"select * from public.promote_trial($1,'attackers')",[trial.id],'22023');
 });
 test('duplicados en promoción revierten la operación; reutilizar exige una ficha del mismo club y EA ID',async()=>{
  const duplicate=await row(admin,"insert into public.club_trials(club_id,ea_id,jersey_number) values ($1,'BackupMember',8) returning *",[club.id]);
  await reject(admin,"select * from public.promote_trial($1,'backups')",[duplicate.id],'23505');
  assert.equal((await row(admin,'select status from public.club_trials where id=$1',[duplicate.id])).status,'active');
  const wrong=await row(outsider,"insert into public.players(club_id,ea_id,category) values ($1,'BackupMember','backups') returning *",[other.id]);
  await reject(admin,"select * from public.promote_trial($1,'backups',$2)",[duplicate.id,wrong.id],'22023');
  await reject(outsider,"select * from public.promote_trial($1,'backups',$2)",[duplicate.id,linked.id],'42501');
  await reject(member,"select * from public.promote_trial($1,'backups',$2)",[duplicate.id,linked.id],'42501');
  const promoted=await row(admin,"select * from public.promote_trial($1,'backups',$2)",[duplicate.id,linked.id]); assert.equal(promoted.id,linked.id); assert.equal(promoted.user_id,member); assert.equal(promoted.jersey_number,1);
 });
 test('ayudas exclusivas de cada convocatoria, CRUD y orden de admin',async()=>{
  const a=await row(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Necesitamos 1 DFC') returning *",[club.id,first.id]);
  const b=await row(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Viene un amigo') returning *",[club.id,first.id]);
  await query(admin,'select public.reorder_aids($1,$2)',[first.id,[b.id,a.id]]);
  await query(admin,"update public.call_up_aids set body='Vienen dos amigos' where id=$1",[b.id]);
  assert.equal((await row(member,'select body from public.call_up_aids where id=$1',[b.id])).body,'Vienen dos amigos');
  await reject(member,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Forbidden')",[club.id,first.id],'42501');
  await reject(outsider,'select public.reorder_aids($1,$2)',[first.id,[b.id,a.id]],'42501');
  assert.equal((await query(member,"update public.call_up_aids set body='Forged' where id=$1 returning id",[a.id])).rows.length,0);
  assert.equal((await query(member,'delete from public.call_up_aids where id=$1 returning id',[a.id])).rows.length,0);
  second=await row(admin,"select * from public.create_call_up($1,'2027-01-02T21:00:00Z','open')",[club.id]);
  assert.equal((await query(member,'select * from public.call_up_aids where call_up_id=$1',[second.id])).rows.length,0);
  assert.equal((await query(member,'select * from public.call_up_trials where call_up_id=$1',[second.id])).rows.length,1);
  await query(admin,'delete from public.call_up_aids where id=$1',[a.id]);
  assert.equal((await query(member,'select * from public.call_up_aids where call_up_id=$1',[first.id])).rows.length,1);
 });
 test('históricos conservan categoría, orden, pruebas y ayudas al editar la plantilla o retirar pruebas',async()=>{
  await query(admin,"select * from public.update_call_up($1,'2027-01-01T21:00:00Z','closed')",[first.id]);
  await query(admin,"update public.players set category='attackers' where id=$1",[linked.id]);
  const remaining=await row(admin,"select * from public.club_trials where status='active' and club_id=$1",[club.id]);
  await query(admin,'select * from public.withdraw_trial($1)',[remaining.id]);
  const snapshot=await row(admin,'select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[first.id,linked.id]); assert.equal(snapshot.category_snapshot,'backups'); assert.equal(snapshot.availability,'backup');
  assert.equal((await query(admin,'select * from public.call_up_trials where call_up_id=$1',[first.id])).rows.length,2);
  assert.equal((await query(admin,'select * from public.call_up_aids where call_up_id=$1',[first.id])).rows.length,1);
  await reject(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Change past')",[club.id,first.id],'42501');
  assert.equal((await query(admin,"update public.call_up_aids set body='Change past' where call_up_id=$1 returning id",[first.id])).rows.length,0);
 });
 test('importación conjunta atómica conserva orden y prohíbe disponibilidad, cuentas y duplicados',async()=>{
  const payload=[{ea_id:'Imported B',jersey_number:99,category:'backups'},{ea_id:'Imported A',jersey_number:1,category:'backups'}];
  const imported=await row(admin,'select public.import_roster($1,$2,$3) as value',[club.id,payload,[{ea_id:'Imported Trial',position:'MC o DFC',notes:'Revisar'}]]);
  assert.deepEqual(imported.value,{players:2,trials:1});
  assert.deepEqual((await query(member,"select ea_id from public.players where club_id=$1 and category='backups' order by sort_order",[club.id])).rows.map(x=>x.ea_id),['Imported B','Imported A']);
  await reject(admin,'select public.import_roster($1,$2,$3)',[club.id,[{ea_id:'Rollback',category:'attackers'}],[{ea_id:'Imported Trial'}]],'23505');
  assert.equal((await query(admin,"select * from public.players where ea_id='Rollback'")).rows.length,0);
  for(const extra of [{user_id:member},{availability:'available'},{sort_order:999}]) await reject(admin,'select public.import_roster($1,$2,$3)',[club.id,[{ea_id:'Forged',category:'backups',...extra}],[]],'22023');
  await reject(member,'select public.import_roster($1,$2,$3)',[club.id,payload,[]],'42501');
  await reject(outsider,'select public.import_roster($1,$2,$3)',[club.id,payload,[]],'42501');
  await reject(admin,'select public.import_roster($1,$2,$3)',[club.id,[{ea_id:'Same',category:'backups'}],[{ea_id:'same'}]],'23505');
 });
 test('el borrado de un club por el propietario mantiene las cascadas sin bloquear ayudas cerradas',async()=>{
  const temp=await row(admin,"select * from public.create_club('Cascade Club')");
  const call=await row(admin,"select * from public.create_call_up($1,'2028-01-01T21:00:00Z','open')",[temp.id]);
  await query(admin,"insert into public.call_up_aids(club_id,call_up_id,body) values ($1,$2,'Temporary')",[temp.id,call.id]);
  await query(admin,"select * from public.update_call_up($1,'2028-01-01T21:00:00Z','closed')",[call.id]);
  await db.query('delete from public.clubs where id=$1',[temp.id]);
  assert.equal((await db.query('select * from public.call_up_aids where call_up_id=$1',[call.id])).rows.length,0);
 });
 test('snapshots informativos y trazabilidad no admiten escrituras directas de cliente',async()=>{
  const rls=(await db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname in ('club_trials','call_up_trials','call_up_aids')")).rows; assert.equal(rls.length,3); assert.ok(rls.every(table=>table.relrowsecurity));
  await reject(admin,'update public.call_up_trials set notes_snapshot=$1 where call_up_id=$2',['Forged',second.id],'42501');
  await reject(admin,'delete from public.club_trials where id=$1',[trial.id],'42501');
  await reject(admin,"update public.players set club_id=$1 where id=$2",[other.id,linked.id],'42501');
  await assert.rejects(asUser(db,null,t=>t.query('select * from public.club_trials'), 'anon'),e=>e.code==='42501');
 });
});

test('la migración incremental transforma datos previos sin cambiar posiciones ni respuestas históricas',async()=>{
 const legacy=new PGlite();
 try {
  await legacy.exec(await readFile(new URL('./auth-fixture.sql',import.meta.url),'utf8'));
  const directory=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(directory)).filter(x=>x.endsWith('.sql') && x<'20261014120000').sort()) await legacy.exec(await readFile(new URL(name,directory),'utf8'));
  await legacy.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)',[admin,{username:'LegacyAdmin'}]);
  const run=(sql,params=[])=>asUser(legacy,admin,t=>t.query(sql,params));
  const legacyClub=(await run("select * from public.create_club('Legacy Club')")).rows[0];
  const positions=['POR','DFC','LI','LD','MCD','MC','MCO','MI','MD','EI','ED','DC'];
  for(const [i,position] of positions.entries()) await run('insert into public.players(club_id,ea_id,jersey_number,position) values ($1,$2,$3,$4)',[legacyClub.id,`Legacy${position}`,i+1,position]);
  const ownerPlayer=(await run("select id from public.players where ea_id='LegacyPOR'")).rows[0];
  await run('select * from public.link_player_account($1,$2)',[ownerPlayer.id,admin]);
  const call=(await run("select * from public.create_call_up($1,'2027-06-01T21:00:00Z','open')",[legacyClub.id])).rows[0];
  const ownEntry=(await run('select id from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,admin])).rows[0];
  await run("select * from public.respond_to_call_up($1,'available')",[ownEntry.id]);
  await run("select * from public.update_call_up($1,'2027-06-01T21:00:00Z','closed')",[call.id]);
  const before=(await run('select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows;
  await run("update public.players set position='DC' where ea_id='LegacyPOR'");
  await legacy.exec(await readFile(new URL('20261014120000_roster_categories_trials.sql',directory),'utf8'));
  const after=(await run('select * from public.call_up_players where call_up_id=$1 order by id',[call.id])).rows;
  for(const [i,old] of before.entries()) for(const key of Object.keys(old)) assert.deepEqual(after[i][key],old[key]);
  assert.equal(after.find(x=>x.ea_id_snapshot==='LegacyPOR').category_snapshot,'goalkeepers');
  assert.equal(after.find(x=>x.ea_id_snapshot==='LegacyPOR').availability,'available');
  assert.equal((await run("select category from public.players where ea_id='LegacyPOR'")).rows[0].category,'attackers');
  const expected={POR:'attackers',DFC:'centre_backs',LI:'wide_backs',LD:'wide_backs',MCD:'midfielders',MC:'midfielders',MCO:'midfielders',MI:'midfielders',MD:'midfielders',EI:'attackers',ED:'attackers',DC:'attackers'};
  for(const [position,category] of Object.entries(expected)) assert.equal((await run('select category from public.players where ea_id=$1',[`Legacy${position}`])).rows[0].category,category);
  assert.equal((await run("select * from public.players where category='backups'")).rows.length,0);
  assert.equal((await run('select * from public.call_up_trials')).rows.length,0);
 }finally{await legacy.close();}
});
