import {test}from'node:test';import assert from'node:assert/strict';
import{serializeInvitation,storedInvitation}from'../src/features/invitations/pending-storage.ts';
const invitation={clubId:'00000000-0000-4000-8000-000000000001',token:'a'.repeat(64)};
test('a pending invite survives browser reloads without accepting malformed or stale stored data',()=>{
 const now=Date.now();const raw=serializeInvitation(invitation,now);
 assert.deepEqual(storedInvitation(raw,now+10000),invitation);
 assert.equal(storedInvitation(raw,now-1000),null);
 assert.equal(storedInvitation(raw,now+31*86400_000),null);
 for(const bad of[null,'bad JSON','null','[]','{}',JSON.stringify({...invitation,savedAt:'bad'}),JSON.stringify({...invitation,savedAt:now,token:'bad'}),JSON.stringify({...invitation,savedAt:now,clubId:['duplicate']})])assert.equal(storedInvitation(bad,now),null);
});
