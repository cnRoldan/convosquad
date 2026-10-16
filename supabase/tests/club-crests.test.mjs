import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,player,other]=[1,2,3].map(n=>`75000000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club,foreign;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const row=async(...args)=>(await query(...args)).rows[0];
before(async()=>{
 db=await createTestDatabase();
 for(const [i,id] of [captain,player,other].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Crest_${i}`}]);
 club=await row(captain,"select * from public.create_club('Crest Club')");
 foreign=await row(other,"select * from public.create_club('Foreign Crest Club')");
 await db.query('insert into public.club_members(club_id,user_id) values($1,$2)',[club.id,player]);
});
after(async()=>{await db?.close();});
test('bucket privado admite PNG limitado y el capitán vincula solo un escudo subido de su club',async()=>{
 const bucket=(await db.query("select * from storage.buckets where id='club-crests'")).rows[0];
 assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/png']);
 await assert.rejects(query(captain,'select public.set_club_crest($1,true)',[club.id]),e=>e.code==='22023');
 await query(captain,"insert into storage.objects(bucket_id,name) values('club-crests',$1)",[`${club.id}/crest.png`]);
 assert.equal((await row(captain,'select * from public.set_club_crest($1,true)',[club.id])).crest_path,`${club.id}/crest.png`);
 await assert.rejects(query(captain,'update public.clubs set crest_path=$1 where id=$2',[`${foreign.id}/crest.png`,club.id]),e=>e.code==='42501');
});
test('miembros pueden leer; jugadores, otros clubes y anónimos no suben ni cambian escudos',async()=>{
 assert.equal((await query(player,"select * from storage.objects where bucket_id='club-crests'")).rows.length,1);
 assert.equal((await query(other,"select * from storage.objects where bucket_id='club-crests'")).rows.length,0);
 for(const user of [player,other]){
  await assert.rejects(query(user,"insert into storage.objects(bucket_id,name) values('club-crests',$1)",[`${club.id}/crest.png`]),e=>e.code==='42501');
  await assert.rejects(query(user,'select public.set_club_crest($1,false)',[club.id]),e=>e.code==='42501');
  assert.equal((await query(user,"delete from storage.objects where name=$1 returning *",[`${club.id}/crest.png`])).rows.length,0);
 }
 await assert.rejects(asUser(db,null,tx=>tx.query("select * from storage.objects where bucket_id='club-crests'"),'anon'),e=>e.code==='42501');
 await assert.rejects(query(captain,"insert into storage.objects(bucket_id,name) values('club-crests',$1)",[`${club.id}/other.svg`]),e=>e.code==='42501');
});
test('retirar escudo conserva club, plantilla y posibilidad de volver a subir',async()=>{
 const result=await row(captain,'select * from public.set_club_crest($1,false)',[club.id]);
 assert.equal(result.crest_path,null);assert.equal(result.name,'Crest Club');
 assert.equal((await query(captain,'delete from storage.objects where name=$1 returning *',[`${club.id}/crest.png`])).rows.length,1);
});
