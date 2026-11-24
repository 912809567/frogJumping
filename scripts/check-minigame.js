const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {unzlibSync}=require('fflate');
const adapter=require('../miniprogram_npm/threejs-miniprogram');
const {launch}=require('../minigame/runtime');
const photo=require('../minigame/photo');
class Canvas{
  constructor(){this.width=390;this.height=844;this.context={setTransform(){},clearRect(){},beginPath(){},rect(){},arcTo(){},moveTo(){},lineTo(){},arc(){},fill(){},stroke(){},closePath(){},save(){},restore(){},translate(){},scale(){},clip(){},fillText(){},drawImage(){},measureText:t=>({width:String(t).length*12})};}
  createImage(){return{};}getContext(){return this.context;}
}
const storage=new Map(),callbacks={},frames=new Map();let frameId=0,canvases=0,modal;
const api={getWindowInfo:()=>({windowWidth:390,windowHeight:844,pixelRatio:2,safeArea:{top:44,bottom:810}}),
  createCanvas(){canvases++;return new Canvas();},createImage:()=>({}),getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,JSON.parse(JSON.stringify(value))),
  showModal:options=>{modal=options;},showKeyboard:()=>{},hideKeyboard:()=>{},showShareMenu(){},vibrateShort(){}};
for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','ShareAppMessage','KeyboardInput','KeyboardConfirm']){
  callbacks[name]=new Set();api['on'+name]=fn=>callbacks[name].add(fn);api['off'+name]=fn=>callbacks[name].delete(fn);
}
const fire=(name,event)=>Array.from(callbacks[name]).forEach(fn=>fn(event||{}));
const host={requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}};
function definition(){
  const module={exports:{}},shell={exports:{}};
  vm.runInNewContext(fs.readFileSync('pages/index/shell.js','utf8'),{module:shell,wx:api});
  vm.runInNewContext(fs.readFileSync('pages/index/index.js','utf8'),{module,wx:api,console,Date,Math,setTimeout,clearTimeout,setInterval,clearInterval,
    require:name=>name==='threejs-miniprogram'?adapter:name==='./shell'?shell.exports:require('../pages/index/'+name.slice(2))});
  const d=module.exports;
  d.createRenderer=function(){this.renderer={render(){},clearDepth(){},setPixelRatio(){},setSize(){},dispose(){},autoClear:true};};
  d.captureReflections=function(){};d.captureRoyalReflections=function(){};
  return d;
}
function boot(){
  const g=launch(definition(),api,host,{createThree:canvas=>adapter.createScopedThreejs(canvas)});
  for(let i=0;i<8&&!g.data.threeReady;i++){const [id,fn]=frames.entries().next().value||[];assert(fn,'initial frames missing');frames.delete(id);fn();}
  assert(g.data.threeReady);g.stopLoop();return g;
}
let game=boot();assert.equal(canvases,2,'exactly one screen canvas and one offscreen HUD');
function tap(method,match){
  game.hud.draw(true);const hit=game.hud.hits.find(hit=>hit.method===method&&(!match||match(hit.dataset)));assert(hit,'HUD action '+method);
  const touch={clientX:hit.x+hit.w/2,clientY:hit.y+hit.h/2,identifier:7};fire('TouchStart',{touches:[touch],changedTouches:[touch]});fire('TouchEnd',{touches:[],changedTouches:[touch]});game.stopLoop();
}
tap('startGame');assert.equal(game.data.phase,'route');assert.equal(game.data.routeList.length,19);
game.hud.draw(true);assert(!game.hud.hits.some(hit=>hit.method==='chooseGender'));
tap('selectRoute',d=>d.id==='king');tap('confirmRoute');
assert(game.data.nameEditor);tap('editNativeName');fire('KeyboardInput',{value:'荷塘原生蛙'});fire('KeyboardConfirm',{value:'荷塘原生蛙'});
assert.equal(game.data.petName,'荷塘原生蛙');assert.equal(game.data.phase,'nurture');assert.equal(callbacks.KeyboardConfirm.size,0);game.stopLoop();
for(let i=0;i<20&&!game.data.canChallenge;i++){const type=['feed','pet','play'][i%3];game.applyCare({type,key:{feed:'food',pet:'affection',play:'play'}[type]});}
tap('startJumpChallenge');assert.equal(game.data.phase,'levelJump');
let starts=0,ends=0,point;const originalStart=game.onTouchStart,originalEnd=game.onTouchEnd;
game.onTouchStart=event=>{starts++;point=event.touches[0];};game.onTouchEnd=()=>{ends++;};
const a={clientX:0,clientY:0,identifier:2},b={clientX:60,clientY:0,identifier:3};
fire('TouchStart',{touches:[a],changedTouches:[a]});fire('TouchStart',{touches:[a,b],changedTouches:[b]});fire('TouchEnd',{touches:[a],changedTouches:[b]});
assert.equal(starts,1);assert.equal(ends,0);assert.equal(point.x,0);assert.equal(point.y,0);fire('TouchEnd',{touches:[],changedTouches:[a]});assert.equal(ends,1);
game.onTouchStart=originalStart;game.onTouchEnd=originalEnd;
tap('pauseAdventure');assert(game.data.sessionPaused&&game.data.paused);fire('Show');assert(game.data.paused);
game.hud.draw(true);
assert(game.hud.hits.every(h=>['continueAdventure','saveAndGoHome','restartAdventure'].includes(h.method)),'modal must block underlying controls');
tap('continueAdventure');assert(!game.data.paused);fire('Hide');assert(game.data.paused);fire('Show');assert(!game.data.paused);game.stopLoop();
fire('WindowResize');assert.equal(game.width,390);assert.equal(game.hud.canvas.width,585,'HUD resolution is bounded independently from 3D');
const before=game.hud.lastDraw;game.hud.dirty=true;game.hud.draw();assert.equal(game.hud.lastDraw,before,'HUD throttling must not re-upload every frame');
game.setupBugLevel();const guide=JSON.stringify(game.data.bugGuideSteps);
for(const [width,height]of [[320,640],[390,844]]){
  const lines=[];game.hud.ctx.fillText=(text,x,y)=>lines.push({text,x,y});
  game.hud.resize({windowWidth:width,windowHeight:height,pixelRatio:2,safeArea:{top:24,bottom:height-20}});game.hud.draw(true);
  for(const step of game.data.bugGuideSteps){const line=lines.find(line=>line.text===step);assert(line,'捕虫说明应始终完整显示：'+step);assert(line.y>=game.hud.dockTop&&line.y+18<=height-20);}
}
game.scoreBug(game.insects[0]);game.aimHit=null;game.aimWorld=new game.THREE.Vector3(99,99,99);game.fireTongue();
assert.equal(JSON.stringify(game.data.bugGuideSteps),guide,'捕虫反馈不能覆盖玩法说明');game.retryLevel();assert.equal(JSON.stringify(game.data.bugGuideSteps),guide);
game.setupJumpLevel();game.hud.resize(api.getWindowInfo());
tap('pauseAdventure');tap('saveAndGoHome');tap('openSettings');tap('toggleSetting',d=>d.key==='soundEnabled');assert(!game.data.soundEnabled);tap('goHome');
assert.equal(game.assetPath('/assets/audio/jump.wav'),'assets/audio/jump.wav');
game.onUnload();assert.equal(game.hud,null);assert(Object.values(callbacks).every(set=>set.size===0));assert.equal(frames.size,0);
game=boot();assert(!game.data.soundEnabled);assert.equal(game.companion.name,'荷塘原生蛙');assert(game.data.hasAdventure);game.onUnload();
const broken=definition(),log=console.error;let failed;
try{console.error=()=>{};failed=launch(broken,api,host,{createThree(){throw Error('unsupported GPU');}});}finally{console.error=log;}
assert(failed.data.initError);assert(modal&&modal.title==='池塘加载失败');failed.onUnload();

