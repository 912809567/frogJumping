const C={ink:'#214b3b',muted:'#698575',paper:'rgba(248,252,249,.96)',green:'#326950',line:'#dce7df',gold:'#947125',pink:'#b76e89',blue:'#548d9f'};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ACTIVE=['levelJump','levelBug','returnChoice','returnTravel','sling','returnResult'];

class Hud {
  constructor(game,api,info){
    this.game=game;this.api=api;this.canvas=api.createCanvas();this.ctx=this.canvas.getContext('2d');
    this.dirty=true;this.lastDraw=0;this.hits=[];this.scroll=0;this.images=new Map();
    this.resize(info);
    const T=game.THREE;this.texture=new T.CanvasTexture(this.canvas);this.texture.minFilter=T.LinearFilter;
    this.texture.magFilter=T.LinearFilter;this.texture.generateMipmaps=false;this.texture.encoding=T.sRGBEncoding;
    this.material=new T.MeshBasicMaterial({map:this.texture,transparent:true,depthTest:false,depthWrite:false});
    this.material.toneMapped=false;
    this.geometry=new T.PlaneBufferGeometry(2,2);this.scene=new T.Scene();this.camera=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const quad=new T.Mesh(this.geometry,this.material);quad.frustumCulled=false;this.scene.add(quad);
  }

  resize(info){
    this.w=info.windowWidth;this.h=info.windowHeight;
    const area=info.safeArea||{};this.safeTop=Math.max(0,area.top||info.statusBarHeight||0);
    this.safeBottom=Math.max(0,this.h-(area.bottom||this.h));
    this.ratio=Math.min(1.5,info.pixelRatio||1);this.canvas.width=Math.round(this.w*this.ratio);this.canvas.height=Math.round(this.h*this.ratio);
    this.dirty=true;
  }

  measure(d){
    const phase=d.phase,w=this.w,h=this.h,s=this.safeTop;
    let dock=0,top=s+134;
    if(phase==='home'){dock=164;top=s+158;}
    if(phase==='route'){dock=Math.min(298,Math.max(238,h*.34));top=s+158;}
    if(phase==='levelBug')dock=this.bugGuideHeight(d);
    if(phase==='nurture'){dock=d.bubblePlaying?122:278+(d.souvenirs.length?24:0);top=s+130;}
    if(phase==='status'){dock=d.hasCompanion?326:170;top=s+76;}
    if(phase==='settings'){dock=398;top=s+76;}
    if(phase==='returnChoice'){dock=278;top=s+154;}
    if(phase==='final'){dock=322;top=s+76;}
    this.dockTop=h-this.safeBottom-dock;
    const hasQuote=!!d.petQuote&&((phase==='home')||(phase==='nurture'&&!d.bubblePlaying));
    this.band={top,bottom:Math.max(top+80,this.dockTop-(hasQuote?48:12))};
    if(this.phase!==phase){this.phase=phase;this.scroll=0;this.scrollArea=null;}
    this.dockHeight=dock;return this.band;
  }

