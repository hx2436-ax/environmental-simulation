import assert from 'node:assert/strict';
import {plan,path,blocked,goods} from './planner.mjs';
const rows=goods.map((_,i)=>({qty:i%3===0?2:1,weight:[1.5,1,.4,.7,.3,.8,1.2,.5,.6][i]}));
function verify(r,capacity){const p=plan(r,capacity),counts=Array(9).fill(0);for(const t of p.trips){assert(t.weight<=capacity+.001);assert.deepEqual(t.points[0],[1,1]);assert.deepEqual(t.points.at(-1),[1,1]);t.items.forEach(x=>counts[x.type]++);for(let i=1;i<t.points.length;i++){const a=t.points[i-1],b=t.points[i];assert.equal(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]),1);assert(!blocked.has(b.join()));}assert.equal(t.distance,t.points.length-1);}assert.deepEqual(counts,r.map(x=>x.qty));assert(p.total<=p.baseline);return p;}
const p=verify(rows,12);assert(p.exact);assert.equal(p.count,12);
for(let seed=1;seed<=20;seed++){verify(goods.map((_,i)=>({qty:(seed+i)%4,weight:((seed*7+i*3)%15+1)/10})),3+seed%7);}
const empty=goods.map(()=>({qty:0,weight:1}));assert.equal(verify(empty,1).total,0);assert.throws(()=>plan([{qty:1,weight:20}],12));assert.throws(()=>plan([{qty:-1,weight:1}],12));
const one=empty.map(x=>({...x}));one[0].qty=3;const single=verify(one,2);assert.equal(single.trips.length,2);assert.equal(single.total,2*(path([1,1],[4,3]).length-1)*2);
console.log('PASS: default, 20 varied cargo sets, capacity, quantities, obstacle avoidance, depot returns, empty/invalid input and exact single-shelf optimum.',{defaultDistance:p.total,trips:p.trips.length,baseline:p.baseline});
