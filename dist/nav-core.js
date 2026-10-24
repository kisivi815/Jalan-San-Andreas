/* Geometry and maneuver calculations shared by live navigation and tests. */
(function(root){
  const R=6371000,rad=d=>d*Math.PI/180;
  function distance(a,b){const x=rad(b[1]-a[1]),y=rad(b[0]-a[0]);const h=Math.sin(x/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
  function prepare(route){
    const points=route.geometry?.coordinates;
    if(!points||points.length<2)throw Error('路线缺少可用于导航的道路坐标。');
    const cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+distance(points[i-1],points[i]));
    const total=cumulative.at(-1);if(!total)throw Error('路线长度无效。');
    const raw=route.legs.flatMap(l=>l.steps||[]);if(!raw.length)throw Error('路线缺少转弯指引。');
    const sum=raw.reduce((n,s)=>n+s.distance,0)||route.distance||total;
    let walked=0;
    const steps=raw.map((s,i)=>{const from=walked/sum*total;walked+=s.distance;return {...s,index:i,from,to:walked/sum*total}});
    return {points,cumulative,total,steps,duration:route.duration,distance:route.distance,route};
  }
  function project(point,model,previous=null){
    const cos=Math.cos(rad(point[1]));let best=null;
    for(let i=1;i<model.points.length;i++){
      const a=model.points[i-1],b=model.points[i];const ax=rad(a[0]-point[0])*R*cos,ay=rad(a[1]-point[1])*R;
      const bx=rad(b[0]-point[0])*R*cos,by=rad(b[1]-point[1])*R;const dx=bx-ax,dy=by-ay;
      const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
      const gap=Math.hypot(ax+t*dx,ay+t*dy),along=model.cumulative[i-1]+t*(model.cumulative[i]-model.cumulative[i-1]);
      const penalty=previous===null?0:Math.max(0,previous-along-30)*.15+Math.max(0,along-previous-1000)*.02;
      if(!best||gap+penalty<best.score)best={distance:gap,along,score:gap+penalty,segment:i-1,point:[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]};
    }return best;
  }
  function remaining(model,progress){
    const along=Math.max(0,Math.min(model.total,progress));
    // Ignore departed maneuver; the next step begins at the upcoming junction.
    const next=model.steps.find(s=>s.index>0&&s.from>along+1)||model.steps.at(-1);
    const seconds=model.steps.reduce((n,s)=>n+(s.to>along?s.duration*(s.to-Math.max(s.from,along))/(s.to-s.from||1):0),0);
    return {step:next,turnDistance:Math.max(0,next.from-along),distance:Math.max(0,model.distance*(1-along/model.total)),seconds};
  }
  function instruction(step){
    const m=step.maneuver||{},mod=m.modifier||'',road=step.name?'，进入 '+step.name:'';
    const directions={'left':'左转','right':'右转','slight left':'稍向左转','slight right':'稍向右转','sharp left':'向左急转','sharp right':'向右急转','uturn':'掉头','straight':'直行'};
    if(m.type==='arrive')return '抵达目的地';
    if(['roundabout','rotary','roundabout turn','exit roundabout','exit rotary'].includes(m.type))return (m.type.startsWith('exit')?'驶出环岛':'进入环岛')+(m.exit?'，从第 '+m.exit+' 个出口驶出':'')+road;
    if(m.type==='merge')return '汇入道路'+road;
    if(m.type==='on ramp')return '驶入匝道'+road;
    if(m.type==='off ramp')return '驶出匝道'+road;
    if(m.type==='fork')return (mod.includes('left')?'岔路靠左':mod.includes('right')?'岔路靠右':'沿岔路直行')+road;
    if(m.type==='depart')return '沿当前道路出发'+road;
    if(['turn','end of road','continue'].includes(m.type)&&directions[mod])return directions[mod]+road;
    return '继续直行'+road;
  }
  function arrow(step){const m=step.maneuver||{};if(m.type==='arrive')return '⚑';if((m.type||'').includes('roundabout')||(m.type||'').includes('rotary'))return '⟳';if(m.modifier==='uturn')return '↶';return m.modifier?.includes('left')?'↰':m.modifier?.includes('right')?'↱':'↑'}
  function formatDistance(m){return m>=1000?(m/1000).toFixed(1)+' 公里':Math.max(0,Math.round(m/10)*10)+' 米'}
  const api={distance,prepare,project,remaining,instruction,arrow,formatDistance};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NavCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