  rect(x,y,w,h,color,radius){
    const c=this.ctx,r=Math.min(radius||0,w/2,h/2);c.beginPath();
    if(!r)c.rect(x,y,w,h);else{
      c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);
    }c.fillStyle=color;c.fill();
  }

  text(value,x,y,size,color,maxWidth,options){
    const c=this.ctx,o=options||{};c.font=(o.bold?'600 ':'')+(size||14)+'px sans-serif';c.textBaseline='top';c.fillStyle=color||C.ink;
    const width=maxWidth||this.w-x-18,lines=this.wrap(value,width);
    const step=o.lineHeight||Math.round((size||14)*1.4),limit=o.maxLines||lines.length;
    lines.slice(0,limit).forEach((line,i)=>{
      if(i===limit-1&&lines.length>limit){while(line&&c.measureText(line+'...').width>width)line=line.slice(0,-1);line+='...';}
      c.fillText(line,o.center?x+(width-c.measureText(line).width)/2:x,y+i*step);
    });return Math.min(lines.length,limit)*step;
  }

  wrap(value,width){
    const lines=[];let current='';
    for(const ch of String(value===undefined?'':value)){
      if(ch==='\n'||current&&this.ctx.measureText(current+ch).width>width){lines.push(current);current=ch==='\n'?'':ch;}else current+=ch;
    }if(current||!lines.length)lines.push(current);return lines;
  }

  bugGuideHeight(d){
    this.ctx.save();this.ctx.font='12px sans-serif';
    const height=48+d.bugGuideSteps.reduce((sum,line)=>sum+this.wrap(line,this.w-40).length*18+6,0);
    this.ctx.restore();return Math.max(136,height);
  }

  icon(name,x,y,size,color){
    const c=this.ctx;c.save();c.translate(x,y);c.scale(size/24,size/24);c.lineWidth=1.8;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color||C.ink;c.beginPath();
    if(name==='pause'){c.moveTo(8,5);c.lineTo(8,19);c.moveTo(16,5);c.lineTo(16,19);}
    else if(name==='back'||name==='forward'){
      if(name==='forward'){c.translate(24,0);c.scale(-1,1);}c.moveTo(19,12);c.lineTo(5,12);c.moveTo(11,6);c.lineTo(5,12);c.lineTo(11,18);
    }else if(name==='book'){c.rect(5,4,15,17);c.moveTo(9,4);c.lineTo(9,21);c.moveTo(12,9);c.lineTo(17,9);c.moveTo(12,13);c.lineTo(17,13);}
    else if(name==='home'){c.moveTo(3,11);c.lineTo(12,4);c.lineTo(21,11);c.moveTo(6,10);c.lineTo(6,21);c.lineTo(18,21);c.lineTo(18,10);}
    else if(name==='boat'){c.moveTo(3,14);c.lineTo(6,20);c.lineTo(18,20);c.lineTo(21,14);c.closePath();c.moveTo(7,11);c.lineTo(17,5);c.moveTo(12,7);c.lineTo(12,14);}
    else if(name==='plane'){c.moveTo(12,3);c.lineTo(10,10);c.lineTo(3,14);c.lineTo(3,16);c.lineTo(10,14);c.lineTo(10,20);c.lineTo(12,18);c.lineTo(14,20);c.lineTo(14,14);c.lineTo(21,16);c.lineTo(21,14);c.lineTo(14,10);c.closePath();}
    else if(name==='sling'){c.moveTo(12,21);c.lineTo(12,12);c.lineTo(5,4);c.moveTo(12,12);c.lineTo(19,4);c.moveTo(5,6);c.lineTo(12,10);c.lineTo(19,6);}
    else if(name==='target'){c.arc(12,12,8,0,Math.PI*2);c.moveTo(16,12);c.arc(12,12,4,0,Math.PI*2);}
    else if(name==='check'){c.moveTo(5,12);c.lineTo(10,17);c.lineTo(20,6);}
    else if(name==='rename'){c.moveTo(5,16);c.lineTo(4,21);c.lineTo(9,20);c.lineTo(20,9);c.lineTo(16,5);c.closePath();}
    else{c.arc(12,12,7,0,Math.PI*2);c.moveTo(12,1);c.lineTo(12,4);c.moveTo(12,20);c.lineTo(12,23);c.moveTo(1,12);c.lineTo(4,12);c.moveTo(20,12);c.lineTo(23,12);}
    c.stroke();c.restore();
  }

  button(label,x,y,w,h,method,dataset,options){
    const o=options||{},enabled=!o.disabled,color=o.primary?'#fffdf1':o.danger?'#a14c42':C.ink;
    this.ctx.save();if(!enabled)this.ctx.globalAlpha=.45;
    if(!o.quiet)this.rect(x,y,w,h,o.primary?C.green:o.active?'#d5e8d9':'#eaf2ec',4);
    if(o.icon){const iconSize=o.iconOnly?22:19;this.icon(o.icon,x+(o.iconOnly?(w-iconSize)/2:12),y+(h-iconSize)/2,iconSize,color);}
    if(!o.iconOnly)this.text(label,x+(o.icon?37:8),y+(h-20)/2,o.font||14,color,w-(o.icon?45:16),{bold:!o.quiet,center:!o.icon,maxLines:1});
    this.ctx.restore();
    const hit={id:method+':'+JSON.stringify(dataset||{}),label,x,y,w,h,method,dataset:dataset||{},disabled:!enabled};
    if(this.clipRect&&(y+h<=this.clipRect.y||y>=this.clipRect.y+this.clipRect.h))return;
    if(this.clipRect){const top=Math.max(y,this.clipRect.y);hit.y=top;hit.h=Math.max(0,Math.min(y+h,this.clipRect.y+this.clipRect.h)-top);}
    this.hits.push(hit);
  }

  panel(){this.rect(0,this.dockTop,this.w,this.h-this.dockTop,C.paper);}
  line(y){this.rect(20,y,this.w-40,1,C.line);}
  bar(x,y,w,value,color){this.rect(x,y,w,5,'#dfe9e1');this.rect(x,y,w*clamp(value,0,100)/100,5,color||'#83b88a');}

  sceneInk(d){return d.pondTheme==='firefly'?'#eef6f1':C.ink;}
  sceneMuted(d){return d.pondTheme==='firefly'?'#b5cfc7':C.muted;}

  header(d){
    const back=['route','nurture','status','settings','album'].includes(d.phase),s=this.safeTop,ink=this.sceneInk(d),muted=this.sceneMuted(d);
    if(back)this.button('返回首页',12,s+5,38,38,'goHome',null,{icon:'back',iconOnly:true,quiet:true});
    this.text('荷塘来信',back?59:20,s+9,15,ink,this.w-150,{bold:true,maxLines:1});
    this.text(d.chapter,back?59:20,s+31,11,muted,this.w-150,{maxLines:1});
    if(ACTIVE.includes(d.phase))this.button('暂停冒险',this.w-58,s+56,40,40,'pauseAdventure',null,{icon:'pause',iconOnly:true});
  }

  quoteBubble(d){
    if(!d.petQuote)return;
    const text='「'+d.petQuote+'」',y=this.dockTop-40,x=22,w=this.w-44;
    this.rect(x,y,w,30,'rgba(248,252,249,.9)',15);
    this.text(text,x+12,y+7,12,C.ink,w-24,{center:true,maxLines:1});
    this.hits.push({id:'speakQuote:{}',label:text,x,y,w,h:30,method:'speakQuote',dataset:{},disabled:false});
  }

  caption(d){
    const y=this.safeTop+77,ink=this.sceneInk(d),muted=this.sceneMuted(d);
    if(d.phase==='home'){
      this.text('初夏 · 第一封信',20,y,12,muted);this.text('荷塘来信',20,y+27,34,ink,this.w-40,{bold:true});
      this.text(d.hasCompanion?d.savedPetName+'在池塘等你':'小小的相遇，慢慢长大',20,y+78,13,muted);
      this.quoteBubble(d);
    }else if(d.phase==='route'){
      this.text('未来的模样',20,y-8,12,muted);this.text(d.selectedRouteName||'它会成为谁？',20,y+14,24,ink,this.w-40,{bold:true});
      this.text(d.selectedPerkName?d.selectedPerkName+' · '+d.selectedPerkText:'',20,y+49,12,muted,this.w-40,{maxLines:1});
      this.text(d.skillName?d.skillName+' · '+d.skillText:'',20,y+68,12,muted,this.w-40,{maxLines:1});
    }else if(d.phase==='nurture'){
      this.text(d.selectedRouteName+' · '+d.stageName,20,y-5,11,muted,this.w-40,{maxLines:1});
      this.text(d.petName,20,y+19,23,ink,this.w-80,{bold:true,maxLines:1});
      this.button('改名字',this.w-57,y+13,36,36,'renameCompanion',null,{icon:'rename',iconOnly:true,quiet:true});
      this.text(d.petHabit,20,y+51,12,muted,this.w-40,{maxLines:1});
      if(!d.bubblePlaying)this.quoteBubble(d);
    }
  }

  scrollBegin(x,y,w,h,total){
    this.scroll=clamp(this.scroll,0,Math.max(0,total-h));this.scrollArea={x,y,w,h,total};this.clipRect={x,y,w,h};
    this.ctx.save();this.ctx.beginPath();this.ctx.rect(x,y,w,h);this.ctx.clip();return y-this.scroll;
  }
  scrollEnd(){this.ctx.restore();this.clipRect=null;}

  home(d){
    const x=20,w=this.w-40,y=this.dockTop+8;
    this.button(d.hasAdventure?'继续冒险':'游戏开始',x,y,w,52,'startGame',null,{primary:true,disabled:!d.threeReady});
    const col=(w-16)/3;
    this.button('角色状态',x,y+61,col,42,'openStatus');this.button('纪念册',x+col+8,y+61,col,42,'openAlbum');this.button('设置',x+(col+8)*2,y+61,col,42,'openSettings');
    this.text(d.hasAdventure?d.adventureLabel:'已相遇 '+d.metCount+' / '+d.routeTotal,20,y+116,11,C.muted,w,{center:true,maxLines:1});
  }

  route(d){
    this.panel();const x=20,w=this.w-40,y=this.dockTop+16;
    this.text('成长路线',x,y,19,C.ink,w,{bold:true});
    this.text(d.routeList.length+' 条路线',this.w-109,y+4,12,C.muted,89,{center:true});
    const top=y+34,bottom=this.h-this.safeBottom-72,cols=this.w<350?2:3,gap=7,cw=(w-gap*(cols-1))/cols,rowH=64;
    const origin=this.scrollBegin(x,top,w,bottom-top,Math.ceil(d.routeList.length/cols)*rowH);
    d.routeList.forEach((route,i)=>{
      const rx=x+(i%cols)*(cw+gap),ry=origin+Math.floor(i/cols)*rowH;
      this.button(route.name,rx,ry,cw,56,'selectRoute',{id:route.id},{active:route.id===d.selectedRouteId,font:13});
      this.text(route.perkName+(route.met?' · 已相遇':''),rx+5,ry+37,10,C.muted,cw-10,{center:true,maxLines:1});
    });this.scrollEnd();
    this.button('返回',x,bottom+12,42,44,'goHome',null,{icon:'back',iconOnly:true});
    this.button('取个名字，开始陪伴',x+52,bottom+12,w-52,44,'confirmRoute',null,{primary:true,disabled:!d.selectedRouteId||!d.threeReady});
  }

  needs(values,y){
    const labels=['饱食','亲密','活力'],colors=[C.green,C.pink,C.blue],w=(this.w-40)/3;
    values.forEach((value,i)=>{const x=20+i*w;this.text(labels[i],x,y,12,C.muted,w,{center:true});this.text(value,x,y+19,20,colors[i],w,{center:true,bold:true});});
  }

  nurture(d){
    this.panel();const x=20,w=this.w-40,y=this.dockTop+15;
    if(d.bubblePlaying){this.text(d.actionLabel||'追泡泡',x,y,19,C.ink,w-102,{bold:true,maxLines:1});this.text(d.bubbleSeconds+' 秒 · '+d.bubbleScore+' / 5 · 金色双倍',x,y+30,13,C.blue,w-102,{maxLines:1});this.button('结束陪玩',this.w-112,y+13,92,38,'finishBubbleGame');return;}
    this.text('今日的陪伴',x,y,18,C.ink,w,{bold:true});this.text(d.growthPercent+'%',this.w-72,y+3,12,C.muted,52,{center:true});
    this.bar(x,y+30,w,d.growthPercent);this.text(d.needHint,x,y+42,12,d.needKey?'#a05e38':C.muted,w,{center:true,maxLines:1});
    this.needs([d.food,d.affection,d.play],y+65);
    const cw=(w-16)/3;
    [['喂食','feed'],['抚摸','pet'],['追泡泡','play']].forEach((item,i)=>this.button(i===0&&d.snacks?'莲子 ×'+d.snacks:item[0],x+i*(cw+8),y+112,cw,42,'careAction',{type:item[1]},{disabled:d.careBusy}));
    let next=y+164;if(d.souvenirs.length){this.text(d.souvenirs.join(' · '),x,next,11,C.gold,w,{center:true,maxLines:1});next+=24;}
    if(d.canChallenge)this.button(d.hasAdventure?'继续冒险':'出发，荷叶小径',x,next,w,44,'startJumpChallenge',null,{primary:true,disabled:d.careBusy});
    else this.text(d.stageName,x,next+12,12,C.muted,w,{center:true,maxLines:1});
    this.button('回到首页',x,next+49,w,32,'goHome',null,{quiet:true});
    if(d.storageNotice)this.notice(d.storageNotice);
  }

  status(d){
    this.panel();const x=20,w=this.w-40,y=this.dockTop+18;
    this.text(d.hasCompanion?d.savedPetName:'还没有伙伴',x,y,22,C.ink,w,{bold:true});
    if(!d.hasCompanion){this.text('池塘里，有一只小蝌蚪正等着你。',x,y+40,14,C.muted,w);this.button('去遇见它',x,y+83,w,46,'startGame',null,{primary:true,disabled:!d.threeReady});return;}
    this.text(d.savedPetRoute+' · '+d.savedPetStage,x,y+35,12,C.muted,w,{maxLines:1});
    this.text('成长 '+d.statusGrowth+'%',x,y+63,12,C.muted);this.bar(x,y+85,w,d.statusGrowth);this.needs([d.statusFood,d.statusAffection,d.statusPlay],y+103);
    this.text('冒险 '+d.statusAdventures+' 次 · 莲子 '+d.statusSnacks+' 颗',x,y+153,13,C.muted,w,{center:true});
    this.text(d.statusPerk+' · '+d.statusSkill,x,y+178,12,C.gold,w,{center:true});
    this.button('继续陪伴',x,y+207,w,44,'resumeCompanion',null,{primary:true,disabled:!d.threeReady});
    this.button('结识新的伙伴',x,y+259,w,34,'openNewCompanion',null,{quiet:true});
  }

  settings(d){
    this.panel();const x=20,w=this.w-40,y=this.dockTop+16;
    this.text('设置',x,y,22,C.ink,w,{bold:true});
    [['游戏音效','soundEnabled'],['震动反馈','hapticEnabled']].forEach((item,i)=>{
      const ry=y+42+i*50;this.text(item[0],x,ry+7,15);
      const sx=this.w-76;this.rect(sx,ry+3,56,30,d[item[1]]?C.green:'#b1c2b7',15);this.rect(sx+(d[item[1]]?29:3),ry+6,24,24,'#fff',12);
      this.hits.push({id:'toggleSetting:'+item[1],label:item[0],x:sx-5,y:ry,w:66,h:38,method:'toggleSetting',dataset:{key:item[1]}});this.line(ry+42);
    });
    this.text('画面品质',x,y+146,13,C.muted);const cw=(w-12)/3;
    [['自动','auto'],['高清','high'],['流畅','smooth']].forEach((item,i)=>this.button(item[0],x+i*(cw+6),y+169,cw,36,'chooseQuality',{mode:item[1]},{active:d.qualityMode===item[1],font:13}));
    this.text('荷塘氛围',x,y+218,13,C.muted);this.text('莲子 ×'+(d.snacks||0),this.w-120,y+218,12,C.gold,100,{center:false,maxLines:1});
    const themes=d.pondThemeList||[],tw=(w-8)/2;
    themes.forEach((theme,i)=>{
      const tx=x+(i%2)*(tw+8),ty=y+242+Math.floor(i/2)*44;
      const label=theme.unlocked?theme.name:theme.name+' · '+theme.cost+'莲';
      this.button(label,tx,ty,tw,38,'choosePondTheme',{id:theme.id},{active:d.pondTheme===theme.id,font:12});
    });
    this.button('完成',x,y+334,w,42,'goHome',null,{primary:true});if(d.storageNotice)this.notice(d.storageNotice);
  }

  challenge(d){
    const s=this.safeTop,jump=d.phase==='levelJump',count=jump?d.jumps:d.bugs,ink=this.sceneInk(d),muted=this.sceneMuted(d);
    this.text(count,20,s+66,32,ink,64,{bold:true});this.text('/ '+(jump?d.jumpGoal:d.bugGoal),75,s+82,15,muted,60);
    this.button('回池塘',this.w-114,s+105,94,34,'returnToPond',null,{quiet:true});
    const combo=jump?d.jumpCombo:d.bugCombo;
    if(combo>1){
      const hot=combo>=3;
      this.rect(20,s+112,hot?104:86,23,hot?'rgba(255,232,140,.92)':'rgba(250,232,238,.92)',11);
      this.text((hot?'✦ 连击 ×':'连击 ×')+combo,28,s+116,12,hot?C.gold:C.pink,90,{bold:true,maxLines:1});
    }
    if(d.bonusSeeds)this.text('额外莲子 +'+d.bonusSeeds,20,s+140,12,d.pondTheme==='firefly'?'#ffe28a':C.gold,160,{maxLines:1});
    if(jump){
      const dotY=s+119;for(let i=0;i<d.attemptSlots.length;i++){this.ctx.beginPath();this.ctx.arc(this.w-111+i*16,dotY,4,0,Math.PI*2);this.ctx.fillStyle=i<d.attempts?'#5eaa7a':'#c3d3c7';this.ctx.fill();}
      this.text(d.districtNumber+' / 4 · '+d.districtName,20,s+162,11,muted,220,{maxLines:1});
      if(!d.gameOver){
        const y=this.h-this.safeBottom-49;
        this.text(d.chargeHint,22,y-24,12,ink);this.text(d.chargePercent+'%',this.w-68,y-24,12,ink,46,{center:true});
        this.rect(22,y,this.w-44,13,'rgba(35,79,70,.5)',3);
        this.rect(23,y+1,(this.w-46)*d.chargePercent/100,11,({perfect:'#7df0a2',good:'#c9ea8a',close:'#ffd274',far:'#ff9b8a'})[d.chargeTone],2);
        this.rect(22+(this.w-44)*d.targetCharge/100,y-4,2,21,'#fffbe5');
        this.button(d.skillName+' · '+d.skillStatus,this.w-190,y-91,168,43,'activateSkill',null,{active:d.skillArmed,disabled:!d.skillReady});
      }
    }
    if(!d.gameOver){
      this.text(d.bugHint||d.message,20,jump?this.h-this.safeBottom-161:this.dockTop-43,13,ink,this.w-40,{center:true,maxLines:2});
      if(!jump){
        this.panel();this.text(d.bugGuideTitle,20,this.dockTop+13,14,C.ink,this.w-40,{bold:true});
        let y=this.dockTop+40;d.bugGuideSteps.forEach(line=>{y+=this.text(line,20,y,12,C.muted,this.w-40,{lineHeight:18})+6;});
      }
    }
  }

  returns(d){
    const x=20,w=this.w-40,s=this.safeTop;
    if(d.phase==='returnChoice'||d.phase==='returnTravel'){
      this.text(d.petName+' · '+d.bugs+' 只昆虫 · 满载而归',x,s+113,12,C.muted,w,{maxLines:1});
      this.text(d.returnTitle,x,s+138,22,C.ink,w,{bold:true,maxLines:2});
    }
    if(d.phase==='returnChoice'){
      this.panel();const y=this.dockTop+12;
      [['划船回家','boat','小舟、荷风与莲子'],['坐飞机回家','plane','飞越荷塘，穿过金环'],['弹弓突袭','sling','害虫堡垒挡住了归途']].forEach((item,i)=>{
        this.button(item[0],x,y+i*68,w,58,'chooseReturn',{mode:item[1]},{icon:item[1],quiet:true});
        this.text(item[2],x+37,y+i*68+43,11,C.muted,w-50,{maxLines:1});this.line(y+i*68+65);
      });this.button('快速回家',x,y+214,w,39,'quickReturn',null,{primary:true});
    }else if(d.phase==='returnTravel'){
      const y=this.h-this.safeBottom-(d.returnMode==='boat'?234:180);this.bar(x,y,w,d.returnProgress,'#d4bd6b');
      this.text('归途 '+d.returnProgress+'% · '+(d.travelFeedback||'已收集 '+d.travelCollected+' / 3'),x,y+16,13,C.ink,w,{center:true,maxLines:1});
      const bw=53,gap=12,start=(this.w-3*bw-2*gap)/2;
      [-1,0,1].forEach((lane,i)=>this.button(['向左','回到中间','向右'][i],start+i*(bw+gap),y+48,bw,42,'steerReturn',{lane},{icon:['back','target','forward'][i],iconOnly:true,active:lane===d.returnLane}));
      let by=y+102;if(d.returnMode==='boat'){this.button('划一桨',this.w/2-48,by,96,43,'paddleReturn',null,{icon:'boat'});by+=54;}
      this.button('换一种归途',x,by,(w-10)/2,41,'changeReturnMode');this.button('快速回家',x+(w+10)/2,by,(w-10)/2,41,'quickReturn');
    }else if(d.phase==='sling'){
      this.text(d.fortressName,x,s+113,13,C.muted,w,{maxLines:1});this.text(d.fortressDamage?'破坏 '+d.fortressDamage+'%':'弹弓突袭',x,s+138,22,C.ink,w,{bold:true});
      if(d.slingReady){const bw=(w-10)/3;['木石门楼','双层风塔','护城矮堡'].forEach((name,i)=>this.button(name,x+i*(bw+5),s+175,bw,36,'chooseFortress',{layout:i},{active:d.fortressLayout===i,font:12}));}
      const y=this.h-this.safeBottom-123;this.text(d.slingReady?'蓄力 '+d.slingPower+'%':'飞向堡垒',x,y,13);this.bar(x,y+25,w,d.slingPower,'#b5d681');
      if(d.slingReady)this.button('弹射',x,y+44,(w-10)/2,44,'fireSling',null,{primary:true,icon:'sling'});
      this.button('快速回家',d.slingReady?x+(w+10)/2:x,y+44,d.slingReady?(w-10)/2:w,44,'quickReturn');
    }else if(d.phase==='returnResult'){
      this.text(d.returnTitle,x,s+116,23,C.ink,w,{center:true,bold:true});
      if(d.returnResultReady){const y=this.h-this.safeBottom-128;this.rect(0,y-14,this.w,this.h-y+14,C.paper);
        this.button(d.returnOutcome==='win'?'带着战利品回家':'收好莲子回家',x,y,w,44,'finishReturn',null,{primary:true});
        this.button('再弹一次',x,y+55,(w-10)/2,39,'retrySling');this.button('换一种归途',x+(w+10)/2,y+55,(w-10)/2,39,'changeReturnMode');}
    }
  }

  final(d){
    this.panel();const x=20,w=this.w-40,y=this.dockTop+17;
    this.text(d.petName+'的来信',x,y,21,C.ink,w,{bold:true});
    let line=y+36;d.letterLines.forEach(value=>{line+=this.text(value,x,line,13,C.ink,w,{lineHeight:20,maxLines:2});});
    const stats=Math.max(y+116,line+8),cw=w/3;
    [d.grade,d.perfect+'/'+d.jumpGoal,d.runTimeText].forEach((value,i)=>{this.text(value,x+i*cw,stats,25,i===0?C.gold:C.green,cw,{center:true,bold:true});this.text(['评级','完美落叶','用时'][i],x+i*cw,stats+34,11,C.muted,cw,{center:true});});
    this.text(d.rewardText,x,stats+60,12,C.gold,w,{center:true,maxLines:2});
    this.button('一起回家',x,this.h-this.safeBottom-62,w,44,'returnToPond',null,{primary:true});
  }

  image(path,x,y,w,h,stamp){
    if(this.clipRect&&(y+h<this.clipRect.y||y>this.clipRect.y+this.clipRect.h))return;
    let entry=this.images.get(path);
    if(path&&!entry){
      const image=this.api.createImage();entry={image,loaded:false};this.images.set(path,entry);
      image.onload=()=>{if(this.disposed)return;entry.loaded=true;this.dirty=true;if(this.game.requestUiFrame)this.game.requestUiFrame();};image.onerror=()=>{};image.src=path;
      if(this.images.size>Math.max(8,Math.ceil(this.h/90)+2)){const key=this.images.keys().next().value;this.images.delete(key);}
    }
    if(entry&&entry.loaded)this.ctx.drawImage(entry.image,x,y,w,h);
    else{this.rect(x,y,w,h,'#e0ebe1',4);this.text(stamp||'回忆',x,y+h/2-10,15,C.muted,w,{center:true,maxLines:1});}
  }

  album(d){
    const x=20,w=this.w-40,top=this.safeTop+68,height=this.h-this.safeBottom-top;
    this.rect(0,top-8,this.w,this.h-top+8,'#f5faf5');
    if(d.selectedMemory){
      const m=d.selectedMemory,total=w+230+m.letter.length*27;
      let y=this.scrollBegin(x,top,w,height,total);this.button('纪念册',x,y,w,36,'closeMemory',null,{icon:'back',quiet:true});y+=49;
      this.image(m.photo,x,y,w,w,m.stamp);y+=w+20;this.text(m.title,x,y,22,C.ink,w,{bold:true});y+=37;
      y+=this.text(m.name+' · '+m.routeName+' · '+m.date,x,y,11,C.muted,w,{maxLines:2})+20;
      y+=this.text(m.note,x,y,14,C.muted,w,{maxLines:3})+14;
      m.letter.forEach(value=>{y+=this.text(value,x,y,14,C.ink,w,{lineHeight:24})+5;});this.scrollEnd();
    }else{
      this.text('成长纪念册',x,top,23,C.ink,w,{bold:true});this.text(d.albumCount+' 段回忆',x,top+36,12,C.muted,w);
      if(!d.albumCount){this.text('第一段回忆，等着与你相遇。',x,top+111,14,C.muted,w,{center:true});return;}
      const y=this.scrollBegin(x,top+70,w,height-70,d.albumEntries.length*102);
      d.albumEntries.forEach((m,i)=>{
        const row=y+i*102;this.image(m.photo,x,row+10,74,74,m.stamp);
        this.button(m.title,x+87,row+6,w-87,39,'openMemory',{id:m.id},{quiet:true,font:14});
        this.text(m.name+' · '+m.routeName,x+87,row+48,11,C.muted,w-87,{maxLines:1});this.text(m.date,x+87,row+68,11,C.muted,w-87,{maxLines:1});this.line(row+99);
      });this.scrollEnd();
    }
  }

  modal(title,copy,buttons){
    this.hits=[];this.scrollArea=null;
    this.rect(0,0,this.w,this.h,'rgba(21,53,43,.40)');
    const w=Math.min(340,this.w-40),x=(this.w-w)/2,h=128+buttons.length*48,y=Math.max(this.safeTop+74,(this.h-h)/2-30);
    this.rect(x,y,w,h,'#f8fcf7',8);this.text(title,x+20,y+22,23,C.ink,w-40,{center:true,bold:true});
    this.text(copy,x+20,y+62,13,C.muted,w-40,{center:true,maxLines:2});
    buttons.forEach((button,i)=>this.button(button.label,x+20,y+106+i*48,w-40,40,button.method,null,{primary:i===0,quiet:i!==0,danger:button.danger}));
  }

  nameEditor(d){
    this.hits=[];this.scrollArea=null;
    this.rect(0,0,this.w,this.h,'rgba(21,53,43,.40)');const w=Math.min(340,this.w-40),x=(this.w-w)/2,y=Math.max(this.safeTop+65,this.h*.22);
    this.rect(x,y,w,228,'#f8fcf7',8);this.text('给伙伴取个名字',x+20,y+21,21,C.ink,w-40,{bold:true});
    this.button(d.nameDraft||'小荷',x+20,y+66,w-40,45,'editNativeName',null,{active:true});
    this.button('就叫这个',x+20,y+131,w-40,41,'confirmNativeName',null,{primary:true});this.button('取消',x+20,y+178,w-40,33,'cancelNativeName',null,{quiet:true});
  }

  notice(message){this.rect(12,this.h-this.safeBottom-34,this.w-24,29,'#fff3e9',4);this.text(message,20,this.h-this.safeBottom-27,11,'#a34e3d',this.w-40,{center:true,maxLines:1});}

  draw(force){
    if(this.disposed)return;
    const now=Date.now();if(!force&&(!this.dirty||now-this.lastDraw<33))return;
    this.measure(this.game.data);this.hits=[];this.scrollArea=null;this.ctx.setTransform(this.ratio,0,0,this.ratio,0,0);this.ctx.clearRect(0,0,this.w,this.h);
    const d=this.game.data;this.header(d);this.caption(d);
    if(d.phase==='home')this.home(d);else if(d.phase==='route')this.route(d);
    else if(d.phase==='nurture')this.nurture(d);else if(d.phase==='status')this.status(d);else if(d.phase==='settings')this.settings(d);
    else if(d.phase==='levelJump'||d.phase==='levelBug')this.challenge(d);else if(d.phase.startsWith('return')||d.phase==='sling')this.returns(d);
    else if(d.phase==='final')this.final(d);else if(d.phase==='album')this.album(d);
    if(d.actionLabel&&!d.bubblePlaying)this.text(d.actionLabel,20,this.safeTop+189,16,C.pink,this.w-40,{center:true,maxLines:1});
    if(!d.threeReady){this.text(d.initError?'池塘加载失败':'池塘正在苏醒',20,this.h*.43,16,C.ink,this.w-40,{center:true});if(d.initError)this.button('重新加载',20,this.h*.5,this.w-40,44,'restartNativeGame',null,{primary:true});}
    if(d.transition)this.text('下一段旅程，即将开始',20,this.h*.43,22,C.ink,this.w-40,{center:true});
    if(d.gameOver)this.modal('重新出发',d.message,[{label:'从最近进度继续',method:'retryLevel'},{label:'回到池塘',method:'returnToPond'}]);
    if(d.sessionPaused)this.modal('稍等片刻',d.adventureLabel,[{label:'继续',method:'continueAdventure'},{label:'保存并回到首页',method:'saveAndGoHome'},{label:'重新开始冒险',method:'restartAdventure',danger:true}]);
    if(d.nameEditor)this.nameEditor(d);
    this.texture.needsUpdate=true;this.dirty=false;this.lastDraw=now;
  }

  render(force){
    this.draw(force);const r=this.game.renderer,clear=r.autoClear;r.autoClear=false;r.clearDepth();r.render(this.scene,this.camera);r.autoClear=clear;
  }

  pointHit(point){return this.hits.slice().reverse().find(hit=>point.x>=hit.x&&point.x<=hit.x+hit.w&&point.y>=hit.y&&point.y<=hit.y+hit.h);}
  contains(rect,p){return rect&&p.x>=rect.x&&p.x<=rect.x+rect.w&&p.y>=rect.y&&p.y<=rect.y+rect.h;}

  touchStart(point){
    this.draw(true);const d=this.game.data,hit=this.pointHit(point),scrolling=this.contains(this.scrollArea,point);
    if(hit||scrolling||d.sessionPaused||d.nameEditor||d.gameOver||d.phase==='album'||this.dockHeight>0&&point.y>=this.dockTop&&d.phase!=='home'){
      this.gesture={x:point.x,y:point.y,lastY:point.y,hit,scrolling,moved:false};return true;
    }return false;
  }

  touchMove(point){
    const g=this.gesture;if(!g)return;
    if(Math.hypot(point.x-g.x,point.y-g.y)>9)g.moved=true;
    if(g.scrolling&&g.moved){this.scroll=clamp(this.scroll+g.lastY-point.y,0,Math.max(0,this.scrollArea.total-this.scrollArea.h));this.dirty=true;this.game.requestUiFrame();}
    g.lastY=point.y;
  }

  touchEnd(point){
    const g=this.gesture;this.gesture=null;if(!g||g.moved||!g.hit||g.hit.disabled)return;
    const end=this.pointHit(point);if(!end||end.id!==g.hit.id)return;
    const fn=this.game[g.hit.method];if(typeof fn==='function')fn.call(this.game,{currentTarget:{dataset:g.hit.dataset}});
    this.dirty=true;this.game.requestUiFrame();
  }

  dispose(){this.disposed=true;this.images.clear();this.texture.dispose();this.geometry.dispose();this.material.dispose();this.hits=[];this.gesture=null;}
}
module.exports=Hud;
