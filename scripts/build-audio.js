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

function writeWav(file, sampleRate, samples, gain) {
  const count = samples.length, buffer = Buffer.alloc(44 + count * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) {
    buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * gain * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buffer);
}

const folder = path.join(__dirname, '../assets/audio'); fs.mkdirSync(folder, { recursive: true });
for (const [name, [duration, sample]] of Object.entries(sounds)) {
  const count = Math.ceil(duration * rate), out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / rate, fade = Math.min(1, t * 200, (duration - t) * 100);
    out[i] = sample(t) * fade;
  }
  writeWav(path.join(folder, name + '.wav'), rate, out, .55);
}

// 4 套轻量无缝循环环境音（8kHz 单声道 4 秒，每个约 64 KB），与 4 套荷塘氛围联动。
const ambRate = 8000, ambDuration = 4.0, ambCount = ambRate * ambDuration;
const TAU = Math.PI * 2;
function seededNoise(seed, length) {
  let s = seed >>> 0;
  const raw = new Float32Array(length);
  for (let i = 0; i < length; i++) { s = (s * 1664525 + 1013904223) >>> 0; raw[i] = (s / 0xffffffff) * 2 - 1; }
  return raw;
}
function smoothLoop(samples, passes) {
  const n = samples.length;
  let cur = samples;
  for (let p = 0; p < passes; p++) {
    const next = new Float32Array(n);
    for (let i = 0; i < n; i++) next[i] = cur[(i - 1 + n) % n] * .25 + cur[i] * .5 + cur[(i + 1) % n] * .25;
    cur = next;
  }
  return cur;
}
function pluck(t, at, hz, decay) {
  const dt = ((t - at) % ambDuration + ambDuration) % ambDuration;
  return Math.sin(TAU * hz * dt) * Math.exp(-dt * decay) * Math.min(1, dt * 80);
}
const rainNoise = smoothLoop(seededNoise(101, ambCount), 4);
const breezeNoise = smoothLoop(seededNoise(202, ambCount), 14);
const ambients = {
  // 碧水初夏：柔和五声水滴风铃 + 轻柔微风
  'ambient-summer': i => {
    const t = i / ambRate;
    const pad = (Math.sin(TAU * 262 * t) * .06 + Math.sin(TAU * 330 * t) * .04 + Math.sin(TAU * 392 * t) * .04) * (.65 + .35 * Math.sin(TAU * .25 * t));
    const chimes = pluck(t, .2, 524, 3.2) * .16 + pluck(t, 1.3, 660, 3.6) * .14 + pluck(t, 2.5, 784, 3.4) * .13 + pluck(t, 3.3, 588, 3.8) * .12;
    return breezeNoise[i] * .12 + pad + chimes;
  },
  // 落日金波：温暖大七和弦呼吸 + 远方轻蝉韵律
  'ambient-sunset': i => {
    const t = i / ambRate;
    const swell = .55 + .45 * Math.sin(TAU * .25 * t - Math.PI / 2);
    const chord = (Math.sin(TAU * 175 * t) * .12 + Math.sin(TAU * 220 * t) * .09 + Math.sin(TAU * 262 * t) * .08 + Math.sin(TAU * 330 * t) * .06) * swell;
    const warmNotes = pluck(t, .5, 440, 2.4) * .12 + pluck(t, 2.2, 524, 2.4) * .11;
    return breezeNoise[i] * .09 + chord + warmNotes;
  },
  // 细雨荷塘：细腻雨声底噪 + 偶尔水滴轻落荷叶
  'ambient-rain': i => {
    const t = i / ambRate;
    const rain = rainNoise[i] * (.26 + .06 * Math.sin(TAU * .5 * t));
    const drops = pluck(t, .4, 680 + 140 * Math.sin(t * 2), 18) * .14 + pluck(t, 1.7, 820, 20) * .12 + pluck(t, 2.9, 590, 16) * .13;
    return rain + drops;
  },
  // 夏夜萤火：柔和夜虫轻吟 + 梦幻星光高音点缀
  'ambient-firefly': i => {
    const t = i / ambRate;
    const cricketEnv = Math.pow(Math.max(0, Math.sin(TAU * 1.0 * t)), 3) * (.5 + .5 * Math.sin(TAU * 14 * t));
    const cricket = Math.sin(TAU * 1780 * t) * cricketEnv * .09;
    const nightPad = (Math.sin(TAU * 220 * t) * .08 + Math.sin(TAU * 262 * t) * .06 + Math.sin(TAU * 330 * t) * .05) * (.6 + .4 * Math.sin(TAU * .25 * t));
    const sparkle = pluck(t, .6, 880, 4.2) * .10 + pluck(t, 1.9, 1048, 4.6) * .09 + pluck(t, 3.1, 784, 4.0) * .10;
    return breezeNoise[i] * .06 + cricket + nightPad + sparkle;
  }
};
for (const [name, fn] of Object.entries(ambients)) {
  const out = new Float32Array(ambCount);
  for (let i = 0; i < ambCount; i++) out[i] = fn(i);
  writeWav(path.join(folder, name + '.wav'), ambRate, out, .42);
}
console.log('Built ' + Object.keys(sounds).length + ' SFX + ' + Object.keys(ambients).length + ' ambient loops');
