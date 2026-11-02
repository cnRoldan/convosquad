import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const captain='84000000-0000-4000-8000-000000000001';
const outsider='84000000-0000-4000-8000-000000000002';
let db,club;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
before(async()=>{
 db=await createTestDatabase();
 for(const [id,username] of [[captain,'KitCaptain'],[outsider,'KitOutsider']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username}]);
 club=(await query(captain,"select * from public.create_club('Kit colors')")).rows[0];
});
after(async()=>db?.close());
test('goalkeeper color is validated, stored and preserved by older app clients',async()=>{
 const read=async()=>(await query(captain,'select public.read_lineup_preference($1) value',[club.id])).rows[0].value;
 assert.equal((await read()).goalkeeperColor,'#F4A83A');
 await assert.rejects(query(outsider,"select public.set_lineup_kit_colors($1,'#4C000B','#B3FF61','#FFFFFF')",[club.id]),{code:'42501'});
 await query(captain,"select public.set_lineup_kit_colors($1,'#4c000b','#b3ff61','#ff9900')",[club.id]);
 assert.equal((await read()).goalkeeperColor,'#FF9900');
 await assert.rejects(query(captain,"select public.set_lineup_kit_colors($1,'#000000','#FFFFFF','invalid')",[club.id]),{code:'22023'});
 await assert.rejects(query(captain,"select public.set_lineup_kit_colors($1,'invalid','#FFFFFF','#000000')",[club.id]),{code:'22023'});
 assert.equal((await read()).playerColor,'#4C000B');
 await query(captain,"select public.set_lineup_player_colors($1,'#000000','#FFFFFF')",[club.id]);
 assert.equal((await read()).goalkeeperColor,'#FF9900');
});
