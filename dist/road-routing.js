// Car routing restrictions are enforced by the routing server's road graph.
// These options constrain snapping and heading; they cannot repair missing OSM restrictions.
(function(root){
  function options({alternatives=false,heading=null,accuracy=null}={}){
    const radius=Number.isFinite(accuracy)?Math.max(25,Math.min(100,Math.ceil(accuracy*2))):100;
    const params=new URLSearchParams({overview:'full',geometries:'geojson',alternatives:String(alternatives),steps:'true',snapping:'default',radiuses:radius+';150'});
    if(Number.isFinite(heading))params.set('bearings',Math.round((heading%360+360)%360)%360+',45;');
    return params;
  }
  function errorMessage(code){
    if(['NoSegment','NoRoute'].includes(code))return '起点、行进方向或目的地附近没有可用的汽车路线，请选择可驶入的道路入口。';
    return '路线服务暂时不可用，请稍后重试。';
  }
  async function routes(start,end,settings={}){
    const signal=settings.signal?AbortSignal.any([settings.signal,AbortSignal.timeout(18000)]):AbortSignal.timeout(18000);
    const url='https://router.project-osrm.org/route/v1/driving/'+start.join(',')+';'+end.join(',')+'?'+options(settings);
    const response=await fetch(url,{signal});const data=await response.json();
    if(!response.ok||data.code!=='Ok'||!data.routes?.length)throw Error(errorMessage(data.code));
    return data.routes;
  }
  const api={options,errorMessage,routes};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RoadRouting=api;
})(typeof globalThis!=='undefined'?globalThis:this);
