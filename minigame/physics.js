// 弹弓返程用的 Cannon.js 放在 physics 分包里（见 game.json），首包不再包含物理引擎。
// 分包入口 physics/game.js 执行后会把引擎挂到 GameGlobal.CANNON。
function createPhysicsLoader(api, host) {
  let loading = false, waiting = [];
  const engine = () => (host && host.CANNON) || null;
  function finish(error) {
    loading = false;
    const list = waiting; waiting = [];
    list.forEach(callback => callback(error || null));
  }
  // 已就绪时返回 true 且不调用 callback；否则排队，下载完成（或失败）后调用 callback(error)。
  function load(callback) {
    if (engine()) return true;
    if (callback) waiting.push(callback);
    if (loading) return false;
    if (!api.loadSubpackage) { finish(Error('loadSubpackage is unavailable')); return false; }
    loading = true;
    try {
      api.loadSubpackage({
        name: 'physics',
        success: () => finish(engine() ? null : Error('physics subpackage did not register CANNON')),
        fail: error => finish(error || Error('physics subpackage failed to load'))
      });
    } catch (error) { finish(error); }
    return false;
  }
  return { engine, load, ready: () => !!engine() };
}
module.exports = { createPhysicsLoader };
