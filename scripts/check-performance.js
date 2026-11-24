const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const adapter = require('../miniprogram_npm/threejs-miniprogram');
const artFactory = require('../pages/index/art');
const experience = require('../pages/index/experience');
class Canvas { createImage(){return {};} requestAnimationFrame(){return 1;} cancelAnimationFrame(){} }
const THREE = adapter.createScopedThreejs(new Canvas());
let definition;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/index/index.js'),'utf8'),{
  require: name => name==='./adventure'?require('../pages/index/adventure'):name==='./shell'?require('../pages/index/shell'):name==='./art'?artFactory:name==='./experience'?experience:name==='./returns'?require('../pages/index/returns'):adapter,
  Page: value => { definition=value; }, console, Date, Math, setTimeout, clearTimeout, setInterval, clearInterval
});
function page() {
  return Object.assign({},definition,{THREE,data:Object.assign({},definition.data),
    renderer:{ratios:[],setPixelRatio(value){this.ratios.push(value);},dispose(){}},
    setData(patch){Object.assign(this.data,patch);}});
}

const p=page();p.createMaterials();
const king=p.getRouteById('king'),queen=p.getRouteById('queen'),princess=p.getRouteById('princess');
let start=performance.now();const first=p.art.makeFrog(king,1,p.materials);const cold=performance.now()-start;
start=performance.now();const second=p.art.makeFrog(king,.52,p.materials);const warm=performance.now()-start;
assert.notEqual(first,second);
assert.strictEqual(first.getObjectByName('head').geometry,second.getObjectByName('head').geometry,'缓存实例应共享不可变几何');
assert.strictEqual(first.getObjectByName('body').geometry,second.getObjectByName('body').geometry);
assert.notEqual(first.userData.eyes[0],second.userData.eyes[0],'眼睛节点不能在实例间共享');
assert.notEqual(first.userData.mouthAnchor,second.userData.mouthAnchor,'嘴部锚点必须绑定各自的实例');
assert.equal(second.userData.mouthAnchor.parent,second);
first.userData.frontLegs[0].rotation.x=.7;
assert.equal(second.userData.frontLegs[0].rotation.x,0,'动作不能污染缓存或其他实例');
assert.equal(second.userData.baseScale,.52);
let bytes=0,triangles=0;
first.traverse(node=>{
  if(!node.geometry)return;
  const geometry=node.geometry;
  for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
  if(geometry.index)bytes+=geometry.index.array.byteLength;
  triangles+=(geometry.index?geometry.index.count:geometry.attributes.position.count)/3;
});
assert.equal(triangles,161738,'无损合批不能减少或增加角色的三角面');
assert(bytes<6*1024*1024,'角色几何缓冲应控制在 6 MiB 内');

const body=first.getObjectByName('body').geometry;
let disposed=0;body.addEventListener('dispose',()=>disposed++);
p.removeObject(first);p.removeObject(first);
assert.equal(disposed,0,'释放实例不能销毁缓存中的共享几何');
const q=p.art.makeFrog(queen,1,p.materials),r=p.art.makeFrog(princess,1,p.materials);
assert.equal(disposed,0,'模板被逐出时不能销毁仍在显示的实例');
p.removeObject(second);
assert.equal(disposed,1,'最后一个实例释放后应当回收被逐出的几何');
const rebuilt=p.art.makeFrog(king,1,p.materials);
assert.notStrictEqual(rebuilt.getObjectByName('body').geometry,body,'缓存有上限，旧模板应当可重建');
const resources=new Set(),counts=new Map();
[q,r,rebuilt].forEach(root=>root.traverse(node=>{
  if(node.geometry)resources.add(node.geometry);
  const materials=Array.isArray(node.material)?node.material:[node.material];
  materials.forEach(material=>{if(material&&!p.sharedMaterials.has(material))resources.add(material);});
}));
resources.forEach(resource=>resource.addEventListener('dispose',()=>counts.set(resource,(counts.get(resource)||0)+1)));
const container=new THREE.Group();container.add(q,r,rebuilt);p.removeObject(container);p.art.dispose();
resources.forEach(resource=>assert.equal(counts.get(resource),1,'嵌套实例和模板清理后，每项资源应恰好释放一次'));

// An indexed merge must preserve every original triangle and its attributes.
const probe=artFactory(THREE),source=new (THREE.SphereBufferGeometry)(1,10,8),plain=source.toNonIndexed();
const merged=probe.mergeParts([{geometry:source}],(x,y,z)=>.7+y*.05+z*.03);
assert.equal(merged.attributes.position.count,source.attributes.position.count);
assert.equal(merged.index.count,source.index.count);
for(let i=0;i<source.index.count;i++){
  const at=merged.index.getX(i);
  for(const key of ['position','normal'])for(let component=0;component<3;component++){
    assert.equal(merged.attributes[key].array[at*3+component],plain.attributes[key].array[i*3+component]);
  }
}

