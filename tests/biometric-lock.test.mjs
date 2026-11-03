import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiometricLock } from '../src/features/auth/biometric-lock.ts';
function setup(enabled=true){let now=0,calls=0;const flags=new Map([['a',enabled],['b',true]]);let authenticate=async()=>true;
 const lock=new BiometricLock({read:async u=>flags.get(u)??false,write:async(u,e)=>{flags.set(u,e);},authenticate:async()=>{calls++;return authenticate();},now:()=>now});
 return {lock,flags,calls:()=>calls,time:v=>{now=v;},auth:fn=>{authenticate=fn;}};
}
test('cold start is locked; cancellation stays locked and retry unlocks',async()=>{
 const f=setup();await f.lock.setUser('a');assert.equal(f.lock.snapshot().locked,true);
 f.auth(async()=>false);await f.lock.unlock();assert.equal(f.lock.snapshot().locked,true);
 f.auth(async()=>true);await f.lock.unlock();assert.equal(f.lock.snapshot().locked,false);
});
test('covers inactive app immediately and locks only after 30 seconds away',async()=>{
 const f=setup();await f.lock.setUser('a');await f.lock.unlock();
 f.lock.appState('inactive');assert.equal(f.lock.snapshot().hidden,true);
 f.time(1000);f.lock.appState('active');assert.equal(f.lock.snapshot().locked,false);
 f.lock.appState('background');f.time(31000);f.lock.appState('active');assert.equal(f.lock.snapshot().locked,true);
});
test('successful authentication for an old account cannot unlock a new one',async()=>{
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));const request=f.lock.unlock();
 await f.lock.setUser('b');resolve(true);await request;
 assert.equal(f.lock.snapshot().userId,'b');assert.equal(f.lock.snapshot().locked,true);
});
test('concurrent unlocks make one system prompt; prompt lifecycle does not relock',async()=>{
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));const request=f.lock.unlock();await f.lock.unlock();
 assert.equal(f.calls(),1);f.lock.appState('inactive');f.time(60000);f.lock.appState('active');resolve(true);await request;
 assert.equal(f.lock.snapshot().locked,false);
});
test('enabling and disabling require confirmation and are scoped to the account',async()=>{
 const f=setup(false);await f.lock.setUser('a');f.auth(async()=>false);
 assert.equal(await f.lock.setEnabled(true),false);assert.equal(f.flags.get('a'),false);
 f.auth(async()=>true);assert.equal(await f.lock.setEnabled(true),true);assert.equal(f.flags.get('a'),true);
 assert.equal(await f.lock.setEnabled(false),true);assert.equal(f.flags.get('a'),false);assert.equal(f.flags.get('b'),true);
});
test('backgrounded authentication cannot reveal the app',async()=>{
 const f=setup();await f.lock.setUser('a');let resolve;f.auth(()=>new Promise(r=>{resolve=r;}));
 const request=f.lock.unlock();f.lock.appState('background');resolve(true);await request;
 assert.equal(f.lock.snapshot().hidden,true);assert.equal(f.lock.snapshot().locked,true);
});
