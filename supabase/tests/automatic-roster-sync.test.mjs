import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';
const [owner, member, outsider] = [81,82,83].map(i => `30000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
let db, club, open, closed, past, original;
const row = async (user, sql, args=[]) => (await asUser(db,user,tx=>tx.query(sql,args))).rows[0];
const add = (user,name,category='midfielders') => row(user,'select * from public.add_or_restore_player($1,$2,$3)',[club.id,name,category]);
const snapshot = async (call,player) => (await db.query('select * from public.call_up_players where call_up_id=$1 and source_player_id=$2',[call.id,player.id])).rows[0];
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [owner,member,outsider].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`AutoSync${i}`}]);
 club=await row(owner,"select * from public.create_club('Sync',null,'UTC')");
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,member]);
 original=await add(owner,'Original');
 await row(owner,'select * from public.link_player_account($1,$2)',[original.id,owner]);
 past=await row(owner,"select * from public.create_call_up($1,'2020-01-01T20:00Z','open')",[club.id]);
 closed=await row(owner,"select * from public.create_call_up($1,'2030-01-02T20:00Z','open')",[club.id]);
 await row(owner,"select * from public.update_call_up($1,$2,'closed')",[closed.id,closed.starts_at]);
 open=await row(owner,"select * from public.create_call_up($1,'2030-01-01T20:00Z','open')",[club.id]);
 const s=await snapshot(open,original);
 await row(owner,"select * from public.respond_to_call_up($1,'available')",[s.id]);
});
after(async()=>{await db?.close();});
test('alta entra automáticamente sin voto y conserva respuestas e historial',async()=>{
 const vote=await snapshot(open,original), old=await snapshot(closed,original);
 const player=await add(owner,'Nuevo');
 assert.equal((await snapshot(open,player)).availability,'unanswered');
 assert.equal((await snapshot(open,player)).responded_at,null);
 assert.deepEqual(await snapshot(open,original),vote);
 assert.deepEqual(await snapshot(closed,original),old);
 assert.equal(await snapshot(closed,player),undefined);assert.equal(await snapshot(past,player),undefined);
});
test('vincular después del alta permite votar sin refrescar ni recrear la convocatoria',async()=>{
 const p=await add(owner,'Votante');
 await row(owner,'select * from public.link_player_account($1,$2)',[p.id,member]);
 const entry=await snapshot(open,p); assert.equal(entry.user_id,member);
 assert.equal((await row(member,"select * from public.respond_to_call_up($1,'backup')",[entry.id])).availability,'backup');
});
test('reincorporar por nombre conserva identidad y cuenta sin duplicar fichas ni votos ajenos',async()=>{
 const player=await add(owner,'Reincorporado');
 await row(owner,'update public.players set is_active=false where id=$1 returning *',[player.id]);
 const again=await add(owner,'  reincorporado  ','attackers');
 assert.equal(again.id,player.id);assert.equal(again.is_active,true);assert.equal(again.category,'attackers');
 assert.equal((await db.query('select count(*)::int n from public.call_up_players where call_up_id=$1 and source_player_id=$2',[open.id,player.id])).rows[0].n,1);
 await assert.rejects(add(owner,'REINCORPORADO'),{code:'P0041'});
});
test('reactivar ficha ausente añade candidato; el límite de votación sigue vigente',async()=>{
 const p=await add(owner,'Ausente');
 await row(owner,'update public.players set is_active=false where id=$1 returning *',[p.id]);
 await db.query('delete from public.call_up_players where call_up_id=$1 and source_player_id=$2',[open.id,p.id]);
 await row(owner,'update public.players set is_active=true where id=$1 returning *',[p.id]);
 assert.equal((await snapshot(open,p)).availability,'unanswered');
 const starts=new Date(Date.now()+3600000).toISOString();
 const deadline=new Date(Date.now()+1000).toISOString();
 const expiring=await row(owner,"select * from public.create_call_up_with_schedule($1,$2,null,'open',$3)",[club.id,starts,deadline]);
 await new Promise(resolve=>setTimeout(resolve,1100));
 // A late entry is present, but cannot bypass the deadline when responding.
 await db.query('update public.players set user_id=null where id=$1',[original.id]);
 await row(owner,'select * from public.link_player_account($1,$2)',[p.id,owner]);
 const entry=await snapshot(expiring,p);
 await assert.rejects(row(owner,"select * from public.respond_to_call_up($1,'available')",[entry.id]),{code:'P0031'});
});
test('altas y recuperación reservadas al capitán, también con RPC directa',async()=>{
 for(const u of [member,outsider]) await assert.rejects(add(u,'No autorizado'),{code:'42501'});
 await assert.rejects(asUser(db,null,tx=>tx.query('select * from public.add_or_restore_player($1,$2,$3)',[club.id,'Anon','midfielders']),'anon'),{code:'42501'});
});
