const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const adapter=require('../miniprogram_npm/threejs-miniprogram');
class Canvas{createImage(){return{};}requestAnimationFrame(){return 1;}cancelAnimationFrame(){}}
const T=adapter.createScopedThreejs(new Canvas()),storage=new Map();
const copy=value=>JSON.parse(JSON.stringify(value));
const api={getStorageSync:key=>copy(storage.get(key)||null),setStorageSync(key,value){
  if(this.failPet&&key==='tadpole-companion-v1')throw Error('quota');storage.set(key,copy(value));
},showModal:opts=>opts.success({confirm:true,content:'荷小舟'})};
const RUN='tadpole-adventure-v1',PET='tadpole-companion-v1';
function game(){
  let definition;
  const shell={exports:{}};
  vm.runInNewContext(fs.readFileSync('pages/index/shell.js','utf8'),{module:shell,wx:api});
  vm.runInNewContext(fs.readFileSync('pages/index/index.js','utf8'),{
    require:name=>name==='threejs-miniprogram'?adapter:name==='./shell'?shell.exports:require('../pages/index/'+name.slice(2)),
    wx:api,Page:value=>{definition=value;},console,Date,Math,setTimeout,clearTimeout,setInterval,clearInterval
  });
  const p=Object.assign({},definition,{data:copy(definition.data),THREE:T,canvas:new Canvas(),
    renderer:{render(){},dispose(){}},setData(patch){Object.assign(this.data,patch);}});
  p.width=390;p.height=844;p.setupCamera(390,844);p.createMaterials();p.buildScene();p.data.threeReady=true;
  p.loadCompanion();p.loadMemories();p.loadAdventure();return p;
}
function adult(){const p=game();p.data.selectedRouteId='king';p.beginCompanion('荷小舟');p.data.growth=140;p.data.canChallenge=true;p.saveCompanion();p.startJumpChallenge();return p;}
function land(p,perfect=true){const leaf=p.jumpLeaves[1];p.jumpState={score:perfect?.05:.9,to:leaf.position.clone()};p.resolveLanding(Date.now());}
function reload(p){p.saveCompanion();p.companionActive=false;p.onUnload();const next=game();assert(next.resumeAdventure());return next;}

