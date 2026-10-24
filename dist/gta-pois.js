// Original icon IDs: https://sampwiki.blast.hk/wiki/MapIcons
// Categories follow OpenMapTiles poi.class / poi.subclass, not invented locations.
const GTA_POI_CATEGORIES = [
  {key:'clothes', label:'服装店', icon:45, tags:['clothing_store','clothes','fashion','shoes','boutique']},
  {key:'barber', label:'理发店', icon:7, tags:['hairdresser','barber','beauty']},
  {key:'tattoo', label:'纹身店', icon:39, tags:['tattoo']},
  {key:'hospital', label:'医院 / 诊所', icon:22, tags:['hospital','clinic','doctors']},
  {key:'police', label:'警察局', icon:30, tags:['police']},
  {key:'repair', label:'修车 / 洗车', icon:63, tags:['car_repair','car_wash','car_parts','tyres']},
  {key:'gym', label:'健身房', icon:54, tags:['fitness_centre','fitness_station','gym']},
  {key:'casino', label:'赌场', icon:25, tags:['casino','gambling']},
  {key:'club', label:'夜店', icon:48, tags:['nightclub','stripclub']},
  {key:'bar', label:'酒吧', icon:49, tags:['bar','pub','beer','biergarten']},
  {key:'cafe', label:'咖啡馆 / 小餐馆', icon:17, tags:['cafe','ice_cream']},
  {key:'fastfood', label:'快餐店', icon:10, tags:['fast_food']},
  {key:'restaurant', label:'餐厅', icon:50, tags:['restaurant','food_court']},
  {key:'school', label:'学校', icon:36, tags:['school','college','university','driving_school']},
  {key:'bank', label:'银行 / ATM', icon:52, tags:['bank','atm']},
  {key:'lodging', label:'住宿 · 存档图标', icon:35, tags:['lodging','hotel','motel','hostel','guest_house']},
  {key:'marina', label:'码头', icon:9, tags:['harbor','marina','boat_rental']},
  {key:'airport', label:'机场', icon:5, tags:['aerodrome','airport']},
  {key:'race', label:'赛车场', icon:33, tags:['raceway','karting','motor_sports']},
  {key:'cars', label:'汽车 / 加油站', icon:55, tags:['car','car_rental','car_sharing','fuel']},
  {key:'arms', label:'枪械商店', icon:6, tags:['weapons','guns']}
];
function gtaPoiCategory(properties) {
  const cls=properties.class, sub=properties.subclass;
  // Subclasses must win: OpenMapTiles groups many specialist shops as "shop".
  return GTA_POI_CATEGORIES.find(c=>c.tags.includes(sub)) || GTA_POI_CATEGORIES.find(c=>c.tags.includes(cls));
}
function gtaFoodIcon(properties, fallback) {
  if(!['restaurant','fastfood'].includes(gtaPoiCategory(properties)?.key))return fallback;
  const name=String(properties.name||properties['name:en']||'').toLowerCase();
  if(name.includes('pizza'))return 29;
  if(['kfc','chicken','ayam','nando'].some(s=>name.includes(s)))return 14;
  if(['burger','mcdonald'].some(s=>name.includes(s)))return 10;
  return fallback;
}
async function initGtaPois(gl, map) {
  const panel=document.getElementById('poi-panel');
  const state=document.getElementById('poi-status');
  try {
    const catalogResponse=await fetch('assets/gta/catalog.json');
    if(!catalogResponse.ok)throw Error('Icon catalog unavailable');
    const catalog=await catalogResponse.json();
    const ids=[...new Set([...GTA_POI_CATEGORIES.map(c=>c.icon),14,29])];
    await Promise.all(ids.map(id=>new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{try{
        const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
        const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0,32,32);
        gl.addImage('gta-'+id,ctx.getImageData(0,0,32,32),{pixelRatio:1});resolve();
      }catch(e){reject(e)}};
      img.onerror=()=>reject(Error('Icon '+id+' unavailable'));
      img.src='assets/gta/icon-'+id+'.gif';
    })));
    const categoryExpr=['case'];
    // Match subclass before class just as gtaPoiCategory does.
    for(const field of ['subclass','class'])for(const c of GTA_POI_CATEGORIES){categoryExpr.push(['in',['get',field],['literal',c.tags]],c.key)}
    categoryExpr.push('');
    const iconExpr=['match',categoryExpr];
    for(const c of GTA_POI_CATEGORIES)iconExpr.push(c.key,'gta-'+c.icon);
    iconExpr.push('gta-50');
    const foodName=['downcase',['coalesce',['get','name'],['get','name:en'],'']];
    const food=['in',categoryExpr,['literal',['restaurant','fastfood']]];
    const icon=['case',
      ['all',food,['in','pizza',foodName]],'gta-29',
      ['all',food,['any',...['kfc','chicken','ayam','nando'].map(n=>['in',n,foodName])]],'gta-14',
      ['all',food,['any',...['burger','mcdonald'].map(n=>['in',n,foodName])]],'gta-10',iconExpr];
    const filter=['!=',categoryExpr,''];
    const definition={id:'gta-pois',type:'symbol',source:'openmaptiles','source-layer':'poi',minzoom:13,filter,
      layout:{'icon-image':icon,'icon-size':['interpolate',['linear'],['zoom'],13,.65,16,.9,18,1.1],
        'icon-padding':5,'icon-allow-overlap':false,'symbol-sort-key':['coalesce',['get','rank'],100]}};
    gl.addLayer(definition);
    map.getContainer().dataset.poiIcons='ready';
    const select=document.getElementById('poi-filter');
    GTA_POI_CATEGORIES.forEach(c=>{const o=document.createElement('option');o.value=c.key;o.textContent=c.label;select.append(o)});
    select.onchange=()=>gl.setFilter('gta-pois',select.value?['==',categoryExpr,select.value]:filter);
    const legend=document.getElementById('poi-legend');
    GTA_POI_CATEGORIES.forEach(c=>{const row=document.createElement('div');const img=document.createElement('img');img.src='assets/gta/icon-'+c.icon+'.gif';img.alt='';row.append(img,document.createTextNode(c.label));legend.append(row)});
    const gallery=document.getElementById('icon-gallery');
    catalog.forEach(item=>{const box=document.createElement('div');box.title=item.name;const img=document.createElement('img');img.src=item.file;img.alt=item.name;img.loading='lazy';const label=document.createElement('small');label.textContent='#'+item.id;box.append(img,label);gallery.append(box)});
    const update=()=>{state.textContent=map.getZoom()<13?'放大至街区级别查看地点图标':'点击图标查看地点，放大可显示更多';};
    map.on('zoomend',update);update();
    map.on('click',e=>{
      const pt=gl.project([e.latlng.lng,e.latlng.lat]);
      const features=gl.queryRenderedFeatures([[pt.x-12,pt.y-12],[pt.x+12,pt.y+12]],{layers:['gta-pois']});
      if(!features.length)return;
      const f=features[0],p=f.properties,c=gtaPoiCategory(p);if(!c)return;
      const coords=f.geometry.coordinates;const lng=coords[0]+Math.round((e.latlng.lng-coords[0])/360)*360;
      const content=document.createElement('div');content.className='poi-popup';
      const img=document.createElement('img');img.src='assets/gta/icon-'+gtaFoodIcon(p,c.icon)+'.gif';img.alt=c.label;
      const name=document.createElement('strong');name.textContent=p.name||p['name:en']||c.label;
      const type=document.createElement('p');type.textContent=c.label;
      const go=document.createElement('button');go.textContent='设为目的地 →';
      go.onclick=()=>{window.dispatchEvent(new CustomEvent('jalan:destination',{detail:{coordinates:[lng,coords[1]],name:name.textContent}}));map.closePopup()};
      content.append(img,name,type,go);L.popup().setLatLng([coords[1],lng]).setContent(content).openOn(map);
    });
  }catch(error){
    console.warn('GTA POI icons could not load:',error);
    state.textContent='地点图标加载失败，请刷新重试';
    map.getContainer().dataset.poiIcons='error';
  }
}
