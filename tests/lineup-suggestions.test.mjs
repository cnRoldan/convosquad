import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preset, assignPlayer } from '../src/features/lineups/model.ts';
import { slotCategory, suggestPlayers } from '../src/features/lineups/suggestions.ts';

test('recognizes roles by location across presets and custom layouts', () => {
  const roles = preset('4-3-3').map(slot => slotCategory('4-3-3', slot));
  assert.deepEqual(roles, ['goalkeepers','wide_backs','centre_backs','centre_backs','wide_backs','midfielders','midfielders','midfielders','attackers','attackers','attackers']);
  assert.equal(slotCategory('3-5-2', {id:1,x:.25,y:.72}), 'centre_backs');
  assert.equal(slotCategory('4-3-3', {id:1,x:.5,y:.15}), 'attackers');
  assert.equal(slotCategory('3-5-2', {id:7,x:.84,y:.45}), 'wide_backs');
});
test('suggests a bench attacker and an experienced midfielder, excluding current, inactive and unselected players', () => {
  const lineup = {formation:'4-3-3',slots:preset('4-3-3').map(s => ({...s,playerId:s.id===8?'current':s.id===5?'experienced':null})),bench:['striker','newbie','inactive']};
  const candidates = [
    {id:'current',name:'Current',category:'attackers'}, {id:'striker',name:'Striker',category:'attackers'},
    {id:'experienced',name:'Midfielder',category:'midfielders'}, {id:'newbie',name:'New',category:'midfielders'},
    {id:'omitted',name:'Not included',category:'attackers'}, {id:'inactive',name:'Inactive',category:'attackers',active:false},
  ].map(p => ({active:true,eligible:true,...p}));
  const experience = [{player_id:'experienced',category:'attackers',appearances:3},{player_id:'newbie',category:'centre_backs',appearances:8}];
  const result = suggestPlayers(lineup,8,candidates,experience);
  assert.deepEqual(result.map(x=>x.player.id),['striker','experienced']);
  assert.equal(result[0].rosterMatch,true); assert.equal(result[1].appearances,3);
  const swapped=assignPlayer(lineup,8,'experienced');
  assert.equal(swapped.slots[5].playerId,'current');
  assert.equal(swapped.slots[8].playerId,'experienced');
  const empty={...lineup,slots:lineup.slots.map(s=>({...s,playerId:s.id===8?null:s.playerId}))};
  assert.deepEqual(suggestPlayers(empty,8,candidates,experience).map(x=>x.player.id),['striker','experienced']);
});
test('combines reasons once per player, ranks experience, and works without history', () => {
  const lineup={formation:'4-4-2',slots:preset('4-4-2'),bench:['a','b']};
  const candidates=['a','b'].map(id=>({id,name:id,category:'attackers',active:true,eligible:true}));
  const rows=suggestPlayers(lineup,10,candidates,[{player_id:'b',category:'attackers',appearances:2}]);
  assert.deepEqual(rows.map(x=>x.player.id),['b','a']); assert.equal(rows[0].rosterMatch,true);
  assert.equal(suggestPlayers(lineup,10,candidates,[]).length,2);
  assert.deepEqual(suggestPlayers(lineup,99,candidates,[]),[]);
});
