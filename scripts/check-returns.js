const assert = require('assert');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const adapter = require('../miniprogram_npm/threejs-miniprogram');
const art = require('../pages/index/art');
const returns = require('../pages/index/returns');
const experience = require('../pages/index/experience');
class Canvas { createImage(){return {};} requestAnimationFrame(){return 1;} cancelAnimationFrame(){} }
const THREE = adapter.createScopedThreejs(new Canvas());

function game(width=390,height=844) {
  let page;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/index/index.js'),'utf8'),{
    require: name => name==='./adventure'?require('../pages/index/adventure'):name==='./shell'?require('../pages/index/shell'):name==='./art'?art:name==='./returns'?returns:name==='./experience'?experience:adapter,
    Page: value=>{page=value;},console,Date,Math,setTimeout,clearTimeout,setInterval,clearInterval
  });
  const p=Object.assign({},page,{THREE,data:Object.assign({},page.data),canvas:new Canvas(),renderer:{render(){},dispose(){}},setData(patch){Object.assign(this.data,patch);}});
  p.width=width;p.height=height;p.setupCamera(width,height);p.createMaterials();p.buildScene();p.data.threeReady=true;
  p.data.selectedRouteId='king';p.data.selectedRouteName='国王';p.beginCompanion('小荷');
  p.data.growth=140;p.data.canChallenge=true;p.data.bugs=10;p.data.jumps=20;p.runRewarded=false;
  p.showReturnChoice();return p;
}

for(const mode of ['boat','plane']) {
  const p=game();assert.equal(p.data.phase,'returnChoice');assert(!p.pondGroup.visible);
  p.chooseReturn({currentTarget:{dataset:{mode}}});assert.equal(p.data.phase,'returnTravel');
  const kit=p.returnWorld;
  for(let i=0;i<230&&kit.active;i++)kit.update(Date.now()+i*50,.05);
  assert.equal(p.data.phase,'final',mode+'必须抵达家');assert(p.pondGroup.visible);
  assert.equal(p.data.snacks,3);assert.equal(p.data.adventures,1);
  p.finishReturn();assert.equal(p.data.snacks,3,'完成返程不能重复发奖励');
  p.returnToPond();assert.equal(p.data.phase,'nurture');assert(p.frogGroup);
}

function shoot(power, x, width, height) {
  const p=game(width,height);p.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});
  const kit=p.returnWorld;
  kit.pull={power,x};kit.fire();const first=kit.projectile;kit.fire();assert.equal(kit.projectile,first);
  for(let i=0;i<380&&p.data.phase==='sling';i++)kit.update(kit.shotAt+i*1000/60,1/60);
  return {p,kit};
}

const hit=shoot(.65,0);
assert.equal(hit.p.data.phase,'returnResult');
assert.equal(hit.p.data.returnOutcome,'win','正中堡垒的中等力度必须可以成功');
assert(hit.kit.blocks.some(block=>block.body.position.distanceTo(block.initial)>.2),'成功时堡垒必须真的移动/倒塌');
const small=hit.kit.hero.scale.x;
hit.kit.update(hit.kit.resultAt+2500,1/60);
assert(hit.kit.hero.scale.x>small,'胜利青蛙要逐渐放大');
assert(hit.kit.hero.rotation.x< -1.4,'胜利青蛙应当四脚朝天');
assert(hit.p.data.returnResultReady);
hit.p.finishReturn();assert.equal(hit.p.data.phase,'final');

const miss=shoot(.15,.95);
assert.equal(miss.p.data.returnOutcome,'lose','明显打偏必须失败');
assert(miss.kit.hero.rotation.x>1.4,'直立角色失败后必须向前趴倒，不能仍然站着');
assert(miss.kit.bully&&miss.kit.bully.userData.club,'失败要出现拿棒槌的大蝗虫');
miss.kit.update(miss.kit.resultAt+4000,1/60);
assert(miss.kit.blur>2,'晕倒后场景要逐渐虚化');assert(miss.kit.stars.children.length>=3);
miss.p.retrySling();assert.equal(miss.p.data.phase,'sling');assert.equal(miss.kit.blur,0);
assert(!miss.kit.projectile,'重试必须清理旧的弹射刚体');
miss.kit.touchStart({touches:[{x:195,y:400}]});
miss.kit.touchMove({touches:[{x:195,y:520}]});
assert(miss.p.data.slingPower>60&&miss.p.data.slingPower<70);
assert(miss.kit.trajectory.visible,'拖动时要有抛物线预览');
miss.kit.cancelTouch();assert(!miss.kit.projectile&&miss.kit.hero.position.distanceTo(miss.kit.launchOrigin)<.001);
miss.kit.touchStart({touches:[{x:195,y:400}]});
miss.kit.touchMove({touches:[{x:195,y:520}]});miss.kit.touchEnd();assert(miss.kit.projectile,'松手必须弹射');
const at=miss.kit.shotAt;miss.p.onHide();miss.p.hiddenAt-=5000;miss.p.onShow();
assert(miss.kit.shotAt>=at+5000,'后台期间不能消耗弹射关的判负时间');
miss.p.changeReturnMode();assert.equal(miss.p.data.phase,'returnChoice');assert(!miss.kit.world);
assert.equal(miss.p.data.adventures,0,'返程演出前不能提前重复结算');
miss.p.backToGender();assert(!miss.kit.active&&miss.p.pondGroup.visible);
assert.equal(miss.p.nextScene,null);

function assertInFrame(p,object,label) {
  object.updateMatrixWorld(true);p.camera.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(object);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const point=new THREE.Vector3(x,y,z).project(p.camera);
    assert(Math.abs(point.x)<.99&&Math.abs(point.y)<.99,label+'超出画面：'+point.toArray().join(','));
  }
}
for(const [width,height] of [[320,640],[390,844],[480,900]]){
  const p=game(width,height);p.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});
  assertInFrame(p,p.returnWorld.hero,width+'弹弓起点');
  p.returnWorld.finishShot(true);
  p.returnWorld.update(p.returnWorld.resultAt+2500,1/60);
  assertInFrame(p,p.returnWorld.hero,width+'胜利最大尺寸');
  p.retrySling();p.returnWorld.finishShot(false);
  assertInFrame(p,p.returnWorld.hero,width+'趴倒青蛙');
  assertInFrame(p,p.returnWorld.bully,width+'棒槌蝗虫');
}
console.log('PASS: 划船/飞机真实抵达 / 弹弓碰撞与堡垒倒塌 / 命中放大演出 / 打偏趴倒棒槌与虚化 / 拖拽蓄力 / 取消重试 / 暂停恢复 / 奖励防重 / 三种屏幕返程取景');
