/**
 * 程序化美术工厂。
 *
 * 只依赖 THREE，不持有页面状态：index.js 在拿到 THREE 之后调用一次
 * createArt(THREE)，之后所有角色/道具/场景装饰都从这里生成。
 *
 * 两条贯穿全模块的规则：
 * 1. 每个几何体在创建时都烘焙一层顶点色（假 AO），材质统一开 vertexColors。
 *    这样不用任何贴图就能把"塑料平涂"变成有体积感的软陶质感。
 * 2. 静态装饰（芦苇/荷花/石头）用 mergeParts 合批成一个 draw call，
 *    角色这类会动的才保留独立 mesh。
 */

// Three.js r108：BufferGeometry.setAttribute 是 r110 才加的别名，这里兼容两种。
function attr(geometry, name, attribute) {
  if (geometry.setAttribute) geometry.setAttribute(name, attribute);
  else geometry.addAttribute(name, attribute);
}

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shadeColor(hex, amount) {
  const r = Math.round(((hex >> 16) & 255) * amount);
  const g = Math.round(((hex >> 8) & 255) * amount);
  const b = Math.round((hex & 255) * amount);
  return (clamp(r, 0, 255) << 16) | (clamp(g, 0, 255) << 8) | clamp(b, 0, 255);
}

module.exports = function createArt(THREE, options) {
  const T = THREE;

  /**
   * r108 的 SphereGeometry 还是旧的 Geometry 类（用 vertices/faces），没有 attributes；
   * 必须显式取 *BufferGeometry 版本。r125 之后两者合并，*BufferGeometry 被移除，
   * 所以这里两边都探测一次，换 three 版本也不会炸。
   */
  const Geo = {};
  ["Sphere", "Cylinder", "Torus", "Ring", "Circle", "Cone", "Box", "Plane",
    "Extrude", "Tube", "Dodecahedron", "Lathe", "Shape"].forEach((name) => {
    Geo[name] = T[name + "BufferGeometry"] || T[name];
  });
  const wildlife = require('./wildlife')(T, { Geo, part, connect, measure, addCostume, mergeParts }, options);

  // ---------------------------------------------------------------- 顶点着色

  /**
   * 按局部坐标的 Y 轴烘焙明暗：底暗顶亮，模拟天光遮蔽。
   * 每个部件单独着色，所以球体自己会形成"上亮下暗"的体积感。
   */
  function shadeGeometry(geometry, low, high) {
    const lo = low === undefined ? 0.66 : low;
    const hi = high === undefined ? 1.0 : high;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const span = Math.max(1e-4, box.max.y - box.min.y);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i += 1) {
      let t = (position.getY(i) - box.min.y) / span;
      t = t * t * (3 - 2 * t);
      const k = lo + (hi - lo) * t;
      colors[i * 3] = k;
      colors[i * 3 + 1] = k;
      colors[i * 3 + 2] = k;
    }
    attr(geometry, "color", new T.Float32BufferAttribute(colors, 3));
    return geometry;
  }

  /** 荷叶专用：按到叶心的距离着色，越靠边越暗，突出卷边的厚度。 */
  function shadeRadial(geometry, maxRadius, low, high) {
    const lo = low === undefined ? 0.78 : low;
    const hi = high === undefined ? 1.04 : high;
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const span = Math.max(1e-4, maxRadius);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const t = clamp(Math.sqrt(x * x + y * y) / span, 0, 1);
      const k = hi + (lo - hi) * t * t;
      colors[i * 3] = k;
      colors[i * 3 + 1] = k;
      colors[i * 3 + 2] = k;
    }
    attr(geometry, "color", new T.Float32BufferAttribute(colors, 3));
    return geometry;
  }

  // ---------------------------------------------------------------- 几何合批

  /**
   * 把一批 {geometry, p, r, s} 合成一个 BufferGeometry，减少 draw call。
   * shade(x, y, z) 按合成后的世界坐标着色，让整簇植物从根到梢有统一渐变。
   */
  function mergeParts(parts, shade) {
    let vertexCount = 0;
    let indexCount = 0;
    const hasNormals = parts.every(item => item.geometry.attributes.normal);
    parts.forEach(item => {
      const geometry = item.geometry;
      vertexCount += geometry.attributes.position.count;
      indexCount += geometry.index ? geometry.index.count : geometry.attributes.position.count;
    });
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const colors = new Float32Array(vertexCount * 3);
    const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
    let vertexOffset = 0;
    let indexOffset = 0;
    const matrix = new T.Matrix4();
    const normalMatrix = new T.Matrix3();
    const euler = new T.Euler();
    const scale = new T.Vector3();
    const offset = new T.Vector3();
    const point = new T.Vector3();

    parts.forEach((item) => {
      const geometry = item.geometry;
      euler.set(
        item.r ? item.r[0] : 0,
        item.r ? item.r[1] : 0,
        item.r ? item.r[2] : 0
      );
      scale.set(
        item.s ? item.s[0] : 1,
        item.s ? item.s[1] : 1,
        item.s ? item.s[2] : 1
      );
      offset.set(
        item.p ? item.p[0] : 0,
        item.p ? item.p[1] : 0,
        item.p ? item.p[2] : 0
      );
      matrix.makeRotationFromEuler(euler);
      matrix.scale(scale);
      matrix.setPosition(offset);
      normalMatrix.getNormalMatrix(matrix);

      const position = geometry.attributes.position;
      const normal = geometry.attributes.normal;
      for (let i = 0; i < position.count; i += 1) {
        const offset = (vertexOffset + i) * 3;
        point.set(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(matrix);
        positions[offset] = point.x;
        positions[offset + 1] = point.y;
        positions[offset + 2] = point.z;
        const k = shade ? shade(point.x, point.y, point.z) : 1;
        colors[offset] = colors[offset + 1] = colors[offset + 2] = k;
        if (normal) {
          point.set(normal.getX(i), normal.getY(i), normal.getZ(i)).applyMatrix3(normalMatrix).normalize();
          normals[offset] = point.x;
          normals[offset + 1] = point.y;
          normals[offset + 2] = point.z;
        }
      }
      const count = geometry.index ? geometry.index.count : position.count;
      for (let i = 0; i < count; i += 1) {
        indices[indexOffset + i] = vertexOffset + (geometry.index ? geometry.index.getX(i) : i);
      }
      vertexOffset += position.count;
      indexOffset += count;
    });

    const merged = new T.BufferGeometry();
    attr(merged, "position", new T.BufferAttribute(positions, 3));
    if (hasNormals) attr(merged, "normal", new T.BufferAttribute(normals, 3));
    attr(merged, "color", new T.BufferAttribute(colors, 3));
    merged.setIndex(new T.BufferAttribute(indices, 1));
    if (!hasNormals) merged.computeVertexNormals();
    merged.computeBoundingSphere();
    return merged;
  }

  // ---------------------------------------------------------------- 材质

  function materials() {
    const standard = (color, roughness, extra) => new T.MeshStandardMaterial(Object.assign({
      color: new T.Color(color).convertSRGBToLinear(),
      roughness,
      metalness: 0,
      vertexColors: true
    }, extra || {}));

    return Object.assign({
      // 水面：半透明 + 高光，颜色偏青，靠 shader 做位移（见 index.js）
      water: new T.MeshPhysicalMaterial({
        color: new T.Color(0x285d45).convertSRGBToLinear(),
        roughness: 0.08,
        metalness: 0.02,
        clearcoat: 0.9,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.74,
        depthWrite: false
      }),
      deepWater: new T.MeshStandardMaterial({ color: new T.Color(0x31432c).convertSRGBToLinear(), roughness: 0.85, metalness: 0 }),
      pondBed: standard(0x366447,.98,{side:T.DoubleSide}),
      submerged: standard(0x3f7952,.85,{side:T.DoubleSide}),
      // 荷叶：叶面亮、叶缘和叶背暗
      leaf: standard(0x477c32, 0.38),
      leafUnder: standard(0x354f23, 0.62),
      stem: standard(0x2f7a45, 0.72),
      petal: standard(0xf6b3cd, 0.42),
      petalCore: standard(0xf7cf4b, 0.34, { metalness: 0.24 }),
      reed: standard(0x3f8a4d, 0.7, {side:T.DoubleSide}),
      cattail: standard(0x7a5330, 0.78),
      stone: standard(0x69705c, 0.95),
      // 角色
      white: standard(0xf8fffa, 0.34),
      black: standard(0x141d18, 0.42),
      pet: standard(0x33463b, 0.55),
      cheek: standard(0xb27361, 0.55),
      mouth: standard(0x672e29, 0.4),
      tongue: standard(0xe4485c, 0.34, {vertexColors:false}),
      cream: standard(0xeaf4c6, 0.5),
      gold: standard(0xf7c948, 0.3, { metalness: 0.3 }),
      // 描边：反面渲染的深色外壳
      outline: new T.MeshBasicMaterial({ color: 0x2a4a3d, side: T.BackSide })
    }, wildlife.materials());
  }

  // ---------------------------------------------------------------- 基础装配

  function part(parent, geometry, material, options) {
    const opts = options || {};
    shadeGeometry(geometry, opts.low, opts.high);
    const mesh = new T.Mesh(geometry, material);
    if (opts.p) mesh.position.set(opts.p[0], opts.p[1], opts.p[2]);
    if (opts.s) mesh.scale.set(opts.s[0], opts.s[1], opts.s[2]);
    if (opts.r) mesh.rotation.set(opts.r[0], opts.r[1], opts.r[2]);
    mesh.castShadow = opts.cast !== false;
    mesh.receiveShadow = Boolean(opts.receive);
    parent.add(mesh);
    return mesh;
  }

  /** 两点之间连一根圆柱，用于四肢。 */
  function connect(parent, from, to, radiusNear, radiusFar, material, low) {
    const direction = new T.Vector3().subVectors(to, from);
    const length = direction.length();
    const geometry = new Geo.Cylinder(radiusFar, radiusNear, length, 10, 1, false);
    const mesh = part(parent, geometry, material, { low });
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  /** 给部件套一层放大后的反面外壳，形成卡通描边。 */
  function outlineOf(mesh, mats, scale) {
    const shell = new T.Mesh(mesh.geometry, mats.outline);
    shell.scale.setScalar(scale || 1.05);
    shell.castShadow = false;
    mesh.add(shell);
    return shell;
  }

  /**
   * 椭球表面求值：给定头部椭球的局部 x/y，返回正面的 z。
   * 五官一律贴在解算出来的表面上，避免"贴片浮在球外"或"陷进球里"。
   */
  function surfaceZ(localX, localY, semiX, semiY, semiZ) {
    const nx = localX / semiX;
    const ny = localY / semiY;
    const k = 1 - nx * nx - ny * ny;
    if (k <= 0) return 0;
    return semiZ * Math.sqrt(k);
  }

  /**
   * 量一次模型的实际包围盒，并把视觉重心对到原点。
   *
   * 为什么要居中：蝌蚪的尾巴拖在身后，如果按建模坐标摆放，它会明显偏到画面一侧，
   * 取景再准也是歪的。把子节点整体平移一次，之后所有定位/旋转都绕着视觉中心转。
   * 取景公式也要用这里的尺寸 —— 竖屏的水平视场只有垂直的 0.46 倍。
   */
  function measure(group, scale) {
    const k = scale || 1;
    group.updateMatrixWorld(true);
    let box = new T.Box3().setFromObject(group);

    const cx = (box.min.x + box.max.x) / 2 / k;
    const cz = (box.min.z + box.max.z) / 2 / k;
    if (Math.abs(cx) > 0.01 || Math.abs(cz) > 0.01) {
      group.children.forEach((child) => {
        child.position.x -= cx;
        child.position.z -= cz;
      });
      group.updateMatrixWorld(true);
      box = new T.Box3().setFromObject(group);
    }

    group.userData.sizeW = (box.max.x - box.min.x) / k;
    group.userData.sizeH = (box.max.y - box.min.y) / k;
    group.userData.sizeD = (box.max.z - box.min.z) / k;
    group.userData.lift = box.min.y / k;
    return group;
  }

  // ---------------------------------------------------------------- 天空

  function makeSky(horizonColor, zenithColor, radius) {
    const r = radius || 70;
    const geometry = new Geo.Sphere(r, 24, 16);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const horizon = new T.Color(horizonColor).convertSRGBToLinear();
    const zenith = new T.Color(zenithColor).convertSRGBToLinear();
    const mixed = new T.Color();
    for (let i = 0; i < position.count; i += 1) {
      const t = clamp(position.getY(i) / r * 1.7 + 0.12, 0, 1);
      mixed.copy(horizon).lerp(zenith, t * t);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }
    attr(geometry, "color", new T.Float32BufferAttribute(colors, 3));
    const material = new T.MeshBasicMaterial({
      vertexColors: true,
      side: T.BackSide,
      fog: false,
      depthWrite: false
    });
    const sky = new T.Mesh(geometry, material);
    sky.renderOrder = -10;
    return sky;
  }

  // ---------------------------------------------------------------- 荷叶

  function makeLeaf(mats, scale) {
    const g = scale || 1;
    const group = new T.Group();
    const radius = 1.1 * g;
    const shape = new T.Shape();
    shape.moveTo(0.10 * g, 0);
    const steps = 60;
    for (let i = 0; i <= steps; i += 1) {
      const a = 0.20 + (i / steps) * (TAU - 0.40);
      shape.lineTo(Math.cos(a) * radius, Math.sin(a) * 0.74 * g);
    }
    shape.lineTo(0.10 * g, 0);

    const geometry = new Geo.Extrude(shape, {
      depth: 0.05 * g,
      bevelEnabled: true,
      bevelThickness: 0.018 * g,
      bevelSize: 0.028 * g,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 4
    });

    // 卷边：离叶心越远，叶面抬得越高，边缘因此能接住光。
    const position = geometry.attributes.position;
    const maxRadius = radius * 1.05;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const d = clamp(Math.sqrt(x * x + y * y) / maxRadius, 0, 1);
      position.setZ(i, position.getZ(i) + 0.19 * g * d * d * d);
    }
    geometry.computeVertexNormals();
    shadeRadial(geometry, maxRadius);

    // ExtrudeGeometry 自带两组材质索引：0 = 上下叶面，1 = 叶缘
    const leaf = new T.Mesh(geometry, [mats.leaf, mats.leafUnder]);
    leaf.rotation.x = -Math.PI / 2;
    leaf.castShadow = true;
    leaf.receiveShadow = true;
    group.add(leaf);

    // 叶脉：跟着卷边的曲面走，避免"悬空的直线"。
    const points = [];
    for (let v = 0; v < 9; v += 1) {
      const a = 0.42 + (v / 9) * TAU;
      let prev = null;
      for (let s = 0.16; s <= 0.96; s += 0.16) {
        const d = s;
        const z = 0.052 * g + 0.19 * g * d * d * d + 0.004;
        const current = new T.Vector3(Math.cos(a) * d * radius, Math.sin(a) * d * 0.74 * g, z);
        if (prev) points.push(prev, current);
        prev = current;
      }
    }
    const veinGeometry = new T.BufferGeometry().setFromPoints(points);
    const veins = new T.LineSegments(veinGeometry, new T.LineBasicMaterial({
      color: 0xd8f2a4,
      transparent: true,
      opacity: 0.5
    }));
    group.add(veins);

    group.userData.rx = radius;
    group.userData.rz = 0.74 * g;
    group.userData.kind = "leaf";
    return group;
  }

  // Character construction lives in wildlife.js; costume definitions stay local.

  // ---------------------------------------------------------------- 服饰

  function addCostume(root, costume, mats, accent, dark) {
    const headTop = 1.33;
    const wrap = (radiusTop, radiusBottom, height, y, z, start, length) => {
      const geometry = new Geo.Cylinder(radiusTop, radiusBottom, height, 20, 1, true, start, length);
      return part(root, geometry, accent, { p: [0, y, z || 0], low: 0.62, high: 1.05 });
    };

    if (["king", "queen", "empress"].includes(costume)) {
      const crown = new T.Group();
      crown.position.set(0, headTop, -0.03);
      root.add(crown);
      part(crown, new Geo.Torus(0.22, 0.022, 8, 24), mats.gold, { r: [Math.PI / 2, 0, 0], low: 0.8 });
      for (let i = 0; i < 5; i += 1) {
        const angle = (i / 5) * TAU;
        part(crown, new Geo.Cone(0.055, i === 0 ? 0.24 : 0.17, 4), mats.gold, {
          p: [Math.cos(angle) * 0.21, 0.075, Math.sin(angle) * 0.21],
          low: 0.8
        });
      }
    }

    if (["king", "queen", "empress", "hero"].includes(costume)) {
      // 披风：一段开口圆筒贴着后背垂下来，双面可见
      const cape = wrap(0.52, 0.80, 0.86, 0.44, -0.02, Math.PI * 0.52, Math.PI * 0.96);
      const capeMaterial = accent.clone();
      capeMaterial.side = T.DoubleSide;
      cape.material = capeMaterial;
    }

    if (["general", "commander"].includes(costume)) {
      const armor = new T.MeshStandardMaterial({
        color: 0xc2ced6,
        roughness: 0.26,
        metalness: 0.42,
        vertexColors: true
      });
      wrap(0.54, 0.50, 0.34, 0.60, 0, 0, TAU).material = armor;
      [-1, 1].forEach((side) => {
        part(root, new Geo.Sphere(0.14, 14, 10), armor, {
          s: [1.1, 0.7, 1.1],
          p: [side * 0.46, 0.74, 0.06],
          low: 0.7
        });
      });
      part(root, new Geo.Cone(0.06, 0.44, 10), accent, { p: [0, headTop + 0.04, -0.05], low: 0.8 });
    }

    if (["ceo", "bosslady", "monk", "saint", "college"].includes(costume)) {
      const cloth = new T.MeshStandardMaterial({
        color: costume === "monk" || costume === "saint" ? 0xd8b263 : 0x27303c,
        roughness: 0.62,
        metalness: 0,
        vertexColors: true
      });
      wrap(0.53, 0.49, 0.40, 0.58, 0, 0, TAU).material = cloth;
      if (costume === "ceo" || costume === "bosslady") {
        part(root, new Geo.Cone(0.05, 0.24, 4), mats.tongue, { p: [0, 0.70, 0.40], low: 0.9 });
      }
      if (costume === "college") {
        part(root, new Geo.Sphere(0.30, 16, 12), cloth, {
          s: [1.1, 0.7, 0.9],
          p: [0, 0.72, -0.34],
          low: 0.62
        });
      }
    }

    if (costume === "princess" || costume === "sweetheart") {
      part(root, new Geo.Cylinder(0.32, 0.86, 0.62, 24, 1, true), accent, {
        p: [0, 0.28, 0],
        low: 0.6,
        high: 1.06
      });
    }

    if (costume === "it" || costume === "coder") {
      [-1, 1].forEach((side) => {
        part(root, new Geo.Torus(0.24, 0.014, 8, 32), dark, {
          p: [side * 0.45, 1.20, 0.63],
          low: 0.9,
          cast: false
        });
      });
      part(root, new Geo.Box(0.45, 0.014, 0.014), dark, { p: [0, 1.20, 0.65], cast: false });
    }

    if (costume === "hero" || costume === "swordswoman" || costume === "duke") {
      // 斗笠：帽檐收窄并抬到头顶之上，不然会把眼睛整个盖住
      part(root, new Geo.Cylinder(0.56, 0.56, 0.03, 28), accent, {
        p: [0, headTop + 0.03, -0.03],
        low: 0.72
      });
      part(root, new Geo.Cone(0.30, 0.26, 20), accent, {
        p: [0, headTop + 0.17, -0.03],
        low: 0.78
      });
      if (costume === "duke") {
        part(root, new Geo.Torus(0.20, 0.03, 8, 20), mats.gold, {
          r: [Math.PI / 2, 0.4, 0],
          p: [0, 0.62, 0],
          low: 0.8
        });
      }
    }

    if (costume === "artist") {
      part(root, new Geo.Sphere(0.32, 20, 12), accent, {
        s: [1.25, 0.30, 0.95],
        p: [-0.08, headTop + 0.01, -0.02],
        r: [0, 0, -0.18],
        low: 0.7
      });
    }
  }

  // ---------------------------------------------------------------- 昆虫

  function makeInsect(kind, mats) {
    const group = new T.Group();
    group.userData.kind = kind;
    const color = kind === "dragonfly" ? 0x6fe3f2 : kind === "butterfly" ? 0xff9ccb : 0xffd75e;
    const bodyMaterial = new T.MeshStandardMaterial({
      color,
      roughness: 0.36,
      metalness: 0.05,
      vertexColors: true,
      emissive: new T.Color(color),
      emissiveIntensity: 0.12
    });

    const body = part(group, new Geo.Sphere(0.10, 12, 10), bodyMaterial, {
      s: [kind === "dragonfly" ? 2.6 : 1.1, 0.62, 0.75],
      low: 0.78
    });

    const wingMaterial = new T.MeshBasicMaterial({
      color: 0xeaffff,
      transparent: true,
      opacity: 0.5,
      side: T.DoubleSide,
      depthWrite: false
    });
    const wings = [];
    [-1, 1].forEach((side) => {
      const pivot = new T.Group();
      pivot.position.set(0, 0.03, side * 0.04);
      group.add(pivot);
      const wing = new T.Mesh(
        new Geo.Circle(kind === "butterfly" ? 0.15 : 0.19, 14),
        wingMaterial
      );
      wing.scale.set(1, kind === "butterfly" ? 1.35 : 0.42, 1);
      wing.position.z = side * 0.14;
      wing.rotation.y = Math.PI / 2;
      pivot.add(wing);
      wings.push(pivot);
    });
    group.userData.wings = wings;
    group.userData.body = body;
    return group;
  }

  // ---------------------------------------------------------------- 场景装饰

  function makeStones(mats) {
    const parts = [];
    for (let i = 0; i < 14; i += 1) {
      const angle = (i / 14) * TAU + 0.2;
      const radius = 9.2 + (i % 3) * 0.3;
      parts.push({
        geometry: new Geo.Sphere(0.42 + (i % 3) * 0.12, 16, 10),
        p: [Math.cos(angle) * radius, -0.10, Math.sin(angle) * radius * 0.92],
        r: [i * 0.5, i * 0.8, 0],
        s: [1.1, 0.55, 1.0]
      });
    }
    return new T.Mesh(mergeParts(parts, (x, y) => 0.72 + clamp(y + 0.3, 0, 0.5)), mats.stone);
  }

  function makeReedBed(mats) {
    const parts = [];
    const stalks = [];
    const clusters = [
      { x: -4.8, z: -5.2, dir: -1 },
      { x: 4.5, z: -4.9, dir: 1 }
    ];
    clusters.forEach((cluster) => {
      for (let i = 0; i < 11; i += 1) {
        const x = cluster.x + cluster.dir * i * 0.24;
        const z = cluster.z + (i % 4) * 0.34;
        const height = 1.5 + (i % 5) * 0.26;
        const lean = cluster.dir * (0.12 + (i % 3) * 0.06);
        parts.push({
          geometry: new Geo.Cylinder(0.022, 0.045, height, 6),
          p: [x, height / 2 - 0.05, z],
          r: [0, 0, lean]
        });
        if (i % 3 === 0) {
          parts.push({
            geometry: new Geo.Cylinder(0.055, 0.075, 0.30, 8),
            p: [x + lean * 0.35, height + 0.10, z]
          });
        }
        for(let blade=0;blade<2;blade++){
          const geometry=new Geo.Plane(.10,.80,1,8),p=geometry.attributes.position;
          for(let j=0;j<p.count;j++){
            const t=(p.getY(j)+.40)/.80;
            p.setX(j,p.getX(j)*(1-t*.94)+t*t*.42);
            p.setY(j,p.getY(j)-t*t*.16);p.setZ(j,Math.sin(t*Math.PI)*.055);
          }
          geometry.computeVertexNormals();
          parts.push({geometry,p:[x,height*(.46+blade*.18),z],r:[0,i*2.399+blade*Math.PI,0]});
        }
        stalks.push({ x, z });
      }
    });
    const mesh = new T.Mesh(mergeParts(parts, (x, y, z) => 0.55 + clamp(y / 2.2, 0, 1) * 0.5), mats.reed);
    mesh.castShadow = true;
    return mesh;
  }

  function makeLotusCluster(mats, scale) {
    const s = scale || 1;
    const parts = [];
    for(let layer=0;layer<2;layer++)for(let i=0;i<(layer?7:9);i++){
      const count=layer?7:9,angle=i/count*TAU+layer*.30,radius=layer?.12:.22;
      const geometry=new Geo.Sphere(.20,14,10),p=geometry.attributes.position;
      for(let j=0;j<p.count;j++){
        const tip=Math.max(0,p.getZ(j)/.20);
        p.setX(j,p.getX(j)*(1-tip*.68));p.setY(j,p.getY(j)+tip*tip*(layer?.25:.15));
      }
      geometry.computeVertexNormals();
      parts.push({geometry,p:[Math.cos(angle)*radius,.12+layer*.07,Math.sin(angle)*radius],
        r:[0,Math.PI/2-angle,0],s:[.48*s,.42*s,(layer?.78:1.12)*s]});
    }
    const petalMesh = new T.Mesh(mergeParts(parts, (x, y) => 0.72 + clamp(y * 1.4, 0, 0.5)), mats.petal);
    petalMesh.castShadow = true;

    const group = new T.Group();
    group.add(petalMesh);
    part(group, new Geo.Sphere(0.10, 12, 8), mats.petalCore, {
      s: [1, 0.7, 1],
      p: [0, 0.16, 0],
      low: 0.85
    });
    const pad = new T.Mesh(
      new Geo.Cylinder(0.34 * s, 0.30 * s, 0.055, 20),
      mats.leaf
    );
    shadeGeometry(pad.geometry, 0.7, 1.0);
    pad.position.y = -0.03;
    pad.receiveShadow = true;
    group.add(pad);
    return group;
  }

  function makeUnderwater(mats) {
    const group=new T.Group();group.name='underwater-garden';
    const bed=new Geo.Ring(0,10.5,72,8),p=bed.attributes.position,colors=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),z=p.getY(i),depth=.45+.22*Math.sin(x*.6)*Math.cos(z*.7)+.20*Math.hypot(x,z)/10;
      colors.set([depth,depth*.94,depth*.75],i*3);
      p.setZ(i,Math.sin(x*.5)*Math.cos(z*.7)*.06);
    }
    attr(bed,'color',new T.BufferAttribute(colors,3));bed.computeVertexNormals();
    const floor=new T.Mesh(bed,mats.pondBed);floor.rotation.x=-Math.PI/2;floor.position.y=-.66;group.add(floor);
    const blades=[];
    for(let i=0;i<72;i++){
      const cluster=i%8,angle=i*2.399,height=.28+(i%7)*.045;
      const geometry=new Geo.Plane(.055+(i%3)*.018,height,1,7),position=geometry.attributes.position;
      for(let j=0;j<position.count;j++){
        const t=(position.getY(j)+height/2)/height;
        position.setX(j,position.getX(j)*(1-t*.88)+Math.sin(t*2.4+angle)*t*.10);
        position.setZ(j,Math.sin(t*2.2)*.06);
      }
      geometry.computeVertexNormals();
      const x=Math.sin(cluster*2.399)*(2.1+cluster*.57)+Math.cos(angle)*.30;
      const z=Math.cos(cluster*2.399)*(1.8+cluster*.51)+Math.sin(angle)*.30;
      blades.push({geometry,p:[x,-.66+height/2,z],r:[0,angle,0]});
    }
    const plants=new T.Mesh(mergeParts(blades,(x,y)=>.63+(y+.66)*.7),mats.submerged);plants.name='water-grasses';group.add(plants);
    blades.forEach(item=>item.geometry.dispose());return group;
  }

  return {
    materials,
    Geo,
    makeSky,
    makeLeaf,
    makeTadpole: wildlife.makeTadpole,
    makeFrog: wildlife.makeFrog,
    releaseObject: wildlife.releaseObject,
    dispose: wildlife.dispose,
    makeInsect,
    makeStones,
    makeReedBed,
    makeUnderwater,
    makeLotusCluster,
    mergeParts,
    shadeGeometry,
    shadeColor
  };
};
