import assert from 'node:assert/strict';
import { test } from 'node:test';
import { restoreLanguage } from '../src/features/i18n/restore-language.ts';

function setup() {
 const cache=new Map(), applied=[];
 let current=true, remote=async()=>null;
 const dependencies={read:async key=>cache.get(key)??null,write:async(key,value)=>cache.set(key,value),
  readRemote:id=>remote(id),initializeRemote:async()=>undefined,apply:async language=>{applied.push(language);},
  deviceLocale:'en-US',current:()=>current};
 return {cache,applied,dependencies,remote:fn=>{remote=fn;},cancel:()=>{current=false;}};
}

test('cached device language applies before a slow profile request finishes', async () => {
 const f=setup();f.cache.set('convosquad:language:device','es');
 let resolve,entered;const waiting=new Promise(r=>{entered=r;});
 f.remote(()=>{entered();return new Promise(r=>{resolve=r;});});
 const restoring=restoreLanguage('a',f.dependencies);await waiting;
 assert.deepEqual(f.applied,['es']);
 resolve('es');await restoring;
});

test('restored profile language is cached for login after logout, regardless of the system language', async () => {
 const f=setup();f.remote(async()=> 'es');
 await restoreLanguage('a',f.dependencies);
 assert.equal(f.cache.get('convosquad:language:device'),'es');
 assert.equal(f.cache.get('convosquad:language:a'),'es');
 await restoreLanguage(null,f.dependencies);
 assert.equal(f.applied.at(-1),'es');
});

test('network failure preserves local language and never blocks its application', async () => {
 const f=setup();f.cache.set('convosquad:language:device','es');
 f.remote(async()=>{throw Error('offline');});
 await restoreLanguage('a',f.dependencies);
 assert.deepEqual(f.applied,['es']);
});

test('a slow profile response cannot overwrite a manual language selection', async () => {
 const f=setup();let resolve,entered;const waiting=new Promise(r=>{entered=r;});
 f.remote(()=>{entered();return new Promise(r=>{resolve=r;});});
 const restoring=restoreLanguage('a',f.dependencies);await waiting;
 f.cancel();f.cache.set('convosquad:language:device','fr');f.applied.push('fr');
 resolve('es');await restoring;
 assert.equal(f.applied.at(-1),'fr');
 assert.equal(f.cache.get('convosquad:language:device'),'fr');
});
