const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context={};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/gta-pois.js','utf8'),context);
const category=p=>context.gtaPoiCategory(p)?.key;
test('matches real POI subclasses before broad classes',()=>{
  assert.equal(category({class:'shop',subclass:'clothes'}),'clothes');
  assert.equal(category({class:'car',subclass:'car_repair'}),'repair');
  assert.equal(category({class:'clothing_store'}),'clothes');
  assert.equal(category({class:'restaurant'}),'restaurant');
  assert.equal(category({class:'office'}),undefined);
});
test('food brand icons only override food businesses',()=>{
  assert.equal(context.gtaFoodIcon({class:'fast_food',name:'KFC'},10),14);
  assert.equal(context.gtaFoodIcon({class:'restaurant',name:'Pizza Hut'},50),29);
  assert.equal(context.gtaFoodIcon({class:'restaurant',name:'Local Kitchen'},50),50);
  assert.equal(context.gtaFoodIcon({class:'clothing_store',name:'Pizza Fashion'},45),45);
});
test('all 64 original icons have local GIF assets',()=>{
  const icons=JSON.parse(fs.readFileSync('dist/assets/gta/catalog.json'));
  assert.equal(icons.length,64);assert.equal(new Set(icons.map(i=>i.id)).size,64);
  for(const i of icons){assert.equal(fs.readFileSync('dist/'+i.file).subarray(0,3).toString(),'GIF');}
});
