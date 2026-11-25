const { createScopedThreejs } = require("threejs-miniprogram");
const createArt = require("./art");
const createReturns = require("./returns");
const {
  MALE_ROUTES, FEMALE_ROUTES, PERKS, LETTERS, CARE_EPILOGUE, GRADE_ORDER,
  POND_THEMES, SKILLS, DISTRICTS, SOUVENIRS,
  JUMP_GOAL, BUG_GOAL, BUG_GUIDE, JUMP_PITCH, JUMP_SIDE, JUMP_LIVES,
  TAU, clamp, lerp, damp, easeOutBack
} = require("./config");

const page = {
  data: {
    phase: "home",
    routeList: [],
    selectedRouteId: "",
    selectedRouteName: "",
    selectedPerkName: "",
    selectedPerkText: "",
    stageName: "幼年小蝌蚪",
    food: 12,
    affection: 10,
    play: 8,
    growth: 0,
    growthPercent: 0,
    canChallenge: false,
    needKey: "play",
    needHint: "它想玩一会儿",
    careTitle: "",
    careKey: "",
    grade: "",
    gradeTag: "",
    runTimeText: "",
    bestGrade: "",
    bestTimeText: "",
    letterLines: [],
    metCount: 0,
    routeTotal: MALE_ROUTES.length + FEMALE_ROUTES.length,
    jumps: 0,
    jumpGoal: JUMP_GOAL,
    attempts: JUMP_LIVES,
    attemptSlots: [0, 1, 2],
    perfect: 0,
    falls: 0,
    bugs: 0,
    bugGoal: BUG_GOAL,
    isCharging: false,
    isJumping: false,
    isAiming: false,
    chargePercent: 0,
    chargeTone: "far",
    chargeHint: "长按蓄力",
    targetCharge: 55,
    gameOver: false,
    failTitle: "荷叶小径",
    failUnit: "片荷叶",
    chapter: "初夏的池塘",
    actionLabel: "",
    careBusy: false,
    threeReady: false,
    initError: false,
    transition: false,
    paused: false,
    message: "看看它们在池塘里游。",
    newRoute: false,
    petName: "小荷",
    hasCompanion: false,
    choosingNew: false,
    savedPetName: "",
    savedPetRoute: "",
    savedPetStage: "",
    rosterList: [],
    rosterCount: 0,
    snacks: 0,
    adventures: 0,
    souvenirs: [],
    rewardText: "",
    petHabit: "",
    petQuote: "",
    pondTheme: "summer",
    unlockedThemes: ["summer"],
    pondThemeList: POND_THEMES.map((theme) => ({ id: theme.id, name: theme.name, cost: theme.cost, unlocked: theme.cost === 0 })),
    storageNotice: "",
    districtName: DISTRICTS[0].name,
    districtNumber: 1,
    checkpoint: 0,
    resting: false,
    skillName: "",
    skillText: "",
    skillSymbol: "",
    skillReady: false,
    skillArmed: false,
    skillStatus: "",
    bubblePlaying: false,
    bubbleSeconds: 10,
    bubbleScore: 0,
    bugHint: "",
    bugGuideTitle: "捕虫玩法",
    bugGuideSteps: BUG_GUIDE,
    caughtKinds: [],
    returnMode: "",
    returnProgress: 0,
    returnTitle: "",
    slingPower: 0,
    slingReady: false,
    returnOutcome: "",
    returnResultReady: false,
    fortressDamage: 0
  },

  onReady() {
    this.loadPreferences();
    this.setData({ metCount: this.loadCollection().length });
    this.loadCompanion();
    this.loadMemories();
    this.loadAdventure();
    try {
      if (typeof wx !== "undefined" && wx.showShareMenu) {
        wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
      }
    } catch (error) {}
    this.initThree();
  },

  onUnload() {
    this.disposeMemories();
    this.disposeAudio();
    if (this.initFrame && this.canvas) this.canvas.cancelAnimationFrame(this.initFrame);
    this.saveCompanion();
    this.unloaded = true;
    this.stopLoop();
    this.clearCharge();
    this.disposeThree();
  },

  // ------------------------------------------------------------------ 路线收集

  loadCollection() {
    if (this.collection) return this.collection;
    let saved = [];
    try {
      if (typeof wx !== "undefined" && wx.getStorageSync) {
        const raw = wx.getStorageSync("tadpole-routes-v1");
        if (Array.isArray(raw)) saved = raw;
      }
    } catch (error) { saved = []; }
    this.collection = saved;
    return saved;
  },

  saveRoute(id) {
    const list = this.loadCollection();
    const isNew = list.indexOf(id) < 0;
    if (isNew) {
      list.push(id);
      try {
        if (typeof wx !== "undefined" && wx.setStorageSync) wx.setStorageSync("tadpole-routes-v1", list);
      } catch (error) {}
    }
    this.setData({ metCount: list.length });
    return isNew;
  },

  // ------------------------------------------------------------------ Three.js 初始化与场景

  ensureArt() {
    if (!this.art) {
      this.art = createArt(this.THREE);
      this.geo = this.art.Geo;
    }
    return this.art;
  },

  initThree() {
    this.jumpLeaves = [];
    this.insects = [];
    this.worldTadpoles = [];
    this.effects = null;
    this.unloaded = false;

    wx.createSelectorQuery()
      .in(this)
      .select("#pondCanvas")
      .node()
      .exec((res) => {
        if (this.unloaded) return;
        const canvas = res && res[0] && res[0].node;
        if (!canvas) return;

        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        this.canvas = canvas;
        try {
          this.THREE = createScopedThreejs(canvas);
          const T = this.THREE;
          this.width = info.windowWidth;
          this.height = info.windowHeight;

          this.createRenderer(info);
          this.setupCamera(this.width, this.height);
          this.createMaterials();
          this.buildScene();
          this.camera.position.set(4, 6, 8); this.camera.lookAt(new T.Vector3(0, 0, 0));
          this.renderer.render(this.scene, this.camera);
          const finish = () => {
            if (this.unloaded) return;
            try {
              this.captureReflections(); this.showNurturePreview(); this.cameraSnap();
              this.setData({ threeReady: true, initError: false }); this.startLoop();
            } catch (error) {
              this.stopLoop(); this.setData({ threeReady: false, initError: true });
              console.error("Character preparation failed", error);
            }
          };
          this.initFrame = canvas.requestAnimationFrame(() => { this.initFrame = canvas.requestAnimationFrame(finish); });
        } catch (error) {
          this.stopLoop();
          this.setData({ threeReady: false, initError: true, message: "池塘加载失败，请重新打开。" });
          console.error("Pond initialization failed", error);
        }
      });
  },

  createRenderer(info) {
    const T = this.THREE;
    this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(info.pixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height);
    const pixelRatio = Math.min(info.pixelRatio || 1, 2);
    this.renderQuality = { max: pixelRatio, current: pixelRatio, changedAt: Date.now() - 15000 };
    this.resetRenderQualityWindow(Date.now(), 2000);
    this.applyQualityPreference();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    if (T.ACESFilmicToneMapping !== undefined && "toneMapping" in this.renderer) {
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }
    if ("outputEncoding" in this.renderer) this.renderer.outputEncoding = T.sRGBEncoding;
    else { this.renderer.gammaOutput = true; this.renderer.gammaFactor = 2.2; }
  },

  setupCamera(width, height) {
    const T = this.THREE;
    this.scene = this.scene || new T.Scene();
    this.camera = new T.PerspectiveCamera(45, width / height, 0.1, 120);
    this.cam = { yaw: 0.30, pitch: 0.30, dist: 6.5, fx: 0, fy: 0.55, fz: 1.2, ready: false };
    this.pointer = new T.Vector2();
    this.raycaster = new T.Raycaster();
    this.cameraTarget = new T.Vector3(0, 0.55, 1.2);
  },

  createMaterials() {
    this.ensureArt();
    if (this.materials) return this.materials;
    this.materials = this.art.materials();
    this.sharedMaterials = new Set(Object.keys(this.materials).map((key) => this.materials[key]));
    return this.materials;
  },

  buildScene() {
    const T = this.THREE;
    const mats = this.materials;
    const art = this.ensureArt();

    this.scene = this.scene || new T.Scene();
    this.scene.background = new T.Color(0xcdeee0);
    this.scene.fog = new T.Fog(0xcdeee0, 24, 62);
    this.skyMesh = art.makeSky(0xdcebf0, 0x689ab8, 78);
    this.scene.add(this.skyMesh);

    const hemi = new T.HemisphereLight(0xe4efff, 0x34452b, 0.8);
    this.hemiLight = hemi;
    this.scene.add(hemi);

    const sun = new T.DirectionalLight(0xfff1d4, 1.6);
    this.sunLight = sun;
    sun.position.set(-5.5, 11, 6.5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 34;
    sun.shadow.camera.left = -11;
    sun.shadow.camera.right = 11;
    sun.shadow.camera.top = 11;
    sun.shadow.camera.bottom = -11;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rim = new T.DirectionalLight(0x9fe4ff, 0.42);
    this.rimLight = rim;
    rim.position.set(6, 5.5, -7);
    this.scene.add(rim);

    const bounce = new T.DirectionalLight(0xffd8a6, 0.16);
    this.bounceLight = bounce;
    bounce.position.set(2, -4, 5);
    this.scene.add(bounce);

    this.root = new T.Group();
    this.scene.add(this.root);
    this.pondGroup = new T.Group();
    this.root.add(this.pondGroup);

    const pond = new T.Mesh(new this.geo.Cylinder(10.6, 12.4, 0.5, 72), mats.deepWater);
    pond.position.y = -0.96;
    pond.receiveShadow = true;
    this.pondGroup.add(pond);

    const waterGeometry = new this.geo.Ring(0.02, 10.7, 96, 20);
    this.waterMesh = new T.Mesh(waterGeometry, mats.water);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = 0;
    this.waterMesh.receiveShadow = true;
    this.pondGroup.add(this.waterMesh);

    this.applyWaterShader();

    const shore = new T.Mesh(
      new this.geo.Torus(10.75, 0.16, 6, 96),
      new T.MeshStandardMaterial({ color: 0x2a5f50, roughness: 0.9 })
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.y = -0.06;
    this.pondGroup.add(shore);

    this.pondGroup.add(art.makeStones(mats));
    this.pondGroup.add(art.makeReedBed(mats));
    this.pondGroup.add(art.makeUnderwater(mats));

    this.lotusPatches = [];
    [[-6.6, -2.2, 0.9], [6.4, 1.6, 1.0], [-2.2, -5.4, 0.8]].forEach((spot) => {
      const cluster = art.makeLotusCluster(mats, spot[2]);
      cluster.position.set(spot[0], 0.02, spot[1]);
      this.lotusPatches.push(cluster);
      this.pondGroup.add(cluster);
    });

    this.floatLeaves = new T.Group();
    this.pondGroup.add(this.floatLeaves);
    [[-4.6, 3.4], [0.8, 2.4], [4.9, 3.0]].forEach((spot, i) => {
      const leaf = art.makeLeaf(mats, 0.52 + i * 0.05);
      leaf.position.set(spot[0], 0.045, spot[1]);
      leaf.rotation.y = i * 0.8;
      this.floatLeaves.add(leaf);
    });
    this.homeLeaf = art.makeLeaf(mats, 1.25);
    this.homeLeaf.position.set(0, 0.045, 1.2);
    this.homeLeaf.visible = false;
    this.floatLeaves.add(this.homeLeaf);

    this.worldTadpoles = [];
    for (let i = 0; i < 10; i += 1) {
      const tadpole = art.makeTadpole(i % 3, 0.32 + (i % 4) * 0.04, mats);
      tadpole.traverse((child) => { child.castShadow = false; });
      tadpole.position.set(-7.2 + (i % 5) * 3.3, -0.14, -4.2 + Math.floor(i / 5) * 3.4);
      tadpole.userData.swim = {
        speed: 0.22 + (i % 5) * 0.06,
        direction: i % 2 ? 1 : -1,
        phase: i * 0.7,
        baseZ: tadpole.position.z
      };
      this.worldTadpoles.push(tadpole);
      this.pondGroup.add(tadpole);
    }

    this.effects = new T.Group();
    this.pondGroup.add(this.effects);
    this.bursts = [];
    this.rings = [];
    this.petGroup = null;
    this.frogGroup = null;
    this.jumpLeaves = [];
    this.insects = [];
    this.tongueMesh = null;
    this.tongueTip = null;
    this.preview = null;
    this.blink = { next: Date.now() + 2600 };
    this.pose = { sx: 1, sy: 1, sz: 1, rx: 0, rz: 0, dy: 0 };
    this.sceneStartedAt = Date.now();
    this.applyPondTheme(this.data.pondTheme);
  },

  applyPondTheme(id) {
    if (!this.scene || !this.materials) return;
    const T = this.THREE;
    const theme = POND_THEMES.find((item) => item.id === id) || POND_THEMES[0];
    this.activePondTheme = theme;
    if (this.scene.background) this.scene.background.setHex(theme.bg);
    if (this.scene.fog) this.scene.fog.color.setHex(theme.bg);
    if (this.materials.water) this.materials.water.color.setHex(theme.water).convertSRGBToLinear();
    if (this.materials.deepWater) this.materials.deepWater.color.setHex(theme.deep).convertSRGBToLinear();
    if (this.hemiLight) {
      this.hemiLight.color.setHex(theme.hemiSky);
      this.hemiLight.groundColor.setHex(theme.hemiGround);
      this.hemiLight.intensity = theme.hemiI;
    }
    if (this.sunLight) { this.sunLight.color.setHex(theme.sun); this.sunLight.intensity = theme.sunI; }
    if (this.rimLight) { this.rimLight.color.setHex(theme.rim); this.rimLight.intensity = theme.rimI; }
    if (this.bounceLight) { this.bounceLight.color.setHex(theme.bounce); this.bounceLight.intensity = theme.bounceI; }
    if (this.skyMesh && this.skyMesh.geometry && this.skyMesh.geometry.attributes && this.skyMesh.geometry.attributes.color) {
      const pos = this.skyMesh.geometry.attributes.position, col = this.skyMesh.geometry.attributes.color;
      const horizon = new T.Color(theme.horizon).convertSRGBToLinear();
      const zenith = new T.Color(theme.zenith).convertSRGBToLinear();
      const mixed = new T.Color();
      for (let i = 0; i < pos.count; i += 1) {
        const t = clamp((pos.getY(i) / 78) * 1.7 + 0.12, 0, 1);
        mixed.copy(horizon).lerp(zenith, t * t);
        col.setXYZ(i, mixed.r, mixed.g, mixed.b);
      }
      col.needsUpdate = true;
    }
    this.buildThemeParticles(theme.fx);
  },

  buildThemeParticles(kind) {
    if (this.themeParticles) { this.removeObject(this.themeParticles); this.themeParticles = null; }
    if (!kind || !this.pondGroup) return;
    const T = this.THREE;
    const count = kind === "firefly" ? 36 : 48;
    const positions = new Float32Array(count * 3);
    const seeds = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * TAU + Math.random() * 0.4;
      const radius = 1.4 + Math.random() * 7.6;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      const y = kind === "firefly" ? 0.35 + Math.random() * 2.6 : 0.4 + Math.random() * 5.6;
      positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
      seeds.push({ x, y, z, phase: Math.random() * TAU, speed: kind === "firefly" ? 0.5 + Math.random() * 0.7 : 3.2 + Math.random() * 1.6 });
    }
    const geometry = new T.BufferGeometry();
    (geometry.setAttribute || geometry.addAttribute).call(geometry, "position", new T.Float32BufferAttribute(positions, 3));
    const material = new T.PointsMaterial({
      color: kind === "firefly" ? 0xffe885 : 0xd6eef7,
      size: kind === "firefly" ? 0.16 : 0.085,
      transparent: true,
      opacity: kind === "firefly" ? 0.85 : 0.52,
      depthWrite: false
    });
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    points.userData = { kind, seeds, lastDrop: 0 };
    this.themeParticles = points;
    this.pondGroup.add(points);
  },

  updateThemeParticles(now, dt) {
    const points = this.themeParticles;
    if (!points || !points.geometry || !points.geometry.attributes) return;
    const attr = points.geometry.attributes.position;
    const { kind, seeds } = points.userData;
    const t = now / 1000;
    if (kind === "firefly") {
      for (let i = 0; i < seeds.length; i += 1) {
        const s = seeds[i];
        attr.setXYZ(i, s.x + Math.sin(t * s.speed + s.phase) * 0.45,
          s.y + Math.sin(t * (s.speed * 1.3) + s.phase * 2) * 0.25,
          s.z + Math.cos(t * (s.speed * 0.8) + s.phase) * 0.45);
      }
      points.material.opacity = 0.62 + Math.sin(t * 2.2) * 0.24;
    } else if (kind === "rain") {
      for (let i = 0; i < seeds.length; i += 1) {
        const s = seeds[i];
        s.y -= s.speed * dt;
        s.x += 0.28 * dt;
        if (s.y < 0.05) { s.y = 5.4 + Math.random() * 0.8; s.x = (Math.random() - 0.5) * 14; s.z = (Math.random() - 0.5) * 14; }
        attr.setXYZ(i, s.x, s.y, s.z);
      }
      if (now - points.userData.lastDrop > 420) {
        points.userData.lastDrop = now;
        this.emitWaterRipple({ x: (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 8 }, 0.22);
      }
    }
    attr.needsUpdate = true;
  },

  applyWaterShader() {
    this.waterRipples = Array.from({ length: 6 }, () => new this.THREE.Vector4(0, 0, -100, 0));
    this.nextWaterRipple = 0;
    const material = this.materials.water;
    material.roughness = 0.18; material.clearcoat = 0.62;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.pondTime = { value: 0 };
      shader.uniforms.pondRipples = { value: this.waterRipples };
      this.waterShader = shader;
      shader.vertexShader = "uniform float pondTime;varying vec2 pondCoord;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" +
        "pondCoord=vec2(position.x,-position.y);transformed.z += sin(position.x * 2.8 + pondTime) * 0.028 + cos(position.y * 3.2 + pondTime * 0.8) * 0.020;"
      );
      shader.fragmentShader = "uniform float pondTime;uniform vec4 pondRipples[6];varying vec2 pondCoord;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
        "#include <color_fragment>\nfloat depthPattern=.5+.5*sin(pondCoord.x*.55)*cos(pondCoord.y*.62);\ndiffuseColor.rgb*=mix(vec3(.72,.86,.90),vec3(1.12,1.20,1.06),depthPattern);\nfloat shimmer=pow(max(0.,sin(pondCoord.x*4.3+pondTime*.65)*sin(pondCoord.y*4.7-pondTime*.4)),12.);\ndiffuseColor.rgb+=vec3(.025,.05,.035)*shimmer;\nfor(int i=0;i<6;i++){float age=pondTime-pondRipples[i].z;if(age>=0.&&age<3.&&pondRipples[i].w>.01){float radius=length(pondCoord-pondRipples[i].xy);if(abs(radius-age*.7)<.75){float ring=sin(radius*22.-age*8.)*exp(-pow(radius-age*.7,2.)*12.);float fade=exp(-age*1.6);diffuseColor.rgb+=vec3(.055,.09,.065)*ring*fade*pondRipples[i].w;}}}");
      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        "#include <beginnormal_vertex>\n" +
        "objectNormal = normalize(vec3(-cos(position.x * 2.8 + pondTime) * 0.0784, sin(position.y * 3.2 + pondTime * 0.8) * 0.064, 1.0));"
      );
    };
    material.needsUpdate = true;
  },

  emitWaterRipple(position, strength) {
    if (!this.waterRipples) return;
    const index = this.nextWaterRipple++ % this.waterRipples.length;
    this.waterRipples[index].set(position.x, position.z, (Date.now() - this.sceneStartedAt) / 1000, strength || 0.5);
  },

  captureReflections() {
    if (!this.renderer || !this.renderer.getContext || !this.THREE.CubeCamera) return;
    const camera = new this.THREE.CubeCamera(0.1, 90, 128);
    camera.position.set(0, 0.25, 0); this.scene.add(camera);
    this.waterMesh.visible = false;
    try {
      camera.update(this.renderer, this.scene);
      this.reflectionTarget = camera.renderTarget;
      [this.materials.water, this.materials.frogSkin, this.materials.frogBody, this.materials.tadpoleSkin,
        this.materials.royalSkin, this.materials.royalHead, this.materials.royalBody, this.materials.royalGold, this.materials.royalRuby, this.materials.royalIris].forEach((material) => {
        material.envMap = camera.renderTarget.texture;
        material.envMapIntensity = material === this.materials.water ? 0.75 : material === this.materials.royalGold ? 1.0 : 0.4;
        material.needsUpdate = true;
      });
    } catch (error) { camera.renderTarget.dispose(); }
    this.waterMesh.visible = true; this.scene.remove(camera);
    this.captureRoyalReflections();
  },

  captureRoyalReflections() {
    const T = this.THREE, studio = new T.Scene();
    studio.background = new T.Color(0x8e8a7f).convertSRGBToLinear();
    const panels = [];
    [[-3, 3, 3, 3, 4], [3, 1, 2, 1.4, 4], [0, 5, -1, 4, 3]].forEach(([x, y, z, w, h]) => {
      const plane = new T.Mesh(new this.geo.Plane(w, h), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, toneMapped: false }));
      plane.position.set(x, y, z); plane.lookAt(new T.Vector3()); studio.add(plane); panels.push(plane);
    });
    const camera = new T.CubeCamera(0.1, 30, 256);
    camera.renderTarget.texture.generateMipmaps = true;
    camera.renderTarget.texture.minFilter = T.LinearMipmapLinearFilter;
    studio.add(camera);
    try {
      camera.update(this.renderer, studio); this.royalReflectionTarget = camera.renderTarget;
      ["royalHead", "royalSkin", "royalBody", "royalGold", "royalRuby", "royalIris"].forEach((key) => {
        const material = this.materials[key]; material.envMap = camera.renderTarget.texture;
        material.envMapIntensity = key === "royalGold" ? 0.95 : key === "royalRuby" ? 0.65 : key === "royalIris" ? 0.10 : 0.12;
        material.needsUpdate = true;
      });
    } catch (error) { camera.renderTarget.dispose(); }
    panels.forEach((plane) => { plane.geometry.dispose(); plane.material.dispose(); });
  },

  // ------------------------------------------------------------------ 角色与镜头

  showNurturePreview() {
    if (this.homeLeaf) this.homeLeaf.visible = false;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.frogGroup = null;
    const saved = ["home", "status", "settings"].includes(this.data.phase) ? this.companion : null;
    if (!saved && ["home", "status", "settings"].includes(this.data.phase)) {
      this.materials.water.opacity = 0.68; this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getRouteById("king"), 1.12, this.materials);
      this.frogGroup.position.set(0, 0.11, 1.2); this.homeLeaf.visible = true; this.pondGroup.add(this.frogGroup); return;
    }
    if (saved && this.getGrowthStage(saved.growth).index >= 3) {
      this.materials.water.opacity = 0.74;
      this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getRouteById(saved.routeId), 1.12, this.materials);
      this.frogGroup.position.set(0, 0.11, 1.2);
      this.homeLeaf.visible = true;
      this.pondGroup.add(this.frogGroup);
      this.updateHomeDecor();
      return;
    }
    this.petGroup = this.ensureArt().makeTadpole(saved ? this.getGrowthStage(saved.growth).index : 0, 1.45, this.materials);
    this.petGroup.position.set(0, -0.43, 1.2);
    this.materials.water.opacity = 0.48;
    this.pondGroup.add(this.petGroup);
    this.updateHomeDecor();
  },

  spawnPet(stage) {
    if (this.homeLeaf) this.homeLeaf.visible = stage >= 3;
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.frogGroup = null;
    if (stage >= 3) {
      this.materials.water.opacity = 0.74;
      this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 1.12, this.materials);
      this.frogGroup.position.set(0, 0.11, 1.2);
      this.pondGroup.add(this.frogGroup);
      this.popIn(this.frogGroup);
      return;
    }
    this.petGroup = this.ensureArt().makeTadpole(stage, 1.45, this.materials);
    this.petGroup.position.set(0, -0.43, 1.2);
    this.materials.water.opacity = 0.48;
    this.pondGroup.add(this.petGroup);
    this.popIn(this.petGroup);
  },

  popIn(group) {
    group.userData.pop = { start: Date.now(), duration: 300 };
    group.userData.dyApplied = 0;
  },

  actor() { return this.frogGroup || this.petGroup; },

  actorSize() {
    const actor = this.actor();
    const base = actor && actor.userData.baseScale ? actor.userData.baseScale : 1;
    return {
      w: (actor && actor.userData.sizeW ? actor.userData.sizeW : 1.4) * base,
      h: (actor && actor.userData.sizeH ? actor.userData.sizeH : 1.5) * base,
      d: (actor && actor.userData.sizeD ? actor.userData.sizeD : 0.8) * base
    };
  },

  actorDistance(marginH, marginW) {
    const size = this.actorSize();
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const aspect = this.camera.aspect || 0.46;
    const radiusH = 0.5 * Math.hypot(size.w, size.d);
    const radiusV = 0.5 * Math.hypot(size.h, size.d);
    return clamp(Math.max(radiusV / (tan * marginH), radiusH / (tan * aspect * marginW)), 2.5, 12);
  },

  fitPortraitGoal(goal, phase) {
    if (!this.frogGroup || !["home", "route", "nurture"].includes(phase)) return goal;
    const size = this.actorSize(), rpx = this.width / 750, height = this.height;
    const top = phase === "home" ? height * 0.12 + rpx * 163 + 10 : phase === "nurture" ? height * 0.13 + rpx * 135 + 10 : height * 0.09 + rpx * 176 + 10;
    const bottom = phase === "home" ? height - rpx * 270 - 10 : phase === "nurture" ? height - rpx * (this.data.souvenirs.length ? 650 : 600) - 10 : height * 0.76 - rpx * 216 - 10;
    const band = Math.max(0.18, (bottom - top) / height), tan = Math.tan(this.camera.fov * Math.PI / 360);
    const depth = Math.abs(Math.sin(goal.yaw)) * size.w + Math.abs(Math.cos(goal.yaw)) * size.d;
    const upRadius = (size.h * Math.cos(goal.pitch) + depth * Math.sin(goal.pitch)) * 0.5;
    const depthRadius = (size.h * Math.sin(goal.pitch) + depth * Math.cos(goal.pitch)) * 0.5;
    goal.dist = Math.max(goal.dist, upRadius / (tan * band) + depthRadius);
    const centerY = this.frogGroup.position.y + (this.frogGroup.userData.lift || 0) * this.frogGroup.userData.baseScale + size.h * 0.5;
    const screenCenter = 1 - (top + bottom) / height, offset = screenCenter * goal.dist * tan;
    goal.fx = this.frogGroup.position.x + Math.sin(goal.yaw) * Math.sin(goal.pitch) * offset;
    goal.fy = centerY - Math.cos(goal.pitch) * offset;
    goal.fz = this.frogGroup.position.z + Math.cos(goal.yaw) * Math.sin(goal.pitch) * offset;
    return goal;
  },

  cameraGoal() {
    const phase = this.data.phase;
    const T = this.THREE;
    const goal = { yaw: 0.30, pitch: 0.30, dist: 6.5, fx: 0, fy: 0.55, fz: 1.2 };

    if (phase === "levelJump" && this.jumpLeaves.length > 1) {
      const actor = this.actor() || this.jumpLeaves[0];
      const from = actor.position;
      const next = this.jumpLeaves[1].position;
      const gap = Math.hypot(next.x - from.x, next.z - from.z) || 1;
      const ux = (next.x - from.x) / gap;
      const uz = (next.z - from.z) / gap;
      const side = this.data.jumps % 2 === 0 ? 1 : -1;
      goal.yaw = Math.atan2(-ux, -uz) + side * JUMP_SIDE;
      goal.pitch = JUMP_PITCH;
      goal.dist = clamp(gap * 3.0 + 1.5, 6.5, 14);
      goal.fx = from.x + ux * gap * 0.66;
      goal.fy = 0.55;
      goal.fz = from.z + uz * gap * 0.66;
      return goal;
    }

    if (phase === "levelBug") {
      goal.yaw = -2.28; goal.pitch = 0.36;
      goal.fx = 0; goal.fy = 1.65; goal.fz = 1.9;
      const box = new T.Box3(new T.Vector3(-1.65, 0.1, -0.4), new T.Vector3(1.65, 3.3, 4.1));
      if (this.frogGroup) { this.frogGroup.updateMatrixWorld(true); box.union(new T.Box3().setFromObject(this.frogGroup)); }
      const view = new T.Vector3(Math.sin(goal.yaw) * Math.cos(goal.pitch), Math.sin(goal.pitch), Math.cos(goal.yaw) * Math.cos(goal.pitch));
      const right = new T.Vector3(0, 1, 0).cross(view).normalize(), up = view.clone().cross(right);
      const focus = new T.Vector3(goal.fx, goal.fy, goal.fz), tan = Math.tan(this.camera.fov * Math.PI / 360);
      goal.dist = 4;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const corner = new T.Vector3(x, y, z).sub(focus), depth = corner.dot(view);
        goal.dist = Math.max(goal.dist, depth + Math.abs(corner.dot(right)) / (tan * this.camera.aspect * 0.88), depth + Math.abs(corner.dot(up)) / (tan * 0.70));
      }
      return goal;
    }

    goal.yaw = 0.34;
    goal.pitch = this.petGroup ? 0.55 : 0.16;
    goal.dist = this.actorDistance(phase === "final" ? 0.72 : 0.78, 0.90) * (this.petGroup ? 1 : phase === "final" || phase === "status" ? 1.25 : 1.12);
    goal.fx = 0;
    goal.fy = this.petGroup ? -0.12 : (this.actor() ? this.actor().position.y : 0) + this.actorSize().h * 0.52 - (phase === "final" || phase === "status" ? 1.12 : phase === "route" ? 0.85 : 0.60);
    goal.fz = 1.2;
    return this.fitPortraitGoal(goal, phase);
  },

  updateCamera(dt) {
    if (!this.camera) return;
    const goal = this.cameraGoal();
    const state = this.cam;
    if (!state.ready) { this.cameraSnap(); return; }
    const rate = 5.5;
    state.dist = damp(state.dist, goal.dist, rate, dt);
    state.pitch = damp(state.pitch, goal.pitch, rate, dt);
    state.fy = damp(state.fy, goal.fy, rate, dt);
    state.fx = damp(state.fx, goal.fx, rate, dt);
    state.fz = damp(state.fz, goal.fz, rate, dt);
    const delta = ((goal.yaw - state.yaw + Math.PI) % TAU + TAU) % TAU - Math.PI;
    state.yaw += delta * (1 - Math.exp(-rate * dt));

    const cosPitch = Math.cos(state.pitch);
    this.camera.position.set(
      state.fx + Math.sin(state.yaw) * cosPitch * state.dist,
      state.fy + Math.sin(state.pitch) * state.dist,
      state.fz + Math.cos(state.yaw) * cosPitch * state.dist
    );
    this.cameraTarget.set(state.fx, state.fy, state.fz);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  },

  cameraSnap() {
    const goal = this.cameraGoal();
    const state = this.cam;
    Object.assign(state, goal, { ready: true });
    const cosPitch = Math.cos(state.pitch);
    this.camera.position.set(
      state.fx + Math.sin(state.yaw) * cosPitch * state.dist,
      state.fy + Math.sin(state.pitch) * state.dist,
      state.fz + Math.cos(state.yaw) * cosPitch * state.dist
    );
    this.cameraTarget.set(state.fx, state.fy, state.fz);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  },

  // ------------------------------------------------------------------ 选路与引导

  chooseGender() { this.openRoutes(); },
  backToGender(destination) { this.openRoutes(destination); },

  routesForSelection() {
    return MALE_ROUTES.concat(FEMALE_ROUTES).map((route) => Object.assign({}, route, {
      perkName: PERKS[route.perk] ? PERKS[route.perk].name : "",
      met: this.loadCollection().indexOf(route.id) >= 0
    }));
  },

  selectRoute(event) {
    if (!this.data.threeReady) return;
    const route = this.getRouteById(event.currentTarget.dataset.id);
    if (!route) return;
    const perk = PERKS[route.perk] || null;
    const skill = SKILLS[this.skillForRoute(route.id)];
    this.perk = perk;
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.petGroup = null;
    this.frogGroup = this.ensureArt().makeFrog(route, 1.28, this.materials);
    this.frogGroup.position.set(0, 0.02, 1.2);
    this.pondGroup.add(this.frogGroup);
    this.popIn(this.frogGroup);
    this.setData({
      selectedRouteId: route.id,
      selectedRouteName: route.name,
      selectedPerkName: perk ? perk.name : "",
      selectedPerkText: perk ? perk.text : "",
      skillName: skill.name, skillText: skill.text, skillSymbol: skill.symbol,
      petQuote: this.routeQuote(route.id, 0),
      chapter: route.name,
      message: "已选择：" + route.name + (perk ? "（" + perk.name + "）" : "")
    });
    this.cameraSnap();
  },

  confirmRoute() {
    if (!this.data.threeReady) return;
    if (!this.data.selectedRouteId) {
      this.setData({ message: "先选一条成长路线，它会影响青蛙外观。" });
      return;
    }
    this.askPetName("", (name) => this.beginCompanion(name));
  },

  openRoutes(destination) {
    if (!this.data.threeReady) return;
    this.saveCompanion();
    this.companionActive = false;
    this.clearCharge();
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.petGroup = null;
    this.frogGroup = null;
    if (this.floatLeaves) this.floatLeaves.visible = true;
    this.petStage = 0;
    this.careCounts = { feed: 0, pet: 0, play: 0 };
    this.perk = null;
    this.sinkStart = 0;
    this.sinkLeaf = null;
    this.setData({
      phase: destination === "home" ? "home" : "route", choosingNew: destination === "new",
      routeList: destination === "home" ? [] : this.routesForSelection(),
      selectedRouteId: "", selectedRouteName: "", selectedPerkName: "", selectedPerkText: "",
      skillName: "", skillText: "", skillSymbol: "",
      stageName: "幼年小蝌蚪", food: 12, affection: 10, play: 8, growth: 0, growthPercent: 0,
      canChallenge: false, careTitle: "", careKey: "", needKey: "play", needHint: "它想玩一会儿",
      attempts: JUMP_LIVES, perfect: 0, falls: 0, grade: "", gradeTag: "", runTimeText: "",
      letterLines: [], gameOver: false, isCharging: false, isJumping: false, isAiming: false,
      chargePercent: 0, chapter: destination === "home" ? "初夏的池塘" : "未来的模样",
      actionLabel: "", transition: false, resting: false, careBusy: false, petHabit: "", rewardText: "",
      message: "选择它长大后的成长路线。"
    });
    this.showNurturePreview();
    this.cameraSnap();
  },

  // ------------------------------------------------------------------ 触控分发

  onTouchStart(event) {
    if (this.data.paused || this.data.gameOver || this.data.transition) return;
    if (this.returnWorld && this.returnWorld.active) { this.returnWorld.touchStart(event); return; }
    const touch = (event.touches || [])[0];
    if (this.data.phase === "home" && touch) {
      const actor = this.actor();
      if (actor) {
        const center = actor.position.clone().add(new this.THREE.Vector3(0, 0.5, 0)).project(this.camera);
        const distance = Math.hypot((center.x + 1) * this.width / 2 - touch.x, (1 - center.y) * this.height / 2 - touch.y);
        if (distance < this.width * 0.38) this.speakQuote(this.companion && this.companion.routeId);
      }
    }
    if (this.data.phase === "nurture") {
      if (this.bubbleGame) this.touchPlayBubble(touch);
      else if (touch && !this.data.careBusy) {
        const actor = this.actor();
        if (!actor) return;
        const center = actor.position.clone().add(new this.THREE.Vector3(0, 0.5, 0)).project(this.camera);
        const distance = Math.hypot((center.x + 1) * this.width / 2 - touch.x, (1 - center.y) * this.height / 2 - touch.y);
        if (distance < this.width * 0.38) this.petStroke = { x: touch.x, y: touch.y, distance: 0, start: Date.now() };
      }
    }
    if (this.data.phase === "levelJump") this.requestCharge();
    if (this.data.phase === "levelBug") {
      this.updateAimFromTouch(event);
      this.setData({ isAiming: true });
      this.updateAimMarker();
    }
  },

  onTouchMove(event) {
    if (this.data.paused) return;
    if (this.returnWorld && this.returnWorld.active) { this.returnWorld.touchMove(event); return; }
    const touch = (event.touches || [])[0];
    if (this.data.phase === "nurture" && this.petStroke && touch) {
      this.petStroke.distance += Math.hypot(touch.x - this.petStroke.x, touch.y - this.petStroke.y);
      this.petStroke.x = touch.x; this.petStroke.y = touch.y;
      const actor = this.actor();
      if (actor) actor.rotation.y = clamp((touch.x / this.width - 0.5) * 1.2, -0.5, 0.5);
    }
    if (this.data.phase === "levelBug") {
      this.updateAimFromTouch(event);
      this.updateAimMarker();
    }
  },

  onTouchEnd(event) {
    if (this.returnWorld && this.returnWorld.active) { this.returnWorld.touchEnd(event); return; }
    if (this.data.phase === "nurture" && this.petStroke) {
      const stroke = this.petStroke; this.petStroke = null;
      if (stroke.distance >= 30 && Date.now() - stroke.start > 100) {
        this.careAction({ currentTarget: { dataset: { type: "pet" } } });
      } else if (stroke.distance < 18) {
        this.speakQuote(this.data.selectedRouteId);
      }
    }
    if (this.data.phase === "levelJump") {
      if (this.data.isCharging) this.releaseJump();
      else this.pendingChargeAt = 0;
    }
    if (this.data.phase === "levelBug" && this.data.isAiming) {
      this.updateAimFromTouch(event);
      this.fireTongue();
      this.setData({ isAiming: false });
      this.updateAimMarker();
    }
  },

  onTouchCancel() {
    this.petStroke = null;
    if (this.returnWorld && this.returnWorld.active) this.returnWorld.cancelTouch();
    if (this.data.isCharging) {
      this.clearCharge();
      this.setData({ isCharging: false, chargePercent: 0, chargeTone: "far", chargeHint: "长按蓄力" });
    }
    this.setData({ isAiming: false });
  },

  // ------------------------------------------------------------------ 结算与分享

  formatTime(ms) {
    const total = Math.max(0, Math.round((ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" + seconds : "" + seconds);
  },

  gradeOf(perfect, falls) {
    if (perfect >= Math.ceil(JUMP_GOAL * 0.75) && falls === 0) return "S";
    if (perfect >= Math.ceil(JUMP_GOAL * 0.5) && falls <= 1) return "A";
    if (perfect >= Math.ceil(JUMP_GOAL * 0.25)) return "B";
    return "C";
  },

  loadBest() {
    if (this.bestRun !== undefined) return this.bestRun;
    let saved = null;
    try {
      if (typeof wx !== "undefined" && wx.getStorageSync) saved = wx.getStorageSync("tadpole-best-20-v1");
    } catch (error) { saved = null; }
    this.bestRun = saved && typeof saved === "object" ? saved : null;
    return this.bestRun;
  },

  saveBest(entry) {
    const best = this.loadBest();
    const better = !best
      || GRADE_ORDER.indexOf(entry.grade) > GRADE_ORDER.indexOf(best.grade)
      || (entry.grade === best.grade && entry.perfect > best.perfect);
    if (!better) return false;
    this.bestRun = entry;
    try {
      if (typeof wx !== "undefined" && wx.setStorageSync) wx.setStorageSync("tadpole-best-20-v1", entry);
    } catch (error) {}
    return true;
  },

  showFinal() {
    if (this.data.phase === "final") return;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup); this.petGroup = null;
    this.removeObject(this.frogGroup);
    this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 1.3, this.materials);
    this.frogGroup.position.set(0, 0.11, 1.2);
    if (this.homeLeaf) this.homeLeaf.visible = true;
    this.pondGroup.add(this.frogGroup);
    this.popIn(this.frogGroup);
    this.floatLeaves.visible = true;

    const firstMeet = this.saveRoute(this.data.selectedRouteId);
    const elapsed = this.runStartedAt ? (this.adventureFinishedAt || Date.now()) - this.runStartedAt : 0;
    const perfect = this.data.perfect;
    const falls = this.runFalls || 0;
    const grade = this.gradeOf(perfect, falls);
    const isBest = this.saveBest({ grade, perfect, falls, time: elapsed });
    const best = this.loadBest() || { grade, time: elapsed };

    const route = this.getSelectedRoute() || MALE_ROUTES[0];
    const letter = (LETTERS[route.id] || ["它游向了更深的水。"]).slice();
    const epilogue = CARE_EPILOGUE[this.data.careKey];
    if (epilogue) letter.push(epilogue);
    if (!this.runRewarded && this.companionActive && (!this.currentRun || this.lastRewardedRunId !== this.currentRun.id)) {
      this.runRewarded = true;
      if (this.currentRun) this.lastRewardedRunId = this.currentRun.id;
      const bonus = this.adventureBonus(), reward = 3 + bonus;
      const adventures = this.data.adventures + 1;
      const unlocked = SOUVENIRS.find((item) => item.at === adventures);
      const nextSnacks = Math.min(999, this.sharedSnacks() + reward);
      this.setSharedSnacks(nextSnacks);
      this.setData({
        adventures, snacks: nextSnacks,
        souvenirs: SOUVENIRS.filter((item) => adventures >= item.at).map((item) => item.name),
        rewardText: "带回莲子 ×" + reward + (bonus ? " · 额外奖励 +" + bonus : "") + (unlocked ? " · 新纪念物：" + unlocked.name : "")
      });
      this.rewardStored = this.saveCompanion();
    }
    this.applyPondTheme(this.data.pondTheme);

    this.setData({
      phase: "final", transition: false, newRoute: firstMeet, chapter: "成长纪念",
      grade, gradeTag: isBest ? "个人最佳" : "", perfect, falls,
      runTimeText: this.formatTime(elapsed), letterLines: letter,
      bestGrade: best.grade, bestTimeText: this.formatTime(best.time),
      message: this.data.selectedRouteName + (firstMeet ? "第一次完成了成长试炼。" : "又完成了一次成长试炼。")
    });
    this.emitBurst(new this.THREE.Vector3(0, 1.0, 1.2), 0xffe9a8, 14);
    this.cameraSnap();
    this.settleAdventure(letter);
  },

  onShareAppMessage() {
    const route = this.data.selectedRouteName;
    return {
      title: route
        ? "我的" + this.data.petName + "是一只" + route + " · " + (this.data.careTitle || "荷塘来信")
        : "荷塘来信 · 养一只蝌蚪，看它成为谁",
      path: "/pages/index/index"
    };
  },

  onShareTimeline() {
    const route = this.data.selectedRouteName;
    return {
      title: route ? "荷塘来信 · 我养出了一只" + route : "荷塘来信 · 养一只蝌蚪，看它成为谁"
    };
  },

  // ------------------------------------------------------------------ 特效与返程

  emitBurst(position, color, count) {
    if (!this.effects) return;
    const T = this.THREE;
    const group = new T.Group();
    const geometry = new this.geo.Sphere(0.038, 6, 5);
    const material = new T.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const dirs = [];
    for (let i = 0; i < count; i += 1) {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.copy(position);
      group.add(mesh);
      const angle = (i / count) * TAU + Math.random() * 0.4;
      dirs.push(new T.Vector3(Math.cos(angle) * (0.6 + Math.random() * 0.6), 1.2 + Math.random() * 0.8, Math.sin(angle) * (0.6 + Math.random() * 0.6)));
    }
    group.userData = { start: Date.now(), life: 640, dirs, origin: position.clone() };
    this.effects.add(group);
    this.bursts.push(group);
  },

  emitRing(position, size, color) {
    this.emitWaterRipple(position, size || 1);
    if (!this.effects) return;
    const T = this.THREE;
    const ring = new T.Mesh(
      new this.geo.Torus(0.28, color ? 0.03 : 0.022, 6, 32),
      new T.MeshBasicMaterial({ color: color || 0xd8fff2, transparent: true, opacity: 0.88, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.05, position.z);
    ring.userData = { start: Date.now(), life: 720, size: size || 1 };
    this.effects.add(ring);
    this.rings.push(ring);
  },

  updateEffects(now) {
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const group = this.bursts[i];
      const t = (now - group.userData.start) / group.userData.life;
      if (t >= 1) { this.bursts.splice(i, 1); this.removeObject(group); continue; }
      group.children.forEach((child, index) => {
        const dir = group.userData.dirs[index];
        child.position.copy(group.userData.origin).addScaledVector(dir, t * 0.55);
        child.position.y += -0.9 * t * t;
      });
      group.children[0].material.opacity = 1 - t;
    }
    for (let i = this.rings.length - 1; i >= 0; i -= 1) {
      const ring = this.rings[i];
      const t = (now - ring.userData.start) / ring.userData.life;
      if (t >= 1) { this.rings.splice(i, 1); this.removeObject(ring); continue; }
      ring.scale.setScalar(0.4 + t * 2.4 * ring.userData.size);
      ring.material.opacity = 0.8 * (1 - t);
    }
  },

  applyShake(now) {
    if (!this.shake || !this.camera) return;
    const t = (now - this.shake.start) / this.shake.duration;
    if (t >= 1) { this.shake = null; return; }
    const amount = this.shake.amp * (1 - t);
    this.camera.position.x += (Math.random() - 0.5) * amount;
    this.camera.position.y += (Math.random() - 0.5) * amount;
  },

  vibrate(kind) {
    if (this.data.hapticEnabled === false) return;
    if (typeof wx === "undefined" || !wx.vibrateShort) return;
    wx.vibrateShort({ type: kind === "heavy" ? "heavy" : kind === "medium" ? "medium" : "light" });
  },

  showReturnChoice() {
    this.ensureAdventure();
    this.clearChallengeObjects();
    this.removeObject(this.petGroup); this.petGroup = null;
    this.removeObject(this.frogGroup); this.frogGroup = null;
    if (!this.returnWorld) this.returnWorld = createReturns(this);
    this.returnWorld.showChoice();
    this.saveAdventure();
  },

  chooseReturn(event) {
    if (this.returnWorld) this.returnWorld.begin(event.currentTarget.dataset.mode);
    this.saveAdventure();
  },

  paddleReturn() { if (this.returnWorld) this.returnWorld.paddle(); },
  retrySling() { if (this.returnWorld) this.returnWorld.begin("sling"); this.saveAdventure(); },
  fireSling() { if (this.returnWorld) this.returnWorld.fire(); },
  changeReturnMode() { if (this.returnWorld) this.returnWorld.showChoice(); this.saveAdventure(); },
  finishReturn() { if (this.data.returnResultReady) this.showFinal(); },

  // ------------------------------------------------------------------ 渲染循环与自检

  renderFrame() {
    if (this.returnWorld && this.returnWorld.active) this.returnWorld.render();
    else this.renderer.render(this.scene, this.camera);
  },

  resetRenderQualityWindow(now, delay) {
    const quality = this.renderQuality;
    if (!quality) return;
    quality.count = 0; quality.total = 0; quality.slow = 0; quality.since = now + (delay || 0);
  },

  updateRenderQuality(now, frameMs) {
    if (this.data.qualityMode && this.data.qualityMode !== "auto") return;
    const quality = this.renderQuality;
    if (!quality || !this.renderer.setPixelRatio || now < quality.since) return;
    if (frameMs > 250) { this.resetRenderQualityWindow(now, 2000); return; }
    if (frameMs < 4) return;
    quality.count += 1; quality.total += frameMs;
    if (frameMs > 24) quality.slow += 1;
    if (quality.count < 120 || now - quality.since < 4000) return;
    const average = quality.total / quality.count, slowRatio = quality.slow / quality.count;
    let next = quality.current;
    if (average > 25 && slowRatio > 0.70 && now - quality.changedAt >= 15000) {
      next = Math.max(Math.min(1.5, quality.max), quality.current - 0.25);
    } else if (average < 18 && slowRatio < 0.05 && now - quality.changedAt >= 30000) {
      next = Math.min(quality.max, quality.current + 0.25);
    }
    if (next !== quality.current) {
      if (this.data.isCharging || this.data.isJumping || this.data.isAiming || this.data.transition
        || this.tongueState || (this.returnWorld && this.returnWorld.projectile)) return;
      this.renderer.setPixelRatio(next);
      quality.current = next; quality.changedAt = now;
      this.resetRenderQualityWindow(now, 2000);
    } else this.resetRenderQualityWindow(now, 0);
  },

  startLoop() {
    this.stopLoop();
    this.lastTick = Date.now();
    const tick = () => {
      if (this.unloaded || this.data.paused) return;
      this.animationId = this.canvas.requestAnimationFrame(tick);
      const now = Date.now();
      this.updateRenderQuality(now, now - this.lastTick);
      this.update();
      this.renderFrame();
    };
    tick();
  },

  stopLoop() {
    if (this.canvas && this.animationId) {
      this.canvas.cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  },

  update() {
    const now = Date.now();
    const dt = Math.min((now - (this.lastTick || now)) / 1000, 0.05);
    this.lastTick = now;
    const time = now / 1000;

    this.pose.sx = 1; this.pose.sy = 1; this.pose.sz = 1;
    this.pose.rx = 0; this.pose.rz = 0; this.pose.dy = 0;

    if (this.waterShader) this.waterShader.uniforms.pondTime.value = (now - this.sceneStartedAt) / 1000;
    if (this.returnWorld && this.returnWorld.active) {
      this.returnWorld.update(now, dt);
      return;
    }

    this.updateWorldTadpoles(dt, time);
    this.updateThemeParticles(now, dt);
    this.updateFloatLeaves(time);
    this.updateIdle(now, time);
    this.updateCare(now);
    this.updateBubbleGame(now, dt);
    this.updateSkill(now, dt);
    this.updateCharge(now);
    this.updateJump(now);
    this.updateLanding(now);
    this.updateLeafResponse(now);
    this.updateSplash(now);
    this.updateRespawn(now);
    this.updateSinkingLeaves(now);
    this.updateInsects(dt, time);
    this.updateTongue(now);
    this.updateEffects(now);
    this.applyPose();
    this.updateCamera(dt);
    this.applyShake(now);
    this.updateSceneQueue(now);
  },

  updateWorldTadpoles(dt, time) {
    (this.worldTadpoles || []).forEach((tadpole, index) => {
      const swim = tadpole.userData.swim;
      if (!swim) return;
      swim.phase += dt * 2.2;
      tadpole.position.x += swim.direction * swim.speed * dt;
      tadpole.position.z = swim.baseZ + Math.sin(swim.phase * 0.7) * 0.22;
      tadpole.rotation.y = swim.direction > 0 ? 0 : Math.PI;
      if (Math.abs(tadpole.position.x) > 7.6) swim.direction *= -1;
      const pivot = tadpole.userData.tailPivot;
      if (pivot) pivot.rotation.y = Math.sin(time * 9 + swim.phase) * 0.5;
      const age = (Date.now() - this.sceneStartedAt) / 1000;
      if (index % 3 === 0 && age - (swim.lastWake || 0) > 2.4 + index * 0.1) {
        swim.lastWake = age; this.emitWaterRipple(tadpole.position, 0.18);
      }
    });
  },

  updateFloatLeaves(time) {
    if (!this.floatLeaves || !this.floatLeaves.visible) return;
    this.floatLeaves.children.forEach((leaf, index) => {
      leaf.position.y = 0.045 + Math.sin(time * 1.15 + index * 1.7) * 0.022;
      leaf.rotation.z = Math.sin(time * 0.9 + index) * 0.03;
    });
  },

  updateIdle(now, time) {
    const actor = this.actor();
    if (!actor) return;
    const pop = actor.userData.pop;
    if (pop) {
      const t = clamp((now - pop.start) / pop.duration, 0, 1);
      const k = lerp(0.55, 1, easeOutBack(t));
      this.pose.sx *= k; this.pose.sy *= k; this.pose.sz *= k;
      if (t >= 1) actor.userData.pop = null;
    }
    if (!this.data.isCharging && !this.jumpState) {
      this.pose.sy *= 1 + Math.sin(time * 2.4) * 0.018;
      this.pose.sx *= 1 - Math.sin(time * 2.4) * 0.012;
    }
    const pivot = actor.userData.tailPivot;
    if (pivot) pivot.rotation.y = Math.sin(time * 7) * 0.35;
    if (this.swallowUntil > now) {
      this.pose.sy *= 1 + Math.sin((this.swallowUntil - now) / 350 * Math.PI) * 0.10;
    }
    const gulp = this.swallowUntil > now ? Math.sin((this.swallowUntil - now) / 350 * Math.PI) : 0;
    if (actor.userData.innerTongue) actor.userData.innerTongue.scale.set(1, 0.54 + gulp * 0.18, 0.53 + gulp * 0.10);
    if (actor.userData.head) actor.userData.head.scale.y = 1 + gulp * 0.015;
    if (actor.userData.route && !this.data.isCharging && !this.jumpState && !this.data.careBusy) {
      const costume = actor.userData.route.costume;
      if (["home", "route", "nurture", "status"].includes(this.data.phase)) {
        if (["prince", "princess", "sweetheart"].includes(costume)) { this.pose.rz += Math.sin(time * 1.6) * 0.025; actor.rotation.y = Math.sin(time * 0.55) * 0.23; }
        else if (["monk", "saint"].includes(costume)) { this.pose.sy *= 1 + Math.sin(time * 1.3) * 0.012; }
        else if (["general", "commander"].includes(costume)) this.pose.rx += Math.sin(time * 0.8) * 0.012;
        else if (["ceo", "bosslady"].includes(costume)) this.pose.rz += Math.sin(time * 0.9) * 0.012;
        else if (["it", "coder"].includes(costume)) (actor.userData.eyes || []).forEach((eye, i) => { eye.rotation.y = Math.sin(time * 1.8 + i * 0.3) * 0.025; });
        else if (costume === "artist") (actor.userData.frontLegs || []).forEach((leg, i) => { if (i) leg.rotation.x = Math.sin(time * 2.2) * 0.15; });
        if (actor.userData.gesture) actor.userData.gesture.rotation.z = -0.5 + Math.sin(time * 2) * 0.18;
      }
    }
    const eyelids = actor.userData.eyelids;
    if (eyelids && eyelids.length) {
      if (!this.blink.start && now > this.blink.next) {
        this.blink.start = now;
        this.blink.next = now + 2400 + Math.random() * 2600;
      }
      let k = 0;
      if (this.blink.start) {
        const t = (now - this.blink.start) / 260;
        if (t >= 1) this.blink.start = 0;
        else k = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
      }
      eyelids.forEach((lid) => { lid.rotation.x = lerp(-0.22, 1.34, k); });
    }
    if (this.data.phase === "route" && !this.jumpState && !(actor.userData.route && ["prince", "princess", "sweetheart"].includes(actor.userData.route.costume))) {
      actor.rotation.y = Math.sin(time * 0.6) * 0.35;
    }
  },

  applyPose() {
    const actor = this.actor();
    if (!actor || !actor.userData.baseScale) return;
    const base = actor.userData.baseScale;
    actor.scale.set(base * this.pose.sx, base * this.pose.sy, base * this.pose.sz);
    actor.rotation.x = this.pose.rx;
    actor.rotation.z = this.pose.rz;
    const applied = actor.userData.dyApplied || 0;
    actor.position.y += this.pose.dy - applied;
    actor.userData.dyApplied = this.pose.dy;
  },

  updateSceneQueue(now) {
    if (!this.nextScene || now < this.nextScene.at) return;
    const method = this.nextScene.method;
    this.nextScene = null;
    this.setData({ transition: false });
    if (typeof this[method] === "function") this[method]();
  },

  scheduleScene(method, delay) {
    this.nextScene = { method, at: Date.now() + delay };
    this.setData({ transition: true });
  },

  // ------------------------------------------------------------------ 清理与工具

  clearChallengeObjects() {
    if (this.returnWorld && this.returnWorld.active) this.returnWorld.dispose();
    this.nextScene = null;
    this.jumpState = null;
    this.landingMotion = null;
    this.splashMotion = null;
    this.careMotion = null;
    this.aimHit = null;
    this.tongueState = null;
    this.shake = null;
    this.respawnAt = 0;
    this.sinkStart = 0;
    this.sinkLeaf = null;
    this.petStroke = null;
    this.bubbleGame = null;
    this.stunUntil = 0;
    this.clearPlayBubbles();
    this.removeObject(this.districtDecor); this.districtDecor = null;
    this.slowUntil = 0;
    (this.jumpLeaves || []).forEach((leaf) => this.removeObject(leaf));
    this.jumpLeaves = [];
    (this.insects || []).forEach((insect) => this.removeObject(insect));
    this.insects = [];
    this.removeObject(this.aimMarker); this.aimMarker = null;
    this.removeObject(this.tongueMesh); this.tongueMesh = null;
    this.removeObject(this.tongueTip); this.tongueTip = null;
    this.showPreview(false);
    if (this.preview) { this.removeObject(this.preview); this.preview = null; }
    (this.bursts || []).forEach((burst) => this.removeObject(burst));
    (this.rings || []).forEach((ring) => this.removeObject(ring));
    this.bursts = [];
    this.rings = [];
    if (this.effects) [...this.effects.children].forEach((child) => this.removeObject(child));
    this.setData({
      transition: false, isCharging: false, isAiming: false, chargePercent: 0,
      bubblePlaying: false, careBusy: false, resting: false, skillArmed: false
    });
  },

  removeObject(object) {
    if (!object) return;
    if (object.parent) object.parent.remove(object);
    const shared = this.sharedMaterials || new Set();
    const geometries = new Set();
    const materials = new Set();
    const pooled = this.art ? this.art.releaseObject(object) : new Set();
    object.traverse && object.traverse((child) => {
      if (child.shadow && child.shadow.map) {
        child.shadow.map.dispose(); child.shadow.map = null;
      }
      if (child.geometry) geometries.add(child.geometry);
      if (child.material) {
        (Array.isArray(child.material) ? child.material : [child.material]).forEach((m) => materials.add(m));
      }
    });
    geometries.forEach((geometry) => { if (!pooled.has(geometry)) geometry.dispose(); });
    materials.forEach((material) => { if (!shared.has(material) && !pooled.has(material)) material.dispose(); });
  },

  disposeThree() {
    this.clearChallengeObjects();
    if (this.themeParticles) { this.removeObject(this.themeParticles); this.themeParticles = null; }
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    if (this.scene) this.scene.children.slice().forEach((object) => this.removeObject(object));
    if (this.art) this.art.dispose();
    if (this.reflectionTarget) { this.reflectionTarget.dispose(); this.reflectionTarget = null; }
    if (this.royalReflectionTarget) { this.royalReflectionTarget.dispose(); this.royalReflectionTarget = null; }
    const textures = new Set();
    (this.sharedMaterials || new Set()).forEach((material) => {
      ["map", "bumpMap", "normalMap", "roughnessMap"].forEach((key) => { if (material[key]) textures.add(material[key]); });
      material.dispose();
    });
    textures.forEach((texture) => texture.dispose());
    if (this.renderer) this.renderer.dispose();
  },

  getRouteById(id) {
    return MALE_ROUTES.concat(FEMALE_ROUTES).find((route) => route.id === id);
  },

  getSelectedRoute() {
    return this.getRouteById(this.data.selectedRouteId);
  }
};

const api = typeof wx === "undefined" ? null : wx;
require("./nurture")(page, api);
require("./jump-level")(page);
require("./bug-level")(page);
require("./adventure")(page, api);
require("./shell")(page);
require("./experience")(page);
if (typeof Page === "function") Page(page);
if (typeof module !== "undefined") module.exports = page;
