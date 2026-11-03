import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPurchaseSession } from '../src/features/billing/purchase-session.ts';

function fixture(apiKey='public-sdk-key') {
 const configured=[],logins=[];let purchaser=null;
 const session=createPurchaseSession(apiKey,{
  configure:options=>{configured.push(options);purchaser=options.appUserID;},
  logIn:async user=>{logins.push(user);purchaser=user;},
 });
 return {session,configured,logins,purchaser:()=>purchaser};
}
test('repeated attempts return store results without configuring the SDK again',async()=>{
 const f=fixture();
 for(const result of ['monthly','annual','restored'])assert.equal(await f.session.runAsUser('captain',async()=>result),result);
 assert.equal(f.configured.length,1);assert.deepEqual(f.logins,[]);
});
test('a cancelled purchase does not prevent retrying or restoring purchases',async()=>{
 const f=fixture();
 await assert.rejects(f.session.runAsUser('captain',async()=>{throw Error('cancelled');}));
 assert.equal(await f.session.runAsUser('captain',async()=> 'restored'),'restored');
 assert.equal(f.configured.length,1);
});
test('account changes use login and wait for the pending purchaser to finish',async()=>{
 const f=fixture();let finish,started;
 const ready=new Promise(resolve=>{started=resolve;});
 const purchase=f.session.runAsUser('alice',async()=>{started();await new Promise(resolve=>{finish=resolve;});return f.purchaser();});
 await ready;
 const next=f.session.runAsUser('bob',async()=>f.purchaser());
 assert.equal(f.purchaser(),'alice');assert.deepEqual(f.logins,[]);
 finish();assert.equal(await purchase,'alice');assert.equal(await next,'bob');
 assert.deepEqual(f.logins,['bob']);assert.equal(f.configured.length,1);
});
test('missing configuration never invokes the store SDK',async()=>{
 const f=fixture('');
 await assert.rejects(f.session.runAsUser('captain',async()=>true));
 assert.deepEqual(f.configured,[]);assert.deepEqual(f.logins,[]);
});
