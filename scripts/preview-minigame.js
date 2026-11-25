const http=require('http');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(pathname==='/main.js'||pathname==='/physics/game.js'||/^\/assets\/audio\/[a-z]+\.wav$/.test(pathname)||/^\/assets\/models\/[a-z-]+\.bin$/.test(pathname)){
    const file=path.join(root,pathname==='/main.js'?'minigame-dist/main.js':pathname.slice(1));
    if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    const type=pathname.endsWith('.js')?'application/javascript; charset=utf-8':pathname.endsWith('.bin')?'application/octet-stream':'audio/wav';
    res.setHeader('Content-Type',type);res.end(fs.readFileSync(file));return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>荷塘来信 · 小游戏预览</title>
  <style>html,body{margin:0;height:100%;background:#d7e8e3}#app{position:relative;height:100%;max-width:480px;margin:auto}#screen{display:block;width:100%;height:100%;touch-action:none}</style><div id="app"></div><script>
  const app=document.getElementById('app'),callbacks={},keyboards={},element=document.createElement.bind(document);let screen;
  window.GameGlobal={};
  const info=()=>({windowWidth:app.clientWidth,windowHeight:app.clientHeight,pixelRatio:devicePixelRatio,statusBarHeight:24,safeArea:{top:24,bottom:app.clientHeight-20,left:0,right:app.clientWidth}});
  window.wx={__preview:true,createCanvas(){const canvas=element('canvas');if(!screen){screen=canvas;canvas.id='screen';app.append(canvas);}return canvas;},createImage:()=>new Image(),getWindowInfo:info,getSystemInfoSync:info,
    getStorageSync:key=>JSON.parse(localStorage.getItem(key)||'null'),setStorageSync:(key,value)=>localStorage.setItem(key,JSON.stringify(value)),
    createInnerAudioContext(){const audio=new Audio(),voice={stop(){audio.pause();audio.currentTime=0;},play(){audio.play().catch(()=>{});},destroy(){audio.pause();audio.removeAttribute('src');audio.load();},onError(fn){audio.onerror=fn;}};Object.defineProperty(voice,'src',{set(value){audio.src='/'+value.replace(/^\\//,'');}});Object.defineProperty(voice,'volume',{set(value){audio.volume=value;}});Object.defineProperty(voice,'playbackRate',{get(){return audio.playbackRate;},set(value){audio.playbackRate=value;}});return voice;},
    vibrateShort(){},showShareMenu(){},showModal(options){const confirm=options.showCancel===false?(alert(options.title+'\\n'+(options.content||'')),true):window.confirm(options.title+'\\n'+(options.content||''));if(options.success)options.success({confirm});},
    showKeyboard(options){const value=prompt('伙伴的名字',options.defaultValue);if(value!==null){for(const fn of keyboards.input||[])fn({value});for(const fn of Array.from(keyboards.confirm||[]))fn({value});}},hideKeyboard(){},
    showLoading(){},hideLoading(){},
    loadSubpackage(options){const script=element('script');script.src='/'+options.name+'/game.js';script.onload=()=>{if(options.success)options.success({});};script.onerror=error=>{if(options.fail)options.fail(error);};document.head.append(script);return{onProgressUpdate(){}};},
    getFileSystemManager(){return{readFileSync(file){const xhr=new XMLHttpRequest();xhr.open('GET','/'+file,false);xhr.overrideMimeType('text/plain; charset=x-user-defined');xhr.send();
      if(xhr.status!==200)throw Error('readFileSync failed: '+file);const text=xhr.responseText,bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i)&255;return bytes.buffer;}};},
    canvasToTempFilePath(options){try{const out=element('canvas');out.width=options.destWidth;out.height=options.destHeight;const ratio=screen.width/app.clientWidth;out.getContext('2d').drawImage(screen,options.x*ratio,options.y*ratio,options.width*ratio,options.height*ratio,0,0,out.width,out.height);options.success({tempFilePath:out.toDataURL('image/png')});}catch(error){if(options.fail)options.fail(error);}}
  };
  for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize','ShareAppMessage']){
    callbacks[name]=new Set();wx['on'+name]=fn=>callbacks[name].add(fn);wx['off'+name]=fn=>callbacks[name].delete(fn);
  }
  for(const name of ['Input','Confirm']){const key=name.toLowerCase();keyboards[key]=new Set();wx['onKeyboard'+name]=fn=>keyboards[key].add(fn);wx['offKeyboard'+name]=fn=>keyboards[key].delete(fn);}
  window.__nativeCallbacks=callbacks;
  const dispatch=(name,event)=>{for(const callback of callbacks[name])callback(event);};
  const script=element('script');script.src='/main.js';script.onload=()=>{
    window.game=GameGlobal.pondGame;
    const touch=(event,end)=>{const rect=screen.getBoundingClientRect(),point={clientX:event.clientX-rect.left,clientY:event.clientY-rect.top,identifier:event.pointerId};return{touches:end?[]:[point],changedTouches:[point],timeStamp:event.timeStamp};};
    screen.onpointerdown=e=>{screen.setPointerCapture(e.pointerId);dispatch('TouchStart',touch(e,false));};screen.onpointermove=e=>{if(e.buttons)dispatch('TouchMove',touch(e,false));};screen.onpointerup=e=>dispatch('TouchEnd',touch(e,true));screen.onpointercancel=e=>dispatch('TouchCancel',touch(e,true));
    document.addEventListener('visibilitychange',()=>dispatch(document.hidden?'Hide':'Show',{}));window.addEventListener('pagehide',()=>game.saveCompanion());window.addEventListener('resize',()=>dispatch('WindowResize',{}));
  };document.body.append(script);
  </script></html>`);
});
if(require.main===module){const port=Number(process.env.PORT)||8097;server.listen(port,'127.0.0.1',()=>console.log('Mini-game preview: http://127.0.0.1:'+port));}
module.exports=server;
