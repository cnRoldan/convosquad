import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const admin='80000000-0000-4000-8000-000000000001', member='80000000-0000-4000-8000-000000000002', other='80000000-0000-4000-8000-000000000003';
const d1='80000000-0000-4000-8000-000000000101',d2='80000000-0000-4000-8000-000000000102',d3='80000000-0000-4000-8000-000000000103';
let db,club,foreign,call,entry;
const query=(actor,sql,params=[])=>asUser(db,actor,tx=>tx.query(sql,params));
const row=async(...args)=>(await query(...args)).rows[0];
const server=(sql,params=[])=>db.transaction(async tx=>{await tx.exec('set local role service_role');return tx.query(sql,params);});
const register=(user,id,token)=>query(user,"select public.register_push_device($1,$2,'android')",[id,`ExpoPushToken[${token}]`]);
before(async()=>{
 db=await createTestDatabase();for(const [id,username]of [[admin,'PushAdmin'],[member,'PushMember'],[other,'PushOther']])await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)',[id,{username}]);
 club=await row(admin,"select * from public.create_club('Push Club',null,'Europe/Madrid',true)");foreign=await row(other,"select * from public.create_club('Push Foreign')");
 const request=await row(member,'select * from public.request_to_join($1)',[club.id]);await query(admin,'select * from public.review_join_request($1,true)',[request.id]);
 const player=await row(admin,"insert into public.players(club_id,ea_id,category) values ($1,'PushMember','backups') returning *",[club.id]);await query(admin,'select * from public.link_player_account($1,$2)',[player.id,member]);
 call=await row(admin,"select * from public.create_call_up($1,'2035-09-01T20:00:00Z','open')",[club.id]);entry=await row(member,'select id from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,member]);
});after(async()=>{await db?.close();});
test('registro actualiza token/plataforma/fecha y permite varios dispositivos por usuario',async()=>{
 await register(member,d1,'first_unit');await register(member,d2,'second_unit');const before=await row(member,'select * from public.push_devices where device_id=$1',[d1]);
 await query(member,"select public.register_push_device($1,'ExpoPushToken[rotated_unit]','ios')",[d1]);const after=await row(member,'select * from public.push_devices where device_id=$1',[d1]);
 assert.equal(after.user_id,member);assert.equal(after.expo_push_token,'ExpoPushToken[rotated_unit]');assert.equal(after.platform,'ios');assert.ok(after.updated_at>=before.updated_at);assert.equal(after.is_active,true);
 assert.equal((await query(member,'select * from public.push_devices where is_active')).rows.length,2);
});
test('RLS y RPC impiden leer/registrar/desactivar dispositivos ajenos, falsificar propietario o enviar',async()=>{
 assert.equal((await query(other,'select * from public.push_devices')).rows.length,0);assert.equal((await query(admin,'select * from public.push_devices')).rows.length,0);
 for(const sql of ["select public.register_push_device($1,'ExpoPushToken[stolen_unit]','android')",'select public.deactivate_push_device($1,true)'])await assert.rejects(query(other,sql,[d1]),e=>e.code==='42501');
 await assert.rejects(register(other,d3,'rotated_unit'),e=>e.code==='42501');
 await assert.rejects(query(member,'update public.push_devices set user_id=$1 where device_id=$2',[other,d1]),e=>e.code==='42501');
 await assert.rejects(query(member,"select public.register_push_device($1,'not-an-expo-token','android')",[d1]),e=>e.code==='22023');
 for(const user of [admin,member,other]){
  await assert.rejects(query(user,"select public.prepare_call_up_push($1,$2,'forged','published')",[club.id,call.id]),e=>e.code==='42501');
  await assert.rejects(query(user,'select * from public.push_deliveries'),e=>e.code==='42501');
 }
 await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.push_devices'),'anon'),e=>e.code==='42501');
});
test('reutilizar token propio no duplica dispositivos activos',async()=>{
 await register(member,d3,'second_unit');assert.equal((await row(member,'select * from public.push_devices where device_id=$1',[d2])).is_active,false);
 assert.equal((await query(member,"select * from public.push_devices where expo_push_token='ExpoPushToken[second_unit]' and is_active")).rows.length,1);
});
test('eventos idempotentes y entregas únicas por dispositivo; sin destinatarios de otro club',async()=>{
 await register(other,'80000000-0000-4000-8000-000000000104','foreign_unit');
 const invoke=()=>server("select public.prepare_call_up_push($1,$2,'published:once','published') as id",[club.id,call.id]);const first=(await invoke()).rows[0].id;const again=(await invoke()).rows[0].id;assert.equal(first,again);
 const deliveries=(await server('select * from public.push_deliveries where event_id=$1',[first])).rows;assert.equal(deliveries.length,2);assert.ok(deliveries.every(d=>d.user_id===member && d.club_id===club.id));
 await assert.rejects(server("select public.prepare_call_up_push($1,$2,'published:once','pending')",[club.id,call.id]),e=>e.code==='22023');
 await assert.rejects(server("select public.prepare_call_up_push($1,$2,'foreign','published')",[foreign.id,call.id]),e=>e.code==='22023');
 const claimed=(await server('select * from public.claim_push_deliveries($1)',[first])).rows;assert.equal(claimed.length,2);assert.ok(claimed.every(x=>x.state==='processing'));
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[first])).rows.length,0);
});
test('rechazo de permiso/desactivación y logout limpian token y evitan envíos ya preparados',async()=>{
 const event=(await server("select public.prepare_call_up_push($1,$2,'pending:logout','pending') as id",[club.id,call.id])).rows[0].id;
 await query(member,'select public.deactivate_push_device($1,false)',[d1]);const disabled=await row(member,'select * from public.push_devices where device_id=$1',[d1]);assert.equal(disabled.is_active,false);assert.equal(disabled.expo_push_token,null);assert.equal(disabled.user_id,member);
 await query(member,'select public.deactivate_push_device($1,true)',[d3]);await query(member,'select public.deactivate_push_device($1,true)',[d3]);
 assert.equal((await query(member,'select * from public.push_devices where device_id=$1',[d3])).rows.length,0);
 assert.equal((await server('select * from public.claim_push_deliveries($1)',[event])).rows.length,0);
 assert.ok((await server('select * from public.push_deliveries where event_id=$1',[event])).rows.every(x=>x.state==='skipped'));
 await register(other,d3,'new_owner_unit');assert.equal((await row(other,'select user_id from public.push_devices where device_id=$1',[d3])).user_id,other);
});
test('pendientes, cambios de token, revocación de membresía y cancelación se revalidan al reservar',async()=>{
 await register(member,d1,'revalidation_unit');const event=(await server("select public.prepare_call_up_push($1,$2,'pending:answered','pending') as id",[club.id,call.id])).rows[0].id;
 await query(member,"select * from public.respond_to_call_up($1,'available')",[entry.id]);assert.equal((await server('select * from public.claim_push_deliveries($1)',[event])).rows.length,0);
 const answered=(await server("select public.prepare_call_up_push($1,$2,'pending:empty','pending') as id",[club.id,call.id])).rows[0].id;assert.equal((await server('select * from public.push_deliveries where event_id=$1',[answered])).rows.length,0);
 const rotated=(await server("select public.prepare_call_up_push($1,$2,'published:rotated','published') as id",[club.id,call.id])).rows[0].id;await register(member,d1,'new_token_unit');assert.equal((await server('select * from public.claim_push_deliveries($1)',[rotated])).rows.length,0);
 const revoked=(await server("select public.prepare_call_up_push($1,$2,'published:revoked','published') as id",[club.id,call.id])).rows[0].id;await query(admin,"select * from public.set_club_member($1,$2,'player',false)",[club.id,member]);assert.equal((await server('select * from public.claim_push_deliveries($1)',[revoked])).rows.length,0);
 await query(admin,"select * from public.update_call_up($1,$2,'cancelled')",[call.id,call.starts_at]);await assert.rejects(server("select public.prepare_call_up_push($1,$2,'cancelled','published')",[club.id,call.id]),e=>e.code==='22023');
});
