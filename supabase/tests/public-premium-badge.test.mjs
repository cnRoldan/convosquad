import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';
const owner='86000000-0000-4000-8000-000000000001';
let db,club;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
before(async()=>{
 db=await createTestDatabase();
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[owner,{username:'BadgeCaptain'}]);
 club=(await query(owner,"select * from public.create_club('Premium badge club',null,'UTC',true)")).rows[0];
});
after(async()=>db?.close());
test('public badge reflects active Premium and never exposes private clubs',async()=>{
 const search=async()=>asUser(db,null,tx=>tx.query("select * from public.search_clubs('Premium badge')"),'anon');
 assert.equal((await search()).rows[0].is_premium,false);
 await db.query("insert into public.club_feature_entitlements(club_id,lineup_premium_until) values($1,'infinity')",[club.id]);
 assert.equal((await search()).rows[0].is_premium,true);
 await db.query("update public.club_feature_entitlements set lineup_premium_until=clock_timestamp()-interval '1 second' where club_id=$1",[club.id]);
 assert.equal((await search()).rows[0].is_premium,false);
 await query(owner,'update public.clubs set is_public=false where id=$1',[club.id]);
 assert.equal((await search()).rows.length,0);
});
