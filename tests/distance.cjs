const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const f=src.slice(src.indexOf('function dijkstra('),src.indexOf('let routeLine'));
const nodes=Array.from({length:36},(_,n)=>({x:n%6*8.8,z:Math.floor(n/6)*2.5}));
const adjacency=nodes.map(()=>[]),traffic=new Map(),edges=[];
for(let a=0;a<36;a++) for(const b of [a%6<5?a+1:-1,a<30?a+6:-1]) if(b>=0){const e={a,b,id:`${a}-${b}`,distance:Math.hypot(nodes[a].x-nodes[b].x,nodes[a].z-nodes[b].z)*115};edges.push(e);adjacency[a].push(e);adjacency[b].push(e);traffic.set(e.id,1+(a%3));}
const ctx={nodePositions:nodes,adjacency,state:{roadTraffic:traffic}};vm.createContext(ctx);vm.runInContext(f,ctx);
const length=r=>r.edgeIds.reduce((s,id)=>s+edges.find(e=>e.id===id).distance,0);
for(let a=0;a<36;a++)for(let b=0;b<36;b++){const r=ctx.dijkstra(a,b,'distance');const expected=(Math.abs(nodes[a].x-nodes[b].x)+Math.abs(nodes[a].z-nodes[b].z))*115;assert(Math.abs(length(r)-expected)<1e-8);assert.equal(r.path[0],a);assert.equal(r.path.at(-1),b);assert(length(ctx.dijkstra(a,b))>=expected-1e-8);}
const direct=Math.hypot(8.8,5)*115,road=length(ctx.dijkstra(7,20,'distance'));assert(direct<1200&&road>1200);
traffic.forEach((v,k)=>traffic.set(k,3));assert.equal(length(ctx.dijkstra(7,20,'distance')),road);
ctx.adjacency=nodes.map(()=>[]);assert.equal(ctx.dijkstra(0,35,'distance').path.length,0);
console.log('PASS: 1,296 endpoint pairs, same-location zero, traffic-independent physical distance, near/far demo, disconnected route. Demo:',direct,road);