let p=adult();const identity=p.companionId;
assert(p.memories.some(item=>item.title==='第一次相遇'));
for(const checkpoint of [0,5,10,15]){
  while(p.data.jumps<checkpoint)land(p);
  const position=copy(p.checkpointState.position),heading=p.checkpointState.heading;
  p=reload(p);assert.equal(p.data.jumps,checkpoint);assert.equal(p.checkpointState.position.x,position.x);assert.equal(p.checkpointState.heading,heading||0);
  assert.equal(p.companionId,identity);assert.equal(p.data.perfect,checkpoint);
}
land(p);p.missRun();const best=p.currentRun.bestJump;
p=reload(p);assert.equal(p.data.jumps,15);assert.equal(p.data.jumpCombo,0);assert.equal(p.data.attempts,2);assert.equal(p.currentRun.bestJump,best);
p.runStartedAt=Date.now()-5000;p.pauseAdventure();assert(p.data.paused&&p.data.sessionPaused);
const start=p.runStartedAt;p.hiddenAt-=5000;p.onShow();assert(p.data.paused,'manual pause must survive onShow');p.continueAdventure();assert(!p.data.paused);assert(p.runStartedAt>=start+4990);
p.pauseAdventure();p.saveAndGoHome();assert.equal(p.data.phase,'home');assert(!p.data.paused&&p.data.hasAdventure);p.startGame();assert.equal(p.data.phase,'levelJump');
p.setupBugLevel();for(let i=0;i<4;i++)p.scoreBug(p.insects[0]);p=reload(p);assert.equal(p.data.bugs,4);assert.equal(p.data.bugCombo,4);
p.aimHit=null;p.aimWorld=new T.Vector3(0,1,2);p.fireTongue();assert.equal(p.data.bugCombo,0);p.tongueState=null;
while(p.data.bugs<10)p.scoreBug(p.insects[0]);p=reload(p);assert.equal(p.data.phase,'returnChoice');
p.chooseReturn({currentTarget:{dataset:{mode:'boat'}}});const kit=p.returnWorld;
kit.steerTo(-1);kit.update(Date.now(),1);kit.elapsed=1.99;kit.update(Date.now(),.02);
assert.equal(p.data.travelCollected,1,'boat left lane must collect first seed');
kit.elapsed=3.16;kit.steer=1;kit.targetLane=1;kit.update(Date.now(),.02);assert(kit.wobbleUntil>kit.elapsed,'reeds cause a brief wobble only');assert.equal(p.data.attempts,2);
p=reload(p);assert.equal(p.data.phase,'returnTravel');assert.equal(p.returnWorld.targetLane,1);assert.equal(p.data.travelCollected,1);assert(p.returnWorld.events[0].passed);
p.changeReturnMode();p.chooseReturn({currentTarget:{dataset:{mode:'plane'}}});p.returnWorld.steerTo(1);p.returnWorld.steer=1;p.returnWorld.elapsed=1.75;p.returnWorld.update(Date.now(),.02);assert.equal(p.data.travelCollected,1);
const before=p.adventureBonus();assert(!p.noteReturnPickup('plane','plane-0'));assert.equal(p.adventureBonus(),before);
p=reload(p);assert.equal(p.returnWorld.mode,'plane');assert.equal(p.data.travelCollected,1);
p.changeReturnMode();p.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});p.chooseFortress({currentTarget:{dataset:{layout:2}}});p.returnWorld.pull={x:.2,power:.7};p=reload(p);
assert.equal(p.data.fortressLayout,2);assert.equal(p.returnWorld.pull.x,.2);assert.equal(p.data.slingPower,70);
p.returnWorld.finishShot(false);p=reload(p);assert.equal(p.data.returnOutcome,'lose');assert(p.returnWorld.blur>2);
const runId=p.currentRun.id,reward=3+p.adventureBonus(),savedRun=copy(storage.get(RUN));p.quickReturn();assert.equal(p.data.snacks,reward);assert.equal(p.data.adventures,1);
assert.equal(storage.get(PET).lastRewardedRunId,runId);assert.equal(storage.get(RUN),null);
assert(p.memories.some(item=>item.letter.length>0));const memories=p.memories.length;p.showFinal();assert.equal(p.data.snacks,reward);assert.equal(p.memories.length,memories);
storage.set(RUN,savedRun);const settled=game();assert(!settled.data.hasAdventure,'leftover snapshot cannot grant reward twice');
p.returnToPond();p.data.petName='新名字';p.saveCompanion();assert.equal(p.companion.id,identity);p.setupJumpLevel();assert.notEqual(p.currentRun.id,runId);
const pending=copy(storage.get(RUN));pending.checkpoint.position.x=Infinity;assert.equal(p.validateAdventure(pending),null);
pending.checkpoint.position.x=0;pending.pid='somebody-else';assert.equal(p.validateAdventure(pending),null);
api.failPet=true;p.setupBugLevel();p.data.bugs=10;p.showReturnChoice();const recoverable=storage.get(RUN);p.quickReturn();assert(storage.get(RUN),'quota failure must keep recoverable run');
api.failPet=false;p.companionActive=false;p.onUnload();storage.set(RUN,recoverable);const recover=game();assert(recover.resumeAdventure());recover.quickReturn();assert.equal(recover.data.adventures,2,'failed atomic write may be retried once');
recover.returnToPond();recover.beginCompanion('另一只');assert.notEqual(recover.companionId,identity);assert.equal(storage.get(RUN),null);
assert(!recover.safePhotoPath('https://example.com/x.png'));assert(!recover.safePhotoPath('../private.png'));
api.env={USER_DATA_PATH:'wxfile://usr'};assert(recover.safePhotoPath('wxfile://usr/pond-memories/m-a1.png'));
assert(!recover.safePhotoPath('wxfile://usr/pond-memories/m-a/../../m-secret.png'));
for(let i=0;i<52;i++)recover.recordMemory('extra',{suffix:String(i),title:'记录'});assert.equal(recover.memories.length,48);recover.recordMemory('extra',{suffix:'51',title:'重复'});assert.equal(recover.memories.length,48);
recover.openAlbum();assert.equal(recover.data.phase,'album');recover.openMemory({currentTarget:{dataset:{id:recover.data.albumEntries[0].id}}});assert(recover.data.selectedMemory);recover.closeMemory();assert.equal(recover.data.selectedMemory,null);
recover.onUnload();settled.onUnload();

for(const layout of [0,1,2])for(const miss of [false,true]){
  const s=adult();s.data.bugs=10;s.showReturnChoice();s.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});s.chooseFortress({currentTarget:{dataset:{layout}}});
  const world=s.returnWorld;world.pull=miss?{power:.15,x:.95}:{power:.65,x:0};world.fire();
  for(let i=0;i<380&&s.data.phase==='sling';i++)world.update(world.shotAt+i*1000/60,1/60);
  assert.equal(s.data.returnOutcome,miss?'lose':'win','layout '+layout+' hit/miss');s.companionActive=false;s.onUnload();
}
const won=adult();won.data.bugs=10;won.showReturnChoice();won.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});won.returnWorld.finishShot(true);
const restoredWin=reload(won);assert.equal(restoredWin.data.returnOutcome,'win');assert(restoredWin.data.returnResultReady);assert(restoredWin.returnWorld.blocks.some(part=>part.body.position.distanceTo(part.initial)>.2));restoredWin.companionActive=false;restoredWin.onUnload();
console.log('PASS: 冒险分段持久化 / 暂停冻结 / 捕虫与返程恢复 / 三堡垒命中与打偏 / 划船接莲子与芦苇 / 飞机穿环 / 连击防刷 / 奖励原子防重与写入失败恢复 / 纪念册去重上限与安全路径');
