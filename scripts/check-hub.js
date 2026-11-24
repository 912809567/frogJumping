const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const adapter=require('../miniprogram_npm/threejs-miniprogram');
class Canvas{
  constructor(){this.frames=[];}
  createImage(){return{};}
  requestAnimationFrame(callback){this.frames.push(callback);return this.frames.length;}
  cancelAnimationFrame(){}
}
const T=adapter.createScopedThreejs(new Canvas());
const storage=new Map(),voices=[],vibrations=[];
const api={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,JSON.parse(JSON.stringify(value))),
  confirm:true,showModal(options){options.success({confirm:this.confirm,content:'荷小将'});},
  vibrateShort(value){vibrations.push(value);},
  createInnerAudioContext(){const voice={plays:0,stops:0,destroyed:false,play(){this.plays++;},stop(){this.stops++;},destroy(){this.destroyed=true;},onError(){}};voices.push(voice);return voice;}};
const shellModule={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/index/shell.js'),'utf8'),{module:shellModule,wx:api});
function makeGame(build=true){
  let definition;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/index/index.js'),'utf8'),{
    require:name=>name==='threejs-miniprogram'?adapter:name==='./shell'?shellModule.exports:require('../pages/index/'+name.slice(2)),
    Page:value=>{definition=value;},wx:api,console,Date,Math,setTimeout,clearTimeout,setInterval,clearInterval
  });
  const game=Object.assign({},definition,{data:Object.assign({},definition.data),THREE:T,canvas:new Canvas(),
    renderer:{render(){},dispose(){},ratios:[],setPixelRatio(value){this.ratios.push(value);}},
    setData(patch){Object.assign(this.data,patch);}});
  game.width=390;game.height=844;game.loadPreferences();game.loadCompanion();
  if(build){game.setupCamera(390,844);game.createMaterials();game.buildScene();game.data.threeReady=true;game.showNurturePreview();}
  return game;
}
const game=makeGame();assert.equal(game.data.phase,'home');assert(game.frogGroup);
game.openStatus();assert(!game.data.hasCompanion);assert.equal(game.data.phase,'status');
game.goHome();assert.equal(game.data.phase,'home');assert(game.frogGroup,'空存档总首页应恢复展示角色');
game.startGame();assert.equal(game.data.phase,'route');assert(game.petGroup);assert.equal(game.data.routeList.length,19);
game.selectRoute({currentTarget:{dataset:{id:'general'}}});game.confirmRoute();
assert.equal(game.data.phase,'nurture');assert.equal(game.data.petName,'荷小将');
for(let i=0;i<20&&!game.data.canChallenge;i++){
  const type=['feed','pet','play'][i%3],key={feed:'food',pet:'affection',play:'play'}[type];game.applyCare({type,key});
}
assert(game.data.canChallenge);const food=game.data.food;
game.goHome();assert.equal(game.data.phase,'home');assert(game.data.hasCompanion);
game.openStatus();assert.equal(game.data.statusFood,food);assert.equal(game.data.statusGrowth,100);assert.equal(game.data.statusSkill,'定叶术');
assert(game.frogGroup && !game.petGroup,'成年伙伴的档案必须显示实际青蛙，不能仍然显示蝌蚪');
const companionBefore=JSON.stringify(game.companion);
api.confirm=false;game.openNewCompanion();assert.equal(game.data.phase,'status');
api.confirm=true;game.openNewCompanion();assert.equal(game.data.phase,'route');assert.equal(game.data.routeList.length,19);assert(game.data.choosingNew);assert(game.petGroup);
assert.equal(JSON.stringify(game.companion),companionBefore,'挑选新伙伴前不能覆盖旧伙伴');
game.selectRoute({currentTarget:{dataset:{id:'princess'}}});assert.equal(JSON.stringify(game.companion),companionBefore);
game.cancelNewCompanion();assert.equal(game.data.phase,'nurture');assert.equal(game.data.selectedRouteId,'general');
game.goHome();game.openSettings();game.playSound('charge');const charge=voices.find(voice=>voice.src.endsWith('charge.wav'));
assert(charge&&charge.plays===1);
game.toggleSetting({currentTarget:{dataset:{key:'soundEnabled'}}});const voiceCount=voices.length;
game.playSound('jump');assert.equal(voices.length,voiceCount);assert(charge.stops>=2,'关闭音效应停止正在播放的蓄力音');
game.toggleSetting({currentTarget:{dataset:{key:'hapticEnabled'}}});const count=vibrations.length;game.vibrate('heavy');assert.equal(vibrations.length,count);
game.renderQuality={max:2,current:2,changedAt:0};game.chooseQuality({currentTarget:{dataset:{mode:'smooth'}}});assert.equal(game.renderQuality.current,1.5);
game.updateRenderQuality(100000,40);assert.equal(game.renderQuality.current,1.5,'手动画质不能被自动画质改写');
assert.equal(JSON.stringify(game.companion),companionBefore,'设置不能改变伙伴存档');
const reloaded=makeGame();assert.equal(reloaded.data.soundEnabled,false);assert.equal(reloaded.data.hapticEnabled,false);assert.equal(reloaded.data.qualityMode,'smooth');
reloaded.startGame();assert.equal(reloaded.data.phase,'nurture');assert.equal(reloaded.data.selectedRouteId,'general');assert.equal(reloaded.data.growth,game.companion.growth);
game.onUnload();assert(voices.every(voice=>voice.destroyed));

