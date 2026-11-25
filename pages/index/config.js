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
const POND_STORAGE = "tadpole-pond-v1";
const ROSTER_STORAGE = "tadpole-roster-v1";
const PERFECT_PITCHES = [1, 1.06, 1.12, 1.19, 1.26, 1.33, 1.41, 1.5];

const ROUTE_QUOTES = {
  king: ["王冠有点沉，但气场不能输。", "本王准你多摸两下。", "全荷塘都在等朕出发。"],
  prince: ["请多指教，今天风很温柔。", "谢谢你的莲子，很甜。", "出发前先整理一下绶带。"],
  duke: ["急什么，先摇两下折扇。", "躺平也是门手艺活。", "好吧，看在你的面子上跳两下。"],
  general: ["军情紧急，荷叶列阵！", "甲胄擦亮，随时出征。", "这点风浪，不足挂齿。"],
  ceo: ["这片荷塘，我承包了。", "给你三分钟陪我发呆。", "效率第一，现在出发。"],
  college: ["早八逃不掉，荷叶总能跳。", "背上书包，今天去哪玩？", "有零食我就原谅你。"],
  it: ["别催，正在算落点抛物线。", "再跳一叶就下班，真的。", "这波零 Bug，稳得很。"],
  hero: ["江湖路远，有你便不孤单。", "斗笠一压，风起叶动。", "待我一跃过沧澜。"],
  monk: ["落水亦是缘，不必挂怀。", "心静了，沉叶也慢下来。", "施主，今日莲子甚香。"],
  queen: ["今晚的星星，分你一半。", "本宫的披风不能沾水。", "走吧，让荷塘见识一下。"],
  princess: ["转个圈给你看，好看吗？", "想要亮晶晶的泡泡！", "今天也要漂漂亮亮出门。"],
  empress: ["水泽万顷，皆听号令。", "照顾好自己，也照顾好我。", "随朕巡视这片盛夏。"],
  commander: ["银甲红缨，一步不退！", "阵风再大，我替你挡着。", "列队完毕，即刻启程。"],
  bosslady: ["荷塘合同签好了，归你。", "别让进度条等太久。", "今天拿个 S 级回来。"],
  sweetheart: ["最好的荷叶留给你啦～", "嘿嘿，被摸头会变开心。", "一起去捉亮亮的小虫吧！"],
  coder: ["落点误差已收敛到 0.01。", "喝口荷露，继续优化手感。", "算法验证通过，出发！"],
  swordswoman: ["剑穗轻扬，踏叶无声。", "谁敢拦路，一剑挑开。", "风正好，随我闯一遭。"],
  saint: ["莲开有时，静候佳音。", "水波不兴，心自有光。", "愿此行平安喜乐。"],
  artist: ["今天的水色，很适合写生。", "别动，我把这一刻画下来。", "去远处找一抹新颜色吧。"]
};

const POND_THEMES = [
  { id: "summer", name: "碧水初夏", cost: 0, bg: 0xcdeee0, horizon: 0xdcebf0, zenith: 0x689ab8,
    water: 0x49745b, deep: 0x224c3e, hemiSky: 0xe4efff, hemiGround: 0x34452b, hemiI: 0.8,
    sun: 0xfff1d4, sunI: 1.6, rim: 0x9fe4ff, rimI: 0.42, bounce: 0xffd8a6, bounceI: 0.16, fx: null },
  { id: "sunset", name: "落日金波", cost: 3, bg: 0xf0c9a8, horizon: 0xf7caa1, zenith: 0x7c6a96,
    water: 0x5c6d59, deep: 0x383d39, hemiSky: 0xffdfb8, hemiGround: 0x4e3729, hemiI: 0.85,
    sun: 0xffb86b, sunI: 1.75, rim: 0xffd2a6, rimI: 0.52, bounce: 0xffaa6e, bounceI: 0.24, fx: null },
  { id: "rain", name: "细雨荷塘", cost: 4, bg: 0xb7ccd0, horizon: 0xc4d6da, zenith: 0x627c8c,
    water: 0x3c6160, deep: 0x1d3a3c, hemiSky: 0xd4e4ec, hemiGround: 0x2b3e3a, hemiI: 0.92,
    sun: 0xddebf2, sunI: 1.15, rim: 0x9bc4d8, rimI: 0.36, bounce: 0xa6c4c6, bounceI: 0.14, fx: "rain" },
  { id: "firefly", name: "夏夜萤火", cost: 5, bg: 0x1d3145, horizon: 0x284359, zenith: 0x0c1626,
    water: 0x1e404d, deep: 0x0e222b, hemiSky: 0x6d98c4, hemiGround: 0x162422, hemiI: 0.68,
    sun: 0xb8d4ff, sunI: 1.15, rim: 0xffe48a, rimI: 0.55, bounce: 0x5d8b8c, bounceI: 0.18, fx: "firefly" }
];

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
  "按住昆虫拖动瞄准；金萤虫双倍且掉莲子。",
  "准星变金松手伸舌；红蜂会蛰嘴别舔。",
  "吃到 " + BUG_GOAL + " 只昆虫即可通关。"
];

const SINK_TIME = 2000;
const WIND_SPEED = 2.0;
const CHARGE_TIME = 900;
const JUMP_MIN = 1.35;
const JUMP_SPAN = 2.60;
const ANTICIPATE_TIME = 90;
const FLIGHT_TIME = 340;
const LANDING_TIME = 150;
const SETTLE_TIME = 180;
const TONGUE_OUT = 110;
const TONGUE_HOLD = 70;
const TONGUE_BACK = 190;
const TONGUE_RANGE = 2.9;
const INPUT_BUFFER = 260;
const JUMP_PITCH = 1.04;
const JUMP_SIDE = 0.20;
const JUMP_LIVES = 3;
const RESPAWN_DELAY = 780;
const PERFECT_SCORE = 0.3;

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
const turnToward = (from, to, maxTurn) => from + clamp(angleDelta(from, to), -maxTurn, maxTurn);

module.exports = {
  MALE_ROUTES, FEMALE_ROUTES, PERKS, LETTERS, CARE_EPILOGUE, GRADE_ORDER,
  PET_STORAGE, POND_STORAGE, ROSTER_STORAGE, PERFECT_PITCHES, ROUTE_QUOTES, POND_THEMES,
  SKILLS, DISTRICTS, SOUVENIRS, JUMP_PLAN, JUMP_GOAL, BUG_GOAL, BUG_GUIDE,
  SINK_TIME, WIND_SPEED, CHARGE_TIME, JUMP_MIN, JUMP_SPAN,
  ANTICIPATE_TIME, FLIGHT_TIME, LANDING_TIME, SETTLE_TIME,
  TONGUE_OUT, TONGUE_HOLD, TONGUE_BACK, TONGUE_RANGE, INPUT_BUFFER,
  JUMP_PITCH, JUMP_SIDE, JUMP_LIVES, RESPAWN_DELAY, PERFECT_SCORE,
  CARE_AMOUNT, CARE_DECAY, CARE_BOOSTS, CARE_TITLES,
  TAU, clamp, lerp, damp, easeOutQuad, easeOutBack, easeInQuad, smooth, angleDelta, lerpAngle, turnToward
};
