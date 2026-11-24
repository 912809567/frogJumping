const fs = require('fs');
const path = require('path');
const rate = 16000;
const sounds = {
  select: [.10, t => Math.sin(2*Math.PI*740*t)*Math.exp(-t*35)],
  charge: [1.05, t => Math.sin(2*Math.PI*(170*t+170*t*t))*(.16+.42*Math.min(1,t/.9)+.05*Math.sin(t*65))],
  jump: [.16, t => Math.sin(2*Math.PI*(320*t+1500*t*t))*Math.exp(-t*16)],
  land: [.22, t => (Math.sin(2*Math.PI*(100*t-85*t*t))*.6+Math.sin(t*5249)*Math.sin(t*7253)*.25)*Math.exp(-t*17)],
  perfect: [.42, t => [660,830,990].reduce((sum,hz,i)=>sum+(t>i*.075?Math.sin(2*Math.PI*hz*(t-i*.075))*Math.exp(-(t-i*.075)*14):0),0)*.42],
  tongue: [.17, t => Math.sin(2*Math.PI*(570*t-1200*t*t))*Math.exp(-t*13)],
  swallow: [.19, t => Math.sin(2*Math.PI*(160*t-210*t*t))*Math.sin(Math.PI*t/.19)*.7]
};
const folder = path.join(__dirname,'../assets/audio');fs.mkdirSync(folder,{recursive:true});
for(const [name,[duration,sample]] of Object.entries(sounds)) {
  const count=Math.ceil(duration*rate),buffer=Buffer.alloc(44+count*2);
  buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);
  buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);
  buffer.write('data',36);buffer.writeUInt32LE(count*2,40);
  for(let i=0;i<count;i++){
    const t=i/rate,fade=Math.min(1,t*200,(duration-t)*100);
    buffer.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample(t)*fade))*.55*32767),44+i*2);
  }
  fs.writeFileSync(path.join(folder,name+'.wav'),buffer);
}
console.log('Built '+Object.keys(sounds).length+' local sound effects');
