import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createActivityTracker } from '../src/features/auth/activity-tracker.ts';

test('background does not count as use; foreground is throttled and resuming after fifteen minutes records again', async () => {
  let clock=0, calls=0;
  const tracker=createActivityTracker(async()=>{calls++;},()=>clock);
  await tracker.recordForeground(false); assert.equal(calls,0);
  await tracker.recordForeground(true); assert.equal(calls,1);
  clock=14*60_000;
  await tracker.recordForeground(true); assert.equal(calls,1);
  clock=15*60_000;
  await tracker.recordForeground(false); assert.equal(calls,1);
  await tracker.recordForeground(true); assert.equal(calls,2);
  tracker.stop();clock+=15*60_000;
  await tracker.recordForeground(true); assert.equal(calls,2);
});

test('failed reports can retry, overlapping foreground events make one request and each account has its own tracker',async()=>{
  let calls=0, resolve;
  const tracker=createActivityTracker(async()=>{
    calls++; if(calls===1)throw new Error('Offline');
    await new Promise(done=>{resolve=done;});
  });
  await tracker.recordForeground(true);assert.equal(calls,1);
  const pending=tracker.recordForeground(true);
  await tracker.recordForeground(true);assert.equal(calls,2);
  resolve();await pending;
  tracker.stop();
  const other=createActivityTracker(async()=>{calls++;});
  await other.recordForeground(true);assert.equal(calls,3);
});
