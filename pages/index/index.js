const { createScopedThreejs } = require("threejs-miniprogram");
const createArt = require("./art");
const createReturns = require("./returns");

const MALE_ROUTES = [
  { id: "king", name: "国王", tag: "金冠披风", costume: "king", perk: "steady", body: 0x35b966, accent: 0xf5c849 },
  { id: "prince", name: "王子", tag: "白衣蓝绶", costume: "prince", perk: "nimble", body: 0x48c978, accent: 0x7fb7ff },
  { id: "duke", name: "闲散王爷", tag: "折扇玉带", costume: "duke", perk: "serene", body: 0x36ad68, accent: 0xd9b46a },
  { id: "general", name: "铁血将军", tag: "赤甲长枪", costume: "general", perk: "leap", body: 0x2e9f5b, accent: 0xd95345 },
  { id: "ceo", name: "霸道总裁", tag: "西装领带", costume: "ceo", perk: "steady", body: 0x34b86a, accent: 0x1f2b3a },
  { id: "college", name: "帅气男大", tag: "卫衣书包", costume: "college", perk: "nimble", body: 0x4ac878, accent: 0x5b8cff },
  { id: "it", name: "IT理工男", tag: "眼镜键盘", costume: "it", perk: "serene", body: 0x38b96d, accent: 0x36c8d6 },
  { id: "hero", name: "江湖侠客", tag: "斗笠佩剑", costume: "hero", perk: "leap", body: 0x319b5d, accent: 0x8a5a37 },
  { id: "monk", name: "佛系高僧", tag: "袈裟念珠", costume: "monk", perk: "steady", body: 0x3aad67, accent: 0xc57934 }
];

const FEMALE_ROUTES = [
  { id: "queen", name: "女王", tag: "王冠红披风", costume: "queen", perk: "steady", body: 0x42bf72, accent: 0xe84f68 },
  { id: "princess", name: "公主", tag: "蓬蓬裙", costume: "princess", perk: "nimble", body: 0x4bcf7b, accent: 0xf6a5cf },
  { id: "empress", name: "荷塘女帝", tag: "金纹华服", costume: "empress", perk: "kindred", body: 0x38b96c, accent: 0xe7b447 },
  { id: "commander", name: "飒爽女将", tag: "银甲红缨", costume: "commander", perk: "leap", body: 0x34a964, accent: 0xc9d2dc },
  { id: "bosslady", name: "霸道女总裁", tag: "黑裙高跟", costume: "bosslady", perk: "steady", body: 0x3fbd70, accent: 0x202733 },
  { id: "sweetheart", name: "甜妹校花", tag: "蝴蝶结", costume: "sweetheart", perk: "nimble", body: 0x55d181, accent: 0xff93bd },
  { id: "coder", name: "天才程序媛", tag: "圆框眼镜", costume: "coder", perk: "serene", body: 0x43c274, accent: 0x39c7d1 },
  { id: "swordswoman", name: "江湖女侠", tag: "短披风剑穗", costume: "swordswoman", perk: "leap", body: 0x36a967, accent: 0x7d5a44 },
  { id: "saint", name: "佛系圣女", tag: "莲光素衣", costume: "saint", perk: "steady", body: 0x4bc17a, accent: 0xf1d58b },
  { id: "artist", name: "荷塘画师", tag: "贝雷帽画板", costume: "artist", perk: "kindred", body: 0x40b66e, accent: 0xb175d6 }
];

/**
 * 路线被动：让"选路线"真的影响手感，而不只是换顶帽子。
 * 五种都在不同维度上放宽一点，路线之间是风格差异，不是强弱差异。
 */
const PERKS = {
  steady: { name: "稳重", text: "落点判定宽 15%", tolerance: 1.15 },
  nimble: { name: "轻盈", text: "落水机会 +1", lives: 1 },
  leap: { name: "远跳", text: "跳跃距离 +10%", span: 1.10 },
  serene: { name: "从容", text: "蓄力条走得慢 25%", charge: 1.25 },
  kindred: { name: "亲和", text: "成长速度 +12%", growth: 1.12 }
};

/** 结局页的那封"信"：一条路线一封，最后再叠一句按养育方式收尾的话。 */
const LETTERS = {
  king: ["王冠比想象中重。", "但你说过，会一直戴着它。"],
  prince: ["它学会的第一个词是「请」，", "第二个词是你的名字。"],
  duke: ["折扇摇了一整个夏天，", "正事一件没做，快乐一件没落。"],
  general: ["它守住了整片荷塘，", "只在你面前卸下盔甲。"],
  ceo: ["它把你的每一分钟都排进了日程，", "包括发呆的那十分钟。"],
  college: ["书包里装着没写完的作业，", "和一颗想去看海的心。"],
  it: ["它用三天修好了池塘的水泵，", "用三秒相信了你。"],
  hero: ["斗笠压得很低，", "是怕你看见它在笑。"],
  monk: ["水面上什么也没留下，", "除了你。"],
  queen: ["它把整片荷塘分了你一半，", "另一半自己留着看星星。"],
  princess: ["裙子会脏，花会谢，", "但今天它只想转圈给你看。"],
  empress: ["它说这片水养出来的孩子，", "都要先学会照顾别人。"],
  commander: ["银甲上有一道划痕，", "是第一次护着你时留下的。"],
  bosslady: ["它签下了整片荷塘，", "合同最后一条写着：随时来玩。"],
  sweetheart: ["整个夏天它只做了一件事——", "把最好的那片叶子留给你。"],
  coder: ["它把你写过的每一行代码，", "都游了一遍。"],
  swordswoman: ["剑穗上系着一段红绳，", "另一头在你手里。"],
  saint: ["莲开时它在打坐，", "莲谢时它在等你。"],
  artist: ["它记得的不是荷叶，", "是你调色时哼的那支调子。"]
};

const CARE_EPILOGUE = {
  feed: "你喂得很急，像怕它长不大。",
  pet: "你摸得很轻，像怕它受惊。",
  play: "你陪它玩到水都凉了。"
};

const GRADE_ORDER = ["C", "B", "A", "S"];

const PET_STORAGE = "tadpole-companion-v1";
const SKILLS = {
  glide: { name: "轻风滑翔", text: "修正下一跳的落点", symbol: "↗" },
  anchor: { name: "定叶术", text: "稳住眼前荷叶，驱散阵风", symbol: "⚓" },
  forecast: { name: "叶心计算", text: "下一次蓄力自动在最佳位置起跳", symbol: "◎" },
  slow: { name: "静心时刻", text: "六秒内蓄力和机关放慢", symbol: "◷" },
  rescue: { name: "莲叶相助", text: "下一次落空时召来救援叶", symbol: "✦" }
};
const DISTRICTS = [
  { name: "浅水初遇", water: 0x49745b, sky: 0xcde2e6 },
  { name: "水草摇曳", water: 0x366a53, sky: 0xc3dfe0 },
  { name: "荷花深处", water: 0x42745a, sky: 0xd4e5df },
  { name: "池心盛夏", water: 0x326356, sky: 0xc5dedf }
];
const SOUVENIRS = [
  { at: 1, name: "初夏荷花" }, { at: 3, name: "萤火小灯" }, { at: 5, name: "荷塘草帽" }
];

// Every fifth leaf records progress without interrupting the next jump.
const JUMP_PLAN = [
  { gap: 2.90 },
  { gap: 3.10, size: 1.02 },
  { gap: 3.20 },
  { gap: 3.30 },
  { gap: 3.10 },
  { gap: 3.25, drift: 0.26, driftSpeed: 1.2 },
  { gap: 3.45, drift: 0.42, driftSpeed: 1.5 },
  { gap: 3.40, drift: 0.36, driftSpeed: 1.4 },
  { gap: 3.55, drift: 0.40, driftSpeed: 1.6 },
  { gap: 3.20 },
  { gap: 3.40, sink: true },
  { gap: 3.55, sink: true },
  { gap: 3.60, drift: 0.38, driftSpeed: 1.5 },
  { gap: 3.65, sink: true },
  { gap: 3.30 },
  { gap: 3.50, drift: 0.45, driftSpeed: 1.9, size: 0.9, wind: 0.40 },
  { gap: 3.85, wind: 0.46 },
  { gap: 3.70, size: 0.92, sink: true },
  { gap: 3.75, drift: 0.36, driftSpeed: 1.6, wind: 0.32 },
  { gap: 3.40 }
];

const JUMP_GOAL = JUMP_PLAN.length;
const BUG_GOAL = 10;
const BUG_GUIDE = [
  "按住昆虫，拖动手指调整瞄准方向。",
  "金色准星时松手伸舌；灰色时等虫飞近。",
  "吃到 " + BUG_GOAL + " 只昆虫即可通关。"
];

const SINK_TIME = 2000;   // 落在沉叶上到沉下去的时间，必须比"蓄力+飞行"长才公平
const WIND_SPEED = 2.0;   // 阵风摆动速度（弧度/秒）

// 手感常量：集中在顶部，方便一次性调。
const CHARGE_TIME = 900;        // 蓄力从 0 到满
const JUMP_MIN = 1.35;          // 最短跳跃距离
const JUMP_SPAN = 2.60;         // 蓄满额外距离（最远 3.95，覆盖最长的 3.85）
const ANTICIPATE_TIME = 90;     // 起跳前的下蹲
const FLIGHT_TIME = 340;        // 空中时间
const LANDING_TIME = 150;       // 落地挤压
const SETTLE_TIME = 180;        // 回弹
const TONGUE_OUT = 110;
const TONGUE_HOLD = 70;
const TONGUE_BACK = 190;
const TONGUE_RANGE = 2.9;      // 舌头够得到多远；超出就舔个空，得等虫子飞近
const INPUT_BUFFER = 260;       // 输入缓冲窗口

// 跳跃关取景：俯角要陡，青蛙才会沉到画面下方、把上方留给荷叶。
const JUMP_PITCH = 1.04;
const JUMP_SIDE = 0.20;         // 机位相对跳跃方向左右偏一点，左右交替，构图不至于每跳都一样

// 落水机会：一次失手不再把整关打回第 1 跳
const JUMP_LIVES = 3;
const RESPAWN_DELAY = 780;
const PERFECT_SCORE = 0.3;      // 落点归一化距离低于这个值 = 正中叶心

// 养成：三个按钮各自只加一项，另外两项下滑；成长速度由最低项决定
const CARE_AMOUNT = 25;
const CARE_DECAY = 6;
const CARE_BOOSTS = {
  feed: { key: "food", type: "feed", label: "开饭啦", color: 0xffd68a, text: "它把整口都吞了下去。" },
  pet: { key: "affection", type: "pet", label: "好喜欢你", color: 0xff9fb6, text: "它蹭了蹭你的指腹。" },
  play: { key: "play", type: "play", label: "追上我呀", color: 0x8fddec, text: "它在水草间绕了一圈。" }
};
const CARE_TITLES = {
  feed: "溺爱式养育",
  pet: "温柔式养育",
  play: "放养式养育"
};

