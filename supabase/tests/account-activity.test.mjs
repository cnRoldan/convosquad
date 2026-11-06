import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createTestDatabase, asUser } from '../../scripts/database-test-utils.mjs';
const [captain,member,outsider,orphan,linkedOnly]=[1,2,3,4,5].map(n=>`99070000-0000-4000-8000-${String(n).padStart(12,'0')}`);
let db,club;
const query=(user,sql,args=[])=>asUser(db,user,tx=>tx.query(sql,args));
const age=(user,interval)=>db.query('update private.account_activity set last_active_at=now()-$2::interval where user_id=$1',[user,interval]);
const stage=user=>db.query('select stage from private.account_inactivity_review where user_id=$1',[user]).then(r=>r.rows[0].stage);
before(async()=>{
  db=await createTestDatabase();
  for(const [i,id] of [captain,member,outsider,orphan,linkedOnly].entries()) await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id,{username:`ActivityUser${i}`}]);
  club=(await query(captain,"select * from public.create_club('Activity club')")).rows[0];
  await db.query("insert into public.club_members(club_id,user_id,role) values($1,$2,'player'),($1,$3,'player')",[club.id,member,linkedOnly]);
  await db.query("insert into public.players(club_id,user_id,ea_id,category,is_active) values($1,$2,'Linked inactive','midfielders',false)",[club.id,linkedOnly]);
});
after(async()=>db?.close());

test('new accounts start with a known activity baseline and only their own foreground RPC can update it',async()=>{
  assert.equal((await db.query('select count(*) from private.account_activity')).rows[0].count,5);
  assert.equal(await stage(orphan),'active');
  await age(member,'7 months');await age(outsider,'7 months');
  await query(member,'select public.record_account_activity()');
  assert.equal(await stage(member),'active');assert.equal(await stage(outsider),'orphan_review_due');
  await age(member,'5 minutes');
  const before=(await db.query('select last_active_at from private.account_activity where user_id=$1',[member])).rows[0].last_active_at;
  await query(member,'select public.record_account_activity()');
  assert.equal((await db.query('select last_active_at from private.account_activity where user_id=$1',[member])).rows[0].last_active_at.getTime(),before.getTime());
  await assert.rejects(query(null,'select public.record_account_activity()'),{code:'42501'});
  await assert.rejects(query(member,'select * from private.account_activity'),{code:'42501'});
  await assert.rejects(query(member,'select * from private.account_inactivity_review'),{code:'42501'});
});

test('orphan accounts reach warning at sixty days and review at ninety, while linked accounts are protected',async()=>{
  for(const [interval,expected] of [['59 days','active'],['60 days','orphan_warning_due'],['89 days','orphan_warning_due'],['90 days','orphan_review_due']]){
    await age(orphan,interval);assert.equal(await stage(orphan),expected);
  }
  await age(member,'100 days');assert.equal(await stage(member),'active');
  await db.query('update public.club_members set is_active=false where club_id=$1 and user_id=$2',[club.id,linkedOnly]);
  await age(linkedOnly,'100 days');assert.equal(await stage(linkedOnly),'active');
  await age(linkedOnly,'7 months');assert.equal(await stage(linkedOnly),'member_review_due');
  // Detection alone never deletes any account or deactivates an active member.
  assert.equal((await db.query('select count(*) from auth.users')).rows[0].count,5);
});

test('captains only see inactive active memberships in their own club, with last-captain protection',async()=>{
  await age(member,'6 months');await age(captain,'7 months');
  const rows=(await query(captain,'select * from public.list_inactive_club_members($1)',[club.id])).rows;
  assert.deepEqual(new Set(rows.map(r=>r.user_id)),new Set([captain,member]));
  assert.equal(rows.find(r=>r.user_id===captain).sole_captain,true);
  assert.equal(rows.find(r=>r.user_id===member).sole_captain,false);
  for(const user of [member,outsider])await assert.rejects(query(user,'select * from public.list_inactive_club_members($1)',[club.id]),{code:'42501'});
  await query(member,'select public.record_account_activity()');
  assert.ok(!(await query(captain,'select * from public.list_inactive_club_members($1)',[club.id])).rows.some(r=>r.user_id===member));
  assert.equal((await db.query('select is_active from public.club_members where club_id=$1 and user_id=$2',[club.id,captain])).rows[0].is_active,true);
});
