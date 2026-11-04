import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPosterReadiness } from '../src/features/lineups/poster-readiness.ts';

test('capture waits for the crest, other raster assets and positive layout, regardless of load order',async()=>{
 const gate=createPosterReadiness(true);let settled=false;
 gate.ready.then(()=>{settled=true;});
 gate.loaded('background');gate.loaded('layout');gate.loaded('brand');gate.loaded('brand');
 await Promise.resolve();assert.equal(settled,false,'layout and other images do not mean the crest is painted');
 gate.loaded('crest');await gate.ready;assert.equal(settled,true);
 gate.cancel();gate.loaded('crest');
});
test('clubs without crests wait only for layout and the shared assets',async()=>{
 const gate=createPosterReadiness(false);
 gate.loaded('brand');gate.loaded('background');gate.loaded('layout');await gate.ready;
});
test('a failed raster load aborts capture instead of exporting an empty crest',async()=>{
 const gate=createPosterReadiness(true,20);
 gate.loaded('layout');gate.loaded('background');gate.loaded('brand');
 await assert.rejects(gate.ready,/No se terminaron/);gate.loaded('crest');gate.cancel();
});
test('unmount or cancellation rejects an outstanding capture and clears its timer',async()=>{
 const gate=createPosterReadiness(true);const rejected=assert.rejects(gate.ready,/cancelada/);
 gate.cancel();await rejected;gate.loaded('layout');
});

test('web waits for the poster layout before its independent SVG decoding step',async()=>{
 const gate=createPosterReadiness(true,1000,false);
 gate.loaded('layout');await gate.ready;
});
