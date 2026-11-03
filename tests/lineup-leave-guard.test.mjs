import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { guardRouter, LeaveGuard } from '../src/features/lineups/leave-guard.ts';

const require = createRequire(import.meta.url);
const { TabRouter } = require('../node_modules/expo-router/build/react-navigation/routers/TabRouter.js');
const { StackRouter } = require('../node_modules/expo-router/build/react-navigation/routers/StackRouter.js');

function fixture(router, names) {
  const guard = new LeaveGuard();
  let dirty = true;
  guard.setHandler(() => dirty);
  const options = { routeNames: names, routeParamList: {}, routeGetIdList: {} };
  let state = router.getInitialState(options);
  const replays = [];
  const guarded = { ...router, ...guardRouter(router, guard, action => { replays.push(action); state = guarded.getStateForAction(state, action, options); }) };
  return { guard, replays, clean: () => { dirty = false; }, state: () => state, go: action => { state = guarded.getStateForAction(state, action, options); } };
}

test('switching tabs waits for consent, cancellation keeps the lineup, discard replays once', () => {
  const f = fixture(TabRouter({ initialRouteName: 'lineup' }), ['lineup', 'home', 'roster']);
  const initial = f.state();
  f.go({ type: 'JUMP_TO', payload: { name: 'home' } });
  assert.equal(f.state(), initial);
  assert.equal(f.guard.snapshot(), true);
  f.guard.cancel();
  assert.equal(f.guard.snapshot(), false);
  assert.equal(f.state(), initial);
  f.go({ type: 'JUMP_TO', payload: { name: 'roster' } });
  f.guard.proceed();
  assert.equal(f.state().routes[f.state().index].name, 'roster');
  assert.equal(f.replays[0].target, initial.key);
  f.guard.proceed();
  assert.equal(f.replays.length, 1);
});

test('failed saving leaves navigation pending; successful saving resumes the first destination', () => {
  const f = fixture(TabRouter({ initialRouteName: 'lineup' }), ['lineup', 'home', 'roster']);
  f.go({ type: 'JUMP_TO', payload: { name: 'home' } });
  f.go({ type: 'JUMP_TO', payload: { name: 'roster' } });
  assert.equal(f.state().routes[f.state().index].name, 'lineup');
  assert.equal(f.replays.length, 0);
  assert.equal(f.guard.snapshot(), true);
  f.clean();
  f.guard.proceed();
  assert.equal(f.state().routes[f.state().index].name, 'home');
});

for (const action of [
  { type: 'PUSH', payload: { name: 'settings' } },
  { type: 'REPLACE', payload: { name: 'settings' } },
  { type: 'GO_BACK' },
]) test(`stack ${action.type} is blocked and resumes after confirmation`, () => {
  const f = fixture(StackRouter({ initialRouteName: 'home' }), ['home', 'lineup', 'settings']);
  f.clean();
  f.go({ type: 'PUSH', payload: { name: 'lineup' } });
  f.guard.setHandler(() => true);
  const initial = f.state();
  f.go(action);
  assert.equal(f.state(), initial);
  f.guard.proceed();
  assert.equal(f.state().routes[f.state().index].name, action.type === 'GO_BACK' ? 'home' : 'settings');
});

test('clean editor and same-screen actions navigate without a prompt', () => {
  const f = fixture(TabRouter({ initialRouteName: 'lineup' }), ['lineup', 'home']);
  f.go({ type: 'JUMP_TO', payload: { name: 'lineup' } });
  assert.equal(f.guard.snapshot(), false);
  f.clean();
  f.go({ type: 'JUMP_TO', payload: { name: 'home' } });
  assert.equal(f.guard.snapshot(), false);
  assert.equal(f.state().index, 1);
});
