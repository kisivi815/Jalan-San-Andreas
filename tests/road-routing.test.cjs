const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../dist/road-routing.js'),C=require('../dist/nav-core.js');
test('car requests constrain road snapping and moving direction',()=>{
 const p=R.options({heading:270,accuracy:5});assert.equal(p.get('bearings'),'270,45;');assert.equal(p.get('radiuses'),'25;150');assert.equal(p.get('snapping'),'default');
 assert.equal(R.options({heading:360}).get('bearings'),'0,45;');
 assert.equal(R.options().has('bearings'),false);assert.equal(R.options({accuracy:80}).get('radiuses'),'100;150');
 assert.match(R.errorMessage('NoSegment'),/可用的汽车路线/);assert.match(R.errorMessage('NoRoute'),/可用的汽车路线/);
});
test('heading comparisons handle wraparound and opposite route direction',()=>{
 assert.equal(C.angleDifference(359,1),2);assert.equal(C.angleDifference(90,270),180);
 assert(Math.abs(C.bearing([101,3],[101.01,3])-90)<.01);
 assert(Math.abs(C.bearing([101.01,3],[101,3])-270)<.01);
});
