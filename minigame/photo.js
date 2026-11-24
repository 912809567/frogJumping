const { zlibSync } = require('fflate');
const table = new Uint32Array(256);
for (let n=0;n<256;n++) {let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
function chunk(type, data) {
  const result=new Uint8Array(data.length+12),view=new DataView(result.buffer);
  view.setUint32(0,data.length);for(let i=0;i<4;i++)result[4+i]=type.charCodeAt(i);result.set(data,8);
  let crc=0xffffffff;for(let i=4;i<data.length+8;i++)crc=table[(crc^result[i])&255]^(crc>>>8);
  view.setUint32(result.length-4,(crc^0xffffffff)>>>0);return result;
}
function png(pixels,width,height) {
  const rows=new Uint8Array(height*(width*4+1));
  for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  const header=new Uint8Array(13),view=new DataView(header.buffer);view.setUint32(0,width);view.setUint32(4,height);header[8]=8;header[9]=6;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlibSync(rows,{level:1})),chunk('IEND',new Uint8Array(0))];
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;parts.forEach(p=>{out.set(p,offset);offset+=p.length;});return out;
}
function capture(game,api,options) {
  try {
    // Read immediately after the world pass, before transparent HUD compositing or buffer presentation.
    game.renderWorld();
    if(api.__preview&&api.canvasToTempFilePath){api.canvasToTempFilePath(options);return;}
    const gl=game.renderer.getContext(),ratio=gl.drawingBufferWidth/game.width;
    const x=Math.max(0,Math.floor(options.x*ratio)),width=Math.max(1,Math.min(gl.drawingBufferWidth-x,Math.floor(options.width*ratio)));
    const height=Math.max(1,Math.min(gl.drawingBufferHeight,Math.floor(options.height*ratio)));
    const y=Math.max(0,Math.min(gl.drawingBufferHeight-height,Math.floor(gl.drawingBufferHeight-(options.y+options.height)*ratio)));
    const source=new Uint8Array(width*height*4);gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,source);
    const size=256,pixels=new Uint8Array(size*size*4);
    for(let row=0;row<size;row++)for(let col=0;col<size;col++){
      const from=((height-1-Math.min(height-1,Math.floor(row*height/size)))*width+Math.min(width-1,Math.floor(col*width/size)))*4,to=(row*size+col)*4;
      pixels[to]=source[from];pixels[to+1]=source[from+1];pixels[to+2]=source[from+2];pixels[to+3]=255;
    }
    const manager=api.getFileSystemManager(),folder=api.env.USER_DATA_PATH+'/pond-memories';
    try{manager.mkdirSync(folder,true);}catch(error){}
    const file=folder+'/m-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)+'.png';
    manager.writeFileSync(file,png(pixels,size,size).buffer);
    options.success({tempFilePath:file,persistent:true});
  }catch(error){if(options.fail)options.fail(error);}
}
module.exports={capture,png};
