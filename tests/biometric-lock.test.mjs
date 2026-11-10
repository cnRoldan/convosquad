import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiometricLock, biometricPresentation, needsNativeLockCover } from '../src/features/auth/biometric-lock.ts';
function setup(enabled=true){let now=0,calls=0;const flags=new Map([['a',enabled],['b',true]]);let authenticate=async()=>true;
 const lock=new BiometricLock({read:async u=>flags.get(u)??false,write:async(u,e)=>{flags.set(u,e);},authenticate:async()=>{calls++;return authenticate();},now:()=>now});
 return {lock,flags,calls:()=>calls,time:v=>{now=v;},auth:fn=>{authenticate=fn;}};
}
test('signing out never presents a new native lock modal while the security account catches up',async()=>{
 for(const enabled of [false,true]){
  const f=setup(enabled);await f.lock.setUser('a');if(enabled)await f.lock.unlock();
  const before=needsNativeLockCover(f.lock.snapshot(),true,false);
  // SIGNED_OUT renders auth.userId=null before the provider effect calls setUser(null).
  const transition=needsNativeLockCover(f.lock.snapshot(),false,false);
  await f.lock.setUser(null);
  const after=needsNativeLockCover(f.lock.snapshot(),true,false);
  assert.deepEqual([before,transition,after],[false,false,false]);
 }
});
test('initial restoration and logout keep content hidden without presenting a transient native controller',async()=>{
 const f=setup(false);
 assert.deepEqual(biometricPresentation(f.lock.snapshot(),null,true,false),{ready:false,blocked:true,nativeCover:false});
 await f.lock.setUser('a');
 assert.deepEqual(biometricPresentation(f.lock.snapshot(),'a',false,false),{ready:true,blocked:false,nativeCover:false});
 assert.deepEqual(biometricPresentation(f.lock.snapshot(),null,false,false),{ready:false,blocked:true,nativeCover:false});
 await f.lock.setUser(null);
 assert.deepEqual(biometricPresentation(f.lock.snapshot(),null,false,false),{ready:true,blocked:false,nativeCover:false});
});
test('switching to a biometric account protects content until its preference loads, then shows a real lock',async()=>{
 let finish;
 const lock=new BiometricLock({read:()=>new Promise(resolve=>{finish=resolve;}),write:async()=>{},authenticate:async()=>true,now:Date.now});
 const loading=lock.setUser('secure');
 assert.deepEqual(biometricPresentation(lock.snapshot(),'secure',false,false),{ready:false,blocked:true,nativeCover:false});
 finish(true);await loading;
 assert.deepEqual(biometricPresentation(lock.snapshot(),'secure',false,false),{ready:true,blocked:true,nativeCover:true});
 await lock.unlock();
 assert.deepEqual(biometricPresentation(lock.snapshot(),'secure',false,true),{ready:true,blocked:false,nativeCover:false});
});
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

test('Face ID success before the inactive-to-active event unlocks once and keeps the privacy cover until active', async () => {
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));
 const request=f.lock.unlockAutomatically();
 f.lock.appState('inactive');resolve(true);await request;
 assert.equal(f.lock.snapshot().locked,false);
 assert.equal(f.lock.snapshot().hidden,true);
 assert.equal(needsNativeLockCover(f.lock.snapshot(),true,true),true);
 f.lock.appState('active');await f.lock.unlockAutomatically();
 assert.equal(f.lock.snapshot().hidden,false);
 assert.equal(f.lock.snapshot().locked,false);
 assert.equal(f.calls(),1);
 assert.equal(f.lock.snapshot().userId,'a');
 assert.equal(f.flags.get('a'),true);
});

test('cancellation and failure never retry automatically when iOS returns to active', async () => {
 for(const failure of [async()=>false,async()=>{throw Error('unavailable');}]) {
  const f=setup();await f.lock.setUser('a');f.auth(failure);
  await f.lock.unlockAutomatically();
  for(const state of ['inactive','active','active','inactive','active']) {
   f.lock.appState(state);await f.lock.unlockAutomatically();
  }
  assert.equal(f.calls(),1);
  assert.equal(f.lock.snapshot().locked,true);
  assert.equal(f.lock.snapshot().userId,'a');
  assert.equal(f.flags.get('a'),true);
  f.auth(async()=>true);await f.lock.unlock();
  assert.equal(f.calls(),2);assert.equal(f.lock.snapshot().locked,false);
 }
});

test('enabling while Face ID is inactive does not request another authentication on return', async () => {
 const f=setup(false);await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));
 const enabling=f.lock.setEnabled(true);
 f.lock.appState('inactive');
 assert.equal(needsNativeLockCover(f.lock.snapshot(),true,false),false);
 resolve(true);
 assert.equal(await enabling,true);
 assert.equal(f.lock.snapshot().hidden,true);
 assert.equal(needsNativeLockCover(f.lock.snapshot(),true,false),false);
 f.lock.appState('active');await f.lock.unlockAutomatically();
 assert.equal(f.calls(),1);assert.equal(f.lock.snapshot().locked,false);
 assert.equal(f.flags.get('a'),true);
});

test('real background invalidates authentication even if the app returns before the result', async () => {
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));
 const request=f.lock.unlockAutomatically();
 f.lock.appState('background');f.lock.appState('active');resolve(true);await request;
 assert.equal(f.lock.snapshot().locked,true);
 f.auth(async()=>true);await f.lock.unlockAutomatically();
 assert.equal(f.calls(),2);assert.equal(f.lock.snapshot().locked,false);
});

test('restoring the same account does not relock an authenticated session', async () => {
 const f=setup();await f.lock.setUser('a');await f.lock.unlockAutomatically();
 await f.lock.setUser('a');await f.lock.unlockAutomatically();
 assert.equal(f.calls(),1);assert.equal(f.lock.snapshot().locked,false);
});

test('switching accounts waits for the existing system prompt before authenticating the next account', async () => {
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));
 const request=f.lock.unlockAutomatically();
 await f.lock.setUser('b');await f.lock.unlockAutomatically();
 assert.equal(f.calls(),1);assert.equal(f.lock.snapshot().busy,true);
 resolve(true);await request;
 assert.equal(f.lock.snapshot().locked,true);
 f.auth(async()=>true);await f.lock.unlockAutomatically();
 assert.equal(f.calls(),2);assert.equal(f.lock.snapshot().locked,false);
});

test('a prolonged inactive interruption after successful authentication still enforces the 30 second limit', async () => {
 const f=setup();await f.lock.setUser('a');let resolve;
 f.auth(()=>new Promise(r=>{resolve=r;}));const request=f.lock.unlockAutomatically();
 f.lock.appState('inactive');resolve(true);await request;
 f.time(30001);f.lock.appState('active');
 assert.equal(f.lock.snapshot().locked,true);
 f.auth(async()=>true);await f.lock.unlockAutomatically();
 assert.equal(f.calls(),2);assert.equal(f.lock.snapshot().locked,false);
});
