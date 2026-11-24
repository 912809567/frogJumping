/**
 * 页面表现层：只处理"什么时候画"和"被打断后怎么接上"。
 *
 * 这里不实现任何玩法或建模 —— 那些全在 index.js。本文件唯一的职责是：
 * 1. 切到后台时停掉渲染循环，回来时把动画时钟按暂停时长整体平移，
 *    这样回来不会看到青蛙"瞬移"到半空或者舌头瞬间弹回。
 * 2. 后台期间如果手指正在蓄力，回来时把蓄力干净地收掉。
 *
 * 依赖方向是单向的：本文件可以读写 index.js 的页面对象，index.js 不依赖这里。
 */

const MOTION_KEYS = ["jumpState", "careMotion", "landingMotion", "splashMotion", "shake", "tongueState"];

function shift(instance, elapsed) {
  if (!elapsed || elapsed < 0) return;

  MOTION_KEYS.forEach((key) => {
    const motion = instance[key];
    if (motion && motion.start) motion.start += elapsed;
  });

  if (instance.nextScene && instance.nextScene.at) instance.nextScene.at += elapsed;
  if (instance.chargeStart) instance.chargeStart += elapsed;
  if (instance.pendingChargeAt) instance.pendingChargeAt += elapsed;
  if (instance.respawnAt) instance.respawnAt += elapsed;
  if (instance.sinkStart) instance.sinkStart += elapsed;
  if (instance.slowUntil) instance.slowUntil += elapsed;
  if (instance.returnWorld && instance.returnWorld.active) {
    if (instance.returnWorld.shotAt) instance.returnWorld.shotAt += elapsed;
    if (instance.returnWorld.resultAt) instance.returnWorld.resultAt += elapsed;
  }
  if (instance.runStartedAt) instance.runStartedAt += elapsed;
  if (instance.adventureFinishedAt) instance.adventureFinishedAt += elapsed;
  if (instance.sceneStartedAt) instance.sceneStartedAt += elapsed;
  if (instance.bubbleGame) instance.bubbleGame.start += elapsed;
  if (instance.swallowUntil) instance.swallowUntil += elapsed;
  instance.motionOffset = (instance.motionOffset || 0) + elapsed;
  (instance.insects || []).forEach((insect) => {
    if (insect.userData.flee) insect.userData.flee.at += elapsed;
  });
  if (instance.blink) {
    if (instance.blink.next) instance.blink.next += elapsed;
    if (instance.blink.start) instance.blink.start += elapsed;
  }

  (instance.bursts || []).forEach((burst) => {
    if (burst.userData && burst.userData.start) burst.userData.start += elapsed;
  });
  (instance.rings || []).forEach((ring) => {
    if (ring.userData && ring.userData.start) ring.userData.start += elapsed;
  });

  const actor = instance.actor ? instance.actor() : null;
  if (actor && actor.userData.pop && actor.userData.pop.start) {
    actor.userData.pop.start += elapsed;
  }
}

module.exports = function enhance(page) {
  const originalOnUnload = page.onUnload;
  const originalOnHide = page.onHide;

  page.onHide = function () {
    this.stopAllSounds();
    this.saveCompanion();
    this.petStroke = null;
    if (this.returnWorld && this.returnWorld.active) this.returnWorld.cancelTouch();
    if (originalOnHide) originalOnHide.call(this);
    if (this.hiddenAt) return;
    this.hiddenAt = Date.now();
    this.stopLoop();

    // 手指还在屏幕上时被切走：蓄力状态不能带到后台，否则回来会一直蓄着
    if (this.data.isCharging) {
      this.clearCharge();
      this.setData({ isCharging: false, chargePercent: 0, chargeTone: "far", chargeHint: "长按蓄力" });
    }
    this.setData({ paused: true, isAiming: false });
  };

  page.onShow = function () {
    if(this.data.sessionPaused)return;
    const now = Date.now();
    if (this.hiddenAt) {
      shift(this, now - this.hiddenAt);
      this.hiddenAt = null;
    }
    this.lastTick = now;
    if (this.resetRenderQualityWindow) this.resetRenderQualityWindow(now, 2000);
    this.setData({ paused: false });
    if (this.data.threeReady && !this.unloaded) this.startLoop();
  };

  page.onUnload = function () {
    if (originalOnUnload) originalOnUnload.call(this);
    this.hiddenAt = null;
  };
};
