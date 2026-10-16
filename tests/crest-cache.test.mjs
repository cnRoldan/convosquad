import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createCrestCache} from '../src/features/clubs/crest-cache.ts';
test('escudo comparte URL entre pantallas, deduplica cargas y renueva solo al caducar o invalidarse',async()=>{
 let loads=0,now=0;const cache=createCrestCache(async path=>{loads++;return `https://images.invalid/${path}?token=fixture`;},()=>now);
 const [first,second]=await Promise.all([cache.get('u','c/crest.png'),cache.get('u','c/crest.png')]);
 assert.equal(first,second);assert.equal(loads,1);assert.equal(await cache.get('u','c/crest.png'),first);assert.equal(loads,1);
 cache.invalidate('c/crest.png');const changed=await cache.get('u','c/crest.png');assert.notEqual(changed,first);assert.equal(loads,2);
 now=56*60_000;await cache.get('u','c/crest.png');assert.equal(loads,3);
 await cache.get('other-user','c/crest.png');assert.equal(loads,4);
 cache.clear();assert.equal(cache.peek('u','c/crest.png'),null);
});
test('invalidación y cierre de sesión impiden restaurar caché desde una petición antigua',async()=>{
 let resolve;const cache=createCrestCache(()=>new Promise(r=>{resolve=r;}));
 const pending=cache.get('u','c/crest.png');cache.invalidate('c/crest.png');cache.clear();resolve('https://images.invalid/stale');await pending;
 assert.equal(cache.peek('u','c/crest.png'),null);
});
