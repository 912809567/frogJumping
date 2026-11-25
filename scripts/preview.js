const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const server = http.createServer((req, res) => {
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(/^\/assets\/audio\/[a-z]+\.wav$/.test(pathname)){
    const file=path.join(root,pathname.slice(1));
    if(fs.existsSync(file)){res.setHeader('Content-Type','audio/wav');res.end(fs.readFileSync(file));return;}
    res.statusCode=404;res.end();return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const payload = JSON.stringify({ adapter: read('miniprogram_npm/threejs-miniprogram/index.js'),
    game: read('pages/index/index.js'), art: read('pages/index/art.js'), wildlife: read('pages/index/wildlife.js'),
    royal: read('pages/index/royal.js'), royalHead: read('pages/index/models/royal-head.js'),
    royalFur:read('pages/index/models/royal-fur.js'),codec:read('pages/index/models/codec.js'),
    inflate:read('pages/index/models/inflate.js'),outfits:read('pages/index/outfits.js'),shell:read('pages/index/shell.js'),
    returns: read('pages/index/returns.js'), cannon: read('node_modules/cannon/build/cannon.js'),
    motion: read('pages/index/experience.js'), adventure:read('pages/index/adventure.js'),
    config: read('pages/index/config.js'), nurture: read('pages/index/nurture.js'),
    jumpLevel: read('pages/index/jump-level.js'), bugLevel: read('pages/index/bug-level.js'),
    template: read('pages/index/index.wxml'), css: read('pages/index/index.wxss') }).replace(/</g, '\\u003c');
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荷塘来信 · 本地预览</title><style>body{margin:0;background:#d7e8e3}#app{position:relative;height:100vh;max-width:480px;margin:0 auto}view,text,scroll-view,cover-view{display:block}scroll-view{overflow:auto}button{font-family:inherit;cursor:pointer}canvas{touch-action:none}text text{display:inline}[bindtap]{cursor:pointer}</style><div id="app"></div><script>
  const source=${payload};
  document.documentElement.style.setProperty('--rpx', Math.min(document.getElementById('app').clientWidth,750)/750+'px');
  const style=document.createElement('style');style.textContent=source.css.replace(/([0-9.]+)rpx/g,(_,n)=>'calc(var(--rpx) * '+n+')');document.head.append(style);
  const moduleFactory=(code,req)=>{const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,req);return module.exports};
  const adapter=moduleFactory(source.adapter,()=>{});
  const royalHead=moduleFactory(source.royalHead,()=>{});
  const royalFur=moduleFactory(source.royalFur,()=>{});
  const inflate=moduleFactory(source.inflate,()=>{});
  const codec=moduleFactory(source.codec,()=>inflate);
  const outfits=moduleFactory(source.outfits,()=>{});
  const royal=moduleFactory(source.royal,name=>name==='./models/royal-head'?royalHead:name==='./models/royal-fur'?royalFur:name==='./models/codec'?codec:outfits);
  const wildlife=moduleFactory(source.wildlife,()=>royal);
  const art=moduleFactory(source.art,()=>wildlife);
  const cannon=moduleFactory(source.cannon,()=>{});
  const returns=moduleFactory(source.returns,()=>cannon);
  const motion=moduleFactory(source.motion,()=>{});
  const shell=moduleFactory(source.shell,()=>{});
  const adventure=moduleFactory(source.adventure,()=>{});
  const config=moduleFactory(source.config,()=>{});
  const nurture=moduleFactory(source.nurture,()=>config);
  const jumpLevel=moduleFactory(source.jumpLevel,()=>config);
  const bugLevel=moduleFactory(source.bugLevel,()=>config);
  let page,canvas;
  const app=document.getElementById('app');
  const template=document.createElement('template');template.innerHTML=source.template;
  const expr=(s,scope)=>new Function('s','with(s){return ('+s+')}')(scope);
  const value=(s,scope)=>s.replace(/{{([\\s\\S]*?)}}/g,(_,e)=>expr(e,scope)??'');
  function draw(){
    const nodes=[];
    function children(parent,scope,target){let branch=false;for(const node of parent.childNodes){
      if(node.nodeType===3){target.append(document.createTextNode(value(node.textContent,scope)));continue;}
      if(node.nodeType!==1)continue;
      let show=true;
      if(node.hasAttribute('wx:if')){show=!!expr(node.getAttribute('wx:if').slice(2,-2),scope);branch=show;}
      else if(node.hasAttribute('wx:elif')){show=!branch&&!!expr(node.getAttribute('wx:elif').slice(2,-2),scope);branch=branch||show;}
      else if(node.hasAttribute('wx:else')){show=!branch;branch=true;}
      if(!show)continue;
      const list=node.getAttribute('wx:for');
      if(list){const items=expr(list.slice(2,-2),scope);items.forEach((item,index)=>{const clone=node.cloneNode(true);clone.removeAttribute('wx:for');const holder=document.createElement('div');holder.append(clone);children(holder,Object.assign({},scope,{item,index}),target);});continue;}
      let el;
      if(node.tagName==='CANVAS'&&canvas){continue;}else{el=document.createElement(node.tagName==='COVER-IMAGE'?'img':node.tagName.toLowerCase());}
      for(const attr of node.attributes){if(attr.name.startsWith('wx:'))continue;
        if(attr.name.startsWith('bind')){if(attr.name==='bindtap'){el.setAttribute('role','button');el.setAttribute('tabindex','0');el.onclick=()=>page[attr.value]({currentTarget:{dataset:el.dataset}});el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}};}continue;}
        const v=value(attr.value,scope);if(attr.name==='disabled'){el.disabled=v==='true';continue;}el.setAttribute(attr.name,v);
      }
      if(node.tagName!=='CANVAS')children(node,scope,el);
      target.append(el);
    }}
    const fragment=document.createDocumentFragment();children(template.content,page.data,fragment);
    if(canvas&&app.firstElementChild){const root=app.firstElementChild;root.className=fragment.firstElementChild.className;for(const child of Array.from(root.childNodes)){if(child!==canvas)child.remove();}root.append(...fragment.firstElementChild.childNodes);}else{app.replaceChildren(fragment);}
  }
  window.Page=p=>{let pending=false;page=p;window.game=p;p.data=Object.assign({},p.data);p.setData=patch=>{Object.assign(p.data,patch);if(canvas&&!pending){pending=true;requestAnimationFrame(()=>{pending=false;draw();});}};draw();canvas=document.querySelector('canvas');
    canvas.requestAnimationFrame=requestAnimationFrame.bind(window);canvas.cancelAnimationFrame=cancelAnimationFrame.bind(window);canvas.createImage=()=>new Image();
    function touch(e,end){const r=canvas.getBoundingClientRect();const t={x:e.clientX-r.left,y:e.clientY-r.top,identifier:1};return{touches:end?[]:[t],changedTouches:[t],timeStamp:e.timeStamp};}
    canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);p.onTouchStart(touch(e,false));};canvas.onpointermove=e=>{if(e.buttons)p.onTouchMove(touch(e,false));};canvas.onpointerup=e=>p.onTouchEnd(touch(e,true));canvas.onpointercancel=()=>p.onTouchCancel();p.onReady();
    document.addEventListener('visibilitychange',()=>document.hidden?p.onHide():p.onShow());window.addEventListener('pagehide',()=>p.saveCompanion());};
  window.wx={__preview:true,getStorageSync:key=>JSON.parse(localStorage.getItem(key)||'null'),setStorageSync:(key,value)=>localStorage.setItem(key,JSON.stringify(value)),
    canvasToTempFilePath(options){try{const out=document.createElement('canvas');out.width=options.destWidth;out.height=options.destHeight;const ratio=canvas.width/app.clientWidth;out.getContext('2d').drawImage(canvas,options.x*ratio,options.y*ratio,options.width*ratio,options.height*ratio,0,0,out.width,out.height);options.success({tempFilePath:out.toDataURL('image/png')});}catch(error){if(options.fail)options.fail(error);}},
    createInnerAudioContext(){const a=new Audio();const voice={stop(){a.pause();a.currentTime=0;},play(){a.play().catch(()=>{});},destroy(){a.pause();a.removeAttribute('src');a.load();},onError(fn){a.onerror=fn;}};Object.defineProperty(voice,'src',{set(v){a.src=v;}});Object.defineProperty(voice,'volume',{set(v){a.volume=v;}});return voice;},
    showModal(options){const result=options.editable?window.prompt(options.title,options.content||''):window.confirm(options.title+'\\n'+(options.content||''));options.success({confirm:options.editable?result!==null:result===true,content:typeof result==='string'?result:''});},
    getWindowInfo:()=>({windowWidth:app.clientWidth,windowHeight:app.clientHeight,pixelRatio:devicePixelRatio}),createSelectorQuery(){const q={in(){return q},select(){return q},node(){return q},exec(cb){cb([{node:canvas}]);}};return q;}};
  moduleFactory(source.game,name=>name==='threejs-miniprogram'?adapter:name==='./art'?art:name==='./returns'?returns:name==='./shell'?shell:name==='./adventure'?adventure:name==='./config'?config:name==='./nurture'?nurture:name==='./jump-level'?jumpLevel:name==='./bug-level'?bugLevel:motion);
  </script></html>`);
});
if (require.main === module) {
  const port = Number(process.env.PORT) || 8093;
  server.listen(port, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + port));
}
module.exports = server;
