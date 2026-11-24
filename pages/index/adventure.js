const RUN_KEY='tadpole-adventure-v1';
const ALBUM_KEY='tadpole-memories-v1';
const STAGES=['jump','bugs','choice','travel','sling','result'];
const ACTIVE=['levelJump','levelBug','returnChoice','returnTravel','sling','returnResult'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const integer=(n,max)=>Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
const token=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
const stamp=time=>{const d=new Date(time+8*3600000),pad=n=>String(n).padStart(2,'0');return d.getUTCFullYear()+'.'+pad(d.getUTCMonth()+1)+'.'+pad(d.getUTCDate())+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());};

module.exports=function adventure(page,api){
  Object.assign(page.data,{hasAdventure:false,adventureLabel:'',sessionPaused:false,jumpCombo:0,bugCombo:0,
    bestJumpCombo:0,bestBugCombo:0,bonusSeeds:0,travelCollected:0,travelFeedback:'',returnLane:0,
    fortressLayout:0,fortressName:'木石门楼',albumEntries:[],albumCount:0,selectedMemory:null});
  const read=key=>{try{return api&&api.getStorageSync?api.getStorageSync(key):null;}catch(error){return null;}};
  const write=(key,value)=>{try{if(api&&api.setStorageSync)api.setStorageSync(key,value);return true;}catch(error){return false;}};

  Object.assign(page,{
    newCompanionIdentity(){this.companionId='pet-'+token();this.lastRewardedRunId='';this.currentRun=null;this.clearSavedAdventure();},

    validateAdventure(value){
      const pet=this.companion;
      if(!pet||!value||value.version!==1||value.pid!==pet.id||value.routeId!==pet.routeId
        ||typeof value.id!=='string'||value.id.length>100||!STAGES.includes(value.stage)
        ||this.getGrowthStage(pet.growth).index<3||pet.lastRewardedRunId===value.id)return null;
      const c=value.checkpoint;
      if(!c||!Number.isInteger(c.jumps)||c.jumps<0||c.jumps>15||c.jumps%5
        ||!c.position||![c.position.x,c.position.z,c.heading].every(Number.isFinite)
        ||Math.abs(c.position.x)>10||Math.abs(c.position.z)>10||Math.abs(c.heading)>1000)return null;
      const ids=(mode,list)=>Array.isArray(list)?Array.from(new Set(list.filter(id=>[mode+'-0',mode+'-1',mode+'-2'].includes(id)))):[];
      const travel=value.travel||{},pull=value.pull||{},ledger=value.ledger||{};
      return {version:1,id:value.id,pid:pet.id,routeId:pet.routeId,stage:value.stage,
        elapsed:integer(value.elapsed,86400000),perfect:integer(value.perfect,20),falls:integer(value.falls,999),
        attempts:integer(value.attempts,4),bugs:integer(value.bugs,10),
        checkpoint:{jumps:c.jumps,perfect:integer(c.perfect,c.jumps),position:{x:c.position.x,z:c.position.z},heading:c.heading,combo:integer(c.combo,20)},
        bestJump:integer(value.bestJump,20),bestBug:integer(value.bestBug,10),bugCombo:integer(value.bugCombo,10),
        ledger:{boat:ids('boat',ledger.boat),plane:ids('plane',ledger.plane)},
        caughtKinds:{gnat:integer(value.caughtKinds&&value.caughtKinds.gnat,10),dragonfly:integer(value.caughtKinds&&value.caughtKinds.dragonfly,10),butterfly:integer(value.caughtKinds&&value.caughtKinds.butterfly,10)},
        fortress:integer(value.fortress,2),outcome:value.outcome==='win'?'win':'lose',
        pull:{x:Number.isFinite(pull.x)?clamp(pull.x,-1,1):0,power:Number.isFinite(pull.power)?clamp(pull.power,0,1):.65},
        travel:{mode:travel.mode==='plane'?'plane':'boat',elapsed:integer(travel.elapsed,9000),
          steer:Number.isFinite(travel.steer)?clamp(travel.steer,-1,1):0,lane:Math.sign(Number(travel.lane)||0),
          passed:Array.isArray(travel.passed)?travel.passed.filter(id=>typeof id==='string'&&/^(boat|plane|reed)-[0-2]$/.test(id)).slice(0,8):[]}};
    },

    loadAdventure(){
      this.suspendedAdventure=this.validateAdventure(read(RUN_KEY));this.refreshAdventureSummary();
    },

    refreshAdventureSummary(){
      const saved=this.suspendedAdventure,valid=!!(saved&&this.companion&&saved.pid===this.companion.id&&this.companion.lastRewardedRunId!==saved.id);
      const label=valid?({jump:'荷叶小径 · '+saved.checkpoint.jumps+'/20',bugs:'荷花池 · '+saved.bugs+'/10',choice:'归途待启',travel:saved.travel.mode==='boat'?'归途 · 小舟':'归途 · 飞机',sling:'归途 · 害虫堡垒',result:'归途 · 胜负已定'})[saved.stage]:'';
      this.setData({hasAdventure:valid,adventureLabel:label});
    },

    clearSavedAdventure(){
      this.suspendedAdventure=null;write(RUN_KEY,null);this.setData({hasAdventure:false,adventureLabel:''});
    },

    beginAdventure(){
      if(this.restoringAdventure)return;
      this.currentRun={id:'run-'+token(),pid:this.companionId||this.companion&&this.companion.id,
        routeId:this.data.selectedRouteId,bestJump:0,bestBug:0,ledger:{boat:[],plane:[]}};
      this.setData({jumpCombo:0,bugCombo:0,bestJumpCombo:0,bestBugCombo:0,bonusSeeds:0,travelCollected:0,sessionPaused:false});
    },

    ensureAdventure(){if(!this.currentRun)this.beginAdventure();return this.currentRun;},

    adventureBonus(){
      const run=this.currentRun;if(!run)return 0;
      return Math.min(3,Math.floor(run.bestJump/3))+Math.min(3,Math.floor(run.bestBug/3))
        +Math.min(3,Math.max(run.ledger.boat.length,run.ledger.plane.length));
    },

    noteCombo(kind,success){
      const run=this.currentRun;if(!run)return;
      const key=kind==='jump'?'jumpCombo':'bugCombo',best=kind==='jump'?'bestJump':'bestBug';
      const count=success?Math.min(kind==='jump'?20:10,this.data[key]+1):0;run[best]=Math.max(run[best],count);
      this.setData({[key]:count,bestJumpCombo:run.bestJump,bestBugCombo:run.bestBug,bonusSeeds:this.adventureBonus()});
    },

    noteReturnPickup(mode,id){
      const run=this.currentRun;if(!run||!run.ledger[mode]||run.ledger[mode].includes(id))return false;
      run.ledger[mode].push(id);this.setData({travelCollected:run.ledger[mode].length,bonusSeeds:this.adventureBonus()});
      this.playSound('perfect');this.vibrate('light');this.saveAdventure();return true;
    },

    saveAdventure(){
      const run=this.currentRun;
      if(this.restoringAdventure||!run||!this.companionActive||this.runRewarded||!ACTIVE.includes(this.data.phase))return;
      const phase=this.data.phase,kit=this.returnWorld;
      let stage=phase==='levelJump'?'jump':phase==='levelBug'?'bugs':phase==='returnChoice'?'choice':phase==='returnTravel'?'travel':phase==='sling'?'sling':'result';
      if(stage==='jump'&&this.data.jumps>=20)stage='bugs';
      if(stage==='bugs'&&this.data.bugs>=10)stage='choice';
      const checkpoint=this.checkpointState||{jumps:0,perfect:0,position:{x:-3.2,z:2.8},heading:0,combo:0};
      const saved={version:1,id:run.id,pid:run.pid,routeId:run.routeId,stage,
        elapsed:this.runStartedAt?Math.max(0,(this.adventureFinishedAt||this.hiddenAt||Date.now())-this.runStartedAt):0,
        checkpoint:{jumps:checkpoint.jumps,perfect:checkpoint.perfect,position:{x:checkpoint.position.x,z:checkpoint.position.z},heading:checkpoint.heading||0,combo:checkpoint.combo||0},
        perfect:this.data.perfect,falls:this.runFalls||0,attempts:this.data.attempts,bugs:this.data.bugs,
        bestJump:run.bestJump,bestBug:run.bestBug,bugCombo:this.data.bugCombo,ledger:run.ledger,
        caughtKinds:this.caughtKinds||{gnat:0,dragonfly:0,butterfly:0},fortress:this.data.fortressLayout,
        outcome:this.data.returnOutcome,pull:kit&&kit.pull||{x:0,power:.65},
        travel:kit&&phase==='returnTravel'?{mode:kit.mode,elapsed:Math.round(kit.elapsed*1000),steer:kit.steer||0,lane:kit.targetLane||0,passed:(kit.events||[]).filter(event=>event.passed).map(event=>event.id)}:{mode:'boat',elapsed:0,steer:0,lane:0,passed:[]}};
      this.suspendedAdventure=JSON.parse(JSON.stringify(saved));
      if(!write(RUN_KEY,saved))this.setData({storageNotice:'冒险进度暂时无法保存，请检查设备存储空间'});
      this.refreshAdventureSummary();
    },

    resumeAdventure(){
      const saved=this.validateAdventure(this.suspendedAdventure||read(RUN_KEY));
      if(!saved||!this.data.threeReady)return false;
      this.restoringAdventure=true;
      try{
        this.resumeCompanion();this.currentRun={id:saved.id,pid:saved.pid,routeId:saved.routeId,bestJump:saved.bestJump,bestBug:saved.bestBug,ledger:saved.ledger};
        this.runRewarded=false;this.runFalls=saved.falls;
        this.setData({sessionPaused:false,paused:false,perfect:saved.perfect,falls:saved.falls,attempts:saved.attempts,
          bestJumpCombo:saved.bestJump,bestBugCombo:saved.bestBug,bonusSeeds:this.adventureBonus(),fortressLayout:saved.fortress});
        if(saved.stage==='jump'){
          this.setupJumpLevel();
          this.currentRun={id:saved.id,pid:saved.pid,routeId:saved.routeId,bestJump:saved.bestJump,bestBug:saved.bestBug,ledger:saved.ledger};
          this.checkpointState={jumps:saved.checkpoint.jumps,perfect:saved.checkpoint.perfect,
            position:new this.THREE.Vector3(saved.checkpoint.position.x,.06,saved.checkpoint.position.z),heading:saved.checkpoint.heading,combo:saved.checkpoint.combo};
          this.restoreCheckpoint();this.runFalls=saved.falls;
          this.setData({attempts:saved.attempts,falls:saved.falls,jumpCombo:saved.checkpoint.combo,
            bestJumpCombo:saved.bestJump,bestBugCombo:saved.bestBug,bonusSeeds:this.adventureBonus(),
            gameOver:saved.attempts===0,message:'从第 '+saved.checkpoint.jumps+' 片荷叶继续'});
        }else{
          this.setupBugLevel();
          this.caughtKinds=Object.assign({},saved.caughtKinds);
          this.setData({bugs:saved.bugs,perfect:saved.perfect,falls:saved.falls,bugCombo:saved.bugCombo,
            caughtKinds:Object.keys(this.caughtKinds).map(key=>({name:({gnat:'小飞虫',dragonfly:'蜻蜓',butterfly:'蝴蝶'})[key],count:this.caughtKinds[key]}))});
          if(saved.stage!=='bugs'){
            this.setData({bugs:10});this.showReturnChoice();
            if(saved.stage==='travel'){
              this.chooseReturn({currentTarget:{dataset:{mode:saved.travel.mode}}});
              this.returnWorld.restoreTravel(saved.travel);
            }else if(saved.stage==='sling'||saved.stage==='result'){
              this.chooseReturn({currentTarget:{dataset:{mode:'sling'}}});this.returnWorld.pull=Object.assign({},saved.pull);
              this.setData({slingPower:Math.round(saved.pull.power*100)});this.returnWorld.updateBands();
              if(saved.stage==='result'){
                if(saved.outcome==='win')this.returnWorld.scatterFortress();
                this.returnWorld.finishShot(saved.outcome==='win');this.returnWorld.update(this.returnWorld.resultAt+4000,0);
              }
            }
          }
        }
        this.runStartedAt=Date.now()-saved.elapsed;this.adventureFinishedAt=['choice','travel','sling','result'].includes(saved.stage)?Date.now():0;
        this.runFalls=saved.falls;this.setData({perfect:saved.stage==='jump'?saved.checkpoint.perfect:saved.perfect});
        this.hiddenAt=null;this.lastTick=Date.now();return true;
      }finally{this.restoringAdventure=false;this.saveAdventure();}
    },

    pauseAdventure(){
      if(!ACTIVE.includes(this.data.phase)||this.data.transition||this.data.sessionPaused)return;
      this.setData({sessionPaused:true});this.onHide();
    },

    continueAdventure(){
      if(!this.data.sessionPaused)return;
      this.setData({sessionPaused:false});this.onShow();
    },

    saveAndGoHome(){
      this.saveAdventure();this.setData({sessionPaused:false});this.goHome();
      this.onShow();
    },

    restartAdventure(){
      const restart=()=>{this.currentRun=null;this.clearSavedAdventure();this.setData({sessionPaused:false});this.hiddenAt=null;this.setupJumpLevel();this.onShow();};
      if(!api||!api.showModal){restart();return;}
      api.showModal({title:'重新开始这次冒险？',content:'伙伴的成长与纪念册会保留，本次进度和未结算的额外莲子将重置。',success:result=>{if(result.confirm)restart();}});
    },

    quickReturn(){
      if(!['returnChoice','returnTravel','sling','returnResult'].includes(this.data.phase)||this.data.bugs<10)return;
      this.setData({sessionPaused:false});if(this.hiddenAt){this.hiddenAt=null;this.lastTick=Date.now();this.setData({paused:false});}
      this.showFinal();if(this.canvas&&!this.unloaded)this.startLoop();
    },

    steerReturn(event){if(this.returnWorld&&!this.data.paused)this.returnWorld.steerTo(Number(event.currentTarget.dataset.lane));},

    chooseFortress(event){
      const layout=Number(event.currentTarget.dataset.layout);
      if(this.data.phase!=='sling'||!this.data.slingReady||![0,1,2].includes(layout)||this.data.paused)return;
      this.setData({fortressLayout:layout});this.returnWorld.begin('sling');this.saveAdventure();
    },

    settleAdventure(letter){
      const run=this.currentRun;
      this.recordMemory('return',{suffix:run?run.id:'legacy-'+this.data.adventures,title:'第 '+this.data.adventures+' 次归来',
        note:this.data.grade+' 级 · '+this.data.perfect+' 次完美落叶 · '+this.data.runTimeText,letter,stage:3});
      if(!run||this.lastRewardedRunId===run.id&&this.rewardStored!==false){this.currentRun=null;this.clearSavedAdventure();}
    },

    loadMemories(){
      const saved=read(ALBUM_KEY);
      this.memories=Array.isArray(saved)?saved.filter(item=>item&&typeof item.id==='string'&&typeof item.pid==='string'
        &&typeof item.title==='string'&&this.getRouteById(item.routeId)&&Number.isFinite(item.at)).slice(-48).map(item=>({
          id:item.id.slice(0,180),pid:item.pid.slice(0,100),routeId:item.routeId,name:String(item.name||'小荷').slice(0,12),
          title:item.title.slice(0,32),note:String(item.note||'').slice(0,180),stage:integer(item.stage,3),at:item.at,
          photo:this.safePhotoPath(item.photo)?item.photo:'',letter:Array.isArray(item.letter)?item.letter.filter(line=>typeof line==='string').slice(0,4).map(line=>line.slice(0,100)):[]
        })):[];
      this.refreshMemories();
    },

    safePhotoPath(value){
      if(typeof value!=='string')return false;
      if(api&&api.__preview)return /^data:image\/png;base64,/.test(value)&&value.length<200000;
      const root=api&&api.env&&api.env.USER_DATA_PATH;
      return !!(root&&value.startsWith(root)&&/^\/pond-memories\/m-[a-z0-9-]+\.png$/.test(value.slice(root.length)));
    },

    refreshMemories(){
      this.setData({albumCount:(this.memories||[]).length,albumEntries:(this.memories||[]).slice().reverse().map(item=>Object.assign({},item,{
        date:stamp(item.at),routeName:this.getRouteById(item.routeId).name,stamp:['初遇','后腿','前腿','青蛙'][item.stage]}))});
    },

    persistMemories(){
      if(!write(ALBUM_KEY,this.memories))this.setData({storageNotice:'纪念册暂时无法保存，请检查设备存储空间'});
      this.refreshMemories();
    },

    recordMemory(type,options){
      if(!this.companionActive||!this.companionId||!this.getSelectedRoute())return;
      if(!this.memories)this.loadMemories();
      const opts=options||{},id=this.companionId+':'+type+(opts.suffix?':'+opts.suffix:'');
      if(this.memories.some(item=>item.id===id))return;
      const item={id,pid:this.companionId,routeId:this.data.selectedRouteId,name:this.data.petName,
        title:opts.title||'成长的瞬间',note:opts.note||'',stage:opts.stage===undefined?this.getGrowthStage(this.data.growth).index:opts.stage,
        at:Date.now(),photo:'',letter:opts.letter||[]};
      this.memories.push(item);
      if(this.memories.length>48){const removed=this.memories.shift();this.deleteMemoryPhoto(removed.photo);}
      this.persistMemories();this.queueMemoryPhoto(id);
    },

    queueMemoryPhoto(id){
      if(!api||(!api.canvasToTempFilePath&&!this.captureScenePhoto)||!this.canvas)return;
      this.memoryPhotoTimers=this.memoryPhotoTimers||new Set();
      const timer=setTimeout(()=>{this.memoryPhotoTimers.delete(timer);this.captureMemoryPhoto(id);},420);
      this.memoryPhotoTimers.add(timer);
    },

    captureMemoryPhoto(id){
      const item=(this.memories||[]).find(item=>item.id===id);
      if(!item||this.unloaded||this.data.paused||!this.data.threeReady||item.pid!==this.companionId)return;
      const actor=this.actor()||(this.returnWorld&&this.returnWorld.hero);if(!actor)return;
      if(item.stage!==this.getGrowthStage(this.data.growth).index)return;
      actor.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
      const T=this.THREE,box=new T.Box3().setFromObject(actor);let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const p=new T.Vector3(x,y,z).project(this.camera),sx=(p.x+1)*this.width/2,sy=(1-p.y)*this.height/2;
        left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
      }
      const side=Math.min(this.width,this.height,Math.max(right-left,bottom-top)*1.12);
      const x=clamp((left+right-side)/2,0,this.width-side),y=clamp((top+bottom-side)/2,0,this.height-side);
      this.renderFrame();
      const capture=this.captureScenePhoto?options=>this.captureScenePhoto(options):options=>api.canvasToTempFilePath(options);
      capture({canvas:this.canvas,x,y,width:side,height:side,destWidth:256,destHeight:256,fileType:'png',
        success:result=>{
          const commit=photo=>{const entry=(this.memories||[]).find(entry=>entry.id===id);if(!entry){this.deleteMemoryPhoto(photo);return;}entry.photo=photo;this.persistMemories();};
          if(result.persistent&&this.safePhotoPath(result.tempFilePath)){commit(result.tempFilePath);return;}
          if(api.__preview&&this.safePhotoPath(result.tempFilePath)){commit(result.tempFilePath);return;}
          if(!api.getFileSystemManager||!api.env)return;
          const manager=api.getFileSystemManager(),folder=api.env.USER_DATA_PATH+'/pond-memories',file=folder+'/m-'+token()+'.png';
          try{try{manager.mkdirSync(folder,true);}catch(error){}manager.saveFile({tempFilePath:result.tempFilePath,filePath:file,success:()=>commit(file),fail:()=>{}});}catch(error){}
        },fail:()=>{}});
    },

    deleteMemoryPhoto(photo){
      if(!photo||!this.safePhotoPath(photo)||!api||api.__preview||!api.getFileSystemManager)return;
      try{api.getFileSystemManager().unlink({filePath:photo,fail:()=>{}});}catch(error){}
    },

    openAlbum(){
      this.saveAdventure();this.saveCompanion();if(!this.memories)this.loadMemories();
      this.setData({phase:'album',chapter:'成长纪念册',selectedMemory:null});this.playSound('select');
    },

    openMemory(event){
      const item=this.data.albumEntries.find(item=>item.id===event.currentTarget.dataset.id);
      if(item)this.setData({selectedMemory:item});
    },

    closeMemory(){this.setData({selectedMemory:null});},

    disposeMemories(){(this.memoryPhotoTimers||new Set()).forEach(timer=>clearTimeout(timer));this.memoryPhotoTimers=null;}
  });
};
