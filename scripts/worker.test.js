import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker,{decodeFeed,RealtimeCollector} from '../worker/worker.js';
const concat=(...parts)=>Uint8Array.from(parts.flatMap(p=>Array.from(p)));
const vi=value=>{let n=BigInt(value),out=[];do{let b=Number(n&127n);n>>=7n;out.push(b|(n?128:0));}while(n);return out;};
const scalar=(key,value)=>[...vi(key*8),...vi(value)];
const bytes=(key,data)=>concat(vi(key*8+2),vi(data.length),data);
const str=(key,value)=>bytes(key,new TextEncoder().encode(value));
const sample=()=>concat(bytes(1,concat(str(1,'2.0'),scalar(3,1793935232))),bytes(2,concat(str(1,'entity'),bytes(3,concat(bytes(1,concat(str(1,'trip'),str(3,'20261106'))),bytes(2,concat(scalar(1,2),bytes(3,concat(scalar(1,BigInt.asUintN(64,-60n)),scalar(2,1793935292))))))))));
test('decodes timestamps, trip instance, negative delay and preserves absent arrival',()=>{const data=decodeFeed(sample());assert.equal(data.timestamp,1793935232);assert.equal(data.trips[0].tripId,'trip');assert.equal(data.trips[0].startDate,'20261106');assert.equal(data.trips[0].stops[0].departure.delay,-60);assert.equal(data.trips[0].stops[0].arrival,null);});
test('rejects truncated protobuf and unsupported differential snapshots',()=>{assert.throws(()=>decodeFeed(Uint8Array.of(10,99,1)));assert.throws(()=>decodeFeed(bytes(1,concat(str(1,'2.0'),scalar(2,1)))),/Differential/);});
function collector(storage=new Map()){
 let ready;const state={storage:{get:async k=>Array.isArray(k)?new Map(k.filter(i=>storage.has(i)).map(i=>[i,storage.get(i)])):storage.get(k),put:async(k,v)=>{if(typeof k==='string')storage.set(k,v);else Object.entries(k).forEach(([a,b])=>storage.set(a,b));}},blockConcurrencyWhile:fn=>{ready=fn();}};
 return {instance:new RealtimeCollector(state),get ready(){return ready;},storage};
}
test('global singleton coalesces visitors and preserves snapshots and cooldown across restarts',async()=>{
 const savedFetch=fetch,savedNow=Date.now;let calls=0,clock=1793935232000;Date.now=()=>clock;
 globalThis.fetch=async (url,options)=>{calls++;assert.equal(options.cache,'no-store');assert.match(url,/^https:\/\/ajt-mobusta-gtfs.mcapps.jp\/realtime\/(8|9|10|15)\/trip_updates.bin$/);return url.includes('/15/')?new Response('',{status:503}):new Response(sample());};
 try{
  let c=collector();await c.ready;const names=[];const env={REALTIME_COLLECTOR:{idFromName:n=>{names.push(n);return n;},get:()=>({fetch:()=>c.instance.fetch()})}};
  const responses=await Promise.all(Array.from({length:25},(_,i)=>worker.fetch(new Request(`https://edge-${i}.workers.dev/api/realtime?x=${i}`),env)));
  assert.equal(calls,4);assert.equal(new Set(names).size,1);const data=await responses[0].json();assert.equal(data.version,2);assert.equal(data.feeds[3].ok,false);assert.equal(responses[0].headers.get('Access-Control-Allow-Origin'),'*');
  c=collector(c.storage);await c.ready;clock+=29999;const cached=await worker.fetch(new Request('https://other.workers.dev/'),env);assert.equal(cached.headers.get('X-Busnavi-Cache'),'HIT');assert.deepEqual(await cached.json(),data);assert.equal(calls,4);
  clock++;await worker.fetch(new Request('https://other.workers.dev/'),env);assert.equal(calls,8);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/',{method:'OPTIONS'}),env)).status,204);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/unknown'),env)).status,404);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/'))).status,503);assert.equal(calls,8);
 }finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
test('upstream failures also use cooldown; a restart during collection cannot bypass it',async()=>{
 const savedFetch=fetch,savedNow=Date.now;let calls=0;Date.now=()=>1793935232000;globalThis.fetch=async()=>{calls++;throw Error('offline');};
 try{const c=collector();await c.ready;await c.instance.fetch();await c.instance.fetch();assert.equal(calls,4);const restarted=collector(new Map([['nextFetchAt',Date.now()+30000]]));await restarted.ready;assert.equal((await restarted.instance.fetch()).status,503);assert.equal(calls,4);}finally{globalThis.fetch=savedFetch;Date.now=savedNow;}
});