const staged=makeGame(false),canvas=new Canvas();
api.getWindowInfo=()=>({windowWidth:390,windowHeight:844,pixelRatio:1});
api.createSelectorQuery=()=>{const query={in(){return query;},select(){return query;},node(){return query;},exec(callback){callback([{node:canvas}]);}};return query;};
let renders=0;staged.createRenderer=function(){this.renderer={render(){renders++;},dispose(){}};};
staged.initThree();assert.equal(renders,1);assert(!staged.data.threeReady,'第一帧池塘绘制后角色应分帧准备');
canvas.frames.shift()();assert(!staged.data.threeReady);canvas.frames.shift()();assert(staged.data.threeReady);staged.onUnload();

const art=require('../pages/index/art')(T),raw=require('../pages/index/art')(T,{buildAssets:true});
const route={costume:'king',accent:0xf5c849};
const baked=art.makeFrog(route,1,art.materials()),original=raw.makeFrog(route,1,raw.materials());
for(const name of ['fur-border-base','fur-border-tufts','fur-collar-tufts']){
  const a=baked.getObjectByName(name).geometry,b=original.getObjectByName(name).geometry;
  assert.equal(a.index.count,b.index.count);
  const positions=a.attributes.position.array,source=b.attributes.position.array;let error=0;
  for(let i=0;i<positions.length;i++)error=Math.max(error,Math.abs(positions[i]-source[i]));
  assert(error<.00001,'离线服饰轮廓不能发生可见改变');
}
for(const name of ['select','charge','jump','land','perfect','tongue','swallow']){
  const wave=fs.readFileSync(path.join(__dirname,'../assets/audio/'+name+'.wav'));
  assert.equal(wave.toString('ascii',0,4),'RIFF');assert.equal(wave.readUInt16LE(22),1);assert(wave.length<40000);
}
assert(fs.statSync(path.join(__dirname,'../pages/index/models/royal-fur.js')).size<200000,'离线服饰不能膨胀主包');
const framing=makeGame();framing.openRoutes();const routes=framing.data.routeList.map(route=>route.id);
function screenBounds(object,game){
  object.updateMatrixWorld(true);const box=new T.Box3().setFromObject(object);let top=Infinity,bottom=-Infinity;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
    const point=new T.Vector3(x,y,z).project(game.camera),screen=(1-point.y)*game.height/2;top=Math.min(top,screen);bottom=Math.max(bottom,screen);
  }
  return {top,bottom};
}
for(const [width,height]of [[320,640],[390,844]]){
  framing.width=width;framing.height=height;framing.camera.aspect=width/height;framing.camera.updateProjectionMatrix();
  for(const id of routes){
    framing.selectRoute({currentTarget:{dataset:{id}}});framing.cameraSnap();let bounds=screenBounds(framing.frogGroup,framing);
    assert(bounds.top>height*.09+176*width/750&&bounds.bottom<height*.76-216*width/750,id+'选角不能压住说明或按钮');
    framing.setData({phase:'nurture',canChallenge:true});framing.spawnPet(3);framing.cameraSnap();bounds=screenBounds(framing.frogGroup,framing);
    assert(bounds.top>height*.13+135*width/750&&bounds.bottom<height-600*width/750,id+'养成不能压住名字或照顾按钮');
  }
}
framing.onUnload();
console.log('PASS: 总首页 / 空档案 / 存档状态 / 续养与新伙伴保护 / 设置持久化 / 音效震动开关 / 手动画质 / 分帧首屏 / 离线服饰等价与本地音效');
