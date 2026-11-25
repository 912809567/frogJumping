const Hud = require('./hud');
const photo = require('./photo');
const { createPhysicsLoader } = require('./physics');

function windowInfo(api){
  const info=api.getWindowInfo?api.getWindowInfo():api.getSystemInfoSync();
  return Object.assign({},info,{windowWidth:Math.max(1,info.windowWidth),windowHeight:Math.max(1,info.windowHeight)});
}

function launch(definition,api,host,options){
  const opts=options||{},canvas=opts.canvas||api.createCanvas(),listeners=[];
  const request=host.requestAnimationFrame||canvas.requestAnimationFrame;
  const cancel=host.cancelAnimationFrame||canvas.cancelAnimationFrame;
  if(!request||!cancel)throw Error('Mini-game animation-frame API is unavailable');
  canvas.requestAnimationFrame=callback=>request.call(host,callback);
  canvas.cancelAnimationFrame=id=>cancel.call(host,id);
  canvas.createImage=()=>api.createImage();
  const game=Object.assign({},definition,{data:Object.assign({},definition.data,{nameEditor:false,nameDraft:''}),canvas});
  let uiFrame=null,primaryTouch=null,uiTouch=false,disposed=false;
  const listen=(on,off,callback)=>{
    if(!api[on])return;api[on](callback);listeners.push(()=>{if(api[off])api[off](callback);});
  };
  game.assetPath=path=>path.replace(/^\//,'');
  game.requestUiFrame=function(){
    if(disposed||uiFrame!==null||!this.renderer||!this.hud)return;
    if(this.animationId&&!this.data.paused)return;
    uiFrame=canvas.requestAnimationFrame(()=>{uiFrame=null;if(!disposed&&this.scene)this.renderFrame(true);});
  };
  game.setData=function(patch){
    Object.assign(this.data,patch);
    if(this.hud){if(Object.prototype.hasOwnProperty.call(patch,'selectedMemory'))this.hud.scroll=0;this.hud.dirty=true;this.hud.measure(this.data);}
    this.requestUiFrame();
  };
  game.renderWorld=definition.renderFrame.bind(game);
  let frameCount=0;
  game.renderFrame=function(force){
    if(contextLost)return;
    if(++frameCount%120===0&&this.checkContextLost())return;
    this.renderWorld();if(this.hud)this.hud.render(force===true);
  };
  game.captureScenePhoto=options=>photo.capture(game,api,options);
  game.restartNativeGame=function(){
    if(api.restartMiniProgram)api.restartMiniProgram({fail:()=>api.showModal({title:'请重新打开',content:'请关闭游戏后重新进入。',showCancel:false})});
    else if(api.showModal)api.showModal({title:'请重新打开',content:'请关闭游戏后重新进入。',showCancel:false});
  };
  const saveProgress=()=>{try{game.saveCompanion();if(game.saveAdventure)game.saveAdventure();}catch(error){}};

  // ---- 稳定性：WebGL 上下文丢失 ----
  // 长时间切后台或显存紧张时系统可能回收 WebGL 上下文，继续渲染只会黑屏。
  // 场景资源无法可靠重建，因此保存进度后提示重新载入。
  let contextLost=false;
  game.checkContextLost=function(){
    const gl=this.renderer&&this.renderer.getContext&&this.renderer.getContext();
    if(gl&&typeof gl.isContextLost==='function'&&gl.isContextLost()){this.handleContextLost();return true;}
    return false;
  };
  game.handleContextLost=function(){
    if(contextLost||disposed)return;contextLost=true;
    this.stopLoop();saveProgress();
    const restart=()=>this.restartNativeGame();
    if(api.showModal)api.showModal({title:'画面需要重新载入',content:'手机回收了图形资源，伙伴和冒险进度已经保存。',showCancel:false,success:restart,fail:restart});
    else restart();
  };
  if(canvas.addEventListener){
    const onLost=event=>{if(event&&event.preventDefault)event.preventDefault();game.handleContextLost();};
    canvas.addEventListener('webglcontextlost',onLost,false);
    listeners.push(()=>{if(canvas.removeEventListener)canvas.removeEventListener('webglcontextlost',onLost,false);});
  }

  // ---- 稳定性：内存告警 ----
  // 降低 WebGL 像素密度（逻辑尺寸、触控坐标不变），并限制自适应画质之后最多恢复到 1.5。
  game.handleMemoryWarning=function(){
    const quality=this.renderQuality;
    if(quality){
      quality.max=Math.min(quality.max,1.5);
      if(this.renderer&&this.renderer.setPixelRatio&&quality.current>1){
        const now=Date.now();quality.current=1;quality.changedAt=now;
        this.renderer.setPixelRatio(1);if(this.resetRenderQualityWindow)this.resetRenderQualityWindow(now,2000);
      }
    }
    if(api.triggerGC)api.triggerGC();
  };

  // ---- 物理分包 ----
  const physicsLoader=createPhysicsLoader(api,opts.physicsHost||(typeof GameGlobal==='undefined'?{}:GameGlobal));
  let preloadTimer=null;
  game.physicsEngine=()=>physicsLoader.engine();
  game.ensurePhysics=function(callback){
    if(physicsLoader.ready())return true;
    if(api.showLoading)api.showLoading({title:'准备弹弓…',mask:true});
    physicsLoader.load(error=>{
      if(api.hideLoading)api.hideLoading();
      if(disposed)return;
      if(error){
        console.error('Physics subpackage failed',error);
        if(api.showModal)api.showModal({title:'弹弓资源下载失败',content:'请检查网络后重试，也可以先选择划船或飞机回家。',showCancel:false});
      }
      if(callback)callback(error);
    });
    return false;
  };
  // 读取存档时如果停在弹弓阶段，要先下载物理分包，再恢复冒险。
  const resumeAdventure=game.resumeAdventure;
  game.resumeAdventure=function(){
    const saved=this.suspendedAdventure;
    if(saved&&(saved.stage==='sling'||saved.stage==='result')&&this.data.threeReady&&!physicsLoader.ready()){
      this.ensurePhysics(error=>{if(!error)resumeAdventure.call(this);});
      return true;
    }
    return resumeAdventure.call(this);
  };
  // 首屏完成后在空闲时预下载，通常玩到返程前就已就绪。
  const schedulePhysicsPreload=()=>{
    if(preloadTimer!==null||physicsLoader.ready()||!api.loadSubpackage)return;
    preloadTimer=setTimeout(()=>{preloadTimer=null;if(!disposed)physicsLoader.load(()=>{});},opts.physicsPreloadDelay===undefined?4000:opts.physicsPreloadDelay);
  };

  // ---- 版本更新 ----
  if(api.getUpdateManager){
    try{
      const updater=api.getUpdateManager();
      updater.onUpdateReady(()=>{
        if(!api.showModal){saveProgress();updater.applyUpdate();return;}
        api.showModal({title:'发现新版本',content:'新版本已经准备好，重启即可使用。伙伴和冒险进度会先保存。',confirmText:'重启',cancelText:'稍后',
          success:result=>{if(result.confirm){saveProgress();updater.applyUpdate();}}});
      });
    }catch(error){}
  }

  game.initThree=function(){
    this.jumpLeaves=[];this.insects=[];this.worldTadpoles=[];this.effects=null;this.unloaded=false;
    try{
      const info=windowInfo(api);this.nativeInfo=info;
      this.THREE=opts.createThree?opts.createThree(canvas):require('threejs-miniprogram').createScopedThreejs(canvas);
      this.width=info.windowWidth;this.height=info.windowHeight;
      this.createRenderer(info);this.hud=new (opts.Hud||Hud)(this,api,info);
      this.setupCamera(this.width,this.height);this.createMaterials();this.buildScene();
      this.camera.position.set(4,6,8);this.camera.lookAt(new this.THREE.Vector3(0,0,0));this.renderFrame(true);
      const finish=()=>{
        if(this.unloaded)return;
        try{
          this.captureReflections();this.showNurturePreview();this.cameraSnap();
          this.setData({threeReady:true,initError:false});this.startLoop();schedulePhysicsPreload();
          if(this.syncAmbient)this.syncAmbient(this.data.pondTheme);
          if(pendingLaunchQuery){const q=pendingLaunchQuery;pendingLaunchQuery=null;this.receiveShareCard(q);}
        }catch(error){this.showNativeError(error);}
      };
      this.initFrame=canvas.requestAnimationFrame(()=>{this.initFrame=canvas.requestAnimationFrame(finish);});
    }catch(error){this.showNativeError(error);}
  };
  game.showNativeError=function(error){
    console.error('Mini-game initialization failed',error);this.stopLoop();this.setData({threeReady:false,initError:true});
    if(api.showModal)api.showModal({title:'池塘加载失败',content:'请尝试重新打开游戏。\n'+String(error&&error.message||error).slice(0,100),showCancel:false});
  };

  game.fitPortraitGoal=function(goal,phase){
    if(this.petGroup&&this.hud&&phase==='route'){
      const T=this.THREE,band=this.hud.measure(this.data),actor=this.petGroup;
      const pivot=actor.userData.tailPivot,tailYaw=pivot?pivot.rotation.y:0;
      if(pivot)pivot.rotation.y=0;actor.updateMatrixWorld(true);
      const box=new T.Box3().setFromObject(actor),center=box.getCenter(new T.Vector3());
      if(pivot){pivot.rotation.y=tailYaw;actor.updateMatrixWorld(true);}
      const view=new T.Vector3(Math.sin(goal.yaw)*Math.cos(goal.pitch),Math.sin(goal.pitch),Math.cos(goal.yaw)*Math.cos(goal.pitch));
      const right=new T.Vector3(0,1,0).cross(view).normalize(),up=view.clone().cross(right);
      const tan=Math.tan(this.camera.fov*Math.PI/360),fraction=Math.max(.15,(band.bottom-band.top)/this.height)*.9;
      const screenCenter=1-(band.top+band.bottom)/this.height;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const corner=new T.Vector3(x,y,z).sub(center),depth=corner.dot(view);
        goal.dist=Math.max(goal.dist,depth+Math.abs(corner.dot(right))/(tan*this.camera.aspect*.86),depth+Math.abs(corner.dot(up)+screenCenter*depth*tan)/(tan*fraction));
      }
      const focus=center.addScaledVector(up,-screenCenter*goal.dist*tan);goal.fx=focus.x;goal.fy=focus.y;goal.fz=focus.z;
      return goal;
    }
    if(!this.frogGroup||!this.hud||!['home','route','nurture','status','final'].includes(phase))return goal;
    const size=this.actorSize(),band=this.hud.measure(this.data),top=band.top,bottom=band.bottom;
    const fraction=Math.max(.15,(bottom-top)/this.height),tan=Math.tan(this.camera.fov*Math.PI/360);
    const depth=Math.abs(Math.sin(goal.yaw))*size.w+Math.abs(Math.cos(goal.yaw))*size.d;
    const upRadius=(size.h*Math.cos(goal.pitch)+depth*Math.sin(goal.pitch))*.5;
    const depthRadius=(size.h*Math.sin(goal.pitch)+depth*Math.cos(goal.pitch))*.5;
    goal.dist=Math.max(goal.dist,upRadius/(tan*fraction)+depthRadius);
    const center=this.frogGroup.position.y+(this.frogGroup.userData.lift||0)*this.frogGroup.userData.baseScale+size.h*.5;
    const offset=(1-(top+bottom)/this.height)*goal.dist*tan;
    goal.fx=this.frogGroup.position.x+Math.sin(goal.yaw)*Math.sin(goal.pitch)*offset;
    goal.fy=center-Math.cos(goal.pitch)*offset;goal.fz=this.frogGroup.position.z+Math.cos(goal.yaw)*Math.sin(goal.pitch)*offset;
    return goal;
  };

  let keyboardCleanup=()=>{},nameDone=null;
  game.askPetName=function(current,done){
    keyboardCleanup();nameDone=done;this.setData({nameEditor:true,nameDraft:current||'小荷'});
  };
  game.editNativeName=function(){
    if(!this.data.nameEditor||!api.showKeyboard)return;
    keyboardCleanup();
    const input=result=>{if(this.data.nameEditor)this.setData({nameDraft:String(result.value||'').slice(0,12)});};
    const confirm=result=>{input(result);this.confirmNativeName();};
    if(api.onKeyboardInput)api.onKeyboardInput(input);
    if(api.onKeyboardConfirm)api.onKeyboardConfirm(confirm);
    keyboardCleanup=()=>{if(api.offKeyboardInput)api.offKeyboardInput(input);if(api.offKeyboardConfirm)api.offKeyboardConfirm(confirm);keyboardCleanup=()=>{};};
    api.showKeyboard({defaultValue:this.data.nameDraft,maxLength:12,multiple:false,confirmType:'done',fail:()=>{}});
  };
  game.confirmNativeName=function(){
    if(!this.data.nameEditor||!nameDone)return;
    const done=nameDone;nameDone=null;keyboardCleanup();if(api.hideKeyboard)api.hideKeyboard({fail:()=>{}});
    const name=String(this.data.nameDraft||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,12)||'小荷';
    this.setData({nameEditor:false});done(name);
  };
  game.cancelNativeName=function(){nameDone=null;keyboardCleanup();if(api.hideKeyboard)api.hideKeyboard({fail:()=>{}});this.setData({nameEditor:false});};

  const point=t=>({x:Number.isFinite(t.clientX)?t.clientX:Number.isFinite(t.x)?t.x:t.pageX,
    y:Number.isFinite(t.clientY)?t.clientY:Number.isFinite(t.y)?t.y:t.pageY,identifier:t.identifier===undefined?0:t.identifier});
  const find=(event,end)=>{
    const touches=(end?event.changedTouches:event.touches)||[];
    return touches.find(t=>(t.identifier===undefined?0:t.identifier)===primaryTouch);
  };
  const eventFor=(event,t,end)=>({touches:end?[]:[point(t)],changedTouches:[point(t)],timeStamp:event.timeStamp||Date.now()});
  listen('onTouchStart','offTouchStart',event=>{
    if(primaryTouch!==null||disposed||!game.hud)return;
    if(game.data.threeReady&&game.data.soundEnabled&&!game.data.paused&&!game.activeAmbientId&&game.syncAmbient)game.syncAmbient(game.data.pondTheme);
    const t=(event.changedTouches||event.touches||[])[0];if(!t)return;
    const p=point(t);if(!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    primaryTouch=p.identifier;uiTouch=game.hud.touchStart(p);
    if(!uiTouch)game.onTouchStart(eventFor(event,t,false));
  });
  listen('onTouchMove','offTouchMove',event=>{
    if(primaryTouch===null||disposed)return;const t=find(event,false);if(!t)return;
    if(uiTouch)game.hud.touchMove(point(t));else game.onTouchMove(eventFor(event,t,false));
  });
  listen('onTouchEnd','offTouchEnd',event=>{
    if(primaryTouch===null||disposed)return;const t=find(event,true);if(!t)return;
    if(uiTouch)game.hud.touchEnd(point(t));else game.onTouchEnd(eventFor(event,t,true));primaryTouch=null;uiTouch=false;
  });
  listen('onTouchCancel','offTouchCancel',()=>{
    if(primaryTouch===null)return;if(uiTouch&&game.hud)game.hud.gesture=null;else game.onTouchCancel();primaryTouch=null;uiTouch=false;
  });
  let pendingLaunchQuery=null;
  const checkShareQuery=options=>{
    const query=options&&options.query;
    if(!query||!query.route)return;
    if(game.data.threeReady)game.receiveShareCard(query);
    else pendingLaunchQuery=query;
  };
  if(api.getLaunchOptionsSync){try{checkShareQuery(api.getLaunchOptionsSync());}catch(error){}}
  const buildSharePayload=()=>{
    const value=game.onShareAppMessage();
    const imageUrl=photo.captureShareCard(game,api);
    const payload={title:value.title,query:value.query||''};
    if(imageUrl)payload.imageUrl=imageUrl;
    return payload;
  };
  game.shareFrogCard=function(){
    const payload=buildSharePayload();
    if(api.shareAppMessage){try{api.shareAppMessage(payload);return;}catch(error){}}
    if(api.showModal)api.showModal({title:'青蛙名片已准备好',content:'点击右上角「···」即可转发给好友：\n'+payload.title,showCancel:false});
  };

  listen('onHide','offHide',()=>{primaryTouch=null;uiTouch=false;if(game.hud)game.hud.gesture=null;game.onHide();});
  listen('onShow','offShow',options=>{if(contextLost||game.checkContextLost())return;game.onShow();checkShareQuery(options);});
  listen('onMemoryWarning','offMemoryWarning',()=>game.handleMemoryWarning());
  listen('onWindowResize','offWindowResize',()=>{
    if(!game.data.threeReady||disposed)return;
    const info=windowInfo(api);game.nativeInfo=info;game.width=info.windowWidth;game.height=info.windowHeight;
    game.renderer.setSize(game.width,game.height);game.camera.aspect=game.width/game.height;game.camera.updateProjectionMatrix();
    game.hud.resize(info);if(game.returnWorld&&game.returnWorld.active)game.returnWorld.update(Date.now(),0);else game.cameraSnap();game.requestUiFrame();
  });
  if(api.onShareAppMessage){
    const share=()=>buildSharePayload();
    api.onShareAppMessage(share);listeners.push(()=>{if(api.offShareAppMessage)api.offShareAppMessage(share);});
  }
  if(api.onShareTimeline){
    const timeline=()=>{
      const value=game.onShareTimeline();const imageUrl=photo.captureShareCard(game,api);
      const payload={title:value.title,query:value.query||''};if(imageUrl)payload.imageUrl=imageUrl;return payload;
    };
    api.onShareTimeline(timeline);listeners.push(()=>{if(api.offShareTimeline)api.offShareTimeline(timeline);});
  }
  const dispose=game.disposeThree;
  game.disposeThree=function(){if(this.hud){this.hud.dispose();this.hud=null;}dispose.call(this);};
  const unload=game.onUnload;
  game.onUnload=function(){
    if(disposed)return;disposed=true;keyboardCleanup();nameDone=null;listeners.forEach(remove=>remove());
    if(preloadTimer!==null){clearTimeout(preloadTimer);preloadTimer=null;}
    if(uiFrame!==null){canvas.cancelAnimationFrame(uiFrame);uiFrame=null;}unload.call(this);
  };
  game.onReady();return game;
}
module.exports={launch,windowInfo};
