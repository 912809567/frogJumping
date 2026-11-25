/**
 * 玩法逻辑回归（无需微信开发者工具）。
 *
 * 在 Node 里用 vm 把页面代码跑起来，THREE 用真实的 threejs-miniprogram 适配器，
 * 只把 WebGLRenderer 换成不渲染的桩。断言的是玩法规则而不是画面：
 * 关卡可达性、落点判定、输入缓冲、一次只能伸一条舌头、切场景不残留。
 */

const assert = require("assert");
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { createScopedThreejs } = require("../miniprogram_npm/threejs-miniprogram");
const artFactory = require("../pages/index/art");
const experience = require("../pages/index/experience");

class FakeCanvas {
  createImage() {
    return {};
  }
  requestAnimationFrame() {
    return 1;
  }
  cancelAnimationFrame() {}
}

const THREE = createScopedThreejs(new FakeCanvas());

function loadPage(storageApi) {
  let config = null;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "pages", "index", "index.js"), "utf8"), {
    require: (name) => {
      if (name === "./experience") return experience;
      if (name === "./art") return artFactory;
      if (name.startsWith("./")) return require("../pages/index/" + name.slice(2));
      return { createScopedThreejs };
    },
    Page: (definition) => {
      config = definition;
    },
    console,
    Date,
    Math,
    wx: storageApi,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });
  return config;
}

function makeGame(storageApi) {
  const config = loadPage(storageApi);
  const game = Object.assign({}, config, {
    data: Object.assign({}, config.data),
    THREE,
    canvas: new FakeCanvas(),
    renderer: { render() {}, dispose() {} },
    setData(patch) {
      Object.assign(this.data, patch);
    }
  });
  game.width = 390;
  game.height = 844;
  game.setupCamera(390, 844);
  game.createMaterials();
  game.loadCompanion();
  game.buildScene();
  game.data.threeReady = true;
  game.showNurturePreview();
  return game;
}

/** 把所有计时器的起点往前推 ms，再跑一帧，等效于"快进"。 */
function advance(game, ms) {
  ["jumpState", "careMotion", "landingMotion", "splashMotion", "shake", "tongueState"].forEach((key) => {
    if (game[key] && game[key].start) game[key].start -= ms;
  });
  if (game.nextScene && game.nextScene.at) game.nextScene.at -= ms;
  if (game.chargeStart) game.chargeStart -= ms;
  if (game.pendingChargeAt) game.pendingChargeAt -= ms;
  if (game.respawnAt) game.respawnAt -= ms;
  if (game.sinkStart) game.sinkStart -= ms;
  if (game.bubbleGame) game.bubbleGame.start -= ms;
  if (game.blink) {
    if (game.blink.next) game.blink.next -= ms;
    if (game.blink.start) game.blink.start -= ms;
  }
  (game.bursts || []).forEach((burst) => {
    if (burst.userData.start) burst.userData.start -= ms;
  });
  (game.rings || []).forEach((ring) => {
    if (ring.userData.start) ring.userData.start -= ms;
  });
  const actor = game.actor();
  if (actor && actor.userData.pop && actor.userData.pop.start) actor.userData.pop.start -= ms;
  game.lastTick = Date.now() - 16;
  game.update();
}

