import assert from 'node:assert/strict';
import { before,after,test } from 'node:test';
import { createTestDatabase,asUser } from '../../scripts/database-test-utils.mjs';

const [admin,member,observer,outsider]=[1,2,3,4].map(n=>`7d000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,call,entry,player;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const first=async(...args)=>(await query(...args)).rows[0];
const create=day=>first(admin,"select * from public.create_call_up($1,$2,'open')",[club.id,`2039-01-${day}T20:00:00Z`]);
const lock=enabled=>query(member,'select public.set_club_decision_lock($1,$2,$3)',[club.id,enabled,entry.id]);
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [admin,member,observer,outsider].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`VisibleLock_${i}`}]);
 club=await first(admin,"select * from public.create_club('Visible locks')");
 for(const id of [member,observer])await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,id]);
 player=await first(admin,"insert into public.players(club_id,ea_id,category) values($1,'Locked player','midfielders') returning *",[club.id]);
 await query(admin,'select public.link_player_account($1,$2)',[player.id,member]);
 call=await create('01');entry=await first(member,'select * from public.call_up_players where call_up_id=$1',[call.id]);
});
after(async()=>{await db?.close();});

test('el club ve el indicador, la preferencia sigue privada y no se puede falsificar el candado',async()=>{
 assert.equal(entry.decision_locked,false);
 await query(member,"select public.respond_to_call_up($1,'available')",[entry.id]);await lock(true);
 for(const user of [admin,member,observer])assert.equal((await first(user,'select decision_locked from public.call_up_players where id=$1',[entry.id])).decision_locked,true);
 for(const user of [admin,observer])assert.equal((await query(user,'select * from public.club_decision_locks')).rows.length,0);
 assert.equal((await query(outsider,'select * from public.call_up_players where id=$1',[entry.id])).rows.length,0);
 await assert.rejects(query(member,'update public.call_up_players set decision_locked=false where id=$1',[entry.id]),e=>e.code==='42501');
 await assert.rejects(asUser(db,null,tx=>tx.query('select decision_locked from public.call_up_players'),'anon'),e=>e.code==='42501');
});

test('nuevas convocatorias y cambios manuales conservan el indicador; quitarlo no cambia votos ni crea avisos',async()=>{
 const next=await create('02');
 let auto=await first(observer,'select * from public.call_up_players where call_up_id=$1',[next.id]);
 assert.equal(auto.decision_locked,true);assert.equal(auto.auto_response,true);
 await query(member,"select public.respond_to_call_up($1,'unavailable')",[auto.id]);
 auto=await first(observer,'select * from public.call_up_players where id=$1',[auto.id]);
 assert.equal(auto.decision_locked,true);assert.equal(auto.auto_response,false);
 const before=(await db.query('select id,availability,responded_at from public.call_up_players order by id')).rows;
 const events=(await db.query('select count(*)::integer n from public.push_events')).rows[0].n;
 await lock(false);
 assert.ok((await query(observer,'select decision_locked from public.call_up_players')).rows.every(row=>!row.decision_locked));
 assert.deepEqual((await db.query('select id,availability,responded_at from public.call_up_players order by id')).rows,before);
 assert.equal((await db.query('select count(*)::integer n from public.push_events')).rows[0].n,events);
});

test('desvincular al jugador retira el candado de todas las convocatorias',async()=>{
 await lock(true);
 await db.query('update public.players set user_id=null where id=$1',[player.id]);
 assert.equal((await db.query('select * from public.club_decision_locks')).rows.length,0);
 assert.ok((await query(observer,'select decision_locked from public.call_up_players')).rows.every(row=>!row.decision_locked));
 const next=await create('03');assert.equal((await first(observer,'select decision_locked from public.call_up_players where call_up_id=$1',[next.id])).decision_locked,false);
});
