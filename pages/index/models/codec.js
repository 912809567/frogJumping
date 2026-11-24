const { inflateSync } = require('./inflate');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Int16Array(128);
for(let i=0;i<lookup.length;i++)lookup[i]=-1;
for(let i=0;i<alphabet.length;i++)lookup[alphabet.charCodeAt(i)]=i;

function decode(text, compressed) {
  const out=new Uint8Array(Math.floor(text.length*3/4)-(text.endsWith('==')?2:text.endsWith('=')?1:0));
  let buffer=0,bits=0,index=0;
  for(let i=0;i<text.length;i++){
    const n=lookup[text.charCodeAt(i)];if(n<0||n===undefined)continue;
    buffer=(buffer<<6)|n;bits+=6;if(bits>=8){bits-=8;out[index++]=(buffer>>bits)&255;}
  }
  return compressed ? inflateSync(out) : out;
}

function geometry(T, asset) {
  const result=new T.BufferGeometry();
  Object.keys(asset.attributes).forEach(name=>{
    const item=asset.attributes[name],bytes=decode(item.data,true),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const width=item.type==='f32'?4:item.type==='i16'?2:1,array=new Float32Array(bytes.byteLength/width);
    for(let i=0;i<array.length;i++)array[i]=(item.type==='f32'?view.getFloat32(i*4,true):item.type==='i16'?view.getInt16(i*2,true):item.type==='i8'?view.getInt8(i):view.getUint8(i))*item.scale;
    (result.setAttribute||result.addAttribute).call(result,name,new T.BufferAttribute(array,item.size));
  });
  const bytes=decode(asset.index,true),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),indices=new Uint16Array(bytes.byteLength/2);
  for(let i=0;i<indices.length;i++)indices[i]=view.getUint16(i*2,true);
  result.setIndex(new T.BufferAttribute(indices,1));result.computeBoundingBox();result.computeBoundingSphere();return result;
}
module.exports={decode,geometry};
