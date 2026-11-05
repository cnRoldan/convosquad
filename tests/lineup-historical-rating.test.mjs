import assert from 'node:assert/strict';
import {test} from 'node:test';
import {historicalRatingColor, lineupHistoricalRating} from '../src/features/lineups/historical-rating.ts';
test('historical average colours cover decimals and exact boundaries without treating missing ratings as zero',()=>{
 for(const score of [0,2.99,3,3.99])assert.equal(historicalRatingColor(score),'#FF8B8B');
 for(const score of [4,4.99])assert.equal(historicalRatingColor(score),'#FFBC66');
 for(const score of [5,6.99])assert.equal(historicalRatingColor(score),'#FFE46B');
 for(const score of [7,9.99,10])assert.equal(historicalRatingColor(score),'#B4F16C');
 for(const score of [null,NaN,Infinity,-1,11])assert.equal(historicalRatingColor(score),'#AABCB0');
});

test('lineup rating averages only rated starters, counts zero and scales to 100',()=>{
 const ratings=new Map([['a',7],['b',3],['bench',10],['unknown',null],['zero',0]]);
 const lineup={slots:[{playerId:'a'},{playerId:'b'},{playerId:null},{playerId:'unknown'}]};
 assert.equal(lineupHistoricalRating(lineup,ratings),50);
 assert.equal(lineupHistoricalRating({slots:[{playerId:'zero'}]},ratings),0);
 assert.equal(lineupHistoricalRating({slots:[{playerId:'bench'}]},ratings),100);
 assert.equal(lineupHistoricalRating({slots:[{playerId:null},{playerId:'unknown'},{playerId:'missing'}]},ratings),null);
 assert.equal(lineupHistoricalRating({slots:[{playerId:'a'},{playerId:'a'},{playerId:'b'}]},ratings),50);
 assert.equal(lineupHistoricalRating({slots:[{playerId:'a'},{playerId:'b'},{playerId:'zero'}]},ratings),33);
});