/** 扫描蓄力值，找出落点最靠近叶心的那个。 */
function idealCharge(game) {
  let best = 0;
  let bestScore = Infinity;
  for (let k = 0; k <= 1; k += 0.005) {
    const score = game.landingFor(k, Date.now()).score;
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  // 阵风叶的落点被风推到一侧，这一瞬间不可能正中叶心，只能要求"能落上去"
  const windy = game.jumpLeaves[1] && game.jumpLeaves[1].userData.wind;
  const limit = windy ? 0.9 : 0.02;
  assert(bestScore < limit,
    "每一跳都必须存在一个能落上去的蓄力值，实际最小偏差 " + bestScore.toFixed(3));
  return best;
}

function performJump(game) {
  game.requestCharge();
  assert(game.data.isCharging, "落地后应当能立刻开始蓄力");
  assert(game.preview && game.preview.visible, "蓄力时必须显示世界内的落点预览");
  game.charge = idealCharge(game);
  game.releaseJump();
  advance(game, 140);   // 预备下蹲结束、进入飞行
  assert(game.jumpState && game.jumpState.phase === "fly", "预备动作之后应当进入飞行阶段");
  advance(game, 420);   // 飞行结束、落地
}

// ------------------------------------------------------------------ 养成

const game = makeGame();
game.openRoutes();
assert.equal(game.data.phase, "route");
assert.equal(game.data.routeList.length,19,'统一入口必须同时展示所有角色');
assert.equal(new Set(game.data.routeList.map(route=>route.id)).size,19,'路线不能重复');
assert(game.data.routeList.some(route=>route.id==='king')&&game.data.routeList.some(route=>route.id==='queen')&&game.data.routeList.some(route=>route.id==='artist'));
game.selectRoute({ currentTarget: { dataset: { id: "king" } } });
game.confirmRoute();
assert.equal(game.data.phase, "nurture");

let rounds = 0;
while (!game.data.canChallenge && rounds < 30) {
  rounds += 1;
  game.careAction({ currentTarget: { dataset: { type: ["feed", "pet", "play"][rounds % 3] } } });
  assert(game.data.careBusy, "动作播放期间应当锁定按钮");
  const growth = game.data.growth;
  game.careAction({ currentTarget: { dataset: { type: "feed" } } });
  assert.equal(game.data.growth, growth, "动作没播完之前不能再加成长值");
  advance(game, game.bubbleGame ? 11000 : 1400);
  assert(!game.data.careBusy, "动作结束后应当解锁按钮");
}
assert(game.data.canChallenge, "连续照顾之后应当可以挑战");
assert(game.frogGroup, "成长到第三阶段应当变成青蛙");
assert(game.data.careTitle, "通关时应当给出养育称号");

// ------------------------------------------------------------------ 养成的取舍

function nurtureRun(plan, limit) {
  const instance = makeGame();
  instance.chooseGender({ currentTarget: { dataset: { gender: "male" } } });
  instance.selectRoute({ currentTarget: { dataset: { id: "king" } } });
  instance.confirmRoute();
  let actions = 0;
  while (!instance.data.canChallenge && actions < limit) {
    instance.careAction({ currentTarget: { dataset: { type: plan[actions % plan.length] } } });
    advance(instance, instance.bubbleGame ? 11000 : 1100);
    actions += 1;
  }
  return { instance, actions };
}

// 轮流照顾 vs 只喂食：木桶效应必须让"只喂一样"明显更慢，否则这个玩法还是假的
const rotate = nurtureRun(["feed", "pet", "play"], 40);
const spam = nurtureRun(["feed"], 40);
assert(rotate.instance.data.canChallenge && spam.instance.data.canChallenge, "两种玩法都应当能养大");
assert(rotate.actions < spam.actions,
  "轮流照顾用了 " + rotate.actions + " 次，只喂食用 " + spam.actions + " 次，木桶效应没有生效");
assert(spam.instance.data.affection === 0 && spam.instance.data.play === 0,
  "只喂食应当让另外两项见底");

// 每次照顾只抬一项，另外两项下滑
const decay = nurtureRun(["feed"], 1);
assert(decay.instance.data.affection < 10 && decay.instance.data.play < 8,
  "喂食之后亲密和活力应当下滑");
assert.equal(decay.instance.data.needKey, "play", "最缺的那一项应当被标出来");
// 见底时要明确告诉玩家"会变慢"，否则惩罚是不可见的
for (let i = 0; i < 3; i += 1) {
  decay.instance.careAction({ currentTarget: { dataset: { type: "feed" } } });
  advance(decay.instance, 1100);
}
assert(decay.instance.data.play === 0 && decay.instance.data.needHint.indexOf("变慢") >= 0,
  "某一项见底时应当提示成长会变慢，实际提示：" + decay.instance.data.needHint);

// ------------------------------------------------------------------ 路线被动

function gameWithRoute(gender, routeId) {
  const instance = makeGame();
  instance.openRoutes();
  instance.selectRoute({ currentTarget: { dataset: { id: routeId } } });
  instance.confirmRoute();
  return instance;
}

// 每条路线都必须有被动，否则"选路线"又变回换帽子
const perkList = makeGame();
const perkNames = new Set();
perkList.openRoutes();
  perkList.data.routeList.forEach((route) => {
    assert(route.perkName, route.name + " 没有配置被动（perk id 可能写错了）");
    perkNames.add(route.perkName);
  });
assert.equal(perkNames.size, 5, "应当有 5 种被动，实际 " + Array.from(perkNames).join("、"));

// 稳重：同一个落点，判定值更小 = 判定圈更宽
const leafProbe = makeGame();
const probeLeaf = leafProbe.createGameLeaf(0, 0, 0);
const offCenter = new THREE.Vector3(0.75, 0, 0);
const steadyScore = gameWithRoute("male", "king").leafScore(offCenter, probeLeaf);
const normalScore = gameWithRoute("male", "general").leafScore(offCenter, probeLeaf);
assert(steadyScore < normalScore,
  "稳重路线的判定应当更宽松（" + steadyScore.toFixed(3) + " vs " + normalScore.toFixed(3) + "）");

// 轻盈：多一次落水机会，HUD 圆点也要跟着多
const nimbleRun = gameWithRoute("male", "prince");
nimbleRun.data.canChallenge = true;
nimbleRun.setupJumpLevel();
assert.equal(nimbleRun.data.attempts, 4, "轻盈路线应当有 4 次机会");
assert.equal(nimbleRun.data.attemptSlots.length, 4, "机会圆点数量必须跟着机会数走");

const plainRun = gameWithRoute("male", "king");
plainRun.data.canChallenge = true;
plainRun.setupJumpLevel();
assert.equal(plainRun.data.attempts, 3, "普通路线应当有 3 次机会");

// 远跳：同样蓄满，能跳得更远
function maxReach(routeId) {
  const instance = gameWithRoute("male", routeId);
  instance.data.canChallenge = true;
  instance.setupJumpLevel();
  const from = instance.jumpLeaves[0].position;
  const point = instance.landingFor(1, Date.now()).point;
  return Math.hypot(point.x - from.x, point.z - from.z);
}
assert(maxReach("hero") > maxReach("king"),
  "远跳路线的最大距离应当更远（" + maxReach("hero").toFixed(2) + " vs " + maxReach("king").toFixed(2) + "）");

// 从容：同样按住 500ms，蓄力值更低（条走得更慢）
function chargeAfter(routeId, ms) {
  const instance = gameWithRoute("male", routeId);
  instance.data.canChallenge = true;
  instance.setupJumpLevel();
  instance.requestCharge();
  instance.chargeStart -= ms;
  advance(instance, 16);
  return instance.charge;
}
assert(chargeAfter("duke", 500) < chargeAfter("king", 500),
  "从容路线的蓄力条应当走得更慢");

// 亲和：同样的照顾次数，成长更多
function growthAfter(routeId, times) {
  const instance = gameWithRoute("female", routeId);
  for (let i = 0; i < times; i += 1) {
    instance.careAction({ currentTarget: { dataset: { type: "feed" } } });
    advance(instance, instance.bubbleGame ? 11000 : 1100);
  }
  return instance.data.growth;
}
assert(growthAfter("artist", 3) > growthAfter("queen", 3),
  "亲和路线的成长应当更快");

// ------------------------------------------------------------------ 荷叶可达性

const probe = makeGame();
probe.confirmRoute();
probe.setupJumpLevel();
let previous = probe.jumpLeaves[0];
for (let i = 0; i < 400; i += 1) {
  const next = probe.createNextGameLeaf(previous, i);
  const gap = Math.hypot(next.position.x - previous.position.x, next.position.z - previous.position.z);
  assert(gap >= 2.8 - 1e-6 && gap <= 3.9 + 1e-6, "荷叶间距必须落在可跳区间，实际 " + gap.toFixed(3));
  assert(Math.hypot(next.position.x, next.position.z) <= 7.6 + 1e-6,
    "荷叶必须留在池塘范围内，实际半径 " + Math.hypot(next.position.x, next.position.z).toFixed(2));
  assert(next.userData.rx > 0.5 && next.userData.rz > 0.3, "荷叶必须有可站立半径");
  if (previous !== probe.jumpLeaves[0]) probe.removeObject(previous);
  previous = next;
}
probe.removeObject(previous);

// 整关 20 跳，随机撒点会让镜头每跳都重新对正后方，
// 玩家看到的是"整个池塘在乱转" —— 所以单独验这一段。
function angleDiff(a, b) {
  return ((((a - b + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
}
const trail = makeGame();
trail.confirmRoute();
trail.setupJumpLevel();
let trailPrev = trail.jumpLeaves[0];
let trailLast = null;
let trailTurn = 0;
for (let i = 1; i < trail.data.jumpGoal; i += 1) {
  const next = trail.createNextGameLeaf(trailPrev, i - 1);
  const angle = Math.atan2(next.position.x - trailPrev.position.x, next.position.z - trailPrev.position.z);
  if (trailLast !== null) trailTurn = Math.max(trailTurn, Math.abs(angleDiff(angle, trailLast)));
  trailLast = angle;
  trail.removeObject(trailPrev);
  trailPrev = next;
}
assert(trailTurn < 1.0, "20 跳里最大转向 " + (trailTurn * 57.3).toFixed(0) + "°，镜头会跟着乱转");

// ------------------------------------------------------------------ 输入缓冲

const buffer = makeGame();
buffer.confirmRoute();
buffer.setupJumpLevel();
buffer.requestCharge();
buffer.charge = idealCharge(buffer);
buffer.releaseJump();
advance(buffer, 200);                       // 预备结束，进入飞行
advance(buffer, 150);                       // 飞到半途
assert.equal(buffer.data.isCharging, false);
buffer.requestCharge();                     // 空中点击：应当被记住而不是丢弃
assert.equal(buffer.data.isCharging, false, "空中不能直接开始蓄力");
assert(buffer.pendingChargeAt > 0, "空中的点击必须进入输入缓冲");
advance(buffer, 200);                       // 剩余行程走完，落地
advance(buffer, 16);                        // 落地后的下一帧消费缓冲
assert(buffer.data.isCharging, "落地后应当自动接上缓冲的蓄力");

// ------------------------------------------------------------------ 落水机会与完美落叶

/** 造一个"必失手"的跳跃状态直接结算，省得算蓄力。 */
function stubLanding(instance, score) {
  const from = instance.jumpLeaves[0].position.clone();
  const to = instance.jumpLeaves[1].position.clone();
  instance.jumpState = { from, to, target: to, score, phase: "fly", start: Date.now() };
  instance.resolveLanding(Date.now());
}

const lives = makeGame();
lives.confirmRoute();
lives.setupJumpLevel();
assert.equal(lives.data.attempts, 3, "第一关应当有 3 次机会");

stubLanding(lives, 5);
assert.equal(lives.data.attempts, 2, "落水应当扣一次机会");
assert.equal(lives.data.gameOver, false, "还有机会时不该直接判负");
assert.equal(lives.data.jumps, 0, "落水不该计入跳跃数");
advance(lives, 900);
assert(lives.frogGroup.visible, "复活后青蛙必须重新可见");
assert(Math.hypot(lives.frogGroup.position.x - lives.jumpLeaves[0].position.x,
  lives.frogGroup.position.z - lives.jumpLeaves[0].position.z) < 0.01,
  "复活后应当回到当前荷叶，而不是回到第 1 跳");

// 再落两次，机会用光才判负
stubLanding(lives, 5);
advance(lives, 900);
stubLanding(lives, 5);
assert.equal(lives.data.attempts, 0);
assert.equal(lives.data.gameOver, true, "三次机会用完应当判负");

// 完美落叶要有独立计数
const perfectRun = makeGame();
perfectRun.confirmRoute();
perfectRun.setupJumpLevel();
stubLanding(perfectRun, 0.1);
assert.equal(perfectRun.data.perfect, 1, "正中叶心应当记一次完美");
assert.equal(perfectRun.data.jumps, 1);
stubLanding(perfectRun, 0.9);
assert.equal(perfectRun.data.perfect, 1, "只是稳稳落叶不算完美");

// ------------------------------------------------------------------ 完整通关

const run = makeGame();
run.chooseGender({ currentTarget: { dataset: { gender: "female" } } });
run.selectRoute({ currentTarget: { dataset: { id: "queen" } } });
run.confirmRoute();
run.data.canChallenge = true;
run.setupJumpLevel();
assert.equal(run.jumpLeaves.length, 2);

for (let i = 0; i < run.data.jumpGoal; i += 1) {
  const before = run.data.jumps;
  performJump(run);
  assert.equal(run.data.jumps, before + 1, "第 " + (i + 1) + " 跳应当判定成功");
  if (i < run.data.jumpGoal - 1) assert.equal(run.jumpLeaves.length, 2, "落地后始终保留当前叶和下一片叶");
}
assert.equal(run.data.jumpGoal, 20, "第一关必须是 20 跳");
assert(run.nextScene && run.nextScene.method === "setupBugLevel", "跳满 20 片荷叶后应当排队进入第二关");
advance(run, 900);
assert.equal(run.data.phase, "levelBug", "应当进入捕虫关");
assert.equal(run.data.bugs, 0);

// ------------------------------------------------------------------ 捕虫

run.camera.updateMatrixWorld();
for (let i = 0; i < run.data.bugGoal; i += 1) {
  const insect = run.insects[0];
  assert(insect, "场上应当有昆虫");
  // 舌头有射程了：模拟"等它飞近再出手"，把目标拉进射程
  const mouth = run.mouthWorld();
  const offset = insect.position.clone().sub(mouth);
  if (offset.length() > 2.4) insect.position.copy(mouth.clone().add(offset.normalize().multiplyScalar(2.4)));
  const projected = insect.position.clone().project(run.camera);
  const x = ((projected.x + 1) / 2) * run.width;
  const y = ((1 - projected.y) / 2) * run.height;
  const touch = { x, y, identifier: 1 };

  run.onTouchStart({ touches: [touch], changedTouches: [touch] });
  run.onTouchEnd({ touches: [], changedTouches: [touch] });

  assert(run.tongueState, "松手应当伸舌头");
  const state = run.tongueState;
  run.fireTongue();
  assert.equal(run.tongueState, state, "同一条舌头没收回之前不能再伸");

  const before = run.data.bugs;
  advance(run, 420);
  assert.equal(run.data.bugs, before + 1, "第 " + (i + 1) + " 只虫应当被吃到");
  assert.equal(run.tongueState, null, "舌头用完必须收回");
}

assert(run.nextScene && run.nextScene.method === "showReturnChoice");
advance(run, 900);
assert.equal(run.data.phase, "returnChoice", "捕虫结束应当先选择返程方式");
run.chooseReturn({currentTarget:{dataset:{mode:'boat'}}});
for(let i=0;i<220 && run.returnWorld.active;i++)run.returnWorld.update(Date.now(),.05);
assert.equal(run.data.bugGoal, 10, "第二关必须捕获 10 只");
assert.equal(run.data.phase, "final", "吃满 10 只虫应当通关");
assert.equal(run.data.newRoute, true, "第一次通关应当标记为新相遇");
assert.equal(run.data.metCount, 1, "通关后应当记下这条路线");

// 结算：评级、用时、信件、分享
assert(["S", "A", "B", "C"].indexOf(run.data.grade) >= 0, "结算必须给出评级");
assert(/^\d+:\d{2}$/.test(run.data.runTimeText), "用时要格式化成 m:ss，实际 " + run.data.runTimeText);
assert(run.data.letterLines.length >= 2, "结局应当有这封来信");
assert.equal(run.data.letterLines[0], "它把整片荷塘分了你一半，", "女王应当拿到自己那封信");
assert(run.onShareAppMessage().title.indexOf("女王") >= 0, "分享文案应当带上路线名");
assert.equal(run.gradeOf(15, 0), "S");
assert.equal(run.gradeOf(10, 1), "A");
assert.equal(run.gradeOf(5, 3), "B");
assert.equal(run.gradeOf(0, 0), "C");
assert(run.loadBest() && run.loadBest().grade, "最好成绩应当被记下来");
assert.equal(run.saveBest({ grade: "C", perfect: 0, falls: 9, time: 99999 }), false,
  "更差的成绩不该覆盖最好成绩");

// ------------------------------------------------------------------ 沉叶与阵风

const sinkRun = makeGame();
sinkRun.confirmRoute();
sinkRun.setupJumpLevel();
sinkRun.jumpLeaves[1].userData.sink = true;
stubLanding(sinkRun, 0.5);
assert.equal(sinkRun.data.jumps, 1);
assert(sinkRun.sinkStart > 0, "落在沉叶上应当开始下沉倒计时");
advance(sinkRun, 2200);
assert.equal(sinkRun.data.attempts, 2, "沉下去了也该扣一次机会，而不是直接判负");
assert(sinkRun.jumpLeaves[0].position.y < 0.06, "沉叶要真的往下沉，玩家才看得见");

const windRun = makeGame();
windRun.confirmRoute();
windRun.setupJumpLevel();
const windLeaf = windRun.jumpLeaves[1];
windLeaf.userData.wind = { amp: 0.4, ax: 1, az: 0 };
const gustA = windRun.landingFor(0.5, 1000).point;
const gustB = windRun.landingFor(0.5, 1800).point;
assert(Math.abs(gustA.x - gustB.x) > 0.2, "阵风叶的落点必须随时间摆动");

const calmRun = makeGame();
calmRun.confirmRoute();
calmRun.setupJumpLevel();
const calmA = calmRun.landingFor(0.5, 1000).point;
const calmB = calmRun.landingFor(0.5, 1800).point;
assert(Math.abs(calmA.x - calmB.x) < 1e-6, "普通荷叶的落点不该自己动");

// ------------------------------------------------------------------ 捕虫射程

const bugGame = makeGame();
bugGame.confirmRoute();
bugGame.data.canChallenge = true;
bugGame.setupBugLevel();

// 射程外：舌头只能伸到最远处，吃不到，还会把附近的虫吓飞
const farInsect = bugGame.insects[0];
farInsect.position.copy(bugGame.mouthWorld()).add(new THREE.Vector3(0, 2.0, -2.8));
bugGame.aimHit = farInsect;
bugGame.aimWorld.copy(farInsect.position);
bugGame.fireTongue();
assert(bugGame.tongueState && bugGame.tongueState.hit === null, "射程外的目标不该被锁定");
assert(farInsect.userData.flee, "舔空之后附近的虫子应当被吓飞");
const bugsBefore = bugGame.data.bugs;
advance(bugGame, 420);
assert.equal(bugGame.data.bugs, bugsBefore, "射程外不能吃到虫子");

// 射程内：正常吃到
const nearInsect = bugGame.insects[1] || bugGame.insects[0];
nearInsect.userData.flee = null;
nearInsect.position.copy(bugGame.mouthWorld()).add(new THREE.Vector3(.1, .2, -1.2));
bugGame.aimHit = nearInsect;
bugGame.aimWorld.copy(nearInsect.position);
bugGame.fireTongue();
assert(bugGame.tongueState && bugGame.tongueState.hit === nearInsect, "射程内应当直接锁定");
const bugsNow = bugGame.data.bugs;
advance(bugGame, 420);
assert.equal(bugGame.data.bugs, bugsNow + 1, "射程内应当吃到");

// ------------------------------------------------------------------ 路线收集

const collect = makeGame();
assert.equal(collect.data.metCount, 0, "新开一局应当是 0 条已相遇");
assert.equal(collect.saveRoute("king"), true, "第一次相遇算新路线");
assert.equal(collect.data.metCount, 1);
assert.equal(collect.saveRoute("king"), false, "同一条路线不该重复计数");
assert.equal(collect.data.metCount, 1, "重复保存不能增加计数");
collect.saveRoute("queen");
assert.equal(collect.data.metCount, 2);

collect.chooseGender({ currentTarget: { dataset: { gender: "male" } } });
const metKing = collect.data.routeList.find((route) => route.id === "king");
const unmetMonk = collect.data.routeList.find((route) => route.id === "monk");
assert(metKing && metKing.met, "相遇过的路线应当在卡片上标出来");
assert(unmetMonk && !unmetMonk.met, "没相遇过的路线不该有标记");

// ------------------------------------------------------------------ 切场景清理

run.backToGender();
assert.equal(run.nextScene, null, "返回池塘必须取消排队中的转场");
assert.equal(run.data.phase, "route");
assert.equal(run.jumpLeaves.length, 0);
assert.equal(run.insects.length, 0);
run.update();
assert.equal(run.data.phase, "route", "残留的转场不能再把玩家拽回关卡");
assert(run.petGroup, "回到池塘应当重新出现小蝌蚪");

const meshCount = (() => {
  let count = 0;
  run.scene.traverse((child) => {
    if (child.isMesh || child.isLine || child.isLineSegments) count += 1;
  });
  return count;
})();
assert(meshCount < 200, "常驻场景的绘制对象应当控制在 200 以内，实际 " + meshCount);

// ------------------------------------------------------------------ 静态检查

// this.xxx() 调用的方法必须真的存在：重构时改名漏改会在这里立刻暴露
const pageSource = ["index.js", "nurture.js", "jump-level.js", "bug-level.js"]
  .map((file) => fs.readFileSync(path.join(__dirname, "..", "pages", "index", file), "utf8"))
  .join("\n");
const called = new Set();
pageSource.replace(/this\.([A-Za-z_$][\w$]*)\s*\(/g, (match, name) => {
  called.add(name);
  return match;
});
const allow = new Set(["setData"]);
const missing = Array.from(called).filter((name) => !allow.has(name) && typeof game[name] !== "function");
assert.equal(missing.length, 0, "调用了不存在的方法：" + missing.join("、"));
const markup = fs.readFileSync(path.join(__dirname, '../pages/index/index.wxml'), 'utf8');
const handlers = Array.from(markup.matchAll(/bind(?:tap|touchstart|touchmove|touchend|touchcancel)="([A-Za-z_$][\w$]*)"/g), match => match[1]);
handlers.forEach(name => assert.equal(typeof game[name], 'function', '界面绑定了不存在的操作：' + name));
assert(!markup.includes('rest-stop'), '跳跃中不能出现强制休息面板');

// ------------------------------------------------------------------ 伙伴存档与冒险收获
const disk = new Map();
const storage = {
  getStorageSync: (key) => disk.has(key) ? JSON.parse(disk.get(key)) : null,
  setStorageSync: (key, value) => disk.set(key, JSON.stringify(value))
};
const savedPet = makeGame(storage);
savedPet.chooseGender({ currentTarget: { dataset: { gender: "female" } } });
savedPet.selectRoute({ currentTarget: { dataset: { id: "princess" } } });
savedPet.beginCompanion("荷小满");
savedPet.careAction({ currentTarget: { dataset: { type: "feed" } } });
advance(savedPet, 1100);
const savedGrowth = savedPet.data.growth;
const reloaded = makeGame(storage);
assert(reloaded.data.hasCompanion, "重新打开应当找到伙伴");
reloaded.resumeCompanion();
assert.equal(reloaded.data.petName, "荷小满");
assert.equal(reloaded.data.growth, savedGrowth, "成长进度不能丢失");
assert.equal(reloaded.data.selectedRouteId, "princess");
assert.equal(reloaded.perkLives(), 1, "恢复后角色被动仍然生效");
reloaded.data.growth = 140; reloaded.data.canChallenge = true;
reloaded.runRewarded = false; reloaded.showFinal();
assert.equal(reloaded.data.snacks, 3);
assert.equal(reloaded.data.adventures, 1);
assert(reloaded.data.souvenirs.indexOf("初夏荷花") >= 0);
reloaded.showFinal();
assert.equal(reloaded.data.snacks, 3, "重复结算不能重复领取奖励");
reloaded.returnToPond();
assert.equal(reloaded.data.phase, "nurture");
assert(reloaded.frogGroup, "成年伙伴回家后仍然是青蛙");
reloaded.applyCare({ key: "food", type: "feed" });
assert.equal(reloaded.data.snacks, 2, "喂食消耗带回的莲子");
const afterHome = makeGame(storage); afterHome.resumeCompanion();
assert.equal(afterHome.data.snacks, 2);
assert.equal(afterHome.data.adventures, 1);
const blockedStorage = makeGame({ setStorageSync() { throw new Error("quota"); } });
blockedStorage.chooseGender({ currentTarget: { dataset: { gender: "male" } } });
blockedStorage.selectRoute({ currentTarget: { dataset: { id: "king" } } });
blockedStorage.beginCompanion("小荷");
assert(blockedStorage.data.storageNotice, "存储失败要明确提示");
assert.equal(blockedStorage.data.phase, "nurture", "存储失败也能继续游玩");
const corrupt = makeGame({ getStorageSync: () => ({ version: 1, name: "坏存档", routeId: "missing", growth: -1 }) });
assert.equal(corrupt.data.hasCompanion, false, "损坏的存档不能阻止启动");

// ------------------------------------------------------------------ 五种主动本领
const glide = gameWithRoute("male", "prince"); glide.setupJumpLevel();
const beforeGlide = glide.landingFor(0.35, Date.now()).score;
glide.activateSkill();
assert(glide.landingFor(0.35, Date.now()).score < beforeGlide, "滑翔必须改善落点");
glide.requestCharge(); glide.charge = 0.35; glide.releaseJump();
assert(glide.jumpState.assisted && !glide.data.skillArmed, "滑翔只作用一次且不算完美");
const anchor = gameWithRoute("male", "general"); anchor.setupJumpLevel();
anchor.jumpLeaves[1].userData.drift = { ax: .4, az: .2, speed: 1, amp: .5 };
anchor.jumpLeaves[1].userData.sink = true;
anchor.jumpLeaves[1].userData.wind = { amp: .4, ax: 1, az: 0 };
anchor.activateSkill();
assert(!anchor.jumpLeaves[1].userData.drift && !anchor.jumpLeaves[1].userData.wind && !anchor.jumpLeaves[1].userData.sink);
assert(!anchor.data.skillReady, "同一段不能重复用技能");
const forecast = gameWithRoute("male", "it"); forecast.setupJumpLevel(); forecast.activateSkill();
forecast.requestCharge(); forecast.chargeStart -= 1400; forecast.updateCharge(Date.now());
assert(forecast.jumpState && forecast.jumpState.score < .3, "叶心计算应当自动在可落叶位置起跳");
const slow = gameWithRoute("male", "monk"); slow.setupJumpLevel();
const normalTime = slow.chargeTime(); slow.activateSkill();
assert(slow.chargeTime() > normalTime, "静心期间蓄力应该放慢");
slow.sinkStart = Date.now(); const sinkBefore = slow.sinkStart;
slow.updateSkill(Date.now(), 0.05);
assert(slow.sinkStart > sinkBefore, "静心也要放慢沉叶");
const rescue = gameWithRoute("male", "king"); rescue.setupJumpLevel(); rescue.activateSkill();
rescue.requestCharge(); rescue.charge = 0; rescue.releaseJump();
advance(rescue, 140); advance(rescue, 420);
assert.equal(rescue.data.jumps, 1, "救援叶应当接住落空的一跳");
assert.equal(rescue.data.attempts, 3);
assert.equal(rescue.data.perfect, 0, "救援落点不能刷完美数");

// ------------------------------------------------------------------ 休息点、陪玩与昆虫行为
const resting = gameWithRoute("male", "king"); resting.setupJumpLevel();
for (let i = 0; i < 5; i++) performJump(resting);
assert.equal(resting.data.checkpoint, 5);
assert(!resting.data.resting && resting.data.skillReady, "20 跳必须连续进行，不能出现休息弹窗");
performJump(resting);
stubLanding(resting, 5); advance(resting, 900);
assert.equal(resting.data.jumps, 5, "失手后从最近的休息点重来");
assert.equal(resting.data.perfect, resting.checkpointState.perfect, "重跑不能重复刷完美");
stubLanding(resting, 5); advance(resting, 900); stubLanding(resting, 5);
assert(resting.data.gameOver);
resting.retryLevel();
assert.equal(resting.data.jumps, 5, "用完机会后的重试也应保留休息点");
assert.equal(resting.data.attempts, 3);
const bubbles = gameWithRoute("female", "artist"); bubbles.startBubbleGame();
const growthBeforeBubbles = bubbles.data.growth;
for (let i = 0; i < 5; i++) {
  const p = bubbles.playBubble.position.clone().project(bubbles.camera);
  bubbles.touchPlayBubble({ x: (p.x + 1) * bubbles.width / 2, y: (1 - p.y) * bubbles.height / 2 });
}
assert(!bubbles.data.bubblePlaying && bubbles.data.bubbleScore === 5);
assert(bubbles.data.growth > growthBeforeBubbles, "追泡泡结束后才结算陪玩成长");
const flightGame = makeGame(); flightGame.setupBugLevel();
const dragon = flightGame.insects.find((insect) => insect.userData.kind === "dragonfly");
const butterfly = flightGame.insects.find((insect) => insect.userData.kind === "butterfly");
const gnat = flightGame.insects.find((insect) => insect.userData.kind === "gnat");
const shift = dragon.userData.phase;
const hoverA = flightGame.insectFlightAt(dragon, .1 - shift);
const hoverB = flightGame.insectFlightAt(dragon, .5 - shift);
assert.equal(hoverA.behavior, "hover"); assert.equal(hoverA.x, hoverB.x);
assert.equal(flightGame.insectFlightAt(dragon, 1.7 - shift).behavior, "glide");
const span = (insect) => {
  const points = Array.from({ length: 80 }, (_, i) => flightGame.insectFlightAt(insect, i / 10).y);
  return Math.max(...points) - Math.min(...points);
};
assert(span(butterfly) > span(gnat) * 2, "蝴蝶的上下摆动要明显区别于小飞虫");
console.log("PASS: 伙伴命名存档与异常恢复 / 冒险收获防重复 / 五种主动本领 / 连续跳跃与自动进度 / 追泡泡 / 三种昆虫飞行");

const pause = gameWithRoute("male", "monk"); pause.setupJumpLevel(); pause.activateSkill();
const slowEnd = pause.slowUntil;
const startedAt = pause.runStartedAt;
pause.onHide(); pause.hiddenAt -= 5000; pause.onShow();
assert(pause.slowUntil >= slowEnd + 5000, "后台时间不能消耗本领时长");
assert(pause.runStartedAt >= startedAt + 5000, "后台时间不能计入冒险用时");
const pausePlay = gameWithRoute("female", "artist"); pausePlay.startBubbleGame();
const playStart = pausePlay.bubbleGame.start;
pausePlay.onHide(); pausePlay.hiddenAt -= 5000; pausePlay.onShow();
assert(pausePlay.bubbleGame.start >= playStart + 5000, "追泡泡切后台也要暂停计时");

const routes = makeGame();
routes.openRoutes();
  for (const route of routes.data.routeList) {
    const routeRun = gameWithRoute(null, route.id); routeRun.setupJumpLevel();
    for (let jump = 0; jump < 20; jump++) performJump(routeRun);
    assert.equal(routeRun.data.jumps, 20, route.name + "必须能走完 20 跳");
    routeRun.disposeThree();
  }
console.log("PASS: 切后台不消耗技能与陪玩时长 / 19 条路线完整 20 跳均可达");

// ------------------------------------------------------------------ 连击升调 / 路线台词 / 金泡泡 / 跨伙伴莲子与荷塘氛围
const comboGame = gameWithRoute("male", "king"); comboGame.setupJumpLevel();
const rates = [];
comboGame.playSound = (name, options) => { if (name === "perfect") rates.push(options && options.rate || 1); };
stubLanding(comboGame, 0.05);
stubLanding(comboGame, 0.05);
const ringsAfter2 = comboGame.rings.length;
stubLanding(comboGame, 0.05);
assert.equal(rates.length, 3);
assert(rates[0] < rates[1] && rates[1] < rates[2], "连续完美落叶音效必须逐级升调");
assert(comboGame.data.message.includes("完美连击 ×3"), "连续完美应展示连击反馈");
assert(ringsAfter2 >= 3, "2 连击以上应产生双层金色涟漪");
comboGame.disposeThree();

const quoteGame = makeGame(); quoteGame.openRoutes();
for (const route of quoteGame.data.routeList) {
  const q0 = quoteGame.routeQuote(route.id, 0), q1 = quoteGame.routeQuote(route.id, 1);
  assert(q0 && q1 && q0 !== q1, route.id + " 缺少多条专属台词");
}
quoteGame.selectRoute({ currentTarget: { dataset: { id: "it" } } });
const firstQuote = quoteGame.data.petQuote;
quoteGame.speakQuote({ currentTarget: { dataset: {} } }, true);
quoteGame.speakQuote({ currentTarget: { dataset: {} } }, true);
assert(quoteGame.data.petQuote && quoteGame.data.petQuote !== firstQuote, "点击气泡应切换台词");
quoteGame.disposeThree();

const goldBubbles = gameWithRoute("female", "artist"); goldBubbles.startBubbleGame();
assert.equal(goldBubbles.playBubbles.length, 3, "追泡泡应同时刷新多个泡泡");
const goldTarget = goldBubbles.playBubbles[1];
goldTarget.userData.golden = true; goldTarget.userData.value = 2;
const gp = goldTarget.position.clone().project(goldBubbles.camera);
goldBubbles.touchPlayBubble({ x: (gp.x + 1) * goldBubbles.width / 2, y: (1 - gp.y) * goldBubbles.height / 2 });
assert.equal(goldBubbles.data.bubbleScore, 2, "金色泡泡应一次加 2 分");
goldBubbles.disposeThree();

const sharedStore = {};
const sharedApi = {
  getStorageSync: (k) => sharedStore[k],
  setStorageSync: (k, v) => { sharedStore[k] = JSON.parse(JSON.stringify(v)); }
};
const petA = makeGame(sharedApi);
petA.selectRoute({ currentTarget: { dataset: { id: "king" } } });
petA.beginCompanion("大王蛙");
petA.setSharedSnacks(6);
petA.choosePondTheme({ currentTarget: { dataset: { id: "sunset" } } });
assert.equal(petA.data.pondTheme, "sunset");
assert.equal(petA.data.snacks, 3, "解锁落日金波应扣除 3 颗莲子");
petA.choosePondTheme({ currentTarget: { dataset: { id: "firefly" } } });
assert.equal(petA.data.pondTheme, "sunset", "莲子不足时不能解锁夏夜萤火");
petA.setSharedSnacks(8);
petA.choosePondTheme({ currentTarget: { dataset: { id: "firefly" } } });
assert.equal(petA.data.pondTheme, "firefly");
assert(petA.themeParticles && petA.themeParticles.userData.kind === "firefly", "夏夜萤火应激活萤火粒子");
assert.equal(petA.data.snacks, 3);
const petB = makeGame(sharedApi);
petB.selectRoute({ currentTarget: { dataset: { id: "princess" } } });
petB.beginCompanion("新伙伴");
assert.equal(petB.data.snacks, 3, "换新伙伴必须保留账号通用莲子");
assert.equal(petB.data.pondTheme, "firefly", "换新伙伴必须保留已选荷塘氛围");
assert.equal(petB.data.rosterCount, 2, "荷塘名册应同时保留新旧两位伙伴");
const firstPetId = petA.companion.id;
petB.switchCompanion({ currentTarget: { dataset: { id: firstPetId } } });
assert.equal(petB.companion.name, "大王蛙", "切回名册中的旧伙伴应恢复对应角色");
assert.equal(petB.companion.routeId, "king");
const petReloaded = makeGame(sharedApi);
assert.equal(petReloaded.data.rosterCount, 2, "多伙伴名册应持久化保存");
assert.equal(petReloaded.companion.name, "大王蛙");
petA.disposeThree(); petB.disposeThree(); petReloaded.disposeThree();

// 第二关：金萤虫（双倍+莲子）与带刺红蜂（蛰嘴断连击+短晕）
const specialBugs = gameWithRoute("male", "king"); specialBugs.setupBugLevel();
const goldBug = specialBugs.insects.find((item) => item.userData.kind === "goldbug");
const beeBug = specialBugs.insects.find((item) => item.userData.kind === "bee");
assert(goldBug && beeBug, "荷花池应刷新金萤虫和带刺红蜂");
const snacksBeforeGold = specialBugs.data.snacks;
specialBugs.scoreBug(goldBug);
assert.equal(specialBugs.data.bugs, 2, "金萤虫应算 2 只进度");
assert.equal(specialBugs.data.snacks, snacksBeforeGold + 1, "金萤虫应额外奖励 1 颗莲子");
assert.equal(specialBugs.data.bugCombo, 1);
specialBugs.scoreBug(beeBug);
assert.equal(specialBugs.data.bugs, 2, "误舔红蜂不能增加捕虫数");
assert.equal(specialBugs.data.bugCombo, 0, "误舔红蜂必须打断连击");
assert(specialBugs.stunUntil > Date.now(), "误舔红蜂应触发短暂发晕");
specialBugs.aimHit = specialBugs.insects[0];
specialBugs.fireTongue();
assert.equal(specialBugs.tongueState, null, "发晕期间不能伸舌头");
specialBugs.disposeThree();

// 无尽荷塘：超过 20 跳不结束、每跳可达、落水记最高分并给莲子
const endlessStore = {};
const endlessApi = {
  getStorageSync: (k) => endlessStore[k],
  setStorageSync: (k, v) => { endlessStore[k] = JSON.parse(JSON.stringify(v)); }
};
const endlessGame = makeGame(endlessApi);
endlessGame.selectRoute({ currentTarget: { dataset: { id: "king" } } });
endlessGame.beginCompanion("无尽蛙");
endlessGame.data.growth = 140; endlessGame.data.canChallenge = true;
assert.equal(endlessGame.data.endlessUnlocked, false, "未通关前无尽模式应未解锁");
endlessGame.showFinal();
assert.equal(endlessGame.data.endlessUnlocked, true, "通关后应解锁无尽荷塘");
endlessGame.resumeCompanion();
endlessGame.startEndlessMode();
assert(endlessGame.data.endlessMode && endlessGame.data.attempts === 1);
for (let i = 0; i < 24; i += 1) performJump(endlessGame);
assert.equal(endlessGame.data.jumps, 24, "无尽荷塘应可连续跳超过 20 跳");
assert.equal(endlessGame.data.phase, "levelJump", "无尽荷塘满 20 跳不能切进捕虫关");
const snacksBeforeFall = endlessGame.data.snacks;
stubLanding(endlessGame, 5);
assert(endlessGame.data.gameOver, "无尽荷塘落水应结束本局");
assert.equal(endlessGame.data.endlessBest, 24, "无尽荷塘应记录最高跳数");
assert(endlessGame.data.snacks > snacksBeforeFall, "无尽荷塘应按跳数奖励莲子");
const shareData = endlessGame.onShareAppMessage();
assert(shareData.query.includes("route=king") && shareData.query.includes("best=24"), "分享 query 应带路线与无尽成绩");
endlessGame.receiveShareCard({ route: "ceo", name: "霸总蛙", best: "18" });
assert(endlessGame.data.visitorCard && endlessGame.data.visitorCard.routeId === "ceo");
endlessGame.adoptFromVisitor();
assert.equal(endlessGame.data.phase, "route");
assert.equal(endlessGame.data.selectedRouteId, "ceo");
assert.equal(endlessGame.data.visitorCard, null);
endlessGame.disposeThree();
console.log("PASS: 完美连击升调与双层金环 / 19 条路线台词 / 多泡泡与金色双倍 / 跨伙伴莲子与荷塘氛围皮肤 / 多伙伴名册 / 金萤虫与红蜂 / 无尽荷塘与分享名片");

console.log("PASS: 养成 3 阶段（轮流 " + rotate.actions + " 次 / 只喂食 " + spam.actions + " 次）" +
  " / 5 种路线被动 / 输入缓冲 / 20 跳可达 / 落水机会 / 完美落叶 / 沉叶+阵风 / 捕虫射程+受惊 / 10 虫通关 / 路线收集 / 结算评级+来信+分享 / 转场清理" +
  " / 常驻绘制对象 " + meshCount + " / 20 跳最大转向 " + (trailTurn * 57.3).toFixed(0) + "°");
