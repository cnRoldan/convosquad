import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { asUser, createTestDatabase } from '../../scripts/database-test-utils.mjs';
const captain='92000000-0000-4000-8000-000000000001',member='92000000-0000-4000-8000-000000000002';
let db,club;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
before(async()=>{
 db=await createTestDatabase();
 for(const [id,name] of [[captain,'GoogleBillingCaptain'],[member,'GoogleBillingMember']]) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:name}]);
 club=(await query(captain,"select * from public.create_club('Google billing club')")).rows[0];
 await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player')",[club.id,member]);
});
after(async()=>db?.close());
test('Google base-plan identifiers match purchase intents and renewal transactions',async()=>{
 for(const period of ['monthly','yearly']) {
  const product=`com.convosquad.premium.${period}`;
  await query(captain,'select public.begin_club_purchase($1,$2)',[club.id,`${product}:${period}`]);
  const apply=async(id,expiry)=>(await db.query('select public.apply_revenuecat_event($1,$1,$2,$3,\'PLAY_STORE\',$4,$5) event',[captain,id,`google-${period}`,'INITIAL_PURCHASE',expiry])).rows[0].event;
  assert.equal((await apply(`${product}:${period}`,'2035-01-01T00:00:00Z')).applied,true);
  assert.equal((await apply(product,'2035-02-01T00:00:00Z')).applied,true);
  const stored=(await db.query('select product_id,club_id from public.club_store_purchases where original_transaction_id=$1',[`google-${period}`])).rows[0];
  assert.equal(stored.product_id,product);assert.equal(stored.club_id,club.id);
 }
});
test('unsupported products and malformed suffixes never grant access',async()=>{
 for(const product of ['foreign.monthly:monthly','com.convosquad.premium.monthly:','com.convosquad.premium.monthly:monthly:extra']) {
  await assert.rejects(query(captain,'select public.begin_club_purchase($1,$2)',[club.id,product]),{code:'22023'});
  const result=(await db.query('select public.apply_revenuecat_event($1,$1,$2,\'unsupported\',\'PLAY_STORE\',\'INITIAL_PURCHASE\',now()) event',[captain,product])).rows[0].event;
  assert.deepEqual(result,{applied:false,reason:'unsupported_product'});
 }
});
test('normalization preserves captain-only intents and server-only payment verification',async()=>{
 await assert.rejects(query(member,"select public.begin_club_purchase($1,'com.convosquad.premium.monthly:monthly')",[club.id]),{code:'42501'});
 await assert.rejects(query(captain,"select public.apply_revenuecat_event($1,$1,'com.convosquad.premium.monthly:monthly','forged','PLAY_STORE','INITIAL_PURCHASE',now())",[captain]),{code:'42501'});
 await assert.rejects(query(captain,"select private.begin_club_purchase_before_google_plans($1,'com.convosquad.premium.monthly')",[club.id]),{code:'42501'});
});
