import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSecureSessionStorage } from '../src/lib/secure-session-storage.ts';
function setup() {
 const secureData=new Map(),legacyData=new Map();let id=0,fail=false;
 const secure={getItem:async k=>secureData.get(k)??null,setItem:async(k,v)=>{if(fail)throw Error('keychain unavailable');secureData.set(k,v);},removeItem:async k=>{secureData.delete(k);}};
 const legacy={getItem:async k=>legacyData.get(k)??null,setItem:async(k,v)=>{legacyData.set(k,v);},removeItem:async k=>{legacyData.delete(k);}};
 return {secureData,legacyData,fail:()=>{fail=true;},storage:createSecureSessionStorage(secure,legacy,()=>`g${++id}`)};
}
test('migrates old sessions without leaving their plaintext copy',async()=>{
 const f=setup();const value=JSON.stringify({token:'x'.repeat(7000),name:'⚽'.repeat(800)});
 f.legacyData.set('sb-example-auth-token',value);
 assert.equal(await f.storage.getItem('sb-example-auth-token'),value);
 assert.equal(f.legacyData.size,0);
 assert.ok([...f.secureData.values()].every(v=>Buffer.byteLength(v,'utf8')<2048));
 assert.equal(await f.storage.getItem('sb-example-auth-token'),value);
});
test('failed replacement keeps the previous secure session intact',async()=>{
 const f=setup();await f.storage.setItem('session','original');f.fail();
 await assert.rejects(f.storage.setItem('session','replacement'));
 assert.equal(await f.storage.getItem('session'),'original');
});
test('failed migration retains the legacy session instead of discarding it',async()=>{
 const f=setup();f.legacyData.set('session','original');f.fail();
 await assert.rejects(f.storage.getItem('session'));
 assert.equal(f.legacyData.get('session'),'original');
});
test('refresh cleans obsolete chunks and logout removes both storage copies',async()=>{
 const f=setup();await f.storage.setItem('session','a'.repeat(4000));await f.storage.setItem('session','short');
 assert.equal(f.secureData.size,2);
 f.legacyData.set('session','stale');await f.storage.removeItem('session');
 assert.equal(f.secureData.size,0);assert.equal(f.legacyData.size,0);assert.equal(await f.storage.getItem('session'),null);
});
test('incomplete secure sessions never fall back to stale plaintext',async()=>{
 const f=setup();await f.storage.setItem('session','value');f.legacyData.set('session','stale');
 const chunk=[...f.secureData.keys()].find(k=>k.endsWith('.g1.0'));f.secureData.delete(chunk);
 await assert.rejects(f.storage.getItem('session'));
});
