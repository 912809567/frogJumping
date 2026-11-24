const Hud = require('./hud');
const photo = require('./photo');

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
  game.renderFrame=function(force){this.renderWorld();if(this.hud)this.hud.render(force===true);};
  game.captureScenePhoto=options=>photo.capture(game,api,options);
  game.restartNativeGame=function(){
    if(api.restartMiniProgram)api.restartMiniProgram({fail:()=>api.showModal({title:'请重新打开',content:'请关闭游戏后重新进入。',showCancel:false})});
    else if(api.showModal)api.showModal({title:'请重新打开',content:'请关闭游戏后重新进入。',showCancel:false});
  };

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
          this.setData({threeReady:true,initError:false});this.startLoop();
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
  listen('onHide','offHide',()=>{primaryTouch=null;uiTouch=false;if(game.hud)game.hud.gesture=null;game.onHide();});
  listen('onShow','offShow',()=>game.onShow());
  listen('onWindowResize','offWindowResize',()=>{
    if(!game.data.threeReady||disposed)return;
    const info=windowInfo(api);game.nativeInfo=info;game.width=info.windowWidth;game.height=info.windowHeight;
    game.renderer.setSize(game.width,game.height);game.camera.aspect=game.width/game.height;game.camera.updateProjectionMatrix();
    game.hud.resize(info);if(game.returnWorld&&game.returnWorld.active)game.returnWorld.update(Date.now(),0);else game.cameraSnap();game.requestUiFrame();
  });
  if(api.onShareAppMessage){
    const share=()=>{const value=game.onShareAppMessage();return{title:value.title,query:''};};
    api.onShareAppMessage(share);listeners.push(()=>{if(api.offShareAppMessage)api.offShareAppMessage(share);});
  }
  const dispose=game.disposeThree;
  game.disposeThree=function(){if(this.hud){this.hud.dispose();this.hud=null;}dispose.call(this);};
  const unload=game.onUnload;
  game.onUnload=function(){
    if(disposed)return;disposed=true;keyboardCleanup();nameDone=null;listeners.forEach(remove=>remove());
    if(uiFrame!==null){canvas.cancelAnimationFrame(uiFrame);uiFrame=null;}unload.call(this);
  };
  game.onReady();return game;
}
module.exports={launch,windowInfo};
