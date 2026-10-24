const $=id=>document.getElementById(id);let map,origin=[101.7123,3.1579],dest=null,lines=[],markers=[],routeData=[],selected=0,busy=false,locationMarker=null,accuracyCircle=null,defaultMarker=null,locating=false;
function status(t){$('status').textContent=t}function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} 
if(window.L){map=L.map('map',{zoomControl:false,minZoom:2,maxZoom:19,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1}).setView([3.1515,101.707],13);initMapTheme(map);L.control.zoom({position:'bottomright'}).addTo(map);defaultMarker=L.circleMarker([origin[1],origin[0]],{radius:8,color:'#fff',weight:4,fillColor:'#386f59',fillOpacity:1}).addTo(map).bindPopup('默认起点：KLCC')}else status('地图组件加载失败，请刷新页面重试。');
$('origin').addEventListener('input',()=>origin=null);$('destination').addEventListener('input',()=>dest=null);
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(18000)});if(!r.ok)throw Error('网络服务暂时不可用');return r.json()}
async function geocode(q){return json('https://nominatim.openstreetmap.org/search?format=json&limit=5&q='+encodeURIComponent(q))}
function locate(){
if(busy||locating)return;
if(!navigator.geolocation)return status('浏览器不支持定位，请手动输入起点。');
locating=true;$('locate').disabled=true;$('maploc').disabled=true;$('search').disabled=true;
$('locate').textContent='◎ 正在定位…';status('正在获取你的位置，请允许浏览器访问位置信息。');
const finish=()=>{locating=false;$('locate').disabled=false;$('maploc').disabled=false;$('search').disabled=false;$('locate').textContent='◎ Current location · 当前位置'};
navigator.geolocation.getCurrentPosition(async p=>{
origin=[p.coords.longitude,p.coords.latitude];$('origin').value='Current location · 当前位置';
reset();routeData=[];
if(map){
if(defaultMarker)map.removeLayer(defaultMarker);
if(locationMarker)map.removeLayer(locationMarker);
if(accuracyCircle)map.removeLayer(accuracyCircle);
accuracyCircle=L.circle([origin[1],origin[0]],{radius:p.coords.accuracy,color:'#4285f4',weight:1,fillColor:'#4285f4',fillOpacity:.1}).addTo(map);
locationMarker=L.circleMarker([origin[1],origin[0]],{radius:9,color:'#fff',weight:3,fillColor:'#4285f4',fillOpacity:1}).addTo(map).bindPopup('你的位置 · 精度约 '+Math.round(p.coords.accuracy)+' 米').openPopup();
map.setView([origin[1],origin[0]],15);
}
$('maptitle').textContent='你在这里。';$('mapsub').textContent='已将当前位置设为起点';
status('已使用当前位置作为起点，定位精度约 '+Math.round(p.coords.accuracy)+' 米。');
finish();
if(dest){busy=true;$('search').disabled=true;try{await route()}catch(e){status(e.message)}finally{busy=false;$('search').disabled=false}}
},e=>{finish();status(e.code===1?'位置权限被拒绝，请在浏览器的网站设置中允许位置访问，然后重试。':e.code===3?'定位超时，请到信号较好的地方重试。':'暂时无法确定你的位置，请稍后重试或手动输入起点。')},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
}
$('locate').onclick=locate;$('maploc').onclick=locate;
$('search').onclick=async()=>{if(busy||locating)return;if(!$('destination').value.trim())return status('先输入想去的地方。');busy=true;$('search').disabled=true;$('matches').innerHTML='';try{if(!origin){status('正在查找起点…');const o=await geocode($('origin').value);if(!o.length)throw Error('找不到起点，请补充城市或街道名称。');origin=[+o[0].lon,+o[0].lat]}if(dest){await route();return}status('正在搜索目的地…');const results=await geocode($('destination').value);if(!results.length)throw Error('找不到这个地点，请尝试更详细的地址。');status('请选择目的地：');results.forEach(r=>{const b=document.createElement('button');b.textContent=r.display_name;b.onclick=async()=>{if(busy)return;dest=[+r.lon,+r.lat];$('destination').value=r.display_name.split(',').slice(0,2).join(',');$('matches').innerHTML='';busy=true;try{await route()}catch(e){status(e.message)}finally{busy=false}};$('matches').append(b)})}catch(e){status(e.name==='TimeoutError'?'请求超时，请稍后再试。':e.message)}finally{busy=false;$('search').disabled=false}};
document.querySelectorAll('[data-place]').forEach(b=>b.onclick=()=>{if(busy||locating)return;dest=[+b.dataset.lng,+b.dataset.lat];$('destination').value=b.dataset.place;$('search').click()});
async function route(){status('正在规划驾车路线…');const r=await json('https://router.project-osrm.org/route/v1/driving/'+origin.join(',')+';'+dest.join(',')+'?overview=full&geometries=geojson&alternatives=true&steps=true');if(r.code!=='Ok'||!r.routes?.length)throw Error('这两个地点之间没有可用的驾车路线。');routeData=r.routes.slice(0,3);$('routes').innerHTML='<div class="section">选择你的路线 <button class="clear" id="reset">清除</button></div>';routeData.forEach((r,i)=>{const el=document.createElement('div');el.className='result';el.tabIndex=0;el.setAttribute('role','button');el.innerHTML=`${i===0?'<span class="pill">推荐路线</span>':''}<strong>${Math.round(r.duration/60)} <small>分钟</small></strong><p>${(r.distance/1000).toFixed(1)} km · ${i===0?'推荐驾车路线':'备选路线 '+i}</p>`;el.onclick=()=>choose(i);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(i)}};$('routes').append(el)});$('reset').onclick=reset;$('suggestions').classList.add('hidden');$('go').classList.remove('hidden');choose(0);status('路线基于道路数据估算，不包含实时交通、事故或封路信息。')}
function choose(i){selected=i;lines.forEach(l=>map?.removeLayer(l));markers.forEach(m=>map?.removeLayer(m));lines=[];markers=[];document.querySelectorAll('.result').forEach((e,j)=>e.classList.toggle('active',i===j));if(map){routeData.forEach((r,j)=>{if(j!==i)lines.push(L.geoJSON(r.geometry,{style:{color:'#f7f4dc',weight:5,opacity:.85}}).addTo(map))});lines.push(L.geoJSON(routeData[i].geometry,{style:{color:'#152718',weight:11,opacity:.9}}).addTo(map));const line=L.geoJSON(routeData[i].geometry,{style:{color:'#d9f36e',weight:7}}).addTo(map);lines.push(line);[origin,dest].forEach((p,j)=>markers.push(L.circleMarker([p[1],p[0]],{radius:8,color:'white',weight:3,fillColor:j?'#233f35':'#87ab62',fillOpacity:1}).addTo(map).bindPopup(j?'目的地':'起点')));map.fitBounds(line.getBounds(),{padding:[50,50]})}$('maptitle').textContent='每一段路，都有好风景。';$('mapsub').textContent=`驾车 ${(routeData[i].distance/1000).toFixed(1)} km · 预计 ${Math.round(routeData[i].duration/60)} 分钟`;$('instructions').classList.add('hidden')}
$('go').onclick=()=>{const list=$('instructions');list.innerHTML=routeData[selected].legs.flatMap(l=>l.steps).map(s=>{const names={depart:'出发',arrive:'抵达目的地',turn:'转弯',merge:'汇入',fork:'在岔路口行驶',roundabout:'进入环岛',continue:'继续行驶','new name':'继续行驶','end of road':'行至路口',rotary:'进入环岛','on ramp':'驶入匝道','off ramp':'驶出匝道'};const mods={left:'向左',right:'向右','slight left':'稍向左','slight right':'稍向右',straight:'直行','sharp left':'急左转','sharp right':'急右转',uturn:'掉头'};return `<li>${esc(names[s.maneuver.type]||'继续行驶')} ${esc(mods[s.maneuver.modifier]||'')}${s.name?' · '+esc(s.name):''} <span style="color:#819177">${s.distance>=1000?(s.distance/1000).toFixed(1)+' km':Math.round(s.distance)+' m'}</span></li>`}).join('');list.classList.toggle('hidden');status('行程指引仅供出发前查看；此版本不提供实时语音导航。')};
function reset(){lines.forEach(l=>map?.removeLayer(l));markers.forEach(m=>map?.removeLayer(m));lines=[];markers=[];$('routes').innerHTML='';$('go').classList.add('hidden');$('instructions').classList.add('hidden');$('suggestions').classList.remove('hidden');$('maptitle').textContent='你好，吉隆坡。';$('mapsub').textContent='移动地图，发现城市的另一面。';status('');map?.setView([3.1515,101.707],13)}
