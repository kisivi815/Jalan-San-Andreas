/* Foreground GPS navigation. Server routing is requested only at start / confirmed deviation. */
function createLiveNavigation({map,getSelection,planRoute,onRoute,onStatus}){
  const C=NavCore,$=id=>document.getElementById(id);
  let active=false,watch=null,tick=null,epoch=0,controller=null,model=null,progress=0,latest=null,lastGood=0,started=0;
  let follow=true,planning=false,offSince=null,offCount=0,lastPlan=-Infinity,announced=new Set(),wake=null,player=null,halo=null,target=null;
  const voiceAvailable='speechSynthesis' in window&&'SpeechSynthesisUtterance' in window;
  const clips={locating:'locating',depart:'depart',rerouted:'rerouted',arrive:'arrive',voice:'voice-on',left:'left',right:'right','slight left':'slight-left','slight right':'slight-right','sharp left':'sharp-left','sharp right':'sharp-right',straight:'straight',uturn:'uturn',merge:'merge','on ramp':'on-ramp','off ramp':'off-ramp','fork-left':'fork-left','fork-right':'form-right',roundabout:'roundabout-enter','exit roundabout':'roudabout-exit'};
  let playing=null,voiceToken=0;
  function cancelVoice(){voiceToken++;if(playing){playing.pause();playing=null}if(voiceAvailable)speechSynthesis.cancel()}
  function clipFor(step){const m=step.maneuver||{},t=m.type||'',mod=m.modifier||'';if(t==='fork')return clips['fork-'+mod];if(['roundabout','rotary','roundabout turn'].includes(t))return clips.roundabout;if(['exit roundabout','exit rotary'].includes(t))return clips['exit roundabout'];if(t==='arrive')return clips.arrive;if(t==='depart')return clips.depart;return clips[t]||clips[mod]||null}
  function message(s){$('nav-state').textContent=s}
  function speak(text,clip=null,context=''){if($('nav-voice').getAttribute('aria-pressed')==='false')return;
    cancelVoice();const token=voiceToken;
    function tts(words,done){if(!voiceAvailable){done?.();return}try{const u=new SpeechSynthesisUtterance(words);u.lang='zh-CN';const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('zh'));if(v)u.voice=v;u.onend=()=>{if(token===voiceToken)done?.()};speechSynthesis.speak(u)}catch{if(token===voiceToken)done?.()}}
    function play(){if(token!==voiceToken)return;const a=new Audio('audio/'+clip+'.mp3');playing=a;a.onended=()=>{if(playing===a)playing=null};a.play().catch(()=>{if(token===voiceToken){playing=null;tts(text)}})}
    if(clip){if(context)tts(context,play);else play()}else tts(text);
  }
  async function keepAwake(){if(!active||document.visibilityState!=='visible'||!navigator.wakeLock||wake)return;const token=epoch;
    try{const lock=await navigator.wakeLock.request('screen');if(!active||token!==epoch){await lock.release();return}wake=lock;lock.addEventListener('release',()=>{if(wake===lock)wake=null})}catch{}
  }
  function lockControls(locked){
    ['origin','destination','search','locate'].forEach(id=>$(id).disabled=locked);
    $('routes').classList.toggle('nav-locked',locked);$('routes').inert=locked;$('show-steps').disabled=locked;
    document.querySelectorAll('[data-place]').forEach(b=>b.disabled=locked);
    $('go').disabled=locked;$('go').textContent=locked?'正在导航…':'开始实时导航 ↗';
    document.body.classList.toggle('navigating',locked);
    map?.invalidateSize?.({pan:false});
  }
  function clearGraphics(){if(player){map.removeLayer(player);player=null}if(halo){map.removeLayer(halo);halo=null}}
  function stop(reason='已结束导航。',arrived=false){
    active=false;epoch++;if(watch!==null){navigator.geolocation.clearWatch(watch);watch=null}clearInterval(tick);tick=null;
    controller?.abort();controller=null;planning=false;model=null;announced.clear();
    if(wake){wake.release().catch(()=>{});wake=null}cancelVoice();
    clearGraphics();lockControls(false);$('nav-panel').classList.toggle('hidden',!arrived);$('nav-recenter').classList.add('hidden');
    if(arrived){$('nav-distance').textContent='已抵达';$('nav-turn').textContent='目的地就在附近';$('nav-arrow').textContent='⚑';message('行程完成');$('nav-stop').textContent='关闭';speak('已抵达目的地，导航结束。',clips.arrive)}
    else $('nav-panel').classList.add('hidden');
    onStatus(reason);
  }
  function renderPlayer(fix){const p=[fix.point[1],fix.point[0]];
    if(!player){player=L.marker(p,{zIndexOffset:2000,interactive:false,icon:L.divIcon({className:'nav-player',html:'<span>▲</span>',iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map);halo=L.circle(p,{radius:fix.accuracy,color:'#4389ff',weight:1,fillColor:'#4389ff',fillOpacity:.12,interactive:false}).addTo(map)}
    else {player.setLatLng(p);halo.setLatLng(p);halo.setRadius(fix.accuracy)}
    const heading=player.getElement()?.querySelector('span');if(heading&&Number.isFinite(fix.heading))heading.style.transform=`rotate(${fix.heading}deg)`;
    if(follow)map.setView(p,Math.max(16,map.getZoom()),{animate:false});
  }
  function showRemaining(r){$('nav-arrow').textContent=C.arrow(r.step);$('nav-distance').textContent=C.formatDistance(r.turnDistance);$('nav-turn').textContent=C.instruction(r.step);
    $('nav-left').textContent=C.formatDistance(r.distance);$('nav-time').textContent=Math.max(1,Math.ceil(r.seconds/60))+' 分钟';
    $('nav-eta').textContent=new Date(Date.now()+r.seconds*1000).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
  }
  async function replan(fix,initial=false){
    if(!active||planning)return;planning=true;lastPlan=Date.now();offSince=null;offCount=0;
    const token=epoch;controller=new AbortController();message(initial?'正在从当前位置规划路线…':'已偏离路线，正在重新规划…');
    try{const route=await planRoute(fix.point,target,controller.signal,fix);if(!active||token!==epoch)return;
      model=C.prepare(route);progress=0;announced.clear();onRoute(route,fix.point);speak(initial?'导航开始':'路线已重新规划',initial?clips.depart:clips.rerouted);
      if(latest&&Date.now()-lastGood<15000)update(latest,true);else message('等待新 GPS 位置后继续导航…');
    }catch(e){if(!active||token!==epoch)return;message(initial?'汽车路线获取失败，请结束后重试。':'汽车路线重算失败，请勿按旧提示继续行驶。');onStatus(e.message||'导航路线请求失败，请检查网络。');}
    finally{if(token===epoch){planning=false;controller=null}}
  }
  function update(fix,afterPlan=false){
    if(!active||!model)return;
    const match=C.project(fix.point,model,progress),limit=Math.max(45,fix.accuracy*1.5);
    const roadHeading=C.bearing(model.points[match.segment],model.points[match.segment+1]);
    const opposite=Number.isFinite(fix.routingHeading)&&C.angleDifference(fix.routingHeading,roadHeading)>110;
    const backwards=match.along<progress-Math.max(25,fix.accuracy*2);
    if(match.distance>limit||opposite||backwards){
      if(offSince===null)offSince=Date.now();offCount++;
      message(opposite||backwards?'行进方向与路线不一致 · 正在确认':'已偏离路线 · 正在确认位置');
      $('nav-distance').textContent='确认位置';$('nav-turn').textContent='暂不提供转弯提示，正在核对行进方向';
      cancelVoice();
      if(offCount>=3&&Date.now()-offSince>=5000&&Date.now()-lastPlan>=20000)replan(fix);
      return;
    }
    offSince=null;offCount=0;progress=Math.max(progress,match.along);const r=C.remaining(model,progress);showRemaining(r);
    if(!planning||afterPlan)message('GPS 导航中 · 精度约 '+Math.round(fix.accuracy)+' 米');
    const endpoint=model.points.at(-1);
    if(model.total-progress<30&&C.distance(fix.point,endpoint)<35){stop('已抵达目的地。',true);return}
    const band=r.turnDistance>500?'far':r.turnDistance>200?'500':r.turnDistance>50?'200':'now';const key=r.step.index+':'+band;
    if(!announced.has(key)){
      // Remember earlier bands too so a small GPS bounce cannot repeat announcements.
      for(const b of ['far','500','200','now'].slice(0,['far','500','200','now'].indexOf(band)+1))announced.add(r.step.index+':'+b);
      const prefix=r.turnDistance>30?'前方 '+C.formatDistance(r.turnDistance)+'，':'现在，';
      const m=r.step.maneuver||{},context=prefix+(m.exit?'从第 '+m.exit+' 个出口驶出，':'')+(r.step.name?'道路 '+r.step.name:'');
      speak(prefix+C.instruction(r.step),clipFor(r.step),context);
    }
  }
  function position(p){
    if(!active)return;const coords=p.coords,now=Date.now();
    if(!Number.isFinite(coords.latitude)||!Number.isFinite(coords.longitude)||!Number.isFinite(coords.accuracy)||coords.accuracy<0)return;
    if(p.timestamp&&now-p.timestamp>15000)return;
    const fix={point:[coords.longitude,coords.latitude],accuracy:coords.accuracy,heading:coords.heading,speed:coords.speed,timestamp:p.timestamp||now,routingHeading:null};
    if(fix.accuracy<=30&&Number.isFinite(coords.speed)&&coords.speed>=2&&Number.isFinite(coords.heading))fix.routingHeading=(coords.heading%360+360)%360;
    if(latest&&fix.timestamp<=latest.timestamp)return;
    if(fix.accuracy>80){message('GPS 精度较低，等待更准确的位置…');return}
    if(latest){const elapsed=(fix.timestamp-latest.timestamp)/1000;if(C.distance(latest.point,fix.point)>Math.max(300,elapsed*70)){message('定位出现跳动，等待稳定信号…');return}}
    if(fix.routingHeading===null&&latest&&fix.accuracy<=30&&latest.accuracy<=30){
      const seconds=(fix.timestamp-latest.timestamp)/1000,moved=C.distance(latest.point,fix.point);
      if(seconds>=1&&seconds<=10&&moved>=Math.max(15,fix.accuracy+latest.accuracy)&&moved/seconds>=2){fix.routingHeading=C.bearing(latest.point,fix.point);fix.heading=fix.routingHeading;}
    }
    latest=fix;lastGood=now;renderPlayer(fix);
    if(!model){if(!planning&&now-lastPlan>=20000)replan(fix,true);return}
    if(!planning)update(fix);
  }
  function geoError(e){if(!active)return;if(e.code===1){stop('位置权限被拒绝，请在浏览器设置中允许定位后再开始导航。');return}message(e.code===3?'GPS 定位超时，正在等待信号…':'GPS 暂不可用，正在等待信号…')}
  function start(){
    if(active)return;const selection=getSelection();if(!selection?.route||!selection.destination)return onStatus('请先选择目的地并规划路线。');
    if(!navigator.geolocation)return onStatus('浏览器不支持实时定位。');if(!map)return onStatus('地图尚未加载，请刷新重试。');
    target=[...selection.destination];active=true;epoch++;model=null;progress=0;latest=null;lastGood=0;started=Date.now();lastPlan=-Infinity;planning=false;follow=true;offSince=null;offCount=0;announced.clear();
    lockControls(true);window.scrollTo?.({top:0,left:0,behavior:'instant'});
    window.requestAnimationFrame?.(()=>{window.scrollTo?.({top:0,left:0,behavior:'instant'});map?.invalidateSize?.({pan:false})});
    $('nav-panel').classList.remove('hidden');$('nav-stop').textContent='结束';$('nav-distance').textContent='定位中';$('nav-turn').textContent='正在获取你的实时位置';$('nav-arrow').textContent='◎';
    ['nav-left','nav-time','nav-eta'].forEach(id=>$(id).textContent='—');message('请允许浏览器获取精确位置');
    onStatus('导航期间请保持网页在前台打开。');speak('正在获取位置，准备导航',clips.locating);keepAwake();
    try{watch=navigator.geolocation.watchPosition(position,geoError,{enableHighAccuracy:true,maximumAge:0,timeout:15000})}catch{stop('无法启动定位，请检查浏览器权限。');return}
    tick=setInterval(()=>{if(!active)return;if(Date.now()-(lastGood||started)>15000){message('GPS 信号中断，等待定位恢复…');cancelVoice()}},2000);
  }
  $('nav-stop').onclick=()=>stop();
  $('nav-recenter').onclick=()=>{follow=true;$('nav-recenter').classList.add('hidden');if(latest)renderPlayer(latest)};
  $('nav-voice').onclick=()=>{const muted=$('nav-voice').getAttribute('aria-pressed')==='true';$('nav-voice').setAttribute('aria-pressed',String(!muted));$('nav-voice').textContent=muted?'语音关闭':'语音开启';if(muted)cancelVoice();else speak('语音导航已开启',clips.voice)};
  map?.on('dragstart',()=>{if(active){follow=false;$('nav-recenter').classList.remove('hidden')}});
  document.addEventListener('visibilitychange',()=>{if(active){if(document.visibilityState==='visible')keepAwake();else message('网页在后台，返回前台以继续导航')}});
  window.addEventListener('pagehide',()=>{if(active)stop()});
  return {start,stop,isActive:()=>active,recenter(){if(active&&latest){follow=true;renderPlayer(latest);$('nav-recenter').classList.add('hidden')}},getState:()=>({active,planning,progress,watch,hasRoute:!!model})};
}



