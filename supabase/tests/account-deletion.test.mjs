import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,member,other,solo]=[1,2,3,4].map(n=>`7d000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,soloClub,player,otherPlayer,entry,call,trial;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
const remove=(user,confirmation,age=0,method='password')=>asUser(db,user,async tx=>{
 await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:user,amr:[{method,timestamp:Math.floor(Date.now()/1000)-age}]})]);
 return tx.query('select public.delete_my_account($1)',[confirmation]);
});
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [captain,member,other,solo].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`DeleteAccount_${i}`}]);
 club=await row(captain,"select * from public.create_club('Shared club')");
 soloClub=await row(solo,"select * from public.create_club('Solo club')");
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player'),($1,$3,'admin')",[club.id,member,other]);
 player=await row(captain,"insert into public.players(club_id,ea_id,category) values($1,'DeleteAccount_1','midfielders') returning *",[club.id]);
 otherPlayer=await row(captain,"insert into public.players(club_id,ea_id,category) values($1,'DeleteAccount_2','midfielders') returning *",[club.id]);
 await query(captain,'select public.link_player_account($1,$2)',[player.id,member]);
 await query(captain,'select public.link_player_account($1,$2)',[otherPlayer.id,other]);
 trial=(await db.query("insert into public.club_trials(club_id,ea_id,player_id,status,incorporated_at,notes) values($1,'Old trial name',$2,'incorporated',now(),'Private note') returning *",[club.id,player.id])).rows[0];
 await db.query("insert into public.club_trial_contacts(club_id,trial_id,phone) values($1,$2,'+34600000000')",[club.id,trial.id]);
 call=await row(captain,"select * from public.create_call_up($1,now()+interval '1 day','open')",[club.id]);
 // Include an archived trial snapshot even though the trial is incorporated now.
 await db.query("insert into public.call_up_trials(club_id,call_up_id,source_trial_id,ea_id_snapshot,sort_order_snapshot,trial_created_at) values($1,$2,$3,'Old trial name',0,now())",[club.id,call.id,trial.id]);
 entry=await row(captain,'select * from public.call_up_players where call_up_id=$1 and user_id=$2',[call.id,member]);
 await query(member,"select public.register_push_device('7d000000-1111-4000-8000-000000000001','ExpoPushToken[DeleteAccount]','android')");
 await query(other,"select public.register_push_device('7d000000-1111-4000-8000-000000000002','ExpoPushToken[OtherAccount]','android')");
 await query(member,'select public.set_notification_preferences(true)');
 await query(member,"select public.respond_from_notification($1,$2,'available','delete-test-response')",[club.id,call.id]);
 await query(member,'select public.set_club_decision_lock($1,true,$2)',[club.id,entry.id]);
 await db.query("insert into public.player_ratings(call_up_player_id,club_id,call_up_id,player_id,player_name,score,rated_by) values($1,$2,$3,$4,'DeleteAccount_1',8,$5)",[entry.id,club.id,call.id,player.id,captain]);
 await query(captain,"select * from public.update_call_up($1,$2,'closed')",[call.id,call.starts_at]);
 await db.query("insert into public.push_deliveries(event_id,club_id,device_id,user_id,token_snapshot) select id,club_id,'7d000000-1111-4000-8000-000000000001',$1,'ExpoPushToken[DeleteAccount]' from public.push_events where call_up_id=$2 and kind='published'",[member,call.id]);
 await db.query("insert into auth.refresh_tokens(user_id) values($1)",[member]);
 await db.query("insert into auth.flow_state(user_id) values($1)",[member]);
 await db.query("insert into auth.sessions(user_id) values($1)",[member]);
 await db.query("insert into storage.objects(bucket_id,name,owner,owner_id) values('club-crests',$1,$2,$3)",[`${club.id}/crest.png`,captain,captain]);
});
after(async()=>await db?.close());
test('rechaza anónimos, ID ajeno, sesión antigua o sin contraseña sin borrar datos',async()=>{
 await assert.rejects(asUser(db,null,tx=>tx.query("select public.delete_my_account('DeleteAccount_1')"),'anon'),e=>e.code==='42501');
 await assert.rejects(remove(member,'DeleteAccount_2'),e=>e.code==='P4001');
 await assert.rejects(remove(member,'DeleteAccount_1',600),e=>e.code==='P4003');
 await assert.rejects(remove(member,'DeleteAccount_1',0,'token_refresh'),e=>e.code==='P4003');
 await assert.rejects(query(member,"select public.delete_my_account('DeleteAccount_1')"),e=>e.code==='P4003');
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,4);
});
test('último capitán no puede borrar su cuenta y solo ve sus clubes bloqueantes',async()=>{
 assert.deepEqual((await query(solo,'select * from public.account_deletion_blockers()')).rows,[{club_id:soloClub.id,club_name:soloClub.name}]);
 assert.deepEqual((await query(member,'select * from public.account_deletion_blockers()')).rows,[]);
 await assert.rejects(remove(solo,'DeleteAccount_3'),e=>e.code==='P4002');
 assert.equal((await db.query('select count(*)::int n from public.clubs where id=$1',[soloClub.id])).rows[0].n,1);
});
test('borra cuenta y copias vinculadas incluso cerradas; conserva datos de otros jugadores',async()=>{
 await remove(member,' deleteaccount_1 ');
 for(const [table,column,id] of [
  ['auth.users','id',member],['auth.sessions','user_id',member],['auth.refresh_tokens','user_id',member],['auth.flow_state','user_id',member],
  ['public.profiles','id',member],['public.club_members','user_id',member],['public.players','id',player.id],['public.call_up_players','id',entry.id],
  ['public.player_ratings','player_id',player.id],['public.club_decision_locks','user_id',member],['public.notification_preferences','user_id',member],
  ['public.push_devices','user_id',member],['public.push_deliveries','user_id',member],['public.push_events','actor_user_id',member],
  ['private.push_response_actions','user_id',member],['public.club_trials','id',trial.id],['public.call_up_trials','source_trial_id',trial.id],
  ['public.club_trial_contacts','trial_id',trial.id],['public.club_trial_notes','trial_id',trial.id],
 ]) assert.equal((await db.query(`select count(*)::int n from ${table} where ${column}=$1`,[id])).rows[0].n,0,table);
 assert.equal((await db.query("select count(*)::int n from public.push_deliveries where token_snapshot='ExpoPushToken[DeleteAccount]'")).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.call_up_contacts')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.call_up_trial_notes')).rows[0].n,0);
 assert.equal((await db.query('select count(*)::int n from public.players where id=$1',[otherPlayer.id])).rows[0].n,1);
 assert.equal((await row(other,'select * from public.call_ups where id=$1',[call.id])).status,'closed');
 await assert.rejects(remove(member,'DeleteAccount_1'),e=>e.code==='42501');
 assert.equal((await row(other,'select public.is_ea_id_available($1) available',['DeleteAccount_1'])).available,true);
});
test('borrar al creador transfiere sus controles al capitán restante y conserva el escudo sin su identidad',async()=>{
 await remove(captain,'DeleteAccount_0');
 assert.equal((await row(other,'select * from public.clubs where id=$1',[club.id])).created_by,other);
 assert.deepEqual((await db.query('select owner,owner_id from storage.objects')).rows,[{owner:null,owner_id:null}]);
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,2);
 await query(other,'select public.delete_club($1)',[club.id]);
 assert.equal((await db.query('select count(*)::int n from public.clubs where id=$1',[club.id])).rows[0].n,0);
});
