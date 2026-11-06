import {test} from 'node:test';import assert from 'node:assert/strict';import {upcomingGuidance} from '../guidance.js';
test('one shared trip set uses the next departure in each direction, including the three-minute boundary',()=>{
 const trips=[{id:'h0',departure:1200,platform:'17',destinations:{H:1300}},{id:'h1',departure:1381,platform:'1',destinations:{H:1500}},{id:'p0',departure:1500,platform:'6',destinations:{P:1700}},{id:'p1',departure:1680,platform:'3',destinations:{P:1800}},{id:'p2',departure:1681,platform:'1',destinations:{P:1900}}];
 const result=upcomingGuidance(trips,['P','H']);assert.deepEqual([...result.selected].map(t=>t.id).sort(),['h0','p0','p1']);assert.deepEqual(result.groups.map(g=>g.platforms),[['3','6'],['17']]);
 assert.deepEqual([...result.selected], [...new Set(result.groups.flatMap(g=>g.trips))]);
});
test('a bus serving both stops is highlighted once and missing platforms are not invented',()=>{
 const trip={departure:300,platform:'',destinations:{P:400,H:500}};const result=upcomingGuidance([trip],['P','H']);assert.equal(result.selected.size,1);assert.ok(result.selected.has(trip));assert.deepEqual(result.groups.map(g=>g.platforms),[[],[]]);assert.equal(upcomingGuidance([],['P','H']).selected.size,0);
});
