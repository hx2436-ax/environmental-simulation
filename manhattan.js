import {distance,measure,along,remainder} from './geo.mjs';
const $=id=>document.getElementById(id);
const places=[['Penn Station',[-73.9910,40.7506]],['Times Square',[-73.9851,40.7580]],['Grand Central',[-73.9772,40.7527]],['Bryant Park · 42nd St',[-73.9832,40.7542]],['Rockefeller Center',[-73.9787,40.7590]],['Columbus Circle',[-73.9819,40.7681]]];
const s={inputs:{},custom:{},status:'loading',paused:false,progress:0,phase:'pickup',routes:null,driver:null,pickup:null,destination:null,selecting:null,version:0};
let map,markers={},last=0,lastUI=0,controller;
const fc=coords=>({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:coords.length>=2?coords:[coords[0],coords[0]]}});
const empty={type:'FeatureCollection',features:[]};
const fmt=n=>n>=1000?`${(n/1000).toFixed(2)} km`:`${Math.round(n)} m`;
const msg=t=>$('message').textContent=t;
function setStatus(status){s.status=status;controls();}
function controls(){
 $('status').textContent=({loading:'LOADING',planning:'PLANNING',ready:'READY',pickup:'TO PICKUP',arrived:'DRIVER ARRIVED',trip:'ON TRIP',completed:'COMPLETED',cancelled:'CANCELLED',error:'CONNECTION ERROR'})[s.status];
 $('accept').disabled=s.status!=='ready';$('start').disabled=s.status!=='arrived';$('pause').disabled=!['pickup','trip'].includes(s.status);$('cancel').disabled=!['ready','pickup','arrived','trip'].includes(s.status);$('pause').textContent=s.paused?'Resume':'Pause';
 const editing=['loading','planning','pickup','arrived','trip'].includes(s.status);
 for(const kind of ['driver','pickup','destination']) $(`${kind}-place`).disabled=editing;
 document.querySelectorAll('[data-place]').forEach(b=>b.disabled=editing);$('plan').disabled=['loading','planning'].includes(s.status);
 $('phase').textContent=({loading:'Loading Midtown',planning:'Finding driving routes',ready:'Ready for a request',pickup:'Driving to pickup',arrived:'Passenger ready to board',trip:'Driving to destination',completed:'Trip completed',cancelled:'Trip cancelled',error:'Route unavailable'})[s.status];
}
function currentRoute(){return s.routes?.[s.phase];}
function endpoint(kind){return s[kind];}
function marker(kind,coords){
 if(!markers[kind]){const el=document.createElement('div');el.className=`pin ${kind==='driver'?'vehicle':''}`;el.style.setProperty('--pin',({driver:'#417faa',pickup:'#429d79',destination:'#d19a35',rider:'#d8488a'})[kind]);const b=document.createElement('b');b.textContent=kind==='driver'?'🚕 Driver':kind[0].toUpperCase()+kind.slice(1);const stem=document.createElement('i');el.append(b,stem);el.title=kind;markers[kind]=new maplibregl.Marker({element:el,anchor:'bottom',offset:kind==='rider'?[0,-32]:[0,0]}).setLngLat(coords).addTo(map);}
 markers[kind].setLngLat(coords);markers[kind].getElement().title=`${kind}: ${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
}
function updateMarkers(){for(const kind of ['driver','pickup','destination'])if(s[kind])marker(kind,s[kind]);const r=s.status==='trip'||s.status==='completed'?s.driver:s.pickup;if(r)marker('rider',r);const onboard=s.status==='trip'||s.status==='completed';if(markers.rider)markers.rider.getElement().style.display=onboard?'none':'';if(markers.driver)markers.driver.getElement().querySelector('b').textContent=onboard?'🚕 Driver + Rider':'🚕 Driver';}
async function route(a,b,signal){
 if(distance(a,b)<.1)return {coords:[a,b],cumulative:[0,0],distance:0,duration:0,from:a,to:b};
 const u=`https://router.project-osrm.org/route/v1/driving/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson&steps=false`;
 const response=await fetch(u,{signal});if(!response.ok)throw Error('Routing service unavailable');const data=await response.json();if(data.code!=='Ok'||!data.routes?.length)throw Error('No driving route found');
 const r=data.routes[0],coords=r.geometry.coordinates;return {coords,cumulative:measure(coords),distance:r.distance,duration:r.duration,from:data.waypoints[0].location,to:data.waypoints[1].location};
}
function source(name,coords){map.getSource(name)?.setData(coords?.length?fc(coords):empty);}
async function plan(){
 controller?.abort();controller=new AbortController();const version=++s.version;s.paused=false;s.selecting=null;s.progress=0;s.phase='pickup';s.routes=null;setStatus('planning');msg('Finding routes on the Manhattan road network…');source('drive',[]);source('direct',[]);
 try{
  const a=s.inputs.driver,b=s.inputs.pickup,c=s.inputs.destination;
  // Sequential requests ensure both legs share the same road-snapped pickup.
  const pickup=await route(a,b,controller.signal);const trip=await route(pickup.to,c,controller.signal);
  if(version!==s.version)return;s.routes={pickup,trip};s.driver=[...pickup.from];s.pickup=[...pickup.to];s.destination=[...trip.to];
  setStatus('ready');updateMarkers();renderComparison();fit();msg('Route ready. Accept to automatically drive to the pickup.');
 }catch(e){if(version!==s.version||e.name==='AbortError')return;setStatus('error');msg(`${e.message}. Check your connection and press Plan / Reset to retry.`);$('ratio').textContent='Road distance unavailable. Retry planning.';$('direct').textContent=$('road').textContent='—';}
}
function comparison(){
 const mode=$('compare').value,trip=s.routes.trip,pickup=s.routes.pickup;
 if(mode==='trip')return {coords:trip.coords,road:trip.distance,a:trip.from,b:trip.to};
 const started=['pickup','arrived','trip','completed','cancelled'].includes(s.status);
 const onTrip=s.phase==='trip';
 let coords,road;
 if(mode==='pickup'){
  if(onTrip)return null;
  coords=started?remainder(pickup,s.progress):pickup.coords;road=started?Math.max(0,pickup.distance*(1-s.progress/(pickup.cumulative.at(-1)||1))):pickup.distance;
 }else{
  const r=onTrip?trip:pickup;coords=started?remainder(r,s.progress):r.coords;road=started?Math.max(0,r.distance*(1-s.progress/(r.cumulative.at(-1)||1))):r.distance;
  if(!onTrip){coords=[...coords,...trip.coords.slice(1)];road+=trip.distance;}
 }
 return {coords,road,a:coords[0],b:coords.at(-1)};
}
function renderComparison(){
 if(!s.routes)return;
 const v=comparison();
 if(!v){$('direct').textContent=$('road').textContent='—';$('ratio').textContent='Pickup is behind the vehicle. Select another comparison.';$('coordinates').textContent='';$('insight').textContent='Passenger is onboard. Compare the driver to the destination.';source('direct',[]);source('comparison',[]);drawOverview([]);return;}
 const direct=distance(v.a,v.b),road=v.road,max=Math.max(direct,road,1),threshold=Number($('threshold').value)||1200;
 $('direct').textContent=fmt(direct);$('road').textContent=fmt(road);$('direct-bar').style.width=`${100*direct/max}%`;$('road-bar').style.width=`${100*road/max}%`;
 $('ratio').textContent=direct>1?`${(road/direct).toFixed(2)}× direct distance · ${fmt(Math.max(0,road-direct))} extra driving`:'Endpoints occupy the same road location.';
 const split=direct<=threshold&&road>threshold;$('insight').dataset.split=split;
 $('insight').textContent=split?`Close by sight, far by road: within ${threshold} m directly, outside ${threshold} m by driving.`:`Both measures are ${road<=threshold?'within':'beyond'} the ${threshold} m close threshold.`;
 $('coordinates').textContent=`A: ${v.a[1].toFixed(5)}° N, ${Math.abs(v.a[0]).toFixed(5)}° W · B: ${v.b[1].toFixed(5)}° N, ${Math.abs(v.b[0]).toFixed(5)}° W`;
 source('direct',[v.a,v.b]);source('comparison',v.coords);drawOverview(v.coords);
}
function drawOverview(coords){
 const ctx=$('overview').getContext('2d'),w=580,h=280;ctx.clearRect(0,0,w,h);if(!coords.length)return;
 const lat=coords[0][1]*Math.PI/180,k=Math.cos(lat),xs=coords.map(p=>p[0]*k),ys=coords.map(p=>-p[1]);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const scale=Math.min((w-80)/(maxX-minX||.0001),(h-60)/(maxY-minY||.0001));
 const p=c=>[w/2+(c[0]*k-(minX+maxX)/2)*scale,h/2+(-c[1]-(minY+maxY)/2)*scale];
 function line(points,color,dash=[]){ctx.beginPath();ctx.lineWidth=5;ctx.strokeStyle=color;ctx.setLineDash(dash);points.forEach((c,i)=>i?ctx.lineTo(...p(c)):ctx.moveTo(...p(c)));ctx.stroke();ctx.setLineDash([]);}
 line(coords,'#7952b3');line([coords[0],coords.at(-1)],'#d8488a',[9,7]);
 for(const [c,label] of [[coords[0],'A'],[coords.at(-1),'B']]){const [x,y]=p(c);ctx.fillStyle='#493956';ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.font='bold 17px sans-serif';ctx.fillText(label,x+10,y-8);}ctx.font='13px sans-serif';ctx.fillText('N ↑',15,22);
}
function fit(){if(!s.routes)return;const b=new maplibregl.LngLatBounds();for(const c of [...s.routes.pickup.coords,...s.routes.trip.coords])b.extend(c);const mobile=innerWidth<650;map.fitBounds(b,{padding:mobile?{top:115,bottom:innerHeight*.45,left:35,right:35}:{top:150,bottom:140,left:365,right:270},maxZoom:16.5,duration:900});}
function drawDriving(){const r=currentRoute();if(r)source('drive',remainder(r,s.progress));}
function arrive(){
 const r=currentRoute();s.driver=[...r.to];s.progress=r.cumulative.at(-1);updateMarkers();
 if(s.phase==='pickup'){setStatus('arrived');msg('Driver arrived. Press Start Ride to board the passenger.');}
 else {setStatus('completed');msg('Destination reached. Trip completed. Plan / Reset starts a new trip.');}
 renderComparison();
}
function frame(now){
 requestAnimationFrame(frame);const dt=Math.min((now-(last||now))/1000,.15);last=now;
 if(!s.routes)return;
 if(['pickup','trip'].includes(s.status)&&!s.paused){const r=currentRoute(),total=r.cumulative.at(-1);const metersPerSecond=total/Math.max(r.duration,1);s.progress=Math.min(total,s.progress+dt*Number($('speed').value)*metersPerSecond/Number($('congestion').value));s.driver=along(r.coords,r.cumulative,s.progress).point;updateMarkers();if(s.progress>=total)arrive();if($('follow').checked)map.jumpTo({center:s.driver});}
 if(now-lastUI>250){lastUI=now;const r=currentRoute(),fraction=Math.max(0,1-s.progress/(r.cumulative.at(-1)||1));$('remaining').textContent=fmt(r.distance*fraction);$('eta').textContent=`${(r.duration*fraction*Number($('congestion').value)/60).toFixed(1)} min`;
 drawDriving();renderComparison();}
}
function setup(){
 for(const [kind,initial] of [['driver',0],['pickup',1],['destination',2]]){
  const select=$(`${kind}-place`);places.forEach(([name],i)=>select.add(new Option(name,i)));select.value=initial;s.inputs[kind]=[...places[initial][1]];select.onchange=()=>{s.inputs[kind]=[...(select.value==='custom'?s.custom[kind]:places[Number(select.value)][1])];plan();};
 }
 $('plan').onclick=plan;$('accept').onclick=()=>{if(s.status!=='ready')return;s.phase='pickup';s.progress=0;s.paused=false;setStatus('pickup');msg('Automatically driving to pickup.');};
 $('start').onclick=()=>{if(s.status!=='arrived')return;s.phase='trip';s.progress=0;s.paused=false;setStatus('trip');$('compare').value='remaining';msg('Passenger onboard. Automatically driving to destination.');};
 $('pause').onclick=()=>{s.paused=!s.paused;controls();msg(s.paused?'Driving paused.':'Automatic driving resumed.');};
 $('cancel').onclick=()=>{s.paused=false;setStatus('cancelled');msg('Trip cancelled. Vehicle stopped at its current location.');};
 $('view').onclick=fit;$('compare').onchange=renderComparison;$('threshold').oninput=renderComparison;
 let buildings=true;$('buildings').onclick=()=>{buildings=!buildings;map.setLayoutProperty('3d-buildings','visibility',buildings?'visible':'none');$('buildings').textContent=`3D buildings: ${buildings?'on':'off'}`;$('buildings').setAttribute('aria-pressed',String(buildings));};
 document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{s.selecting=b.dataset.place;$('edit-hint').textContent=`Click a Midtown road to place the ${s.selecting}.`;});
 map.on('click',e=>{if(!s.selecting)return;const {lng,lat}=e.lngLat;if(lng< -74.025||lng> -73.95||lat<40.73||lat>40.79){msg('Please select a location in Midtown Manhattan.');return;}const kind=s.selecting;s.inputs[kind]=[lng,lat];s.custom[kind]=[lng,lat];const sel=$(`${kind}-place`);const old=sel.querySelector('option[value="custom"]');old?.remove();sel.add(new Option('Custom map location','custom'));sel.value='custom';s.selecting=null;$('edit-hint').textContent='Endpoint placed. Route uses the nearest drivable road.';plan();});
}
if(typeof maplibregl!=='undefined'){
 map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/bright',center:[-73.9835,40.755],zoom:15.3,pitch:52,bearing:-29,maxPitch:75,minZoom:11,maxZoom:19});
 map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
 map.on('error',()=>{if(s.status==='loading')msg('Map data is taking time to load. Check your internet connection; reload to retry.');});
 map.on('load',()=>{
  map.addLayer({id:'3d-buildings',source:'openmaptiles','source-layer':'building',type:'fill-extrusion',minzoom:14,paint:{'fill-extrusion-color':'#c9b9d5','fill-extrusion-height':['coalesce',['get','render_height'],8],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.63}});
  for(const id of ['comparison','drive','direct']){map.addSource(id,{type:'geojson',data:empty});map.addLayer({id,source:id,type:'line',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':id==='direct'?'#d8488a':id==='drive'?'#38a8c1':'#7952b3','line-width':id==='drive'?4:3,'line-opacity':.95,...(id==='direct'?{'line-dasharray':[2,2]}:{})}});}
  setup();plan();requestAnimationFrame(frame);
 });
}
