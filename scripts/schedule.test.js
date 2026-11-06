import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {active,selectTrips} from '../schedule.js';
const data=JSON.parse(readFileSync(new URL('../data/timetable.json',import.meta.url)));
test('weekdays and weekend use service calendars with no duplicate departures',()=>{for(const date of ['2026-11-06','2026-11-07','2026-11-08']){const ts=selectTrips(data,{stops:['紙屋町','八丁堀']},date,9*3600);assert.ok(ts.length);assert.equal(new Set(ts.map(t=>[t.feed,t.id,t.departure,t.stopId].join('|'))).size,ts.length);for(const [i,t]of ts.entries()){assert.equal(t.origin,'広島駅');assert.ok(t.departure>=9*3600);assert.ok(Object.keys(t.destinations).some(s=>['紙屋町','八丁堀'].includes(s)));if(i)assert.ok(ts[i-1].departure<=t.departure);}}});
test('calendar exceptions override weekday pattern',()=>{const f={calendar:[{service_id:'x',start_date:'20261101',end_date:'20261130',friday:'1'}],exceptions:[{service_id:'x',date:'20261106',exception_type:'2'},{service_id:'x',date:'20261108',exception_type:'1'}]};assert.equal(active(f,'x','2026-11-06'),false);assert.equal(active(f,'x','2026-11-08'),true);});
test('out of coverage has no invented timetable or next-day rollover',()=>{assert.equal(selectTrips(data,{stops:['紙屋町','八丁堀']},'2026-08-30',0).length,0);assert.equal(selectTrips(data,{stops:['紙屋町','八丁堀']},'2026-11-06',86400).length,0);});
import {strings,translate,arrivalTime} from '../i18n.js';
test('arrival suffix and five-language GTFS translations',()=>{assert.equal(arrivalTime('12:23','ja'),'12:23着');assert.equal(arrivalTime('--:--','ja'),'--:--着');for(const lang of ['en','ko','zh-cn','zh-tw']){for(const key of Object.keys(strings.ja))assert.ok(strings[lang][key],lang+key);const feed=data.feeds.find(f=>f.file.includes('hirobus'));assert.ok(feed.translations[lang]['紙屋町']);if(lang==='en')assert.equal(translate(feed,lang,'紙屋町'),'Kamiyacho');assert.equal(translate(feed,lang,'missing'),'missing');}});
test('north/Shinkansen-exit headsigns are excluded even when departing from the south exit',()=>{
 for(const date of ['2026-11-06','2026-11-07','2026-11-08']){
  const trips=selectTrips(data,{stops:['紙屋町','八丁堀']},date,0);assert.ok(trips.length);
  assert.ok(trips.every(t=>t.origin==='広島駅'&&!t.headsign.includes('広島駅新幹線口')));
 }
});