const solver=page();solver.skillId='forecast';solver.data.skillArmed=true;
let predictions=0;
for(let i=0;i<1000;i++){
  const angle=i*.37,gap=2.6+(i%27)*.06,leaf=new THREE.Group(),from=new THREE.Group();
  from.position.set(Math.sin(i)*2,.06,Math.cos(i)*2);
  leaf.position.set(from.position.x+Math.sin(angle)*gap,.06,from.position.z+Math.cos(angle)*gap);
  Object.assign(leaf.userData,{rx:1+(i%3)*.1,rz:.65+(i%5)*.03,anchor:leaf.position.clone()});
  if(i%2)leaf.userData.drift={ax:.3,az:-.2,speed:1.2,amp:.55};
  if(i%3)leaf.userData.wind={ax:Math.cos(angle),az:-Math.sin(angle),amp:.3};
  solver.jumpLeaves=[from,leaf];solver.motionOffset=i*31;
  const now=100000+i*19;
  let best=0,score=Infinity;
  for(let charge=0;charge<=1.001;charge+=.01){
    const candidate=solver.landingFor(charge,now).score;
    if(candidate<score){best=charge;score=candidate;}
  }
  const original=solver.landingFor;let calls=0;
  solver.landingFor=function(...args){calls++;return original.apply(this,args);};
  const ideal=solver.optimalForecastCharge(now);
  solver.landingFor=original;
  assert(Math.abs(ideal-best)<1e-9,'解析计算必须与旧版 1% 扫描一致');
  assert(calls<=2,'每次自动计算最多只需两次精确落点判定');predictions++;
}

function qualityPage(ratio=2){
  const game=page();game.width=390;game.height=844;game.data.phase='levelJump';
  game.renderQuality={max:ratio,current:ratio,changedAt:-15000};game.resetRenderQualityWindow(0,0);return game;
}
function frames(game,count,ms,now=0){for(let i=0;i<count;i++){now+=ms;game.updateRenderQuality(now,ms);}return now;}
const smooth=qualityPage();frames(smooth,600,16.7);
assert.equal(smooth.renderQuality.current,2,'稳定帧率应保持原始画质');
const busy=qualityPage();busy.data.isCharging=true;let now=frames(busy,180,34);
assert.equal(busy.renderer.ratios.length,0,'蓄力期间不能改变渲染分辨率');
busy.data.isCharging=false;busy.updateRenderQuality(now+34,34);
assert.equal(busy.renderQuality.current,1.75);
assert.equal(busy.width,390);assert.equal(busy.height,844,'逻辑尺寸和触控坐标不能变化');
now=frames(busy,180,34,now+34);
assert.equal(busy.renderQuality.current,1.75,'冷却期内不能来回切换画质');
now=frames(busy,800,34,now);
assert.equal(busy.renderQuality.current,1.5,'低画质保底仍需保留清晰度');
now=frames(busy,2500,16.7,now);
assert.equal(busy.renderQuality.current,1.75,'持续流畅后应逐级恢复画质');
frames(busy,2200,16.7,now);assert.equal(busy.renderQuality.current,2);
const lowDpr=qualityPage(1);frames(lowDpr,600,34);assert.equal(lowDpr.renderQuality.current,1);
const interrupted=qualityPage();frames(interrupted,100,34);interrupted.updateRenderQuality(30000,20000);
assert.equal(interrupted.renderQuality.count,0,'后台长间隔不能计入掉帧样本');
assert.equal(interrupted.renderQuality.current,2);
const teardown=page();teardown.createMaterials();teardown.scene=new THREE.Scene();
const light=new THREE.DirectionalLight(0xffffff,1);let shadowReleased=0;
light.shadow.map={dispose(){shadowReleased++;}};teardown.scene.add(light);
teardown.disposeThree();assert.equal(shadowReleased,1,'退出页面必须释放阴影渲染目标');
console.log('PASS: 无损索引合批 / 有界模型缓存与动作隔离 / 嵌套共享资源释放 / '+predictions+' 组新旧落点一致 / 自适应分辨率保护触控与恢复');
console.log('角色 '+triangles+' 三角面，几何缓冲 '+(bytes/1048576).toFixed(2)+' MiB；Node 建模冷启动 '+cold.toFixed(1)+'ms，缓存实例 '+warm.toFixed(1)+'ms（不代表真机帧率）');
