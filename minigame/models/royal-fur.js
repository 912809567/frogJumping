// 小游戏构建时替换 pages/index/models/royal-fur.js，从包内二进制文件读取（scripts/build-minigame.js 生成）。
module.exports = require('../binary-asset').load(wx, 'assets/models/royal-fur.bin');
