import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inheritLineup,assignPlayer,moveSlot,removeFromBench,sendToBench,preset,reconcileLineup} from '../src/features/lineups/model.ts';
test('seven previous starters retain exact coordinates; eight others remain on bench',()=>{
 const candidates=Array.from({length:15},(_,i)=>({id:String(i),name:String(i),active:true,eligible:true}));
 const previous={formation:'4-3-3',slots:preset('4-3-3').map((s,i)=>({...s,playerId:i<7?String(i):'old'+i})),bench:['7']};
 const inherited=inheritLineup(previous,candidates);
 assert.equal(inherited.slots.filter(s=>s.playerId!==null).length,7);assert.equal(inherited.bench.length,8);
 assert.deepEqual(inherited.slots[6],previous.slots[6]);
 const swapped=assignPlayer(inherited,0,'7');assert.equal(swapped.slots[0].playerId,'7');assert.ok(swapped.bench.includes('0'));
 const moved=assignPlayer(swapped,1,'7');assert.equal(moved.slots[0].playerId,'1');assert.equal(moved.slots[1].playerId,'7');
 assert.deepEqual(moveSlot(moved,0,0.1,0.1),moved);
 assert.ok(sendToBench(moved,1).bench.includes('7'));
 const removed=removeFromBench(inherited,'7');assert.ok(!removed.bench.includes('7'));assert.ok(removed.excludedIds.includes('7'));
 assert.ok(!reconcileLineup(removed,candidates).bench.includes('7'));
});
test('unavailable players leave vacant slots while explicit manual selections survive',()=>{
 const candidates=[{id:'a',name:'A',active:true,eligible:false},{id:'b',name:'B',active:true,eligible:true}];
 const lineup={formation:'4-3-3',slots:preset('4-3-3').map((s,i)=>({...s,playerId:i===1?'a':null})),bench:[]};
 assert.equal(reconcileLineup(lineup,candidates).slots[1].playerId,null);
 assert.equal(reconcileLineup({...lineup,manualIds:['a']},candidates).slots[1].playerId,'a');
 assert.deepEqual(reconcileLineup(lineup,candidates).bench,['b']);
});
