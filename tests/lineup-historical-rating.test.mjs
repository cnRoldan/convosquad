import assert from 'node:assert/strict';
import {test} from 'node:test';
import {historicalRatingColor} from '../src/features/lineups/historical-rating.ts';
test('historical average colours cover decimals and exact boundaries without treating missing ratings as zero',()=>{
 for(const score of [0,2.99,3,3.99])assert.equal(historicalRatingColor(score),'#FF8B8B');
 for(const score of [4,4.99])assert.equal(historicalRatingColor(score),'#FFBC66');
 for(const score of [5,6.99])assert.equal(historicalRatingColor(score),'#FFE46B');
 for(const score of [7,9.99,10])assert.equal(historicalRatingColor(score),'#B4F16C');
 for(const score of [null,NaN,Infinity,-1,11])assert.equal(historicalRatingColor(score),'#AABCB0');
});
