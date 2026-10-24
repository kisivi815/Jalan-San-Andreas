const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),C=require('../dist/nav-core.js');
const points=[[101.7,3.15],[101.701,3.15],[101.701,3.151],[101.702,3.151]];
const lengths=points.slice(1).map((p,i)=>C.distance(points[i],p));
const route={geometry:{type:'LineString',coordinates:points},distance:lengths.reduce((a,b)=>a+b),duration:180,legs:[{steps:points.map((p,i)=>({distance:lengths[i]||0,duration:i<3?60:0,name:['First','Second','Third',''][i],maneuver:{type:i===0?'depart':i===3?'arrive':'turn',modifier:i===1?'left':'right',location:p}}))}]};

test('GPS projection follows bends and advances instructions only after the junction',()=>{
 const m=C.prepare(route),a=C.project([101.7005,3.15],m);
 assert(a.distance<1);assert(Math.abs(a.along-lengths[0]/2)<1);
 assert.equal(C.remaining(m,a.along).step.index,1);
 assert.equal(C.remaining(m,lengths[0]-5).step.index,1);
 assert.equal(C.remaining(m,lengths[0]+10).step.index,2);
 const remaining=C.remaining(m,lengths[0]+lengths[1]/2);
 assert(remaining.distance<route.distance/2+5);assert(remaining.seconds<120);
 assert(C.project([101.7,3.153],m).distance>200);
 assert.equal(C.instruction(route.legs[0].steps[1]),'左转，进入 Second');
});
function setup(){
 let clock=200000,watcher,onError,cleared=[],requests=0,pendingResolve,routeCallbacks=0;
 const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false,inert:false,classList:{add(){},remove(){},toggle(){}},attrs:{'aria-pressed':'false'},getAttribute(k){return this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}});return elements.get(id)};
 const graphic=()=>({addTo(){return this},setLatLng(){return this},setRadius(){},getElement(){return null}});
 const map={on(){},removeLayer(){},setView(){},getZoom:()=>16};
 const context={NavCore:C,AbortController,Date:class extends Date{constructor(...a){super(...(a.length?a:[clock]))}static now(){return clock}},
 document:{getElementById:el,querySelectorAll:()=>[],body:{classList:{toggle(){}}},addEventListener(){},visibilityState:'visible'},
 window:{addEventListener(){}},navigator:{geolocation:{watchPosition(a,b){watcher=a;onError=b;return 42},clearWatch(id){cleared.push(id)}}},
 L:{marker:graphic,circle:graphic,divIcon:x=>x},setInterval:()=>1,clearInterval(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('dist/navigation.js','utf8'),context);
 const nav=context.createLiveNavigation({map,getSelection:()=>({route,destination:points.at(-1)}),planRoute:async()=>{requests++;return await new Promise(r=>pendingResolve=r)},onRoute:()=>routeCallbacks++,onStatus(){}});
 return {nav,el,advance:n=>clock+=n,fix:(point,accuracy=5)=>watcher({coords:{longitude:point[0],latitude:point[1],accuracy,heading:90},timestamp:clock}),error:e=>onError(e),resolve:async()=>{pendingResolve(route);await new Promise(setImmediate)},get requests(){return requests},get callbacks(){return routeCallbacks},cleared};
}
test('starts GPS watch, routes from live position, updates progress and clears watch on arrival',async()=>{
 const s=setup();s.nav.start();assert(s.nav.isActive());assert.equal(s.nav.getState().watch,42);
 s.fix(points[0]);assert.equal(s.requests,1);await s.resolve();assert(s.nav.getState().hasRoute);
 assert.match(s.el('nav-turn').textContent,/左转/);s.advance(3000);s.fix([101.7007,3.15]);assert(s.nav.getState().progress>70);
 s.advance(3000);s.fix([101.701,3.1505]);assert.match(s.el('nav-turn').textContent,/右转/);
 s.advance(3000);s.fix(points.at(-1));assert(!s.nav.isActive());assert.deepEqual(s.cleared,[42]);assert.equal(s.el('nav-distance').textContent,'已抵达');
});
test('ignores inaccurate GPS, confirms deviation, and aborts stale request after stopping',async()=>{
 const s=setup();s.nav.start();s.fix(points[0],200);assert.equal(s.requests,0);s.advance(1);s.fix(points[0]);await s.resolve();
 s.advance(21000);s.fix([101.7,3.153]);assert.equal(s.requests,1);
 s.advance(3000);s.fix([101.7,3.153]);s.advance(3000);s.fix([101.7,3.153]);assert.equal(s.requests,2);
 s.advance(3000);s.fix([101.7,3.153]);assert.equal(s.requests,2);
 s.nav.stop();await s.resolve();assert.equal(s.callbacks,1);assert(!s.nav.isActive());assert.deepEqual(s.cleared,[42]);
});
test('permission denial ends navigation and releases location tracking',()=>{const s=setup();s.nav.start();s.error({code:1});assert(!s.nav.isActive());assert.deepEqual(s.cleared,[42]);assert.equal(s.el('origin').disabled,false)});
