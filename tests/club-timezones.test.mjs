import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clubTimezones, defaultClubTimezone, isClubTimezone, timezoneLabel } from '../src/features/clubs/timezones.ts';
const zone = value => clubTimezones.find(zone => zone.value === value);
test('Madrid es el valor inicial y todas las opciones son zonas reales con nombres únicos',()=>{
 assert.equal(defaultClubTimezone,'Europe/Madrid');
 assert.equal(new Set(clubTimezones.map(zone=>zone.value)).size,clubTimezones.length);
 for(const choice of clubTimezones) assert.match(timezoneLabel(choice),/GMT/);
 assert.equal(isClubTimezone('GMT+1'),false);assert.equal(isClubTimezone('invalid'),false);
});
test('Madrid, Canarias y Londres muestran GMT correcto en invierno y verano sin perder la zona geográfica',()=>{
 const winter=new Date('2026-01-15T12:00:00Z'),summer=new Date('2026-07-15T12:00:00Z');
 assert.match(timezoneLabel(zone('Europe/Madrid'),winter),/GMT\+01:00/);
 assert.match(timezoneLabel(zone('Europe/Madrid'),summer),/GMT\+02:00/);
 for(const name of ['Atlantic/Canary','Europe/London']){
  assert.match(timezoneLabel(zone(name),winter),/GMT\+00:00/);
  assert.match(timezoneLabel(zone(name),summer),/GMT\+01:00/);
 }
});
