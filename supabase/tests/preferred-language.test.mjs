import assert from 'node:assert/strict';import {before,after,test} from 'node:test';
import {createTestDatabase,asUser} from '../../scripts/database-test-utils.mjs';
const one='78000000-0000-4000-8000-000000000001',two='78000000-0000-4000-8000-000000000002';let db;
before(async()=>{db=await createTestDatabase();for(const [i,id] of [one,two].entries())await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`Language_${i}`}]);});after(async()=>{await db?.close();});
test('usuario guarda únicamente su idioma; no puede actualizar otros perfiles ni usar valores inválidos',async()=>{
 await asUser(db,one,tx=>tx.query("select public.set_preferred_language('de')"));
 const profiles=(await db.query('select id,preferred_language from public.profiles order by id')).rows;
 assert.equal(profiles[0].preferred_language,'de');assert.equal(profiles[1].preferred_language,null);
 await assert.rejects(asUser(db,one,tx=>tx.query("update public.profiles set preferred_language='fr' where id=$1",[two])),e=>e.code==='42501');
 await assert.rejects(asUser(db,one,tx=>tx.query("select public.set_preferred_language('xx')")),e=>e.code==='22023');
 await assert.rejects(asUser(db,null,tx=>tx.query("select public.set_preferred_language('en')"),'anon'),e=>e.code==='42501');
});
