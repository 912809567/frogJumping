// Organic silhouettes and small-scale skin detail shared by every character.
module.exports = function wildlife(T, helpers, options) {
  const { Geo, part, connect, measure, addCostume, mergeParts } = helpers;
  const royal = require('./royal')(T, helpers, options);
  const TAU = Math.PI * 2;

  function skinTexture(tadpole) {
    const size = 256, pixels = new Uint8Array(size * size * 4);
    const noise = (x, y) => {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const grain = noise(x, y);
      const cellX = Math.floor(x / 23), cellY = Math.floor(y / 19);
      let mottling = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = cellX + dx, b = cellY + dy;
        const cx = a * 23 + noise(a, b) * 23, cy = b * 19 + noise(b, a) * 19;
        const radius = 3 + noise(a + 7, b + 11) * 7;
        const d = Math.hypot((x - cx) * .85, y - cy) / radius;
        mottling = Math.max(mottling, Math.max(0, Math.min(1, (1 - d) * 3)));
      }
      const stripe = Math.pow(Math.max(0, Math.cos(u * TAU * 3 + Math.sin(v * 19) * .12)), 20);
      const light = 1 - mottling * .52 + (grain - .5) * .16 + stripe * .13;
      const base = tadpole ? [71, 74, 42] : [113, 137, 60];
      const i = (y * size + x) * 4;
      pixels[i] = base[0] * light; pixels[i + 1] = base[1] * light;
      pixels[i + 2] = base[2] * light; pixels[i + 3] = 255;
    }
    const texture = new T.DataTexture(pixels, size, size, T.RGBAFormat);
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.magFilter = T.LinearFilter; texture.minFilter = T.LinearMipmapLinearFilter;
    texture.generateMipmaps = true; texture.needsUpdate = true;
    if (T.sRGBEncoding !== undefined) texture.encoding = T.sRGBEncoding;
    return texture;
  }

  function materials() {
    const frog = skinTexture(false), tadpole = skinTexture(true);
    const skin = new T.MeshPhysicalMaterial({ color:0xffffff,map:frog,bumpMap:frog,bumpScale:.010,
      roughness:.45,metalness:0,clearcoat:.28,clearcoatRoughness:.32,vertexColors:true });
    const body = skin.clone();
    body.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 bodyPoint;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbodyPoint = position;');
      shader.fragmentShader = 'varying vec3 bodyPoint;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat belly = 1.0-smoothstep(0.17,0.31,bodyPoint.y);\ndiffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.55,0.50,0.32),belly);');
    };
    return Object.assign({
      frogSkin: skin,
      frogBody: body,
      tadpoleSkin: new T.MeshPhysicalMaterial({ color: 0xffffff, map: tadpole, bumpMap: tadpole, bumpScale: .005,
        roughness: .30, clearcoat: .65, metalness: 0, vertexColors: true }),
      tailFin: new T.MeshStandardMaterial({ color: 0x9caa78, transparent: true, opacity: .38,
        roughness: .4, side: T.DoubleSide, depthWrite: false }),
      frogIris: new T.MeshPhysicalMaterial({ color: 0xb89542, map: frog, roughness: .12,
        clearcoat: 1, metalness: .12, vertexColors: true }),
      frogBelly: new T.MeshStandardMaterial({ color: 0xd2c998, roughness: .65, vertexColors: true }),
      wetBlack: new T.MeshPhysicalMaterial({ color: 0x090e08, roughness: .05, clearcoat: 1, metalness: 0 })
    }, royal.materials());
  }

  function flesh(points, radii) {
    const curve = new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p)));
    const steps = 18, sides = 10;
    const geometry = new Geo.Tube(curve, steps, 1, sides, false);
    const pos = geometry.attributes.position;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, center = curve.getPointAt(t);
      const f = t * (radii.length - 1), left = Math.floor(f), mix = f - left;
      const radius = radii[left] * (1 - mix) + radii[Math.min(left + 1, radii.length - 1)] * mix;
      for (let j = 0; j <= sides; j++) {
        const n = i * (sides + 1) + j;
        pos.setXYZ(n, center.x + (pos.getX(n) - center.x) * radius,
          center.y + (pos.getY(n) - center.y) * radius, center.z + (pos.getZ(n) - center.z) * radius);
      }
    }
    const oldPositions = geometry.attributes.position.array, oldUv = geometry.attributes.uv.array;
    const closedPositions = new Float32Array(oldPositions.length + 6), closedUv = new Float32Array(oldUv.length + 4);
    closedPositions.set(oldPositions); closedUv.set(oldUv);
    const indices = Array.from(geometry.index.array), count = oldPositions.length / 3;
    [0, 1].forEach((end) => {
      const center = curve.getPointAt(end), outgoing = curve.getTangentAt(end).multiplyScalar(end ? 1 : -1);
      closedPositions.set(center.toArray(), (count + end) * 3);
      closedUv.set([.5,.5], (count + end) * 2);
      const base = end ? steps * (sides + 1) : 0;
      for (let j = 0; j < sides; j++) {
        const a = new T.Vector3().fromArray(closedPositions, (base + j) * 3).sub(center);
        const b = new T.Vector3().fromArray(closedPositions, (base + j + 1) * 3).sub(center);
        if (a.cross(b).dot(outgoing) > 0) indices.push(count + end, base + j, base + j + 1);
        else indices.push(count + end, base + j + 1, base + j);
      }
    });
    (geometry.setAttribute||geometry.addAttribute).call(geometry,'position',new T.Float32BufferAttribute(closedPositions,3));
    (geometry.setAttribute||geometry.addAttribute).call(geometry,'uv',new T.Float32BufferAttribute(closedUv,2));
    geometry.setIndex(indices);delete geometry.attributes.normal;geometry.computeVertexNormals(); return geometry;
  }

  function torso() {
    const profiles = [
      [-.77,.035,.28,.03],[-.64,.26,.29,.15],[-.44,.40,.33,.23],[-.20,.43,.36,.25],
      [.02,.48,.40,.24],[.20,.58,.43,.24],[.40,.60,.43,.22],[.58,.48,.40,.17],[.71,.24,.37,.08],[.75,.025,.35,.025]
    ];
    const positions = [], uvs = [], indices = [], rows = 44, sides = 48;
    const sample = new T.CatmullRomCurve3(profiles.map(p => new T.Vector3(p[0], p[1], p[2])));
    for (let i = 0; i <= rows; i++) {
      const f = i / rows * (profiles.length - 1), j = Math.min(profiles.length - 2, Math.floor(f)), mix = f - j;
      const p = sample.getPoint(i / rows);
      const height = profiles[j][3] * (1 - mix) + profiles[j + 1][3] * mix;
      for (let k = 0; k <= sides; k++) {
        const a = k / sides * TAU;
        positions.push(Math.sin(a) * p.y, p.z + Math.cos(a) * height, p.x);
        uvs.push(k / sides, i / rows);
        if (i < rows && k < sides) {
          const n = i * (sides + 1) + k;
          indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);
        }
      }
    }
    const geometry = new T.BufferGeometry();
    const set = (name, array, width) => (geometry.setAttribute || geometry.addAttribute).call(geometry, name, new T.Float32BufferAttribute(array, width));
    set('position', positions, 3); set('uv', uvs, 2); geometry.setIndex(indices);
    geometry.computeVertexNormals(); return geometry;
  }

  function leg(root, side, hind, skin) {
    const pivot = new T.Group();
    pivot.position.set(side * (hind ? .38 : .40), hind ? .30 : .38, hind ? -.38 : .27);
    root.add(pivot);
    const parts = [];
    if (hind) {
      parts.push({ geometry: flesh([[0,0,0],[side*.24,.18,.02],[side*.30,.09,.25]], [.17,.205,.12]) });
      parts.push({ geometry: flesh([[side*.30,.09,.25],[side*.31,-.08,-.08],[side*.18,-.21,-.26]], [.105,.07,.043]) });
      parts.push({ geometry: new Geo.Sphere(.13,16,12), p:[side*.30,.09,.25] });
      parts.push({ geometry: flesh([[side*.18,-.21,-.26],[side*.30,-.24,-.02],[side*.36,-.25,.15]], [.047,.052,.03]) });
    } else {
      parts.push({ geometry: flesh([[0,0,0],[side*.13,-.15,-.06],[side*.15,-.29,.17],[side*.15,-.30,.28]], [.065,.057,.044,.03]) });
    }
    const hand = hind ? [side*.36,-.25,.15] : [side*.15,-.30,.28];
    const fingers = hind ? 5 : 4;
    for (let i = 0; i < fingers; i++) {
      const spread = (i - (fingers - 1) / 2) * .38;
      const length = (hind ? .24 : .17) * (1 - Math.abs(spread) * .22);
      const tip = [hand[0] + Math.sin(spread) * length, hand[1] - .014, hand[2] + Math.cos(spread) * length];
      parts.push({ geometry: flesh([hand,[(hand[0]+tip[0])/2,hand[1]-.015,(hand[2]+tip[2])/2],tip], [.018,.014,.008]) });
    }
    const geometry = mergeParts(parts, (x,y) => .78 + Math.max(0, y + .3) * .22);
    parts.forEach(p => p.geometry.dispose());
    part(pivot, geometry, skin, { low: .78 });
    return pivot;
  }

  function makeFrog(route, scale, mats) {
    const root = new T.Group(), s = scale || 1;
    root.scale.setScalar(s); root.userData.baseScale = s; root.userData.route = route;
    const skin = mats.frogSkin;
    root.userData.skin = skin;
    const body = part(root, torso(), mats.frogBody, { low: .82 }); body.name = 'body';
    const throat = part(root, new Geo.Sphere(.23, 24, 16), mats.frogBelly,
      { p:[0,.28,.47], s:[1.4,.45,.85], low:.85 });
    root.userData.throat = throat;
    const eyes = [], lids = [];
    [-1,1].forEach(side => {
      part(root, new Geo.Sphere(.15, 24, 16), skin, { p:[side*.36,.59,.29], s:[1,.85,1.1], low:.85 });
      const eye = part(root, new Geo.Sphere(.108, 24, 16), mats.frogIris,
        { p:[side*.365,.62,.405], s:[1,.93,.72], cast:false, low:.95 });
      eyes.push(eye);
      part(root, new Geo.Sphere(.065, 20, 12), mats.wetBlack,
        { p:[side*.365,.62,.478], s:[1.05,.38,.28], cast:false });
      part(root, new Geo.Sphere(.012, 10, 8), mats.white,
        { p:[side*.365-.027,.651,.489], cast:false, low:1 });
      const lid = new T.Group(); lid.position.set(side*.365,.62,.405); root.add(lid);
      part(lid, new Geo.Sphere(.113, 20, 12, 0, TAU, 0, Math.PI*.32), skin, { low:.9, cast:false });
      lids.push(lid);
      part(root, new Geo.Sphere(.009, 8, 6), mats.wetBlack, { p:[side*.085,.489,.665], s:[1,.5,1], cast:false });
      if (s > .6) part(root, new Geo.Sphere(.04, 12, 8), mats.cheek,
        { p:[side*.47,.397,.58], s:[1,.5,.15], low:.65, cast:false });
    });
    root.userData.eyes = eyes; root.userData.eyelids = lids;
    const smile = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24 * 2 - 1;
      smile.push(new T.Vector3(u*.5,.334+.036*u*u,.752-.165*u*u));
    }
    part(root,new Geo.Tube(new T.CatmullRomCurve3(smile),32,.008,6,false),mats.mouth,{cast:false,low:.7});
    root.userData.frontLegs = [-1,1].map(side => leg(root,side,false,skin));
    root.userData.hindLegs = [-1,1].map(side => leg(root,side,true,skin));
    const wardrobe = new T.Group(); root.add(wardrobe);
    const accent = new T.MeshStandardMaterial({ color:new T.Color(route.accent).convertSRGBToLinear(), roughness:.82, metalness:.02, vertexColors:true });
    const dark = new T.MeshStandardMaterial({ color:0x263124, roughness:.8, vertexColors:true });
    addCostume(wardrobe,route.costume,mats,accent,dark);
    wardrobe.scale.set(.78,.55,.88); wardrobe.position.set(0,-.08,.02);
    root.userData.costume = wardrobe;
    const mouthAnchor = new T.Object3D(); mouthAnchor.position.set(0,.35,.73); root.add(mouthAnchor);
    root.userData.mouthAnchor = mouthAnchor;
    return measure(root,s);
  }

  function makeTadpole(stage, scale, mats) {
    const root = new T.Group(), s = scale || 1;
    root.scale.setScalar(s); root.userData.baseScale=s; root.userData.stage=stage;
    const skin = stage >= 2 ? mats.frogSkin : mats.tadpoleSkin;
    const body = part(root,new Geo.Sphere(.27,32,22),skin,{p:[.06,.27,0],s:[1.34,.77,.9],low:.85});
    body.name='body';
    [-1,1].forEach(side => {
      part(root,new Geo.Sphere(.041,16,12),mats.wetBlack,{p:[.23,.37,side*.17],s:[1,.92,.6],cast:false});
      part(root,new Geo.Sphere(.008,8,6),mats.white,{p:[.231,.389,side*.194],cast:false,low:1});
    });
    const pivot=new T.Group(); pivot.position.set(-.21,.26,0); root.add(pivot); root.userData.tailPivot=pivot;
    const length=stage >= 2 ? .62 : 1.02;
    part(pivot,flesh([[0,0,0],[-length*.32,.015,0],[-length*.7,-.02,.015],[-length,0,0]],[.09,.058,.026,.002]),skin,{low:.85});
    const points=[],indices=[],uvs=[],steps=36;
    for(let i=0;i<=steps;i++){
      const u=i/steps, width=Math.pow(Math.sin(u*Math.PI),.9)*.15;
      points.push(-u*length,width,0,-u*length,-width,0); uvs.push(u,0,u,1);
      if(i<steps){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
    }
    const fin=new T.BufferGeometry();
    (fin.setAttribute||fin.addAttribute).call(fin,'position',new T.Float32BufferAttribute(points,3));
    (fin.setAttribute||fin.addAttribute).call(fin,'uv',new T.Float32BufferAttribute(uvs,2));
    fin.setIndex(indices);fin.computeVertexNormals();pivot.add(new T.Mesh(fin,mats.tailFin));
    if(stage>=1)[-1,1].forEach(side=>{
      part(root,flesh([[-.10,.24,side*.13],[-.22,.11,side*.27],[-.06,.07,side*.32]],[.042,.032,.015]),skin,{low:.85});
    });
    if(stage>=2)[-1,1].forEach(side=>{
      part(root,flesh([[.17,.22,side*.15],[.22,.10,side*.24],[.32,.06,side*.22]],[.027,.02,.01]),skin,{low:.85});
    });
    return measure(root,s);
  }

  return { materials, makeFrog: royal.makeFrog, makeTadpole,
    releaseObject: royal.releaseObject, dispose: royal.dispose };
};