const pixels=new Uint8Array([255,0,0,255,0,255,0,255,0,0,255,255,255,255,255,255]);
const png=photo.png(pixels,2,2);assert.equal(Buffer.from(png).subarray(1,4).toString(),'PNG');
function decode(bytes){let offset=8,parts=[];while(offset<bytes.length){const view=new DataView(bytes.buffer,bytes.byteOffset+offset),size=view.getUint32(0),kind=String.fromCharCode(...bytes.subarray(offset+4,offset+8));if(kind==='IDAT')parts.push(bytes.subarray(offset+8,offset+8+size));offset+=12+size;}return unzlibSync(Buffer.concat(parts));}
const decoded=decode(png);assert.deepEqual(Array.from(decoded.subarray(1,9)),Array.from(pixels.subarray(0,8)));assert.equal(decoded[9],0);
let written,result,worldPass=0;
const native={env:{USER_DATA_PATH:'wxfile://usr'},getFileSystemManager:()=>({mkdirSync(){},writeFileSync(file,buffer){written={file,bytes:new Uint8Array(buffer)};}})};
const gl={drawingBufferWidth:2,drawingBufferHeight:2,RGBA:6408,UNSIGNED_BYTE:5121,readPixels(x,y,w,h,format,type,out){out.set(pixels);}};
photo.capture({width:2,renderer:{getContext:()=>gl},renderWorld(){worldPass++;}},native,{x:0,y:0,width:2,height:2,success:value=>{result=value;},fail:error=>{throw error;}});
assert.equal(worldPass,1);assert(result.persistent);assert(/^wxfile:\/\/usr\/pond-memories\/m-[a-z0-9-]+\.png$/.test(written.file));
const nativeRows=decode(written.bytes);assert.deepEqual(Array.from(nativeRows.subarray(1,5)),[0,0,255,255],'WebGL photo must be flipped upright');
const config=JSON.parse(fs.readFileSync('project.config.json','utf8'));assert.equal(config.compileType,'game');assert.equal(config.appid,'wx50de633ed3efe246');
assert(fs.existsSync('game.js')&&fs.existsSync('game.json')&&fs.existsSync('minigame-dist/main.js'));
assert(fs.statSync('minigame-dist/main.js').size<2*1024*1024);
console.log('PASS: 无 Page/DOM 原生启动 / Canvas 按钮与模态拦截 / 键盘取名与清理 / 多指与零坐标 / 生命周期与续关 / 有界 HUD 更新与释放 / PNG 编码及 WebGL 照片翻转 / 小游戏工程配置');
