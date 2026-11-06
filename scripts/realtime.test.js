import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyRealtime,createRealtimePoller} from '../realtime.js';
import {selectTrips} from '../schedule.js';
const date='2026-11-06',midnight=Date.parse(date+'T00:00:00+09:00')/1000,now=midnight+36000;
const data={feeds:[{file:'current_data-hirobus.zip',calendar:[{service_id:'s',start_date:'20261101',end_date:'20261130',friday:'1'}],exceptions:[]}],trips:[{feed:0,id:'t',service:'s',origin:'広島駅',departure:35940,stopId:'station',originSequence:2,destinations:{'紙屋町':36540,'八丁堀':36600},evidence:{'紙屋町':{stopId:'kami',sequence:4},'八丁堀':{stopId:'hachi',sequence:5}}}]};
const update={tripId:'t',startDate:'20261106',relationship:0,stops:[{stopId:'station',sequence:2,relationship:0,departure:{delay:180}},{stopId:'kami',sequence:4,relationship:0,departure:{delay:200}}]};
const snapshot=u=>({version:2,feeds:[{id:'hirobus',ok:true,timestamp:now,trips:[u]}]});
const select=(u,stamp=now)=>selectTrips(data,{stops:['紙屋町','八丁堀']},date,36000,t=>applyRealtime(t,data,snapshot(u),date,stamp));
test('delayed bus survives scheduled departure; destination departure is never mislabeled as arrival',()=>{
 const [t]=select(update);assert.equal(t.departure,36120);assert.equal(t.predictedDeparture,true);assert.equal(t.destinations['紙屋町'],36540);assert.equal(t.arrivalPredictions['紙屋町'],false);
 const explicit=structuredClone(update);explicit.stops[1].arrival={time:midnight+36700};assert.equal(select(explicit)[0].destinations['紙屋町'],36700);
});
test('stale data, wrong day, ambiguous instances and inconsistent stop identity are ignored',()=>{
 assert.equal(select(update,now+91).length,0);
 for(const changed of [{...update,startDate:'20261105'},{...update,timestamp:now-91},{...update,stops:[{...update.stops[0],sequence:99}]}])assert.equal(select(changed).length,0);
 const s=snapshot(update);s.feeds[0].trips.push(update);assert.equal(applyRealtime({...data.trips[0],serviceDate:date},data,s,date,now).predictedDeparture,undefined);
});
test('canceled trips and skipped origin/destination are excluded',()=>{
 assert.equal(select({...update,relationship:3}).length,0);
 const skipped=structuredClone(update);skipped.stops[0].relationship=1;assert.equal(select(skipped).length,0);
 const dest=structuredClone(update);dest.stops[1].relationship=1;const [t]=select(dest);assert.equal('紙屋町' in t.destinations,false);assert.equal('八丁堀' in t.destinations,true);
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('30-second polling pauses while hidden, resumes immediately and ignores a late response',async()=>{
 const timers=new Map();let timerId=0,calls=0,updates=0,clock=0;
 const poller=createRealtimePoller({endpoint:'https://example/api/realtime',now:()=>clock,schedule:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},cancel:id=>timers.delete(id),fetcher:async()=>{calls++;return new Response(JSON.stringify({version:2,feeds:[]}));},onUpdate:()=>updates++});
 poller.setEnabled(true);await flush();assert.equal(calls,1);assert.equal(updates,1);assert.equal([...timers.values()][0].ms,30000);
 const timer=[...timers.values()][0];timers.clear();clock=30000;timer.fn();await flush();assert.equal(calls,2);poller.setEnabled(false);assert.equal(timers.size,0);poller.setEnabled(true);await flush();assert.equal(calls,3);poller.setEnabled(false);
 let resolve;const late=createRealtimePoller({endpoint:'x',fetcher:()=>new Promise(r=>resolve=r),onUpdate:()=>assert.fail('hidden request must not update'),schedule:()=>1,cancel:()=>{}});late.setEnabled(true);late.setEnabled(false);resolve(new Response(JSON.stringify({version:2,feeds:[]})));await flush();
});
import {departureMarkup} from '../presentation.js';
test('delayed departures are reordered before upcoming platform selection',()=>{
 const earlier={...data.trips[0],id:'other',departure:36060,platform:'9'};
 const fixture={...data,trips:[{...data.trips[0],platform:'1'},earlier]};
 const trips=selectTrips(fixture,{stops:['紙屋町']},date,36000,t=>applyRealtime(t,fixture,snapshot(update),date,now));
 assert.deepEqual(trips.map(t=>[t.id,t.departure]),[['other',36060],['t',36120]]);
 assert.equal(trips[1].scheduledDeparture,35940);
 const html=departureMarkup(trips[1],'ja');assert.match(html,/<s[^>]*>09:59<\/s>/);assert.match(html,/effective-time--delayed">10:02/);assert.match(html,/\+3 分/);
 const normal=departureMarkup(trips[0],'ja');assert.doesNotMatch(normal,/<s\b|effective-time--delayed/);
});
