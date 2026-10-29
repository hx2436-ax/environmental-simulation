export const depot=[1,1];
export const goods=['饮用水','牛奶','面包','水果','零食','罐头','洗护','纸品','冷饮'];
export const shelves=goods.map((name,i)=>({name,x:4+(i%3)*4,y:4+Math.floor(i/3)*4}));
export const blocked=new Set(shelves.map(s=>`${s.x},${s.y}`));
export const stops=[depot,...shelves.map(s=>[s.x,s.y-1])];
export function path(a,b){const queue=[a],prev=new Map([[a.join(),null]]);for(let h=0;h<queue.length;h++){const p=queue[h];if(p.join()===b.join()){let k=b.join(),out=[];while(k){out.push(k.split(',').map(Number));k=prev.get(k);}return out.reverse();}for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){const n=[p[0]+d[0],p[1]+d[1]],k=n.join();if(n[0]>=1&&n[0]<=15&&n[1]>=1&&n[1]<=15&&!blocked.has(k)&&!prev.has(k)){prev.set(k,p.join());queue.push(n);}}}throw Error('不可达');}
const paths=stops.map(a=>stops.map(b=>path(a,b))),dist=paths.map(row=>row.map(p=>p.length-1));
const costs=Array.from({length:512},()=>Array(9).fill(Infinity)),parents=Array.from({length:512},()=>Array(9).fill(-1));
for(let i=0;i<9;i++)costs[1<<i][i]=dist[0][i+1];
for(let m=1;m<512;m++)for(let i=0;i<9;i++)if(m&(1<<i))for(let j=0;j<9;j++)if(!(m&(1<<j))){const n=m|(1<<j),v=costs[m][i]+dist[i+1][j+1];if(v<costs[n][j]){costs[n][j]=v;parents[n][j]=i;}}
const routes=Array.from({length:512},(_,m)=>{if(!m)return {distance:0,order:[],points:[depot]};let end=-1,best=Infinity;for(let i=0;i<9;i++)if(costs[m][i]+dist[i+1][0]<best){best=costs[m][i]+dist[i+1][0];end=i;}const order=[];let mask=m;while(end>=0){order.unshift(end);const p=parents[mask][end];mask^=1<<end;end=p;}const ids=[0,...order.map(i=>i+1),0],points=[depot];for(let i=1;i<ids.length;i++)points.push(...paths[ids[i-1]][ids[i]].slice(1));return {distance:best,order,points};});
export function plan(rows,capacity){
 if(!Number.isFinite(capacity)||capacity<=0)throw Error('载重必须大于零');
 const items=[];rows.forEach((r,type)=>{if(!Number.isInteger(r.qty)||r.qty<0||r.qty>12||!Number.isFinite(r.weight)||r.weight<=0)throw Error('数量须为 0–12 的整数，重量须大于零');if(r.qty&&r.weight>capacity)throw Error(`${goods[type]}单件超过载重，无法搬运`);for(let i=0;i<r.qty;i++)items.push({type,weight:Math.round(r.weight*100)});});
 const cap=Math.round(capacity*100),make=ids=>{let mask=0;ids.forEach(i=>mask|=1<<items[i].type);return {...routes[mask],items:ids.map(i=>items[i]),weight:ids.reduce((s,i)=>s+items[i].weight,0)/100};};
 const baseline=items.map((_,i)=>make([i]));let trips=[],exact=items.length<=14;
 if(exact&&items.length){const n=1<<items.length,w=new Int32Array(n),m=new Int32Array(n),dp=new Float64Array(n).fill(Infinity),choice=new Int32Array(n);dp[0]=0;for(let s=1;s<n;s++){const bit=s&-s,i=31-Math.clz32(bit),rest=s^bit;w[s]=w[rest]+items[i].weight;m[s]=m[rest]|(1<<items[i].type);}
 for(let s=1;s<n;s++){const anchor=s&-s;for(let t=s;t;t=(t-1)&s)if((t&anchor)&&w[t]<=cap){const v=routes[m[t]].distance+dp[s^t];if(v<dp[s]){dp[s]=v;choice[s]=t;}}}let s=n-1;while(s){const t=choice[s],ids=[];for(let i=0;i<items.length;i++)if(t&(1<<i))ids.push(i);trips.push(make(ids));s^=t;}}
 else if(items.length){let best=Infinity;for(let mode=0;mode<4;mode++){const ids=items.map((_,i)=>i).sort((a,b)=>mode===0?items[b].weight-items[a].weight:mode===1?items[a].type-items[b].type:mode===2?items[b].type-items[a].type:items[a].weight-items[b].weight),bins=[];for(const id of ids){let pick=-1,delta=Infinity;for(let b=0;b<bins.length;b++)if(bins[b].reduce((s,i)=>s+items[i].weight,0)+items[id].weight<=cap){const d=make([...bins[b],id]).distance-make(bins[b]).distance;if(d<delta){delta=d;pick=b;}}if(pick<0)bins.push([id]);else bins[pick].push(id);}const candidate=bins.map(make),total=candidate.reduce((s,t)=>s+t.distance,0);if(total<best){best=total;trips=candidate;}}}
 return {trips,exact,total:trips.reduce((s,t)=>s+t.distance,0),baseline:baseline.reduce((s,t)=>s+t.distance,0),count:items.length};
}
