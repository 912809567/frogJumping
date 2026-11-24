// 小游戏首包里 require('cannon') 被替换成本文件；物理引擎应通过 game.physicsEngine() 从分包获取。
throw Error('Cannon.js lives in the physics subpackage; use game.ensurePhysics() before building the slingshot.');