const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
const easeOutBack = (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
const easeInQuad = (t) => t * t;
const smooth = (t) => t * t * (3 - 2 * t);
const angleDelta = (from, to) => (((to - from + Math.PI) % TAU) + TAU) % TAU - Math.PI;
const lerpAngle = (from, to, t) => from + angleDelta(from, to) * t;
/** 朝 to 转，但单次最多转 maxTurn —— 保证路径连续、镜头不会每跳大回环。 */
const turnToward = (from, to, maxTurn) => from + clamp(angleDelta(from, to), -maxTurn, maxTurn);

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
    falls: 0,
    attempts: JUMP_LIVES,
    attemptSlots: [0, 1, 2],   // HUD 上的机会圆点，数量要和 JUMP_LIVES 一致
    perfect: 0,
    jumps: 0,
    jumpGoal: JUMP_GOAL,
    bugs: 0,
    bugGoal: BUG_GOAL,
    isCharging: false,
    isJumping: false,
    isAiming: false,
    chargePercent: 0,
    chargeHint: "长按蓄力",
    chargeTone: "far",
    gameOver: false,
    failTitle: "荷叶小径",
    failUnit: "片荷叶",
    threeReady: false,
    message: "先养一只属于你的蝌蚪。",
    chapter: "初遇",
    actionLabel: "",
    careBusy: false,
    paused: false,
    initError: false,
    targetCharge: 50,
    transition: false,
    metCount: 0,
    routeTotal: 19,
    newRoute: false,
    petName: "小荷",
    hasCompanion: false,
    choosingNew: false,
    savedPetName: "",
    savedPetRoute: "",
    savedPetStage: "",
    snacks: 0,
    adventures: 0,
    souvenirs: [],
    rewardText: "",
    petHabit: "",
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
    // 转发 + 朋友圈。老版本基础库没有 shareTimeline，取不到就算了。
    try {
      if (typeof wx !== "undefined" && wx.showShareMenu) {
        wx.showShareMenu({ withShareTicket: true, menus: ["shareAppMessage", "shareTimeline"] });
      }
    } catch (error) {
      // 忽略：不影响游戏
    }
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

  /** 记录"遇到过哪些路线"。存不进本地也不影响这一局，所以整段都兜住异常。 */
  loadCollection() {
    if (this.metRoutes) return this.metRoutes;
    let saved = [];
    try {
      if (typeof wx !== "undefined" && wx.getStorageSync) saved = wx.getStorageSync("tadpole-met-routes");
    } catch (error) {
      saved = [];
    }
    this.metRoutes = Array.isArray(saved) ? saved.slice() : [];
    return this.metRoutes;
  },

  /** 记下这条路线；第一次遇到返回 true，用来在结局页标"新相遇"。 */
  saveRoute(id) {
    if (!id) return false;
    const met = this.loadCollection();
    if (met.indexOf(id) >= 0) {
      this.setData({ metCount: met.length });
      return false;
    }
    met.push(id);
    try {
      if (typeof wx !== "undefined" && wx.setStorageSync) wx.setStorageSync("tadpole-met-routes", met);
    } catch (error) {
      // 存不进去也不影响这一局
    }
    this.setData({ metCount: met.length });
    return true;
  },

  // ------------------------------------------------------------------ 初始化

  loadCompanion() {
    let saved;
    try {
      if (typeof wx !== "undefined" && wx.getStorageSync) saved = wx.getStorageSync(PET_STORAGE);
    } catch (error) { saved = null; }
    if (!saved || saved.version !== 1 || !this.getRouteById(saved.routeId)
      || typeof saved.name !== "string" || !Number.isFinite(saved.growth)) return;
    const number = (value, max) => Number.isFinite(value) ? clamp(Math.floor(value), 0, max) : 0;
    this.companion = {
      id: typeof saved.id === 'string' ? saved.id.slice(0,100) : 'legacy-' + saved.routeId + '-' + saved.name.slice(0,12),
      lastRewardedRunId: typeof saved.lastRewardedRunId === 'string' ? saved.lastRewardedRunId.slice(0,100) : '',
      version: 1, name: saved.name.trim().slice(0, 12) || "小荷", routeId: saved.routeId,
      growth: number(saved.growth, 140), food: number(saved.food, 100),
      affection: number(saved.affection, 100), play: number(saved.play, 100),
      snacks: number(saved.snacks, 999), adventures: number(saved.adventures, 9999),
      careCounts: { feed: number(saved.careCounts && saved.careCounts.feed, 99999),
        pet: number(saved.careCounts && saved.careCounts.pet, 99999),
        play: number(saved.careCounts && saved.careCounts.play, 99999) }
    };
    this.companionId = this.companion.id;
    this.lastRewardedRunId = this.companion.lastRewardedRunId;
    this.updateCompanionSummary();
  },

  updateCompanionSummary() {
    const pet = this.companion;
    this.setData({ hasCompanion: !!pet, savedPetName: pet ? pet.name : "",
      savedPetRoute: pet ? this.getRouteById(pet.routeId).name : "",
      savedPetStage: pet ? this.getGrowthStage(pet.growth).name : "" });
  },

  saveCompanion() {
    this.saveAdventure();
    if (!this.companionActive || !this.getSelectedRoute()) return false;
    this.companion = { version: 1, name: this.data.petName, routeId: this.data.selectedRouteId,
      id: this.companionId, lastRewardedRunId: this.lastRewardedRunId || '',
      growth: this.data.growth, food: this.data.food, affection: this.data.affection, play: this.data.play,
      snacks: this.data.snacks, adventures: this.data.adventures,
      careCounts: Object.assign({}, this.careCounts) };
    let stored = true;
    try {
      if (typeof wx !== "undefined" && wx.setStorageSync) wx.setStorageSync(PET_STORAGE, this.companion);
    } catch (error) {
      stored = false;
      this.setData({ storageNotice: "暂时无法保存，离开前请检查设备存储空间" });
    }
    this.updateCompanionSummary();
    if(stored&&this.runRewarded&&this.currentRun&&this.lastRewardedRunId===this.currentRun.id){this.rewardStored=true;this.clearSavedAdventure();}
    return stored;
  },

  resumeCompanion() {
    if (!this.data.threeReady || !this.companion) return;
    const pet = this.companion;
    this.companionId = pet.id;
    this.lastRewardedRunId = pet.lastRewardedRunId || '';
    const route = this.getRouteById(pet.routeId);
    const stage = this.getGrowthStage(pet.growth);
    this.clearChallengeObjects();
    this.companionActive = true;
    this.perk = PERKS[route.perk];
    this.careCounts = Object.assign({ feed: 0, pet: 0, play: 0 }, pet.careCounts);
    this.petStage = stage.index;
    const need = this.needState(pet.food, pet.affection, pet.play);
    this.setData({ phase: "nurture", petName: pet.name, selectedRouteId: route.id,
      selectedRouteName: route.name, selectedPerkName: this.perk.name, selectedPerkText: this.perk.text,
      growth: pet.growth, growthPercent: clamp(Math.round(pet.growth / 118 * 100), 0, 100),
      food: pet.food, affection: pet.affection, play: pet.play,
      snacks: pet.snacks, adventures: pet.adventures,
      souvenirs: SOUVENIRS.filter((item) => pet.adventures >= item.at).map((item) => item.name),
      canChallenge: stage.index >= 3, stageName: stage.name, chapter: pet.name + "的池塘",
      careTitle: stage.index >= 3 ? this.careTitle() : "", careKey: this.careTopKey(),
      needKey: need.key, needHint: need.hint, careBusy: false, actionLabel: "",
      gameOver: false, transition: false, petHabit: this.habitText() });
    this.spawnPet(stage.index);
    this.floatLeaves.visible = true;
    this.updateHomeDecor();
    this.cameraSnap();
  },

  openNewCompanion() {
    const open = () => { this.openRoutes('new'); };
    if (typeof wx === "undefined" || !wx.showModal) { open(); return; }
    wx.showModal({ title: "结识新的伙伴", content: "新伙伴会接替当前的陪伴。已收集的路线和最好成绩会保留，确认名字后才会替换。",
      confirmText: "去看看", success: (result) => { if (result.confirm) open(); } });
  },

  cancelNewCompanion() {
    if(this.companion)this.resumeCompanion();else this.goHome();
    this.setData({ choosingNew: false });
  },

  renameCompanion() {
    if (this.data.careBusy || this.data.phase !== "nurture") return;
    this.askPetName(this.data.petName, (name) => {
      this.setData({ petName: name, chapter: name + "的池塘" });
      this.saveCompanion();
    });
  },

  askPetName(current, done) {
    if (typeof wx === "undefined" || !wx.showModal) { done(current || "小荷"); return; }
    wx.showModal({ title: "给伙伴取个名字", editable: true, placeholderText: "最多 12 个字",
      content: current || "", confirmText: "就叫这个", success: (result) => {
        if (result.confirm) done((result.content || current || "小荷").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 12) || "小荷");
      } });
  },

  returnToPond() {
    this.saveCompanion();
    if (this.companionActive && this.companion) this.resumeCompanion();
    else this.openRoutes();
  },

  habitText() {
    const key = this.careTopKey();
    return { feed: "喜欢等你开饭", pet: "喜欢蹭蹭你的手", play: "一看见泡泡就想追" }[key];
  },

  updateHomeDecor() {
    if (!this.pondGroup) return;
    this.removeObject(this.homeDecor);
    this.homeDecor = new this.THREE.Group();
    this.pondGroup.add(this.homeDecor);
    const count = this.data.phase === "nurture" ? this.data.adventures : (this.companion ? this.companion.adventures : 0);
    if (count >= 1) {
      const lotus = this.ensureArt().makeLotusCluster(this.materials, 1.1);
      lotus.position.set(-1.6, 0.04, 1.0); this.homeDecor.add(lotus);
    }
    if (count >= 3) {
      const lamp = new this.THREE.Mesh(new this.geo.Sphere(0.12, 12, 8), this.materials.gold);
      lamp.position.set(1.6, 0.85, 1.1); this.homeDecor.add(lamp);
    }
    if (count >= 5) {
      const hat = new this.THREE.Mesh(new this.geo.Cone(0.30, 0.20, 16), this.materials.gold);
      hat.position.set(1.5, 0.12, 1.3); this.homeDecor.add(hat);
    }
  },

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
      .select("#webgl")
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
          this.camera.position.set(4,6,8);this.camera.lookAt(new T.Vector3(0,0,0));
          this.renderer.render(this.scene,this.camera);
          const finish=()=>{
            if(this.unloaded)return;
            try{
              this.captureReflections();this.showNurturePreview();this.cameraSnap();
              this.setData({threeReady:true,initError:false});this.startLoop();
            }catch(error){this.stopLoop();this.setData({threeReady:false,initError:true});console.error('Character preparation failed',error);}
          };
          this.initFrame=canvas.requestAnimationFrame(()=>{this.initFrame=canvas.requestAnimationFrame(finish);});
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

    // Decode color textures into linear space and encode the final display output.
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

  // ------------------------------------------------------------------ 材质与场景

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
    // 雾从 24 开始：角色在 5~8 的位置完全不受影响，只有远景被吃掉。
    this.scene.fog = new T.Fog(0xcdeee0, 24, 62);
    this.scene.add(art.makeSky(0xdcebf0, 0x689ab8, 78));

    // 三灯布光：主光暖、天光冷且压低（给形体留暗部）、背后一盏冷轮廓光。
    const hemi = new T.HemisphereLight(0xe4efff, 0x34452b, 0.8);
    this.scene.add(hemi);

    const sun = new T.DirectionalLight(0xfff1d4, 1.6);
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
    rim.position.set(6, 5.5, -7);
    this.scene.add(rim);

    const bounce = new T.DirectionalLight(0xffd8a6, 0.16);
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

    // 水面用环形几何体：既保持圆形轮廓，又有足够顶点做顶点位移。
    const waterGeometry = new this.geo.Ring(0.02, 10.7, 96, 20);
    this.waterMesh = new T.Mesh(waterGeometry, mats.water);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = 0;
    this.waterMesh.receiveShadow = true;
    this.pondGroup.add(this.waterMesh);

    this.applyWaterShader();

    // 岸边压一圈深色环，把圆形池沿"收"进画面里
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
    this.homeLeaf=art.makeLeaf(mats,1.25);this.homeLeaf.position.set(0,.045,1.2);
    this.homeLeaf.visible=false;this.floatLeaves.add(this.homeLeaf);

    this.worldTadpoles = [];
    for (let i = 0; i < 10; i += 1) {
      const tadpole = art.makeTadpole(i % 3, 0.32 + (i % 4) * 0.04, mats);
      // 背景蝌蚪是"氛围"不是"角色"：不投影，省掉一遍 shadow pass
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
    this.sceneStartedAt=Date.now();
  },

  applyWaterShader() {
    this.waterRipples=Array.from({length:6},()=>new this.THREE.Vector4(0,0,-100,0));
    this.nextWaterRipple=0;
    const material = this.materials.water;
    material.roughness=.18;material.clearcoat=.62;
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
      shader.fragmentShader='uniform float pondTime;uniform vec4 pondRipples[6];varying vec2 pondCoord;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat depthPattern=.5+.5*sin(pondCoord.x*.55)*cos(pondCoord.y*.62);\ndiffuseColor.rgb*=mix(vec3(.72,.86,.90),vec3(1.12,1.20,1.06),depthPattern);\nfloat shimmer=pow(max(0.,sin(pondCoord.x*4.3+pondTime*.65)*sin(pondCoord.y*4.7-pondTime*.4)),12.);\ndiffuseColor.rgb+=vec3(.025,.05,.035)*shimmer;\nfor(int i=0;i<6;i++){float age=pondTime-pondRipples[i].z;if(age>=0.&&age<3.&&pondRipples[i].w>.01){float radius=length(pondCoord-pondRipples[i].xy);if(abs(radius-age*.7)<.75){float ring=sin(radius*22.-age*8.)*exp(-pow(radius-age*.7,2.)*12.);float fade=exp(-age*1.6);diffuseColor.rgb+=vec3(.055,.09,.065)*ring*fade*pondRipples[i].w;}}}');
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
    const index=this.nextWaterRipple++%this.waterRipples.length;
    this.waterRipples[index].set(position.x,position.z,(Date.now()-this.sceneStartedAt)/1000,strength||.5);
  },

  captureReflections() {
    if (!this.renderer || !this.renderer.getContext || !this.THREE.CubeCamera) return;
    const camera = new this.THREE.CubeCamera(.1, 90, 128);
    camera.position.set(0,.25,0); this.scene.add(camera);
    this.waterMesh.visible = false;
    try {
      camera.update(this.renderer, this.scene);
      this.reflectionTarget = camera.renderTarget;
      [this.materials.water,this.materials.frogSkin,this.materials.frogBody,this.materials.tadpoleSkin,
        this.materials.royalSkin,this.materials.royalHead,this.materials.royalBody,this.materials.royalGold,this.materials.royalRuby,this.materials.royalIris].forEach(material => {
        material.envMap = camera.renderTarget.texture; material.envMapIntensity = material === this.materials.water ? .75 : material === this.materials.royalGold ? 1.0 : .4;
        material.needsUpdate = true;
      });
    } catch (error) { camera.renderTarget.dispose(); }
    this.waterMesh.visible = true; this.scene.remove(camera);
    this.captureRoyalReflections();
  },

  captureRoyalReflections() {
    const T=this.THREE,studio=new T.Scene();
    studio.background=new T.Color(0x8e8a7f).convertSRGBToLinear();
    const panels=[];
    [[-3,3,3,3,4],[3,1,2,1.4,4],[0,5,-1,4,3]].forEach(([x,y,z,w,h])=>{
      const plane=new T.Mesh(new this.geo.Plane(w,h),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,toneMapped:false}));
      plane.position.set(x,y,z);plane.lookAt(new T.Vector3());studio.add(plane);panels.push(plane);
    });
    const camera=new T.CubeCamera(.1,30,256);
    camera.renderTarget.texture.generateMipmaps=true;
    camera.renderTarget.texture.minFilter=T.LinearMipmapLinearFilter;
    studio.add(camera);
    try {
      camera.update(this.renderer,studio);this.royalReflectionTarget=camera.renderTarget;
      ['royalHead','royalSkin','royalBody','royalGold','royalRuby','royalIris'].forEach(key=>{
        const material=this.materials[key];material.envMap=camera.renderTarget.texture;
        material.envMapIntensity=key==='royalGold'?.95:key==='royalRuby'?.65:key==='royalIris'?.10:.12;
        material.needsUpdate=true;
      });
    } catch(error){camera.renderTarget.dispose();}
    panels.forEach(plane=>{plane.geometry.dispose();plane.material.dispose();});
  },

  // ------------------------------------------------------------------ 角色

  showNurturePreview() {
    if(this.homeLeaf)this.homeLeaf.visible=false;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.frogGroup = null;
    const saved = ['home','status','settings'].includes(this.data.phase) ? this.companion : null;
    if (!saved && ['home','status','settings'].includes(this.data.phase)) {
      this.materials.water.opacity = .68; this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getRouteById('king'), 1.12, this.materials);
      this.frogGroup.position.set(0,.11,1.2);this.homeLeaf.visible=true;this.pondGroup.add(this.frogGroup);return;
    }
    if (saved && this.getGrowthStage(saved.growth).index >= 3) {
      this.materials.water.opacity = .74;
      this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getRouteById(saved.routeId), 1.12, this.materials);
      this.frogGroup.position.set(0, 0.11, 1.2);
      this.homeLeaf.visible=true;
      this.pondGroup.add(this.frogGroup);
      this.updateHomeDecor();
      return;
    }
    this.petGroup = this.ensureArt().makeTadpole(saved ? this.getGrowthStage(saved.growth).index : 0, 1.45, this.materials);
    this.petGroup.position.set(0, -.43, 1.2);
    this.materials.water.opacity = .48;
    this.pondGroup.add(this.petGroup);
    this.updateHomeDecor();
  },

  spawnPet(stage) {
    if(this.homeLeaf)this.homeLeaf.visible=stage>=3;
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.frogGroup = null;
    if (stage >= 3) {
      this.materials.water.opacity = .74;
      this.petGroup = null;
      this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 1.12, this.materials);
      this.frogGroup.position.set(0, 0.11, 1.2);
      this.pondGroup.add(this.frogGroup);
      this.popIn(this.frogGroup);
      return;
    }
    this.petGroup = this.ensureArt().makeTadpole(stage, 1.45, this.materials);
    this.petGroup.position.set(0, -.43, 1.2);
    this.materials.water.opacity = .48;
    this.pondGroup.add(this.petGroup);
    this.popIn(this.petGroup);
  },

  /** 新模型不要"啪"地出现，用 300ms 的过冲缩放把它"长"出来。 */
  popIn(group) {
    group.userData.pop = { start: Date.now(), duration: 300 };
    group.userData.dyApplied = 0;
  },

  actor() {
    return this.frogGroup || this.petGroup;
  },

  /** 角色子类沿用的通用尺寸（世界单位），由 art.js 建模时量好。 */
  actorSize() {
    const actor = this.actor();
    const base = actor && actor.userData.baseScale ? actor.userData.baseScale : 1;
    return {
      w: (actor && actor.userData.sizeW ? actor.userData.sizeW : 1.4) * base,
      h: (actor && actor.userData.sizeH ? actor.userData.sizeH : 1.5) * base,
      d: (actor && actor.userData.sizeD ? actor.userData.sizeD : 0.8) * base
    };
  },

  // ------------------------------------------------------------------ 镜头

  /**
   * 竖屏的水平视场只有垂直的 0.46 倍，所以取景必须同时满足两个方向。
   * 用"包住包围盒的球"来算距离：球在任何机位下的投影都一样大，
   * 因此不必猜朝向，也不会出现"转到某个角度就被裁掉"。
   */
  actorDistance(marginH, marginW) {
    const size = this.actorSize();
    const tan = Math.tan((this.camera.fov * Math.PI) / 360);
    const aspect = this.camera.aspect || 0.46;
    const radiusH = 0.5 * Math.hypot(size.w, size.d);
    const radiusV = 0.5 * Math.hypot(size.h, size.d);
    const byHeight = radiusV / (tan * marginH);
    const byWidth = radiusH / (tan * aspect * marginW);
    return clamp(Math.max(byHeight, byWidth), 2.5, 12);
  },

  fitPortraitGoal(goal, phase) {
    if (!this.frogGroup || !['home','route','nurture'].includes(phase)) return goal;
    const size=this.actorSize(),rpx=this.width/750,height=this.height;
    const top=phase==='home'?height*.12+rpx*163+10:phase==='nurture'?height*.13+rpx*135+10:height*.09+rpx*176+10;
    const bottom=phase==='home'?height-rpx*270-10:phase==='nurture'?height-rpx*(this.data.souvenirs.length?650:600)-10:height*.76-rpx*216-10;
    const band=Math.max(.18,(bottom-top)/height),tan=Math.tan(this.camera.fov*Math.PI/360);
    const depth=Math.abs(Math.sin(goal.yaw))*size.w+Math.abs(Math.cos(goal.yaw))*size.d;
    const upRadius=(size.h*Math.cos(goal.pitch)+depth*Math.sin(goal.pitch))*.5;
    const depthRadius=(size.h*Math.sin(goal.pitch)+depth*Math.cos(goal.pitch))*.5;
    goal.dist=Math.max(goal.dist,upRadius/(tan*band)+depthRadius);
    const centerY=this.frogGroup.position.y+(this.frogGroup.userData.lift||0)*this.frogGroup.userData.baseScale+size.h*.5;
    const screenCenter=1-(top+bottom)/height,offset=screenCenter*goal.dist*tan;
    goal.fx=this.frogGroup.position.x+Math.sin(goal.yaw)*Math.sin(goal.pitch)*offset;
    goal.fy=centerY-Math.cos(goal.pitch)*offset;
    goal.fz=this.frogGroup.position.z+Math.cos(goal.yaw)*Math.sin(goal.pitch)*offset;
    return goal;
  },

  /** 按当前 phase 算目标机位，保存到 this.cam 的 goal 字段。 */
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

      // 1) 俯角要陡：青蛙沉到画面下三分之一，荷叶才能浮到上半屏，两者不重叠。
      // 2) 机位再相对跳跃方向偏一点，青蛙落在画面一侧、荷叶落在另一侧；
      //    左右交替，避免每一跳的构图都一样。
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
      goal.yaw = -2.28;
      goal.pitch = .36;
      goal.fx = 0; goal.fy = 1.65; goal.fz = 1.9;
      const box=new T.Box3(new T.Vector3(-1.65,.1,-.4),new T.Vector3(1.65,3.3,4.1));
      if(this.frogGroup){this.frogGroup.updateMatrixWorld(true);box.union(new T.Box3().setFromObject(this.frogGroup));}
      const view=new T.Vector3(Math.sin(goal.yaw)*Math.cos(goal.pitch),Math.sin(goal.pitch),Math.cos(goal.yaw)*Math.cos(goal.pitch));
      const right=new T.Vector3(0,1,0).cross(view).normalize(),up=view.clone().cross(right);
      const focus=new T.Vector3(goal.fx,goal.fy,goal.fz),tan=Math.tan(this.camera.fov*Math.PI/360);
      goal.dist=4;
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
        const corner=new T.Vector3(x,y,z).sub(focus),depth=corner.dot(view);
        goal.dist=Math.max(goal.dist,depth+Math.abs(corner.dot(right))/(tan*this.camera.aspect*.88),depth+Math.abs(corner.dot(up))/(tan*.70));
      }
      return goal;
    }

    // 养成 / 选路线 / 结局：一次偏 3/4 的肖像机位
    goal.yaw = 0.34;
    goal.pitch = this.petGroup ? .55 : .16;
    goal.dist = this.actorDistance(phase === "final" ? 0.72 : 0.78, 0.90) * (this.petGroup ? 1 : phase === 'final' || phase === 'status' ? 1.25 : 1.12);
    goal.fx = 0;
    goal.fy = this.petGroup ? -.12 : (this.actor() ? this.actor().position.y : 0) + this.actorSize().h * .52 - (phase === 'final' || phase === 'status' ? 1.12 : phase === 'route' ? .85 : .60);
    goal.fz = 1.2;
    return this.fitPortraitGoal(goal,phase);
  },

  updateCamera(dt) {
    if (!this.camera) return;
    const T = this.THREE;
    const goal = this.cameraGoal();
    const state = this.cam;
    if (!state.ready) {
      this.cameraSnap();
      return;
    }
    const rate = 5.5;
    state.dist = damp(state.dist, goal.dist, rate, dt);
    state.pitch = damp(state.pitch, goal.pitch, rate, dt);
    state.fy = damp(state.fy, goal.fy, rate, dt);
    state.fx = damp(state.fx, goal.fx, rate, dt);
    state.fz = damp(state.fz, goal.fz, rate, dt);
    // 偏航要按最短路径插值，否则跨越 ±π 时会绕一整圈
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

  /** 切场景时直接落位，避免镜头从上一个场景一路飘过来。 */
  cameraSnap() {
    const goal = this.cameraGoal();
    const state = this.cam;
    state.yaw = goal.yaw;
    state.pitch = goal.pitch;
    state.dist = goal.dist;
    state.fx = goal.fx;
    state.fy = goal.fy;
    state.fz = goal.fz;
    state.ready = true;
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

  // ------------------------------------------------------------------ 引导流程

  // Older preview scripts still call these entry points.
  chooseGender() { this.openRoutes(); },
  backToGender(destination) { this.openRoutes(destination); },

  routesForSelection() {
    return MALE_ROUTES.concat(FEMALE_ROUTES).map(route=>Object.assign({},route,{
      perkName: PERKS[route.perk] ? PERKS[route.perk].name : "",
      met: this.loadCollection().indexOf(route.id)>=0
    }));
  },

  selectRoute(event) {
    if (!this.data.threeReady) return;
    const route = this.getRouteById(event.currentTarget.dataset.id);
    if (!route) return;
    const perk = PERKS[route.perk] || null;
    const skill = SKILLS[this.skillForRoute(route.id)];
    this.perk = perk;                       // 被动从这里开始生效，直到回到首页
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
      chapter: route.name,
      message: "已选择：" + route.name + (perk ? "（" + perk.name + "）" : "")
    });
    this.cameraSnap();
  },

  /** 路线被动的倍率；没选路线时一律按 1 处理。 */
  perkValue(key) {
    const perk = this.perk;
    return perk && typeof perk[key] === "number" ? perk[key] : 1;
  },

  perkLives() {
    const perk = this.perk;
    return perk && typeof perk.lives === "number" ? perk.lives : 0;
  },

  jumpSpan() {
    return JUMP_SPAN * this.perkValue("span");
  },

  chargeTime() {
    return CHARGE_TIME * this.perkValue("charge") * (this.slowUntil > Date.now() ? 1.7 : 1);
  },

  confirmRoute() {
    if (!this.data.threeReady) return;
    if (!this.data.selectedRouteId) {
      this.setData({ message: "先选一条成长路线，它会影响青蛙外观。" });
      return;
    }
    this.askPetName("", (name) => this.beginCompanion(name));
  },

  beginCompanion(name) {
    if (!this.data.threeReady || !this.getSelectedRoute()) return;
    this.newCompanionIdentity();
    this.showNurturePreview();
    this.companionActive = true;
    this.petStage = 0;
    this.careCounts = { feed: 0, pet: 0, play: 0 };
    this.setData({
      phase: "nurture",
      petName: name,
      choosingNew: false,
      snacks: 0, adventures: 0, souvenirs: [], rewardText: "", storageNotice: "", petHabit: "",
      food: 12,
      affection: 10,
      play: 8,
      growth: 0,
      growthPercent: 0,
      stageName: "幼年小蝌蚪",
      canChallenge: false,
      careTitle: "",
      careKey: "",
      needKey: "play",
      needHint: "它想玩一会儿",
      chapter: name + "的池塘",
      message: "喂食、抚摸、陪玩，让它慢慢长出后腿。"
    });
    this.saveCompanion();
    this.updateHomeDecor();
    this.cameraSnap();
    this.recordMemory('birth',{title:'第一次相遇',note:'从一只小蝌蚪开始，和你一起长大。',stage:0});
  },

  // ------------------------------------------------------------------ 养成

  /**
   * 三个按钮各自只把一项拉上去，另外两项会下滑；成长速度由"最低的那一项"决定。
   * 于是"只喂食"会明显变慢、三项数值也会肉眼可见地垮下去——
   * 这是把养成从"点着看动画"变成"自己找平衡"的关键一步。
   */
  careAction(event) {
    if (this.data.phase !== "nurture" || this.data.careBusy || !this.data.threeReady) return;
    const boost = CARE_BOOSTS[event.currentTarget.dataset.type];
    if (!boost) return;
    if (boost.type === "play") { this.startBubbleGame(); return; }

    this.careMotion = { type: boost.type, start: Date.now(), duration: 950, boost };
    this.setData({ careBusy: true, actionLabel: boost.label });
    const actor = this.actor();
    if (actor) {
      this.emitBurst(actor.position.clone().add(new this.THREE.Vector3(0, 0.5, 0)), boost.color, 8);
    }
    this.vibrate("light");
  },

  applyCare(boost) {
    const next = { food: this.data.food, affection: this.data.affection, play: this.data.play };
    const snack = boost.type === "feed" && this.data.snacks > 0;
    next[boost.key] = clamp(next[boost.key] + CARE_AMOUNT + (snack ? 15 : 0), 0, 100);
    Object.keys(next).forEach((key) => {
      if (key !== boost.key) next[key] = clamp(next[key] - CARE_DECAY, 0, 100);
    });

    // 木桶效应：最缺的那一项决定这次成长多少
    const lowest = Math.min(next.food, next.affection, next.play);
    const gain = Math.round((10 + lowest / 10) * this.perkValue("growth"));   // 10 ~ 20，亲和再 +12%
    const growth = clamp(this.data.growth + gain, 0, 140);
    const stage = this.getGrowthStage(growth);

    if (!this.careCounts) this.careCounts = { feed: 0, pet: 0, play: 0 };
    this.careCounts[boost.type] += 1;

    const changed = stage.index !== (this.petStage === undefined ? 0 : this.petStage);
    this.petStage = stage.index;
    if (changed) this.spawnPet(stage.index);

    const need = this.needState(next.food, next.affection, next.play);
    const done = stage.index >= 3;
    this.setData({
      food: next.food,
      affection: next.affection,
      play: next.play,
      snacks: Math.max(0, this.data.snacks - (snack ? 1 : 0)),
      growth,
      growthPercent: clamp(Math.round((growth / 118) * 100), 0, 100),
      stageName: stage.name,
      canChallenge: done,
      careTitle: done ? this.careTitle() : this.data.careTitle,
      careKey: done ? this.careTopKey() : this.data.careKey,
      petHabit: this.habitText(),
      needKey: need.key,
      needHint: need.hint,
      message: done ? "小青蛙长成了，可以去闯关。" : boost.text
    });
    this.saveCompanion();
    if(changed)this.recordMemory('growth-'+stage.index,{title:['初遇','长出后腿啦','四肢齐全啦','长成小青蛙'][stage.index],note:stage.name,stage:stage.index});
  },

  startBubbleGame() {
    if (this.data.careBusy || this.data.phase !== "nurture") return;
    this.bubbleGame = { start: Date.now(), duration: 10000, score: 0 };
    this.setData({ bubblePlaying: true, bubbleScore: 0, bubbleSeconds: 10, careBusy: true, actionLabel: "追泡泡" });
    this.spawnPlayBubble();
  },

  spawnPlayBubble() {
    this.removeObject(this.playBubble);
    if (!this.bubbleGame) return;
    const T = this.THREE;
    const material = new T.MeshStandardMaterial({ color: 0xb9f5ef, transparent: true,
      opacity: 0.65, roughness: 0.12, metalness: 0.18 });
    this.playBubble = new T.Mesh(new this.geo.Sphere(0.20, 20, 16), material);
    this.playBubble.position.set((Math.random() - 0.5) * 1.8, 0.65 + Math.random() * 0.65, 1.25);
    this.playBubble.userData.start = Date.now();
    this.pondGroup.add(this.playBubble);
  },

  touchPlayBubble(touch) {
    if (!this.playBubble || !this.bubbleGame || !touch) return;
    this.camera.updateMatrixWorld();
    const p = this.playBubble.position.clone().project(this.camera);
    const distance = Math.hypot((p.x + 1) * this.width / 2 - touch.x, (1 - p.y) * this.height / 2 - touch.y);
    if (distance > 48) return;
    this.emitBurst(this.playBubble.position.clone(), 0xb9f5ef, 7);
    this.bubbleGame.score += 1;
    this.setData({ bubbleScore: this.bubbleGame.score });
    this.vibrate("light");
    this.spawnPlayBubble();
    if (this.bubbleGame.score >= 5) this.finishBubbleGame();
  },

  finishBubbleGame() {
    if (!this.bubbleGame) return;
    const score = this.bubbleGame.score;
    const played = Date.now() - this.bubbleGame.start >= 1500 || score > 0;
    this.bubbleGame = null;
    this.removeObject(this.playBubble); this.playBubble = null;
    this.setData({ bubblePlaying: false, careBusy: false, actionLabel: "", bubbleScore: score });
    if (played) this.applyCare(CARE_BOOSTS.play);
    this.setData({ needHint: score ? "一起追到了 " + score + " 个泡泡" : "陪伴本身就很开心" });
  },

  updateBubbleGame(now, dt) {
    if (!this.bubbleGame) return;
    const seconds = Math.max(0, Math.ceil((this.bubbleGame.duration - now + this.bubbleGame.start) / 1000));
    if (seconds !== this.data.bubbleSeconds) this.setData({ bubbleSeconds: seconds });
    if (this.playBubble) {
      this.playBubble.position.y += dt * 0.07;
      const actor = this.actor();
      if (actor) actor.rotation.y = Math.sin(now / 300) * 0.16;
    }
    if (!seconds) this.finishBubbleGame();
  },

  /** 哪一项最缺就提示哪一项——让玩家跟着状态走，而不是盲点三个按钮。 */
  needState(food, affection, play) {
    const entries = [
      { key: "food", value: food, hint: "它有点饿了", empty: "饿坏了，成长会变慢" },
      { key: "affection", value: affection, hint: "它想被摸摸", empty: "有点疏远，成长会变慢" },
      { key: "play", value: play, hint: "它想玩一会儿", empty: "没精打采，成长会变慢" }
    ];
    entries.sort((a, b) => a.value - b.value);
    const lowest = entries[0];
    if (lowest.value <= 0) return { key: lowest.key, hint: lowest.empty };
    if (lowest.value < 30) return { key: lowest.key, hint: lowest.hint };
    return { key: "", hint: "照顾得很周到" };
  },

  /** 按最常用的那种照顾方式，给这一局一个称号。 */
  careTopKey() {
    const counts = this.careCounts || { feed: 0, pet: 0, play: 0 };
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  },

  careTitle() {
    return CARE_TITLES[this.careTopKey()] || "";
  },

  getGrowthStage(growth) {
    if (growth >= 118) return { index: 3, name: "戴着命运光环的小青蛙" };
    if (growth >= 76) return { index: 2, name: "四肢齐全的准青蛙" };
    if (growth >= 38) return { index: 1, name: "长出后腿的小蝌蚪" };
    return { index: 0, name: "幼年小蝌蚪" };
  },

  // ------------------------------------------------------------------ 第一关

  startJumpChallenge() {
    if (this.data.careBusy || this.data.phase !== "nurture" || !this.data.threeReady) return;
    if (!this.data.canChallenge) {
      this.setData({ message: "还没长成小青蛙，再陪它一会儿。" });
      return;
    }
    if(!this.resumeAdventure())this.setupJumpLevel();
  },

  setupJumpLevel() {
    this.beginAdventure();
    this.adventureFinishedAt = 0;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.petGroup = null;
    this.jumpLeaves = [];
    this.jumpIndex = 0;
    this.trailHeading = undefined;

    const first = this.createGameLeaf(-3.2, 2.8, 0);
    const second = this.createNextGameLeaf(first, 0);
    this.jumpLeaves = [first, second];

    // 青蛙约 0.98 宽，荷叶约 2.1 宽 —— 站在叶子上要"占一半"，不是把整片盖住
    this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 0.52, this.materials);
    this.frogGroup.position.copy(first.position);
    this.frogGroup.position.y = 0.10;
    this.pondGroup.add(this.frogGroup);

    this.charge = 0;
    this.pendingChargeAt = 0;
    this.respawnAt = 0;
    this.runStartedAt = Date.now();   // 计时从第一关开始
    this.runFalls = 0;
    this.runRewarded = false;
    this.motionOffset = 0;
    this.checkpointState = { jumps: 0, perfect: 0, position: first.position.clone(), heading: this.trailHeading };
    this.removeObject(this.homeDecor); this.homeDecor = null;
    this.floatLeaves.visible = false;
    const lives = JUMP_LIVES + this.perkLives();

    this.setData({
      phase: "levelJump",
      jumps: 0,
      jumpGoal: JUMP_GOAL,
      // 轻盈路线多给一次机会，圆点数量跟着走
      attempts: lives,
      attemptSlots: Array.from({ length: lives }, (unused, i) => i),
      perfect: 0,
      falls: 0,
      bugs: 0,
      bugGoal: BUG_GOAL,
      gameOver: false,
      isCharging: false,
      isJumping: false,
      isAiming: false,
      chargePercent: 0,
      chargeTone: "far",
      chargeHint: "长按蓄力",
      failTitle: "荷叶小径",
      failUnit: "片荷叶",
      chapter: "01 · 荷叶小径",
      transition: false,
      checkpoint: 0, resting: false, rewardText: "",
      message: "长按蓄力，松手起跳。水面上的圆环就是落点。"
    });
    this.applyDistrict(0);
    this.resetSkill();
    this.cameraSnap();
    this.syncChargeTarget();
    this.saveAdventure();
  },

  applyDistrict(jumps) {
    const number = Math.min(3, Math.floor(jumps / 5));
    const district = DISTRICTS[number];
    this.setData({ districtName: district.name, districtNumber: number + 1,
      chapter: "荷叶小径 · " + district.name });
    if (this.materials.water) this.materials.water.color.setHex(district.water).convertSRGBToLinear();
    if (this.scene.background) this.scene.background.setHex(district.sky);
    if (this.scene.fog) this.scene.fog.color.setHex(district.sky);
    this.removeObject(this.districtDecor);
    this.districtDecor = new this.THREE.Group();
    this.pondGroup.add(this.districtDecor);
    const origin = this.jumpLeaves[0] ? this.jumpLeaves[0].position : new this.THREE.Vector3();
    if (number >= 1) {
      for (let i = 0; i < number + 1; i += 1) {
        const flower = this.ensureArt().makeLotusCluster(this.materials, 0.8 + number * 0.1);
        flower.position.set(clamp(origin.x + (i % 2 ? -2.4 : 2.4), -8.2, 8.2), 0.03,
          clamp(origin.z - 1.8 + i * 1.1, -8.2, 8.2));
        this.districtDecor.add(flower);
      }
    }
  },

  restoreCheckpoint() {
    const checkpoint = this.checkpointState;
    if (!checkpoint || !this.frogGroup) return;
    (this.jumpLeaves || []).forEach((leaf) => this.removeObject(leaf));
    this.trailHeading = checkpoint.heading;
    const first = this.createGameLeaf(checkpoint.position.x, checkpoint.position.z, checkpoint.jumps);
    this.jumpLeaves = [first, this.createNextGameLeaf(first, checkpoint.jumps)];
    this.frogGroup.visible = true;
    this.frogGroup.position.copy(first.position); this.frogGroup.position.y = 0.10;
    this.frogGroup.userData.dyApplied = 0;
    this.sinkStart = 0; this.sinkLeaf = null;
    this.landingMotion = null; this.splashMotion = null;
    this.setData({ jumps: checkpoint.jumps, perfect: checkpoint.perfect, resting: false,
      jumpCombo: this.restoringAdventure ? checkpoint.combo || 0 : 0,
      isJumping: false, isCharging: false, gameOver: false, transition: false });
    this.applyDistrict(checkpoint.jumps);
    this.resetSkill();
    this.syncChargeTarget(); this.cameraSnap();
  },

  skillForRoute(id) {
    if (["prince", "princess", "college", "sweetheart"].indexOf(id) >= 0) return "glide";
    if (["general", "commander", "hero", "swordswoman"].indexOf(id) >= 0) return "anchor";
    if (["it", "coder", "ceo", "bosslady"].indexOf(id) >= 0) return "forecast";
    if (["monk", "saint", "duke"].indexOf(id) >= 0) return "slow";
    return "rescue";
  },

  resetSkill() {
    this.skillId = this.skillForRoute(this.data.selectedRouteId);
    const skill = SKILLS[this.skillId];
    this.slowUntil = 0; this.forecastCharge = null;
    this.setData({ skillName: skill.name, skillText: skill.text, skillSymbol: skill.symbol,
      skillReady: true, skillArmed: false, skillStatus: "可用" });
  },

  activateSkill() {
    if (this.data.phase !== "levelJump" || !this.data.skillReady || this.data.resting
      || this.data.gameOver || this.data.transition || this.respawnAt || this.jumpState || this.data.isCharging) return;
    const id = this.skillId;
    this.setData({ skillReady: false, skillArmed: id === "glide" || id === "rescue" || id === "forecast",
      skillStatus: id === "anchor" ? "已稳住" : id === "slow" ? "静心 6 秒" : "已就绪" });
    if (id === "anchor") {
      this.jumpLeaves.forEach((leaf) => {
        leaf.userData.drift = null; leaf.userData.wind = null; leaf.userData.sink = false;
        leaf.userData.anchor.copy(leaf.position); leaf.position.y = leaf.userData.baseY || 0.06;
        leaf.scale.setScalar(1);
      });
      this.sinkLeaf = null; this.sinkStart = 0;
    }
    if (id === "slow") this.slowUntil = Date.now() + 6000;
    this.emitBurst(this.frogGroup.position.clone().add(new this.THREE.Vector3(0, 0.5, 0)), 0xffe9a8, 10);
    this.setData({ message: SKILLS[id].text });
    this.vibrate("medium");
  },

  updateSkill(now, dt) {
    if (!this.slowUntil) return;
    if (now >= this.slowUntil) {
      this.slowUntil = 0; this.setData({ skillStatus: "下段恢复" }); return;
    }
    this.motionOffset = (this.motionOffset || 0) + dt * 650;
    if (this.sinkStart) this.sinkStart += dt * 650;
    const status = "静心 " + Math.ceil((this.slowUntil - now) / 1000) + " 秒";
    if (status !== this.data.skillStatus) this.setData({ skillStatus: status });
  },

  /** 荷叶编号 index：0 是起点，第 n 跳的目标是 index = n。难度按「第几跳」取档。 */
  planFor(index) {
    return JUMP_PLAN[clamp(index - 1, 0, JUMP_PLAN.length - 1)];
  },

  createGameLeaf(x, z, index) {
    const plan = this.planFor(index);
    const scale = 0.95 * (plan.size || 1);
    const leaf = this.ensureArt().makeLeaf(this.materials, scale);
    leaf.position.set(x, 0.06, z);
    leaf.rotation.y = (index * 1.37) % TAU;
    leaf.userData.index = index;
    leaf.userData.anchor = leaf.position.clone();
    leaf.userData.baseY = 0.06;
    if (index > 0 && index <= JUMP_GOAL && index % 5 === 0) {
      const ring = new this.THREE.Mesh(new this.geo.Torus(0.65, 0.025, 6, 40), this.materials.gold);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.10;
      leaf.add(ring);
    }
    this.pondGroup.add(leaf);
    return leaf;
  },

  createNextGameLeaf(from, index) {
    const plan = this.planFor(index + 1);
    const gap = plan.gap;

    // 荷叶小径必须是一条"路"，不能是随机撒点。
    // 旧实现用黄金角螺旋，相邻两跳的方向能差 137°，镜头只好每次都转到正后方，
    // 于是既像"永远正前方"，又让整个池塘在屏幕里乱转。
    // 现在：每跳转向有上限，离池心远时朝切线方向绕，形成一条蜿蜒的小径。
    const radius = Math.hypot(from.position.x, from.position.z);
    const pull = clamp((radius - 3.4) / 2.4, 0, 1);
    const toCenter = Math.atan2(-from.position.x, -from.position.z);
    const previous = this.trailHeading === undefined ? toCenter + 0.9 : this.trailHeading;
    // 想去的方向：绕池的切线（贴着池边转圈，永远出不去）
    const tangentA = toCenter + Math.PI / 2;
    const tangentB = toCenter - Math.PI / 2;
    const tangent = Math.abs(angleDelta(previous, tangentA)) <= Math.abs(angleDelta(previous, tangentB))
      ? tangentA
      : tangentB;
    const weave = (index % 2 === 0 ? 1 : -1) * 0.32 * (1 - pull);
    const desired = lerpAngle(previous + weave, tangent, pull);
    const maxTurn = 0.52 + pull * 0.28;

    const inBounds = (x, z) => Math.hypot(x, z) <= 7.6;
    for (let i = 0; i < 40; i += 1) {
      const offset = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.06;
      const angle = turnToward(previous, desired + offset, maxTurn);
      const x = from.position.x + Math.sin(angle) * gap;
      const z = from.position.z + Math.cos(angle) * gap;
      if (inBounds(x, z)) {
        this.trailHeading = angle;
        return this.placeGameLeaf(x, z, index + 1, angle, plan);
      }
    }
    // 保底：直接朝池心跨一步。间距不变，位置一定在池内，关卡不会断。
    this.trailHeading = toCenter;
    return this.placeGameLeaf(
      from.position.x + Math.sin(toCenter) * gap,
      from.position.z + Math.cos(toCenter) * gap,
      index + 1,
      toCenter,
      plan
    );
  },

  placeGameLeaf(x, z, index, angle, plan) {
    const leaf = this.createGameLeaf(x, z, index);
    if (plan && plan.drift) {
      leaf.userData.drift = {
        ax: Math.cos(angle) * plan.drift,
        az: -Math.sin(angle) * plan.drift,
        speed: plan.driftSpeed,
        amp: 0.55
      };
    }
    if (plan && plan.sink) leaf.userData.sink = true;
    if (plan && plan.wind) {
      // 阵风把落点往侧面吹，方向垂直于跳跃方向，摆幅和速度都固定
      leaf.userData.wind = {
        amp: plan.wind,
        ax: Math.cos(angle),
        az: -Math.sin(angle)
      };
    }
    return leaf;
  },

  /** 漂移叶在某一时刻的位置（含预判），落点预览和判定共用同一套算法。 */
  leafPositionAt(leaf, timeMs) {
    const drift = leaf.userData.drift;
    if (!drift) return leaf.position.clone();
    const k = Math.sin(((timeMs - (this.motionOffset || 0)) / 1000) * drift.speed) * drift.amp;
    return leaf.userData.anchor.clone().add(new this.THREE.Vector3(drift.ax * k, 0, drift.az * k));
  },

  /** 统一判定：归一化椭圆距离，<1 即落在叶面上。预览配色和落地判定都用它。 */
  leafScore(point, leaf, target) {
    const center = target || leaf.position;
    const tolerance = 0.86 * this.perkValue("tolerance");   // 稳重的判定圈更宽
    const rx = (leaf.userData.rx || 1.0) * tolerance;
    const rz = (leaf.userData.rz || 0.7) * tolerance;
    const dx = (point.x - center.x) / rx;
    const dz = (point.z - center.z) / rz;
    return Math.sqrt(dx * dx + dz * dz);
  },

  /**
   * 蓄力到 k 时，青蛙会落在哪里。
   * 阵风叶会把落点往侧面吹——预览环和真实落点共用这一个函数，
   * 所以玩家看到的环在哪、最后就落在哪，风只是让环一直在摆。
   */
  landingFor(charge, now) {
    const stamp = now || Date.now();
    const from = this.jumpLeaves[0].position;
    const leaf = this.jumpLeaves[1];
    const target = this.leafPositionAt(leaf, stamp + FLIGHT_TIME);
    const dx = target.x - from.x;
    const dz = target.z - from.z;
    const length = Math.hypot(dx, dz) || 1;
    const distance = JUMP_MIN + charge * this.jumpSpan();
    const point = new this.THREE.Vector3(
      from.x + (dx / length) * distance,
      0.12,
      from.z + (dz / length) * distance
    );

    const wind = leaf.userData.wind;
    if (wind) {
      const gust = Math.sin(((stamp - (this.motionOffset || 0)) / 1000) * WIND_SPEED) * wind.amp;
      point.x += wind.ax * gust;
      point.z += wind.az * gust;
    }

    if (this.skillId === "glide" && this.data.skillArmed) {
      const delta = target.clone().sub(point); delta.y = 0;
      point.add(delta.multiplyScalar(Math.min(0.75, 1.2 / Math.max(delta.length(), 0.001))));
    }

    return { point, target, score: this.leafScore(point, leaf, target) };
  },

  syncChargeTarget() {
    if (this.jumpLeaves.length < 2) return;
    const leaf = this.jumpLeaves[1];
    const from = this.jumpLeaves[0].position;
    const target = this.leafPositionAt(leaf, Date.now());
    const gap = Math.hypot(target.x - from.x, target.z - from.z);
    this.setData({ targetCharge: Math.round(Math.sqrt(clamp((gap - JUMP_MIN) / this.jumpSpan(), 0, 1)) * 100) });
  },

  optimalForecastCharge(now, target) {
    const from = this.jumpLeaves[0].position, leaf = this.jumpLeaves[1];
    const center = target || this.leafPositionAt(leaf, now + FLIGHT_TIME);
    const dx = center.x - from.x, dz = center.z - from.z, length = Math.hypot(dx, dz) || 1;
    const ux = dx / length, uz = dz / length;
    const wind = leaf.userData.wind;
    const gust = wind ? Math.sin(((now - (this.motionOffset || 0)) / 1000) * WIND_SPEED) * wind.amp : 0;
    const ox = from.x - center.x + (wind ? wind.ax * gust : 0);
    const oz = from.z - center.z + (wind ? wind.az * gust : 0);
    const rx = leaf.userData.rx || 1.0, rz = leaf.userData.rz || .7;
    const weightX = 1 / (rx * rx), weightZ = 1 / (rz * rz);
    const divisor = ux * ux * weightX + uz * uz * weightZ;
    const distance = divisor ? -(ux * ox * weightX + uz * oz * weightZ) / divisor : JUMP_MIN;
    const ideal = clamp((distance - JUMP_MIN) / this.jumpSpan(), 0, 1);
    // Preserve the original 1% charge grid and elliptical scoring, including wind.
    const lower = Math.floor(ideal * 100) / 100, upper = Math.min(1, lower + .01);
    return this.landingFor(lower, now).score <= this.landingFor(upper, now).score ? lower : upper;
  },

  // ------------------------------------------------------------------ 蓄力与起跳

  onTouchStart(event) {
    if (this.data.paused || this.data.gameOver || this.data.transition) return;
    if (this.returnWorld && this.returnWorld.active) { this.returnWorld.touchStart(event); return; }
    const touch = (event.touches || [])[0];
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
    }
  },

  onTouchCancel() {
    if (this.returnWorld && this.returnWorld.active) { this.returnWorld.cancelTouch(); return; }
    this.petStroke = null;
    if (this.data.phase === "levelJump") {
      if (this.data.isCharging) this.releaseJump();
      else this.pendingChargeAt = 0;
    }
    this.setData({ isAiming: false });
  },

  /**
   * 输入缓冲：落地后的 150ms 挤压期间点屏幕不会被吞掉，
   * 而是记下来等落地结束立刻蓄力。这是"点了有反应"的关键。
   */
  requestCharge() {
    const now = Date.now();
    if (this.data.paused || this.data.gameOver || this.data.transition || this.data.resting || this.respawnAt) return;
    if (this.data.isCharging) return;
    if (this.data.isJumping || this.jumpState) {
      this.pendingChargeAt = now;
      return;
    }
    this.beginCharge(now);
  },

  beginCharge(now) {
    this.playSound('charge');
    this.charge = 0;
    this.chargeStart = now;
    this.pendingChargeAt = 0;
    this.setData({ isCharging: true, chargePercent: 0, chargeTone: "far", chargeHint: "蓄力中" });
    this.showPreview(true);
  },

  updateCharge(now) {
    if (this.pendingChargeAt && now - this.pendingChargeAt <= INPUT_BUFFER) {
      if (!this.data.isJumping && !this.jumpState && !this.data.isCharging && !this.data.gameOver) {
        this.beginCharge(now);
      }
    } else if (this.pendingChargeAt && now - this.pendingChargeAt > INPUT_BUFFER) {
      this.pendingChargeAt = 0;
    }

    if (!this.data.isCharging) return;

    // 蓄力本身是缓入的：前期慢、后期快，长时间按住更有"压紧"的手感
    const raw = clamp((now - this.chargeStart) / this.chargeTime(), 0, 1);
    this.charge = easeInQuad(raw);
    const landing = this.landingFor(this.charge, now);
    const tone = landing.score <= 0.55 ? "perfect" : landing.score <= 0.96 ? "good" : landing.score <= 1.2 ? "close" : "far";

    // 蓄力时青蛙同步下蹲并轻微发抖：身体动作就是最直接的蓄力反馈
    const crouch = this.charge * 0.30;
    this.pose.sy *= 1 - crouch;
    this.pose.sx *= 1 + crouch * 0.42;
    this.pose.rz = Math.sin(now * 0.055) * 0.014 * this.charge;
    this.pose.dy -= crouch * 0.10;

    if (now - (this.lastChargeHud || 0) > 50) {
      this.lastChargeHud = now;
      this.setData({
        chargePercent: Math.round(raw * 100),
        chargeTone: tone,
        chargeHint: this.getChargeHint(landing.score)
      });
    }
    this.updatePreviewMarker(landing);
    if (this.skillId === "forecast" && this.data.skillArmed) {
      const ideal = this.optimalForecastCharge(now, landing.target);
      if (this.charge >= ideal) { this.charge = ideal; this.releaseJump(); }
    }
  },

  getChargeHint(score) {
    if (score <= 0.55) return "正中叶心";
    if (score <= 0.96) return "稳了";
    if (score <= 1.2) return "踩到边缘";
    return "会落空";
  },

  showPreview(visible) {
    if (!visible && !this.preview) return;
    if (!this.preview) {
      const T = this.THREE;
      const group = new T.Group();
      const ring = new T.Mesh(
        new this.geo.Torus(0.34, 0.022, 8, 40),
        new T.MeshBasicMaterial({ color: 0x9cf5ac, transparent: true, opacity: 0.95, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);

      const disc = new T.Mesh(
        new this.geo.Circle(0.34, 32),
        new T.MeshBasicMaterial({ color: 0x9cf5ac, transparent: true, opacity: 0.22, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = -0.005;
      group.add(disc);

      const geometry = new T.BufferGeometry().setFromPoints([
        new T.Vector3(0, 0, 0),
        new T.Vector3(0, 0, 0)
      ]);
      const line = new T.Line(geometry, new T.LineBasicMaterial({
        color: 0xeafff2, transparent: true, opacity: 0.42, depthWrite: false
      }));
      group.add(line);

      group.userData = { ring, disc, line };
      this.preview = group;
      this.pondGroup.add(group);
    }
    this.preview.visible = visible;
  },

  updatePreviewMarker(landing) {
    if (!this.data.isCharging && !this.data.isAiming) return;
    if (!this.preview || !this.preview.visible) return;
    if (!landing) {
      landing = this.landingFor(this.charge || 0, Date.now());
    }
    const T = this.THREE;
    const { point, score } = landing;
    const color = score <= 0.55 ? 0x9cf5ac : score <= 0.96 ? 0xc9f08a : score <= 1.2 ? 0xffd274 : 0xff8f7c;
    const { ring, disc, line } = this.preview.userData;
    ring.material.color.setHex(color);
    disc.material.color.setHex(color);
    this.preview.position.set(point.x, point.y, point.z);
    this.preview.visible = true;

    const actor = this.actor();
    if (actor) {
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, actor.position.x, actor.position.y + 0.12, actor.position.z);
      positions.setXYZ(1, point.x, point.y, point.z);
      positions.needsUpdate = true;
      line.geometry.computeBoundingSphere();
    }
  },

  releaseJump() {
    if (!this.data.isCharging) return;
    this.stopSound('charge'); this.playSound('jump');
    const now = Date.now();
    const charge = this.charge || 0;
    this.setData({ isCharging: false, isJumping: true, actionLabel: "" });
    this.showPreview(false);

    const landing = this.landingFor(charge, now);
    const from = this.jumpLeaves[0].position.clone();
    from.y = 0.10;
    const to = landing.point.clone();

    this.jumpState = {
      phase: "anticipate",
      start: now,
      charge,
      crouch: charge * 0.30,   // 接着蓄力时的下蹲量继续压，松手不会"弹"一下
      from,
      to,
      target: landing.target,
      score: landing.score,
      peak: 0.85 + charge * 0.75
    };
    if (this.data.skillArmed && (this.skillId === "glide" || this.skillId === "forecast")) {
      this.jumpState.assisted = true;
      this.setData({ skillArmed: false, skillStatus: "下段恢复" });
    }
    this.vibrate("light");
  },

  updateJump(now) {
    const state = this.jumpState;
    if (!state || !this.frogGroup) return;

    if (state.phase === "anticipate") {
      const t = clamp((now - state.start) / ANTICIPATE_TIME, 0, 1);
      const crouch = state.crouch || 0;
      this.pose.sy *= lerp(1 - crouch, 0.72, easeOutQuad(t));
      this.pose.sx *= lerp(1 + crouch * 0.42, 1.12, easeOutQuad(t));
      if (t >= 1) {
        state.phase = "fly";
        state.start = now;
        if (this.frogGroup) this.frogGroup.rotation.y = Math.atan2(state.to.x - state.from.x, state.to.z - state.from.z);
      }
      return;
    }

    if (state.phase === "fly") {
      const t = clamp((now - state.start) / FLIGHT_TIME, 0, 1);
      this.frogGroup.position.lerpVectors(state.from, state.to, t);
      this.frogGroup.position.y = 0.10 + 4 * t * (1 - t) * state.peak;
      this.pose.sy *= 1 + 0.14 * Math.sin(t * Math.PI);
      this.pose.sx *= 1 - 0.08 * Math.sin(t * Math.PI);
      this.pose.rx = Math.sin(t * Math.PI * 2) * 0.22;
      // 飞行中把后腿蹬直、前腿收起来
      (this.frogGroup.userData.hindLegs || []).forEach((leg) => {
        leg.rotation.x = -Math.sin(t * Math.PI) * 0.85;
      });
      (this.frogGroup.userData.frontLegs || []).forEach((leg) => {
        leg.rotation.x = Math.sin(t * Math.PI) * 0.55;
      });
      if (t >= 1) this.resolveLanding(now);
      return;
    }
  },

  resolveLanding(now) {
    const state = this.jumpState;
    this.jumpState = null;
    if (!state || !this.frogGroup) return;

    (this.frogGroup.userData.hindLegs || []).forEach((leg) => { leg.rotation.x = 0; });
    (this.frogGroup.userData.frontLegs || []).forEach((leg) => { leg.rotation.x = 0; });

    let leaf = this.jumpLeaves[1];
    if (state.score > 1.08 && this.skillId === "rescue" && this.data.skillArmed) {
      this.removeObject(leaf);
      leaf = this.createGameLeaf(state.to.x, state.to.z, this.data.jumps + 1);
      this.jumpLeaves[1] = leaf;
      state.score = 0.9; state.assisted = true;
      this.setData({ skillArmed: false, skillStatus: "下段恢复" });
      this.emitBurst(leaf.position.clone(), 0x9df1b0, 12);
    }
    // 挂边宽容：判定圈外 8% 以内算"踩住边缘"，避免"明明踩到了却掉水里"
    const landed = state.score <= 1.08;

    if (!landed) {
      // 先别急着判失败：还有机会就落回当前荷叶重来
      this.missRun();
      return;
    }

    this.frogGroup.position.copy(this.leafPositionAt(leaf, now));
    this.frogGroup.position.y = 0.10;

    const jumps = this.data.jumps + 1;
    const perfect = state.score <= PERFECT_SCORE && !state.assisted;
    const perfectCount = this.data.perfect + (perfect ? 1 : 0);
    this.landingMotion = { start: now };
    leaf.userData.landingAt = now;
    this.playSound(perfect ? 'perfect' : 'land');
    this.emitRing(this.frogGroup.position, perfect ? 1.0 : 0.7);
    this.emitBurst(
      this.frogGroup.position.clone().add(new this.THREE.Vector3(0, 0.2, 0)),
      perfect ? 0xffe082 : 0xe7f7c3,
      perfect ? 12 : 7
    );
    this.vibrate(perfect ? "heavy" : "medium");

    // 沉叶：落上去就开始倒计时，得赶紧跳下一片
    this.sinkStart = leaf.userData.sink ? now : 0;
    this.sinkLeaf = leaf.userData.sink ? leaf : null;

    this.setData({
      jumps,
      perfect: perfectCount,
      isJumping: false,
      chargePercent: 0,
      chargeTone: "far",
      message: leaf.userData.sink
        ? "快跳！这片荷叶要沉了"
        : perfect
          ? "正中叶心！完美 ×" + perfectCount
          : state.score <= 1 ? "稳稳落叶" : "刚好踩住叶边"
    });
    this.noteCombo('jump',perfect);
    if(perfect)this.recordMemory('perfect',{title:'第一次正中叶心',note:'轻轻一跃，稳稳落在荷叶中央。',stage:3});

    if (jumps >= JUMP_GOAL) {
      this.saveAdventure();
      this.scheduleScene("setupBugLevel", 780);
      this.setData({ chapter: "01 · 通关" });
      return;
    }

    this.removeObject(this.jumpLeaves[0]);
    this.jumpLeaves = [leaf, this.createNextGameLeaf(leaf, jumps)];
    if (jumps % 5 === 0) {
      this.checkpointState = { jumps, perfect: perfectCount, position: leaf.position.clone(), heading: this.trailHeading, combo:this.data.jumpCombo };
      this.sinkStart = 0; this.sinkLeaf = null;
      this.setData({ resting: false, checkpoint: jumps, message: "前往" + DISTRICTS[Math.min(3, jumps / 5)].name });
      this.applyDistrict(jumps); this.resetSkill();
    }
    this.syncChargeTarget();
    this.saveAdventure();
  },

  /**
   * 落水但还有机会：溅个水花、扣一次机会，然后回到最近休息点。
   * 三次用完才真正判负 —— 一次失手不再把整关打回第 1 跳。
   */
  missRun(reason) {
    this.noteCombo('jump',false);
    if(this.checkpointState)this.checkpointState.combo=0;
    const attempts = this.data.attempts - 1;
    this.runFalls = (this.runFalls || 0) + 1;
    if (attempts <= 0) {
      this.setData({ attempts: 0, falls: this.runFalls });
      this.saveAdventure();
      this.failRun("机会用完了，可以从第 " + this.data.checkpoint + " 片荷叶继续。", true);
      return;
    }

    this.jumpState = null;
    this.clearCharge();
    this.showPreview(false);
    this.setData({
      attempts,
      falls: this.runFalls,
      isJumping: false,
      isCharging: false,
      chargePercent: 0,
      chargeTone: "far",
      message: (reason || "扑通！") + " 还剩 " + attempts + " 次机会"
    });

    if (this.frogGroup) {
      this.splashMotion = { start: Date.now(), x: this.frogGroup.position.x, z: this.frogGroup.position.z };
      this.emitRing(this.frogGroup.position, 1.15);
      this.emitBurst(this.frogGroup.position.clone().add(new this.THREE.Vector3(0, 0.05, 0)), 0xbfeff0, 10);
      this.shake = { start: Date.now(), amp: 0.16, duration: 260 };
    }
    this.vibrate("heavy");
    this.respawnAt = Date.now() + RESPAWN_DELAY;
    this.saveAdventure();
  },

  /** 溅完水花回到休息点，回滚本段进度和完美数。 */
  updateRespawn(now) {
    if (!this.respawnAt || now < this.respawnAt) return;
    this.respawnAt = 0;
    this.splashMotion = null;
    if (!this.frogGroup || !this.jumpLeaves.length || this.data.gameOver) return;

    this.restoreCheckpoint();
    this.setData({ message: "回到第 " + this.data.checkpoint + " 片荷叶，再试一次。" });
  },

  /**
   * 沉叶倒计时：落到会沉的荷叶上，2 秒内没跳走就掉下去。
   * 叶子会真的往下沉，玩家看得见，不是突然判负。
   */
  updateSinkingLeaves(now) {
    if (!this.sinkStart || !this.sinkLeaf) return;
    const t = clamp((now - this.sinkStart) / SINK_TIME, 0, 1);
    const leaf = this.sinkLeaf;
    const baseY = leaf.userData.baseY === undefined ? 0.06 : leaf.userData.baseY;

    leaf.position.y = baseY - t * 0.62;
    leaf.scale.setScalar(1 - t * 0.14);
    if (this.frogGroup && !this.jumpState) {
      this.frogGroup.position.y = Math.min(this.frogGroup.position.y, leaf.position.y + 0.04);
    }

    if (t >= 1 && !this.data.gameOver && !this.jumpState && !this.splashMotion) {
      this.sinkStart = 0;
      this.sinkLeaf = null;
      this.missRun("荷叶沉下去了。");
    }
  },

  failRun(message, inWater) {
    this.clearCharge();
    this.showPreview(false);
    this.jumpState = null;
    this.setData({
      gameOver: true,
      isJumping: false,
      isCharging: false,
      chargePercent: 0,
      message,
      failTitle: this.data.phase === "levelBug" ? "荷花池" : "荷叶小径",
      failUnit: this.data.phase === "levelBug" ? "只昆虫" : "片荷叶"
    });
    if (inWater && this.frogGroup) {
      this.splashMotion = { start: Date.now(), x: this.frogGroup.position.x, z: this.frogGroup.position.z };
      this.emitRing(this.frogGroup.position, 1.15);
      this.emitBurst(this.frogGroup.position.clone().add(new this.THREE.Vector3(0, 0.05, 0)), 0xbfeff0, 10);
      this.shake = { start: Date.now(), amp: 0.16, duration: 260 };
    }
    this.vibrate("heavy");
  },

  retryLevel() {
    if (this.data.phase === "levelBug") this.setupBugLevel();
    else if (this.checkpointState) {
      this.clearChallengeObjects();
      this.setData({ attempts: JUMP_LIVES + this.perkLives(), gameOver: false });
      this.restoreCheckpoint();
    } else this.setupJumpLevel();
    this.saveAdventure();
  },

  // ------------------------------------------------------------------ 第二关

  setupBugLevel() {
    this.ensureAdventure();
    if(this.homeLeaf)this.homeLeaf.visible=false;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    this.petGroup = null;
    this.removeObject(this.districtDecor); this.districtDecor = null;
    this.caughtKinds = { gnat: 0, dragonfly: 0, butterfly: 0 };

    this.jumpLeaves = [];
    const base = this.createGameLeaf(0, 3.0, 99);
    base.scale.setScalar(1.5);
    this.jumpLeaves = [base];

    this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 0.85, this.materials);
    this.frogGroup.position.set(0, 0.12, 3.0);
    this.frogGroup.rotation.y = Math.PI;
    this.pondGroup.add(this.frogGroup);
    this.popIn(this.frogGroup);

    this.insects = [];
    for (let i = 0; i < 12; i += 1) this.spawnInsect(i);
    this.createAimMarker();

    this.setData({
      phase: "levelBug",
      bugs: 0,
      bugGoal: BUG_GOAL,
      jumps: JUMP_GOAL,
      gameOver: false,
      isCharging: false,
      isJumping: false,
      isAiming: false,
      chargePercent: 0,
      failTitle: "荷花池",
      failUnit: "只昆虫",
      chapter: "02 · 盛夏荷花池",
      transition: false,
      caughtKinds: [], bugHint: "", resting: false,
      message: "拖动瞄准，松手伸舌头。吃到 " + BUG_GOAL + " 只就通关。"
    });
    this.cameraSnap();
    this.saveAdventure();
  },

  /**
   * 竖屏的水平视场只有 ±10.5°，能看见的宽度只有 ±1.2 左右。
   * 虫子必须排成"青蛙正前方的一条纵向走廊"（靠高度和远近做变化），
   * 撒到 ±3 去就会有一半在屏幕外，点都点不到。
   */
  spawnInsect(index) {
    if (this.insects.length > 14) return;
    const kinds = ["dragonfly", "butterfly", "gnat"];
    const kind = kinds[index % kinds.length];
    const insect = this.ensureArt().makeInsect(kind, this.materials);
    const rx = (index * 0.618) % 1;
    const ry = (index * 0.3733) % 1;
    const rz = (index * 0.7919) % 1;
    insect.position.set(
      (rx * 2 - 1) * 1.15,
      0.95 + ry * 1.7,
      0.70 + rz * 1.30
    );
    insect.userData.baseY = insect.position.y;
    insect.userData.kind = kind;
    insect.userData.baseX = insect.position.x;
    insect.userData.baseZ = insect.position.z;   // 前后摆动，才会一会儿进射程、一会儿出射程
    insect.userData.speed = 0.16 + ((index % 5) * 0.05);
    insect.userData.phase = index * 0.9;
    this.insects.push(insect);
    this.pondGroup.add(insect);
    return insect;
  },

  createAimMarker() {
    this.removeObject(this.aimMarker);
    const T = this.THREE;
    const marker = new T.Group();
    const ring = new T.Mesh(
      new this.geo.Torus(0.18, 0.014, 8, 28),
      new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
    );
    marker.add(ring);
    marker.visible = false;
    this.aimMarker = marker;
    this.aimWorld = new T.Vector3(0, 1.6, 1.0);
    this.pondGroup.add(marker);
  },

  updateAimFromTouch(event) {
    if (this.data.phase !== "levelBug" || this.tongueState || this.data.transition) return;
    const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
    if (!touch) return;

    this.pointer.set((touch.x / this.width) * 2 - 1, 1 - (touch.y / this.height) * 2);
    this.camera.updateMatrixWorld();

    // 优先按屏幕距离拾取昆虫：手指点得"够近"就算瞄中，比精确射线宽容得多
    let best = 52;
    let hit = null;
    const projected = new this.THREE.Vector3();
    this.insects.forEach((insect) => {
      projected.copy(insect.position).project(this.camera);
      if (projected.z < -1 || projected.z > 1) return;
      const dx = (projected.x - this.pointer.x) * this.width * 0.5;
      const dy = (projected.y - this.pointer.y) * this.height * 0.5;
      const distance = Math.hypot(dx, dy);
      if (distance < best) {
        best = distance;
        hit = insect;
      }
    });

    this.aimHit = hit;
    if (hit) {
      this.aimWorld.copy(hit.position);
    } else {
      // 没瞄中昆虫就落到一块远平面上，准星不会永远贴在 z=0
      this.raycaster = this.raycaster || new this.THREE.Raycaster();
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const plane = new this.THREE.Plane(new this.THREE.Vector3(0, 0, 1), -1.0);
      const point = this.raycaster.ray.intersectPlane(plane, new this.THREE.Vector3());
      if (point) this.aimWorld.copy(point);
    }

    if (this.frogGroup) {
      const dx = this.aimWorld.x - this.frogGroup.position.x;
      const dz = this.aimWorld.z - this.frogGroup.position.z;
      this.frogGroup.rotation.y = Math.atan2(dx, dz);
    }
  },

  /** 青蛙嘴的世界坐标：舌头从这儿伸出去，射程也从这儿量。 */
  mouthWorld() {
    if (!this.frogGroup) return new this.THREE.Vector3(0, 1, 3);
    this.frogGroup.updateMatrixWorld(true);
    if (this.frogGroup.userData.mouthAnchor) return this.frogGroup.userData.mouthAnchor.getWorldPosition(new this.THREE.Vector3());
    return this.frogGroup.localToWorld(new this.THREE.Vector3(0, 0.92, 0.50));
  },

  updateAimMarker() {
    if (!this.aimMarker) return;
    if (!this.data.isAiming) {
      this.aimMarker.visible = false;
      return;
    }
    this.aimMarker.visible = true;
    this.aimMarker.position.copy(this.aimWorld);
    this.aimMarker.quaternion.copy(this.camera.quaternion);
    // 准星颜色直接告诉玩家"够不够得着"：金色=能吃到，灰色=太远了
    const inRange = this.mouthWorld().distanceTo(this.aimWorld) <= TONGUE_RANGE;
    const color = inRange ? (this.aimHit ? 0xffe98a : 0xffffff) : 0x8f9a92;
    this.aimMarker.children[0].material.color.setHex(color);
    this.aimMarker.scale.setScalar(inRange && this.aimHit ? 1.1 : 1.0);
    const hit = this.aimHit;
    const names = { dragonfly: "蜻蜓", butterfly: "蝴蝶", gnat: "小飞虫" };
    const behavior = hit && hit.userData.behavior;
    const hint = hit ? names[hit.userData.kind] + " · " + (!inRange ? "等它飞近" : behavior === "hover" ? "正在悬停" : "够得着") : "";
    if (hint !== this.data.bugHint) this.setData({ bugHint: hint });
  },

  fireTongue() {
    if (this.data.phase !== "levelBug" || !this.frogGroup || this.tongueState
      || this.data.paused || this.data.transition || this.data.gameOver) return;
    const T = this.THREE;
    this.playSound('tongue');
    const from = this.mouthWorld();
    const aimed = this.aimHit && this.insects.indexOf(this.aimHit) >= 0 ? this.aimHit : null;
    let target = (aimed ? aimed.position : this.aimWorld).clone();

    // 射程外的目标：舌头只能伸到最远处，虫子吃不到
    const distance = from.distanceTo(target);
    const outOfRange = distance > TONGUE_RANGE;
    let hit = aimed;
    if (outOfRange) {
      target = from.clone().add(target.clone().sub(from).normalize().multiplyScalar(TONGUE_RANGE));
      hit = null;
    }

    this.tongueState = {
      start: Date.now(),
      from,
      target,
      hit,
      scored: false,
      duration: TONGUE_OUT + TONGUE_HOLD + TONGUE_BACK
    };

    if (!hit) {
      this.noteCombo('bug',false);
      this.saveAdventure();
      this.startleInsects(target);
      this.setData({ message: outOfRange ? "够不着，等它飞近一点。" : "扑空了。" });
    }

    if (!this.tongueMesh) {
      const geometry = new this.geo.Cylinder(0.032, 0.055, 1, 10, 1, true);
      this.tongueMesh = new T.Mesh(geometry, this.materials.tongue);
      this.tongueMesh.castShadow = false;
      this.pondGroup.add(this.tongueMesh);
      this.tongueTip = new T.Mesh(new this.geo.Sphere(0.062, 12, 10), this.materials.tongue);
      this.pondGroup.add(this.tongueTip);
    }
    this.tongueMesh.visible = true;
    this.tongueTip.visible = true;
    this.vibrate("light");
  },

  /** 舔空之后附近的虫子会被吓飞一下，失误有代价。 */
  startleInsects(point) {
    if (!this.insects || !this.insects.length) return;
    const now = Date.now();
    this.insects.forEach((insect) => {
      if (insect.position.distanceTo(point) > 2.8) return;
      insect.userData.flee = { at: now, duration: 780 };
    });
  },

  updateTongue(now) {
    const state = this.tongueState;
    if (!state || !this.tongueMesh) return;
    const T = this.THREE;
    const elapsed = now - state.start;

    let reach;
    if (elapsed < TONGUE_OUT) reach = easeOutQuad(elapsed / TONGUE_OUT);
    else if (elapsed < TONGUE_OUT + TONGUE_HOLD) reach = 1;
    else reach = Math.pow(clamp(1 - (elapsed - TONGUE_OUT - TONGUE_HOLD) / TONGUE_BACK, 0, 1),1.25);

    const end = state.from.clone().lerp(state.target, reach);
    const delta = end.clone().sub(state.from);
    const length = Math.max(0.001, delta.length());
    this.tongueMesh.position.copy(state.from).lerp(end, 0.5);
    this.tongueMesh.scale.set(1, length, 1);
    this.tongueMesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    this.tongueTip.position.copy(end);
    const elastic=elapsed>TONGUE_OUT+TONGUE_HOLD?Math.sin(clamp((elapsed-TONGUE_OUT-TONGUE_HOLD)/TONGUE_BACK,0,1)*Math.PI):0;
    this.tongueTip.scale.set(1+elastic*.22,1-elastic*.12,1+elastic*.22);

    if (state.hit && !state.scored && reach > 0.9) {
      state.scored = true;
      state.hit.userData.caught = now;
      this.emitBurst(state.hit.position.clone(), 0xffe98a, 6);
    }

    // 被舌头粘住的虫：一边被拽向嘴边，一边缩小
    if (state.hit && state.hit.userData.caught) {
      const pull = clamp((now - state.hit.userData.caught) / 180, 0, 1);
      if (state.hit.parent) {
        state.hit.position.lerp(end, pull);
        state.hit.scale.setScalar(Math.max(0.001, 1 - pull));
      }
    }

    if (elapsed >= state.duration) {
      if (state.hit) this.scoreBug(state.hit);
      this.tongueMesh.visible = false;
      this.tongueTip.visible = false;
      this.tongueState = null;
      this.aimHit = null;
      return;
    }
    if (state.hit && state.hit.userData.caught) return;
  },

  scoreBug(insect) {
    if (!insect || this.insects.indexOf(insect) < 0) return;
    this.removeObject(insect);
    this.insects = this.insects.filter((item) => item !== insect);
    const bugs = this.data.bugs + 1;
    const kind = insect.userData.kind;
    this.caughtKinds = this.caughtKinds || { gnat: 0, dragonfly: 0, butterfly: 0 };
    this.caughtKinds[kind] = (this.caughtKinds[kind] || 0) + 1;
    const names = { gnat: "小飞虫", dragonfly: "蜻蜓", butterfly: "蝴蝶" };
    this.emitRing(insect.position, 0.45);
    this.vibrate("medium");
    this.setData({ bugs, bugHint: "", caughtKinds: Object.keys(this.caughtKinds).map((key) => ({
      name: names[key], count: this.caughtKinds[key] })),
      message: bugs >= BUG_GOAL ? "捕虫成功，荷花池通关。" : "吃到一只" + (names[kind] || "小虫") + "！" });
    this.swallowUntil = Date.now() + 350;
    this.playSound('swallow');
    this.noteCombo('bug',true);
    this.recordMemory('catch',{title:'第一只小虫',note:'长舌头一伸，第一次吃到了'+(names[kind]||'小虫')+'。',stage:3});
    if (bugs >= BUG_GOAL) {
      this.adventureFinishedAt = Date.now();
      this.scheduleScene("showReturnChoice", 820);
    } else {
      this.spawnInsect(bugs + 7);
    }
    this.saveAdventure();
  },

  formatTime(ms) {
    const total = Math.max(0, Math.round((ms || 0) / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes + ":" + (seconds < 10 ? "0" + seconds : "" + seconds);
  },

  /** 评级只看完美数和落水次数：简单、能解释、玩家能算得出来。 */
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
    } catch (error) {
      saved = null;
    }
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
    } catch (error) {
      // 存不进去也不影响这一局
    }
    return true;
  },

  showFinal() {
    if(this.data.phase==='final')return;
    this.clearChallengeObjects();
    this.removeObject(this.petGroup); this.petGroup = null;
    this.removeObject(this.frogGroup);
    this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 1.3, this.materials);
    this.frogGroup.position.set(0, 0.11, 1.2);
    if(this.homeLeaf)this.homeLeaf.visible=true;
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
      if(this.currentRun)this.lastRewardedRunId=this.currentRun.id;
      const bonus=this.adventureBonus(),reward=3+bonus;
      const adventures = this.data.adventures + 1;
      const unlocked = SOUVENIRS.find((item) => item.at === adventures);
      this.setData({ adventures, snacks: Math.min(999, this.data.snacks + reward),
        souvenirs: SOUVENIRS.filter((item) => adventures >= item.at).map((item) => item.name),
        rewardText: "带回莲子 ×"+reward+(bonus?' · 额外奖励 +'+bonus:'') + (unlocked ? " · 新纪念物：" + unlocked.name : "") });
      this.rewardStored=this.saveCompanion();
    }

    this.setData({
      phase: "final",
      transition: false,
      newRoute: firstMeet,
      chapter: "成长纪念",
      grade,
      gradeTag: isBest ? "个人最佳" : "",
      perfect,
      falls,
      runTimeText: this.formatTime(elapsed),
      letterLines: letter,
      bestGrade: best.grade,
      bestTimeText: this.formatTime(best.time),
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

  openRoutes(destination) {
    if(!this.data.threeReady)return;
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
      phase: destination === 'home' ? 'home' : 'route', choosingNew: destination === 'new',
      routeList: destination === 'home' ? [] : this.routesForSelection(),
      selectedRouteId: "",
      selectedRouteName: "",
      selectedPerkName: "",
      selectedPerkText: "",
      skillName: "", skillText: "", skillSymbol: "",
      stageName: "幼年小蝌蚪",
      food: 12,
      affection: 10,
      play: 8,
      growth: 0,
      growthPercent: 0,
      canChallenge: false,
      careTitle: "",
      careKey: "",
      needKey: "play",
      needHint: "它想玩一会儿",
      attempts: JUMP_LIVES,
      perfect: 0,
      falls: 0,
      grade: "",
      gradeTag: "",
      runTimeText: "",
      letterLines: [],
      gameOver: false,
      isCharging: false,
      isJumping: false,
      isAiming: false,
      chargePercent: 0,
      chapter: destination === 'home' ? "初夏的池塘" : "未来的模样",
      actionLabel: "",
      transition: false,
      resting: false, careBusy: false, petHabit: "", rewardText: "",
      message: "选择它长大后的成长路线。"
    });
    this.showNurturePreview();
    this.cameraSnap();
  },

  // ------------------------------------------------------------------ 特效

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

  emitRing(position, size) {
    this.emitWaterRipple(position,size||1);
    if (!this.effects) return;
    const T = this.THREE;
    const ring = new T.Mesh(
      new this.geo.Torus(0.28, 0.022, 6, 32),
      new T.MeshBasicMaterial({ color: 0xd8fff2, transparent: true, opacity: 0.85, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(position.x, 0.05, position.z);
    ring.userData = { start: Date.now(), life: 720, size: size || 1 };
    this.effects.add(ring);
    this.rings.push(ring);
  },

  updateEffects(now) {
    const T = this.THREE;
    for (let i = this.bursts.length - 1; i >= 0; i -= 1) {
      const group = this.bursts[i];
      const t = (now - group.userData.start) / group.userData.life;
      if (t >= 1) {
        this.bursts.splice(i, 1);
        this.removeObject(group);
        continue;
      }
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
      if (t >= 1) {
        this.rings.splice(i, 1);
        this.removeObject(ring);
        continue;
      }
      const scale = 0.4 + t * 2.4 * ring.userData.size;
      ring.scale.setScalar(scale);
      ring.material.opacity = 0.8 * (1 - t);
    }
  },

  /**
   * 震屏必须放在 updateCamera 之后：镜头每帧都会从机位状态重算 position，
   * 先震再算等于白震。
   */
  applyShake(now) {
    if (!this.shake || !this.camera) return;
    const t = (now - this.shake.start) / this.shake.duration;
    if (t >= 1) {
      this.shake = null;
      return;
    }
    const amount = this.shake.amp * (1 - t);
    this.camera.position.x += (Math.random() - 0.5) * amount;
    this.camera.position.y += (Math.random() - 0.5) * amount;
  },

  vibrate(kind) {
    if (this.data.hapticEnabled === false) return;
    if (typeof wx === "undefined" || !wx.vibrateShort) return;
    wx.vibrateShort({ type: kind === "heavy" ? "heavy" : kind === "medium" ? "medium" : "light" });
  },

  // ------------------------------------------------------------------ 每帧驱动

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

  paddleReturn() {
    if (this.returnWorld) this.returnWorld.paddle();
  },

  retrySling() {
    if (this.returnWorld) this.returnWorld.begin("sling");
    this.saveAdventure();
  },

  fireSling() {
    if (this.returnWorld) this.returnWorld.fire();
  },

  changeReturnMode() {
    if (this.returnWorld) this.returnWorld.showChoice();
    this.saveAdventure();
  },

  finishReturn() {
    if (this.data.returnResultReady) this.showFinal();
  },

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
    if (this.data.qualityMode && this.data.qualityMode !== 'auto') return;
    const quality = this.renderQuality;
    if (!quality || !this.renderer.setPixelRatio || now < quality.since) return;
    if (frameMs > 250) { this.resetRenderQualityWindow(now, 2000); return; }
    if (frameMs < 4) return;
    quality.count += 1; quality.total += frameMs;
    if (frameMs > 24) quality.slow += 1;
    if (quality.count < 120 || now - quality.since < 4000) return;
    const average = quality.total / quality.count, slowRatio = quality.slow / quality.count;
    let next = quality.current;
    if (average > 25 && slowRatio > .70 && now - quality.changedAt >= 15000) {
      next = Math.max(Math.min(1.5, quality.max), quality.current - .25);
    } else if (average < 18 && slowRatio < .05 && now - quality.changedAt >= 30000) {
      next = Math.min(quality.max, quality.current + .25);
    }
    if (next !== quality.current) {
      // Resize only between gestures; gameplay, camera aspect and touch coordinates stay logical pixels.
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

    this.pose.sx = 1;
    this.pose.sy = 1;
    this.pose.sz = 1;
    this.pose.rx = 0;
    this.pose.rz = 0;
    this.pose.dy = 0;

    if (this.waterShader) this.waterShader.uniforms.pondTime.value = (now-this.sceneStartedAt)/1000;
    if (this.returnWorld && this.returnWorld.active) {
      this.returnWorld.update(now, dt);
      return;
    }

    this.updateWorldTadpoles(dt, time);
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
    (this.worldTadpoles || []).forEach((tadpole,index) => {
      const swim = tadpole.userData.swim;
      if (!swim) return;
      swim.phase += dt * 2.2;
      tadpole.position.x += swim.direction * swim.speed * dt;
      tadpole.position.z = swim.baseZ + Math.sin(swim.phase * 0.7) * 0.22;
      tadpole.rotation.y = swim.direction > 0 ? 0 : Math.PI;
      if (Math.abs(tadpole.position.x) > 7.6) swim.direction *= -1;
      const pivot = tadpole.userData.tailPivot;
      if (pivot) pivot.rotation.y = Math.sin(time * 9 + swim.phase) * 0.5;
      const age=(Date.now()-this.sceneStartedAt)/1000;
      if(index%3===0 && age-(swim.lastWake||0)>2.4+index*.1){swim.lastWake=age;this.emitWaterRipple(tadpole.position,.18);}
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

    // 出生过冲：作为姿态倍率参与合成，不要直接写 scale，否则会和呼吸打架
    const pop = actor.userData.pop;
    if (pop) {
      const t = clamp((now - pop.start) / pop.duration, 0, 1);
      const k = lerp(0.55, 1, easeOutBack(t));
      this.pose.sx *= k;
      this.pose.sy *= k;
      this.pose.sz *= k;
      if (t >= 1) actor.userData.pop = null;
    }

    // 呼吸 + 眨眼 + 偶尔小跳
    if (!this.data.isCharging && !this.jumpState) {
      this.pose.sy *= 1 + Math.sin(time * 2.4) * 0.018;
      this.pose.sx *= 1 - Math.sin(time * 2.4) * 0.012;
    }

    const pivot = actor.userData.tailPivot;
    if (pivot) pivot.rotation.y = Math.sin(time * 7) * 0.35;
    if (this.swallowUntil > now) {
      this.pose.sy *= 1 + Math.sin((this.swallowUntil - now) / 350 * Math.PI) * 0.10;
    }
    const gulp=this.swallowUntil>now?Math.sin((this.swallowUntil-now)/350*Math.PI):0;
    if(actor.userData.innerTongue)actor.userData.innerTongue.scale.set(1,.54+gulp*.18,.53+gulp*.10);
    if(actor.userData.head)actor.userData.head.scale.y=1+gulp*.015;
    if(actor.userData.route && !this.data.isCharging && !this.jumpState && !this.data.careBusy){
      const costume=actor.userData.route.costume;
      const portrait=['home','route','nurture','status'].includes(this.data.phase);
      if(portrait){
        if(['prince','princess','sweetheart'].includes(costume)){this.pose.rz+=Math.sin(time*1.6)*.025;actor.rotation.y=Math.sin(time*.55)*.23;}
        else if(['monk','saint'].includes(costume)){this.pose.sy*=1+Math.sin(time*1.3)*.012;}
        else if(['general','commander'].includes(costume))this.pose.rx+=Math.sin(time*.8)*.012;
        else if(['ceo','bosslady'].includes(costume))this.pose.rz+=Math.sin(time*.9)*.012;
        else if(['it','coder'].includes(costume))(actor.userData.eyes||[]).forEach((eye,i)=>{eye.rotation.y=Math.sin(time*1.8+i*.3)*.025;});
        else if(costume==='artist')(actor.userData.frontLegs||[]).forEach((leg,i)=>{if(i)leg.rotation.x=Math.sin(time*2.2)*.15;});
        if(actor.userData.gesture)actor.userData.gesture.rotation.z=-.5+Math.sin(time*2)*.18;
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
        if (t >= 1) {
          this.blink.start = 0;
        } else {
          k = t < 0.45 ? t / 0.45 : 1 - (t - 0.45) / 0.55;
        }
      }
      eyelids.forEach((lid) => {
        lid.rotation.x = lerp(-0.22, 1.34, k);
      });
    }

    if (this.data.phase === "route" && !this.jumpState && !(actor.userData.route && ['prince','princess','sweetheart'].includes(actor.userData.route.costume))) {
      actor.rotation.y = Math.sin(time * 0.6) * 0.35;
    }
  },

  updateCare(now) {
    const motion = this.careMotion;
    if (!motion) return;
    const actor = this.actor();
    const t = clamp((now - motion.start) / motion.duration, 0, 1);

    if (actor) {
      if (motion.type === "feed") {
        // 一口一口地啄：三次快速下沉
        this.pose.dy += Math.abs(Math.sin(t * Math.PI * 3)) * 0.10;
        this.pose.rx = Math.sin(t * Math.PI * 6) * 0.10;
      } else if (motion.type === "pet") {
        this.pose.rz = Math.sin(t * Math.PI * 4) * 0.14;
        this.pose.dy += Math.sin(t * Math.PI) * 0.04;
      } else {
        // 陪玩：绕一圈小跳
        this.pose.dy += Math.abs(Math.sin(t * Math.PI * 2)) * 0.22;
        this.pose.rz = Math.sin(t * Math.PI * 2) * 0.22;
      }
      const throat = actor.userData.throat;
      if (throat && motion.type === "feed") {
        throat.scale.set(1.15, 0.78 + Math.sin(t * Math.PI * 3) * 0.22, 0.88);
      }
    }

    if (t >= 1) {
      const boost = motion.boost;
      this.careMotion = null;
      if (actor) actor.rotation.z = 0;
      this.setData({ careBusy: false, actionLabel: "" });
      this.applyCare(boost);
    }
  },

  updateLanding(now) {
    const motion = this.landingMotion;
    if (!motion) return;
    const t = (now - motion.start) / (LANDING_TIME + SETTLE_TIME);
    if (t >= 1) {
      this.landingMotion = null;
      return;
    }
    // 先压扁，再回弹过冲，最后归位
    if (t < LANDING_TIME / (LANDING_TIME + SETTLE_TIME)) {
      const k = t / (LANDING_TIME / (LANDING_TIME + SETTLE_TIME));
      this.pose.sy *= lerp(1, 0.78, easeOutQuad(k));
      this.pose.sx *= lerp(1, 1.18, easeOutQuad(k));
    } else {
      const k = (t - LANDING_TIME / (LANDING_TIME + SETTLE_TIME)) / (SETTLE_TIME / (LANDING_TIME + SETTLE_TIME));
      const bounce = Math.sin(k * Math.PI) * 0.12;
      this.pose.sy *= 1 + bounce;
      this.pose.sx *= 1 - bounce;
    }
  },

  updateLeafResponse(now) {
    (this.jumpLeaves||[]).forEach(leaf=>{
      if(!leaf.userData.landingAt)return;
      const age=(now-leaf.userData.landingAt)/900;
      if(age>=1){leaf.rotation.x=0;leaf.rotation.z=0;leaf.userData.landingAt=0;return;}
      const pulse=Math.sin(Math.max(0,age)*Math.PI*3)*Math.exp(-age*4);
      leaf.rotation.x=pulse*.055;leaf.rotation.z=-pulse*.035;
    });
  },

  updateSplash(now) {
    if (!this.splashMotion || !this.frogGroup) return;
    const t = (now - this.splashMotion.start) / 460;
    if (t >= 1) {
      this.frogGroup.visible = false;
      return;
    }
    this.frogGroup.position.y = 0.10 - easeInQuad(t) * 1.6;
    this.pose.rz = t * 0.8;
  },

  insectFlightAt(insect, time) {
    const data = insect.userData;
    const t = time - (this.motionOffset || 0) / 1000 + data.phase;
    let x, y, z, behavior;
    if (data.kind === "dragonfly") {
      const cycle = ((t % 3.2) + 3.2) % 3.2;
      const u = clamp((cycle - 0.95) / 2.25, 0, 1);
      x = data.baseX + Math.sin(u * TAU) * 0.35;
      y = data.baseY + Math.sin(t * 3) * 0.04 + Math.sin(u * Math.PI) * 0.18;
      z = data.baseZ + 0.65 - Math.pow(Math.sin(u * Math.PI), 2) * 1.2;
      behavior = cycle < 0.95 ? "hover" : "glide";
    } else if (data.kind === "butterfly") {
      x = data.baseX + Math.sin(t * 1.2) * 0.38;
      y = data.baseY + Math.sin(t * 2.4) * 0.32;
      z = data.baseZ + Math.sin(t * 0.9) * 0.6;
      behavior = "flutter";
    } else {
      x = data.baseX + Math.sin(t * 0.9) * 0.18;
      y = data.baseY + Math.sin(t * 1.7) * 0.10;
      z = data.baseZ + Math.sin(t * 0.65) * 0.45;
      behavior = "slow";
    }
    return { x: clamp(x, -1.18, 1.18), y, z, behavior };
  },

  updateInsects(dt, time) {
    if (!this.insects || !this.insects.length) return;
    const now = time * 1000;
    this.insects.forEach((insect, index) => {
      if (insect.userData.caught) return;
      const data = insect.userData;
      const flight = this.insectFlightAt(insect, time);
      if (data.flee) {
        const t = (now - data.flee.at) / data.flee.duration;
        if (t >= 1) {
          data.flee = null;
        } else {
          flight.y += Math.sin(t * Math.PI) * 0.45;
          flight.x = clamp(flight.x + Math.sin(t * Math.PI) * 0.25, -1.18, 1.18);
        }
      }

      insect.position.set(flight.x, flight.y, flight.z);
      data.behavior = flight.behavior;

      (data.wings || []).forEach((wing, wingIndex) => {
        wing.rotation.z = Math.sin(time * 26 + index) * 0.7 * (wingIndex ? 1 : -1);
      });

      const targeted = this.aimHit === insect;
      const targetScale = targeted ? 1.18 + Math.sin(time * 12) * 0.06 : 1;
      const current = insect.scale.x || 1;
      insect.scale.setScalar(damp(current, targetScale, 14, dt));
    });
    if (this.data.isAiming && this.aimHit && !this.tongueState) {
      this.aimWorld.copy(this.aimHit.position); this.updateAimMarker();
    }
  },

  applyPose() {
    const actor = this.actor();
    if (!actor || !actor.userData.baseScale) return;
    const base = actor.userData.baseScale;
    actor.scale.set(base * this.pose.sx, base * this.pose.sy, base * this.pose.sz);
    actor.rotation.x = this.pose.rx;
    actor.rotation.z = this.pose.rz;

    // pose.dy 是"叠加位移"，只补上增量，避免每帧累加把角色推到天上
    const applied = actor.userData.dyApplied || 0;
    actor.position.y += this.pose.dy - applied;
    actor.userData.dyApplied = this.pose.dy;
  },

  updateSceneQueue(now) {
    if (!this.nextScene) return;
    if (now < this.nextScene.at) return;
    const method = this.nextScene.method;
    this.nextScene = null;
    this.setData({ transition: false });
    if (typeof this[method] === "function") this[method]();
  },

  scheduleScene(method, delay) {
    this.nextScene = { method, at: Date.now() + delay };
    this.setData({ transition: true });
  },

  // ------------------------------------------------------------------ 工具

  clearCharge() {
    this.stopSound('charge');
    this.charge = 0;
    this.pendingChargeAt = 0;
    this.chargeStart = 0;
    this.showPreview(false);
  },

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
    this.removeObject(this.playBubble); this.playBubble = null;
    this.removeObject(this.districtDecor); this.districtDecor = null;
    this.slowUntil = 0;
    (this.jumpLeaves || []).forEach((leaf) => this.removeObject(leaf));
    this.jumpLeaves = [];
    (this.insects || []).forEach((insect) => this.removeObject(insect));
    this.insects = [];
    this.removeObject(this.aimMarker);
    this.aimMarker = null;
    this.removeObject(this.tongueMesh);
    this.tongueMesh = null;
    this.removeObject(this.tongueTip);
    this.tongueTip = null;
    this.showPreview(false);
    if (this.preview) {
      this.removeObject(this.preview);
      this.preview = null;
    }
    (this.bursts || []).forEach((burst) => this.removeObject(burst));
    (this.rings || []).forEach((ring) => this.removeObject(ring));
    this.bursts = [];
    this.rings = [];
    if (this.effects) {
      [...this.effects.children].forEach((child) => this.removeObject(child));
    }
    this.setData({ transition: false, isCharging: false, isAiming: false, chargePercent: 0,
      bubblePlaying: false, careBusy: false, resting: false, skillArmed: false });
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
    geometries.forEach((geometry) => {
      if (!pooled.has(geometry)) geometry.dispose();
    });
    materials.forEach((material) => {
      if (!shared.has(material) && !pooled.has(material)) material.dispose();
    });
  },

  disposeThree() {
    this.clearChallengeObjects();
    this.removeObject(this.petGroup);
    this.removeObject(this.frogGroup);
    if (this.scene) this.scene.children.slice().forEach(object => this.removeObject(object));
    if (this.art) this.art.dispose();
    if (this.reflectionTarget) { this.reflectionTarget.dispose(); this.reflectionTarget = null; }
    if (this.royalReflectionTarget) { this.royalReflectionTarget.dispose(); this.royalReflectionTarget = null; }
    const textures = new Set();
    (this.sharedMaterials || new Set()).forEach(material => {
      ['map','bumpMap','normalMap','roughnessMap'].forEach(key => { if (material[key]) textures.add(material[key]); });
      material.dispose();
    });
    textures.forEach(texture => texture.dispose());
    if (this.renderer) this.renderer.dispose();
  },

  getRouteById(id) {
    return MALE_ROUTES.concat(FEMALE_ROUTES).find((route) => route.id === id);
  },

  getSelectedRoute() {
    return this.getRouteById(this.data.selectedRouteId);
  }
};

require("./adventure")(page, typeof wx === 'undefined' ? null : wx);
require("./shell")(page);
require("./experience")(page);
if (typeof Page === 'function') Page(page);
if (typeof module !== 'undefined') module.exports = page;
