const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { MAGIC } = require('../minigame/binary-asset');
const root = path.resolve(__dirname, '..');
require('./patch-threejs-miniprogram');

// 1. 模型资源：把 JS 里的 base64 数据转成二进制文件，运行时由 minigame/models/*.js 读取。
const BASE64 = /^[A-Za-z0-9+/]{32,}={0,2}$/;
function packAsset(asset) {
  const blobs = []; let size = 0;
  const header = JSON.stringify(asset, (key, value) => {
    if (typeof value !== 'string' || !BASE64.test(value)) return value;
    const bytes = Buffer.from(value, 'base64'), offset = size;
    blobs.push(bytes); size += bytes.length;
    return { $bin: [offset, bytes.length] };
  }).replace(/[\u0080-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  const head = Buffer.from(header, 'ascii'), start = Math.ceil((8 + head.length) / 4) * 4;
  const out = Buffer.alloc(start + size);
  out.write(MAGIC, 0, 'ascii'); out.writeUInt32LE(head.length, 4); head.copy(out, 8);
  let offset = start; blobs.forEach(bytes => { bytes.copy(out, offset); offset += bytes.length; });
  return out;
}
const modelDir = path.join(root, 'assets/models');
fs.mkdirSync(modelDir, { recursive: true });
['royal-head', 'royal-fur'].forEach(name => {
  fs.writeFileSync(path.join(modelDir, name + '.bin'), packAsset(require(path.join(root, 'pages/index/models', name + '.js'))));
});

// 2. 首包：游戏主体。royal-head/royal-fur 换成二进制加载器，cannon 留给 physics 分包。
const minigameModels = {
  name: 'minigame-models',
  setup(build) {
    build.onResolve({ filter: /^\.\/models\/royal-(head|fur)$/ }, args =>
      args.importer.endsWith(path.join('pages', 'index', 'royal.js'))
        ? { path: path.join(root, 'minigame', args.path.slice(2) + '.js') } : undefined);
  }
};
async function main() {
  await esbuild.build({
    entryPoints: [path.join(root, 'minigame/main.js')],
    outfile: path.join(root, 'minigame-dist/main.js'),
    bundle: true, platform: 'browser', format: 'iife', target: ['es2017'], minify: true,
    legalComments: 'eof', charset: 'utf8',
    define: { Page: 'undefined' },
    plugins: [minigameModels],
    alias: {
      'threejs-miniprogram': path.join(root, 'miniprogram_npm/threejs-miniprogram/index.js'),
      cannon: path.join(root, 'minigame/no-cannon.js')
    }
  });

  // 3. physics 分包：Cannon.js，按需通过 wx.loadSubpackage 下载。
  fs.mkdirSync(path.join(root, 'physics'), { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(root, 'minigame/physics-entry.js')],
    outfile: path.join(root, 'physics/game.js'),
    bundle: true, platform: 'browser', format: 'iife', target: ['es2017'], minify: true,
    legalComments: 'eof', charset: 'utf8',
    alias: { cannon: path.join(root, 'miniprogram_npm/cannon/index.js') }
  });
  fs.copyFileSync(path.join(root, 'miniprogram_npm/cannon/LICENSE'), path.join(root, 'physics/LICENSE-cannon.txt'));

  const sizeOf = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, item) =>
    sum + (item.isDirectory() ? sizeOf(path.join(dir, item.name)) : fs.statSync(path.join(dir, item.name)).size), 0);
  const mainSize = fs.statSync(path.join(root, 'minigame-dist/main.js')).size + sizeOf(path.join(root, 'assets'))
    + ['game.js', 'game.json', 'project.config.json'].reduce((sum, name) => sum + fs.statSync(path.join(root, name)).size, 0);
  const physicsSize = sizeOf(path.join(root, 'physics'));
  if (mainSize > 4 * 1024 * 1024) throw Error('Mini-game main package exceeds 4 MiB');
  if (mainSize + physicsSize > 30 * 1024 * 1024) throw Error('Mini-game total package exceeds 30 MiB');
  const mib = n => (n / 1048576).toFixed(2) + ' MiB';
  console.log('Mini-game main package: ' + mib(mainSize) + ' · physics subpackage: ' + mib(physicsSize));
}
main().catch(error => { console.error(error); process.exit(1); });