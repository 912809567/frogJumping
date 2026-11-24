/**
 * 构图与预算检查（无需渲染器，用真实的投影矩阵算）。
 *
 * 这些断言对应最初诊断出的三个"元凶"：
 * 1. 角色占屏比 —— 之前只有 11%，模型再好也看不见；
 * 2. 雾对主体的影响 —— 之前主体被雾吃掉约 18%；
 * 3. 绘制对象/材质数量 —— 之前静态装饰每片花瓣一个材质。
 *
 * 同时用包围盒反查模型自身是否合理：声明高度要和实际高度一致，
 * 脚不能陷进水里，整体比例不能变成一根柱子。
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
const WIDTH = 390;
const HEIGHT = 844;

function loadPage() {
  let config = null;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "pages", "index", "index.js"), "utf8"), {
    require: (name) => {
      if (name === './adventure') return require('../pages/index/adventure');
      if (name === './shell') return require('../pages/index/shell');
      if (name === "./experience") return experience;
      if (name === "./art") return artFactory;
      if (name === "./returns") return require('../pages/index/returns');
      return { createScopedThreejs };
    },
    Page: (definition) => {
      config = definition;
    },
    console,
    Date,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });
  return config;
}

function makeGame() {
  const config = loadPage();
  const game = Object.assign({}, config, {
    data: Object.assign({}, config.data),
    THREE,
    setData(patch) {
      Object.assign(this.data, patch);
    }
  });
  game.width = WIDTH;
  game.height = HEIGHT;
  game.setupCamera(WIDTH, HEIGHT);
  game.createMaterials();
  game.buildScene();
  game.data.threeReady = true;
  game.data.phase = 'gender';
  game.showNurturePreview();
  return game;
}

/** 把物体包围盒的 8 个角投影到 NDC，得到真实的屏幕占比。 */
function projectBox(game, object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const corners = [];
  [box.min.x, box.max.x].forEach((x) => {
    [box.min.y, box.max.y].forEach((y) => {
      [box.min.z, box.max.z].forEach((z) => {
        corners.push(new THREE.Vector3(x, y, z));
      });
    });
  });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  corners.forEach((corner) => {
    const p = corner.clone().project(game.camera);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  return {
    box,
    minX,
    maxX,
    minY,
    maxY,
    screenHeight: (maxY - minY) / 2,   // NDC 高度 2 等于整屏
    screenWidth: (maxX - minX) / 2,
    center: box.getCenter(new THREE.Vector3()),
    size: box.getSize(new THREE.Vector3())
  };
}

function fogFactor(game, point) {
  const fog = game.scene.fog;
  if (!fog) return 0;
  const distance = game.camera.position.distanceTo(point);
  return Math.max(0, Math.min(1, (distance - fog.near) / (fog.far - fog.near)));
}

function countScene(scene) {
  let meshes = 0;
  let materials = new Set();
  scene.traverse((child) => {
    if (child.isMesh || child.isLine || child.isLineSegments) {
      meshes += 1;
      const list = Array.isArray(child.material) ? child.material : [child.material];
      list.forEach((material) => {
        if (material) materials.add(material.uuid);
      });
    }
  });
  return { meshes, materials: materials.size };
}

const rows = [];
function record(phase, game, object) {
  const projected = projectBox(game, object);
  rows.push({
    phase,
    fraction: projected.screenHeight,
    width: projected.screenWidth,
    fog: fogFactor(game, projected.center),
    dist: game.cam.dist,
    size: game.actorSize ? game.actorSize() : null,
    minY: projected.minY,
    maxY: projected.maxY,
    minX: projected.minX,
    maxX: projected.maxX
  });
  return projected;
}

// ------------------------------------------------------------------ 各阶段的取景

const game = makeGame();
game.cameraSnap();
const tadpolePreview = record("gender", game, game.petGroup);

game.chooseGender({ currentTarget: { dataset: { gender: "male" } } });
game.selectRoute({ currentTarget: { dataset: { id: "king" } } });
game.cameraSnap();
const frogRoute = record("route", game, game.frogGroup);

// 直接推进到成年青蛙，避免为了构图检查跑完整养成流程
game.confirmRoute();
game.data.canChallenge = true;
game.petStage = 2;
game.spawnPet(3);
game.cameraSnap();
const frogNurture = record("nurture", game, game.frogGroup);

game.setupJumpLevel();
game.cameraSnap();
const frogJump = record("levelJump", game, game.frogGroup);
const nextLeaf = projectBox(game, game.jumpLeaves[1]);

// 整关 20 跳都要过一遍：间距会变、左右侧偏会交替，不能只验第一跳
let worstOverlap = 0;
for (let i = 0; i < game.data.jumpGoal; i += 1) {
  game.data.jumps = i;
  game.cameraSnap();
  const frog = projectBox(game, game.frogGroup);
  const pad = projectBox(game, game.jumpLeaves[1]);
  const overlap = overlapArea(frog, pad);
  worstOverlap = Math.max(worstOverlap, overlap);
  assert(overlap < 0.06,
    "第 " + (i + 1) + " 跳青蛙挡住了 " + (overlap * 100).toFixed(0) + "% 的荷叶");
  assert(frog.minY > -1.02 && frog.maxY < 1.02 && frog.minX > -1.02 && frog.maxX < 1.02,
    "第 " + (i + 1) + " 跳青蛙出画");
  assert(pad.minY > -0.98 && pad.maxY < 0.98 && pad.minX > -0.98 && pad.maxX < 0.98,
    "第 " + (i + 1) + " 跳荷叶出画");
  if (i < game.data.jumpGoal - 1) {
    game.frogGroup.position.copy(game.jumpLeaves[1].position);
    game.removeObject(game.jumpLeaves[0]);
    game.jumpLeaves = [game.jumpLeaves[1], game.createNextGameLeaf(game.jumpLeaves[1], i + 1)];
  }
}

game.setupBugLevel();
game.cameraSnap();
const frogBug = record("levelBug", game, game.frogGroup);

// 捕虫关的每一只虫子都必须在画面内，否则玩家点不到
game.camera.updateMatrixWorld(true);
let offscreen = 0;
game.insects.forEach((insect) => {
  const projected = insect.position.clone().project(game.camera);
  if (Math.abs(projected.x) > 0.98 || Math.abs(projected.y) > 0.98) offscreen += 1;
});
assert.equal(offscreen, 0, "有 " + offscreen + " 只昆虫在画面外，点不到");

game.showFinal();
game.cameraSnap();
const frogFinal = record("final", game, game.frogGroup);

/** 两个屏幕包围盒的重叠面积占 b 的比例。用来量化"青蛙有没有挡住荷叶"。 */
function overlapArea(a, b) {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (w <= 0 || h <= 0) return 0;
  const area = (b.maxX - b.minX) * (b.maxY - b.minY);
  return Math.max(0, (w * h) / Math.max(1e-6, area));
}

// ------------------------------------------------------------------ 断言：看得见

console.log("阶段        占屏宽   占屏高   雾影响    NDC 左右 / 上下");
rows.forEach((row) => {
  console.log(
    "  " + row.phase.padEnd(10) +
    (row.width * 100).toFixed(1).padStart(6) + "%" +
    (row.fraction * 100).toFixed(1).padStart(7) + "%" +
    (row.fog * 100).toFixed(1).padStart(8) + "%" +
    "   x " + row.minX.toFixed(2) + ".." + row.maxX.toFixed(2) +
    "  y " + row.minY.toFixed(2) + ".." + row.maxY.toFixed(2) +
    "  d " + row.dist.toFixed(2) +
    (row.size ? "  w" + row.size.w.toFixed(2) + " h" + row.size.h.toFixed(2) + " d" + row.size.d.toFixed(2) : "")
  );
});
console.log("下一片荷叶 NDC x " + nextLeaf.minX.toFixed(2) + ".." + nextLeaf.maxX.toFixed(2) +
  " y " + nextLeaf.minY.toFixed(2) + ".." + nextLeaf.maxY.toFixed(2) +
  " 占屏高 " + (nextLeaf.screenHeight * 100).toFixed(1) + "%");

const MIN_FRACTION = 0.30;
rows.forEach((row) => {
  // 竖屏下"看起来够大"取决于较长的那个边：蝌蚪是横着的，看宽度才对
  const dominant = Math.max(row.fraction, row.width);
  assert(dominant >= MIN_FRACTION,
    row.phase + " 阶段角色最大边只占屏 " + (dominant * 100).toFixed(1) + "%，低于 " + (MIN_FRACTION * 100) + "%");
  assert(row.fog <= 0.08,
    row.phase + " 阶段角色被雾遮住 " + (row.fog * 100).toFixed(1) + "%，主体不该进雾区");
});

// 角色必须完整落在画面内，别被裁掉
rows.forEach((row) => {
  assert(row.minY > -1.02 && row.maxY < 1.02 && row.minX > -1.02 && row.maxX < 1.02,
    row.phase + " 阶段角色被画面裁切");
});

// 跳跃关：下一片荷叶必须同时可见，否则玩家没法判断距离
assert(nextLeaf.minY > -0.95 && nextLeaf.maxY < 0.98 && nextLeaf.minX > -0.98 && nextLeaf.maxX < 0.98,
  "跳跃关的下一片荷叶必须留在画面内");
assert(nextLeaf.screenHeight > 0.12, "下一片荷叶太小，玩家看不清落点");

// 青蛙不能挡住落点：这是玩家最直接的抱怨，必须用数字盯住
// 青蛙不能挡住落点：整关逐跳检查。
assert(worstOverlap < 0.06,
  "20 跳里最差一跳，青蛙挡住了 " + (worstOverlap * 100).toFixed(0) + "% 的荷叶，落点看不见");

// ------------------------------------------------------------------ 断言：模型本身

// 声明高度（取景依赖它）必须和实际包围盒一致
const frogBox = frogNurture.size;
const FROG_SCALE = 1.12;                 // spawnPet(3) 用的缩放
const frogModelH = frogBox.y / FROG_SCALE;
const frogModelW = frogBox.x / FROG_SCALE;
// 归一化到 scale=1 之后校验：模型崩坏（多一个巨大部件、少半个身子）会立刻在这里露出来
assert(frogModelH > 2.35 && frogModelH < 2.9,
  "皇家玩偶青蛙模型高度 " + frogModelH.toFixed(2) + " 超出合理范围");
assert(frogModelW > 2.0 && frogModelW < 2.6,
  "青蛙模型宽度 " + frogModelW.toFixed(2) + " 超出合理范围");

const TADPOLE_SCALE = 1.45;
const tadpoleBox = tadpolePreview.size;
assert(tadpoleBox.y / TADPOLE_SCALE > .30 && tadpoleBox.y / TADPOLE_SCALE < .55,
  "流线蝌蚪模型高度 " + (tadpoleBox.y / TADPOLE_SCALE).toFixed(2) + " 超出合理范围");

// 参考图是大头短身的立体玩偶，皇冠也必须计入身高。
assert(frogBox.x / frogBox.y > .75 && frogBox.x / frogBox.y < 1.10,
  "青蛙宽高比 " + (frogBox.x / frogBox.y).toFixed(2) + " 不符合参考图比例");
assert(frogBox.z / frogBox.y > .4 && frogBox.z / frogBox.y < .75,
  "青蛙纵深比 " + (frogBox.z / frogBox.y).toFixed(2) + " 不符合立体玩偶比例");

// 脚要踩在水面上，不能陷进水里也不能飘着
const frogMinY = frogNurture.box.min.y;
assert(frogMinY > -0.12 && frogMinY < 0.25,
  "青蛙最低点应当在水平面附近，实际 " + frogMinY.toFixed(2));

// 摄像头不能钻进角色里
assert(game.camera.position.distanceTo(frogNurture.center) > 2.0,
  "机位离角色太近，会穿模");

// ------------------------------------------------------------------ 断言：没有部件被身体吃掉

/**
 * 建模时最容易犯、又最难被截图发现的错误：某个配件其实埋在身体里。
 * 做法是把身体/头/下颌看成三个椭球，逐个网格检查顶点——
 * 只要有一个顶点落在三个椭球之外，它就还有可见面积；全在内部就是完全不可见。
 */
function checkNothingBuried(root, label) {
  root.updateMatrixWorld(true);
  const body = root.getObjectByName("body");
  assert(body && body.geometry.attributes.position, label + " 缺少连贯的身体网格");
  const ray = new THREE.Raycaster();
  const direction = new THREE.Vector3(1, .371, .237).normalize();
  const point = new THREE.Vector3(), buried = [];
  const side = body.material.side;
  body.material.side = THREE.DoubleSide;
  root.traverse((child) => {
    if (!child.isMesh || child === body || !child.geometry.attributes.position) return;
    const positions = child.geometry.attributes.position;
    const step = Math.max(1, Math.floor(positions.count / 48));
    let visible = false;
    for (let i = 0; i < positions.count && !visible; i += step) {
      point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
      ray.set(point, direction);
      const distances = ray.intersectObject(body).map(hit => hit.distance).filter(d => d > .0001);
      const unique = distances.filter((d, j) => j === 0 || Math.abs(d - distances[j - 1]) > .0001);
      if (unique.length % 2 === 0) visible = true;
    }
    if (!visible) buried.push((child.name || child.geometry.type) + " @ " + child.position.toArray().map(n=>n.toFixed(3)).join(","));
  });
  body.material.side = side;
  assert.equal(buried.length, 0, label + " 有完全埋进体内的部件：" + buried.join("、"));
}

checkNothingBuried(frogRoute_king(), "国王造型");
const sculptHead=frogRoute_king().getObjectByName('head');
assert(sculptHead.geometry.index.array instanceof Uint16Array,'雕塑头部必须使用真机兼容的 16 位索引');
assert(sculptHead.geometry.attributes.position.count>17000&&sculptHead.geometry.attributes.position.count<20000,
  '雕塑头部应当保留曲面细节，同时避免超出网格预算');
assert.equal(sculptHead.geometry.groups.length,2,'头部需要同时保留皮肤和真实嘴腔');
frogRoute_king().traverse(child => {
  if (!child.geometry || !child.geometry.attributes.position) return;
  const attributes = child.geometry.attributes;
  assert.equal(attributes.normal.count, attributes.position.count, '封口后法线数量必须与顶点数一致');
  assert(Array.from(attributes.normal.array).every(Number.isFinite), '角色不能带有无效法线或黑色破洞');
});

function frogRoute_king() {
  // 用带皇冠的造型，覆盖最容易"陷进头里"的一类配件
  const probe = makeGame();
  probe.chooseGender({ currentTarget: { dataset: { gender: "male" } } });
  probe.selectRoute({ currentTarget: { dataset: { id: "king" } } });
  return probe.frogGroup;
}

// ------------------------------------------------------------------ 断言：预算

const sceneCount = countScene(game.scene);
assert(sceneCount.meshes <= 200, "绘制对象超标：" + sceneCount.meshes);
assert(sceneCount.materials <= 48, "材质数量超标：" + sceneCount.materials + "，静态装饰必须共用材质");

// 青蛙自身不能成为 draw call 黑洞
const frogCount = countScene(game.frogGroup);
assert(frogCount.meshes <= 72, "青蛙单体部件过多：" + frogCount.meshes);

// 材质共享：两只青蛙之间不应重复持有同一批场景材质
assert(game.sharedMaterials && game.sharedMaterials.size >= 15, "共享材质池应当被建立起来");

// 颜色管线：ACES 可用时应当已经挂上（只在有渲染器时生效，这里只校验常量存在）
assert(THREE.ACESFilmicToneMapping !== undefined, "当前 three 版本应当支持 ACES 色调映射");

const overlapNow = overlapArea(frogJump, nextLeaf);
console.log("青蛙包围盒 " + frogBox.x.toFixed(2) + " x " + frogBox.y.toFixed(2) + " x " + frogBox.z.toFixed(2) +
  "（归一化 " + frogModelW.toFixed(2) + " x " + frogModelH.toFixed(2) + "）");
console.log("跳跃关：青蛙占屏宽 " + (frogJump.screenWidth * 100).toFixed(0) +
  "%，荷叶 " + (nextLeaf.screenWidth * 100).toFixed(0) +
  "%，遮挡 " + (overlapNow * 100).toFixed(0) + "%（20 跳最差 " + (worstOverlap * 100).toFixed(0) + "%）");
console.log("绘制对象 " + sceneCount.meshes + "，材质 " + sceneCount.materials + "，青蛙部件 " + frogCount.meshes);

console.log("PASS: 取景占比 / 雾影响 / 画面裁切 / 模型比例 / 绘制预算 全部达标");
