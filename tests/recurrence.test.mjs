import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyDays, firstRecurringDate, localWeekday } from '../src/features/call-ups/recurrence.ts';
test('Spanish weekdays use L M X J V S D and every locale has full accessible names',()=>{
 assert.deepEqual(weeklyDays('es-ES').map(d=>d.label),['L','M','X','J','V','S','D']);
 for(const locale of ['es-ES','en-GB','de-DE','fr-FR']){
  const days=weeklyDays(locale);assert.deepEqual(days.map(d=>d.value),[1,2,3,4,5,6,7]);assert.equal(new Set(days.map(d=>d.name)).size,7);assert.ok(days.every(d=>d.label.length<=4&&d.name.length>2));
 }
 assert.equal(weeklyDays('en-GB')[0].name,'Monday');assert.equal(weeklyDays('de-DE')[0].name,'Montag');assert.equal(weeklyDays('fr-FR')[0].name,'lundi');
});
test('first recurrence honours selected days and month/year transitions without device zone assumptions',()=>{
 assert.equal(localWeekday('2026-11-23'),1);
 assert.equal(firstRecurringDate('2026-11-23',[1,3]),'2026-11-23');
 assert.equal(firstRecurringDate('2026-11-24',[1,3]),'2026-11-25');
 assert.equal(firstRecurringDate('2026-12-31',[1]),'2027-01-04');
 for(const [date,days]of[['2026-02-30',[1]],['bad',[1]],['2026-11-23',[]],['2026-11-23',[0]],['2026-11-23',[null]]])assert.equal(firstRecurringDate(date,days),null);
});
