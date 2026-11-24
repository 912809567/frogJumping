const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
require('./patch-threejs-miniprogram');
esbuild.buildSync({
  entryPoints: [path.join(root, 'minigame/main.js')],
  outfile: path.join(root, 'minigame-dist/main.js'),
  bundle: true, platform: 'browser', format: 'iife', target: ['es2017'], minify: true,
  legalComments: 'eof', charset: 'utf8',
  define: { Page: 'undefined' },
  alias: {
    'threejs-miniprogram': path.join(root, 'miniprogram_npm/threejs-miniprogram/index.js'),
    cannon: path.join(root, 'miniprogram_npm/cannon/index.js')
  }
});
const runtime = fs.statSync(path.join(root, 'minigame-dist/main.js')).size;
const audio = fs.readdirSync(path.join(root, 'assets/audio')).reduce((sum, name) => sum + fs.statSync(path.join(root, 'assets/audio', name)).size, 0);
if (runtime + audio > 4 * 1024 * 1024) throw Error('Mini-game main package exceeds 4 MiB');
console.log('Mini-game bundle + audio: ' + ((runtime + audio) / 1048576).toFixed(2) + ' MiB');
