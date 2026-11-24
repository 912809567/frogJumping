// physics 分包入口：由 scripts/build-minigame.js 打包为 physics/game.js。
const host = typeof GameGlobal !== 'undefined' ? GameGlobal : typeof globalThis !== 'undefined' ? globalThis : {};
host.CANNON = require('cannon');
