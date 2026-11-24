// 小游戏构建时替换 pages/index/models/royal-head.js，从包内二进制文件读取（scripts/build-minigame.js 生成）。
module.exports = require('../binary-asset').load(wx, 'assets/models/royal-head.bin');
