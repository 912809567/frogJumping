const {
  PERKS, PET_STORAGE, POND_STORAGE, ROSTER_STORAGE, ROUTE_QUOTES, POND_THEMES,
  SOUVENIRS, CARE_AMOUNT, CARE_DECAY, CARE_BOOSTS, CARE_TITLES, TAU, clamp
} = require("./config");

function normalizeCompanion(saved, getRouteById) {
  if (!saved || saved.version !== 1 || !getRouteById(saved.routeId)
    || typeof saved.name !== "string" || !Number.isFinite(saved.growth)) return null;
  const num = (value, max) => Number.isFinite(value) ? clamp(Math.floor(value), 0, max) : 0;
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id.slice(0, 100) : "legacy-" + saved.routeId + "-" + saved.name.slice(0, 12),
    lastRewardedRunId: typeof saved.lastRewardedRunId === "string" ? saved.lastRewardedRunId.slice(0, 100) : "",
    version: 1,
    name: saved.name.trim().slice(0, 12) || "小荷",
    routeId: saved.routeId,
    growth: num(saved.growth, 140),
    food: num(saved.food, 100),
    affection: num(saved.affection, 100),
    play: num(saved.play, 100),
    snacks: num(saved.snacks, 999),
    adventures: num(saved.adventures, 9999),
    careCounts: {
      feed: num(saved.careCounts && saved.careCounts.feed, 99999),
      pet: num(saved.careCounts && saved.careCounts.pet, 99999),
      play: num(saved.careCounts && saved.careCounts.play, 99999)
    }
  };
}

module.exports = function attachNurture(page, api) {
  const getApi = () => api || (typeof wx !== "undefined" ? wx : null);
  const readKey = (key) => {
    const wxApi = getApi();
    try { return wxApi && wxApi.getStorageSync ? wxApi.getStorageSync(key) : null; } catch (error) { return null; }
  };
  const writeKey = (key, value) => {
    const wxApi = getApi();
    try { if (wxApi && wxApi.setStorageSync) wxApi.setStorageSync(key, value); return true; } catch (error) { return false; }
  };

  Object.assign(page, {
    loadCompanion() {
      const pet = normalizeCompanion(readKey(PET_STORAGE), (id) => this.getRouteById(id));
      const rosterRaw = readKey(ROSTER_STORAGE);
      const roster = [];
      const seen = new Set();
      if (rosterRaw && rosterRaw.version === 1 && Array.isArray(rosterRaw.list)) {
        rosterRaw.list.forEach((entry) => {
          const item = normalizeCompanion(entry, (id) => this.getRouteById(id));
          if (item && !seen.has(item.id) && roster.length < 19) { seen.add(item.id); roster.push(item); }
        });
      }
      if (pet) {
        const index = roster.findIndex((item) => item.id === pet.id);
        if (index >= 0) roster[index] = pet;
        else roster.unshift(pet);
        if (roster.length > 19) roster.length = 19;
      }
      this.roster = roster;
      this.companion = pet || roster.find((item) => rosterRaw && item.id === rosterRaw.activeId) || roster[0] || null;
      if (this.companion) {
        this.companionId = this.companion.id;
        this.lastRewardedRunId = this.companion.lastRewardedRunId;
      }
      this.loadPondAccount();
      this.updateCompanionSummary();
    },

    saveRoster() {
      if (!this.roster) this.roster = [];
      return writeKey(ROSTER_STORAGE, {
        version: 1,
        activeId: this.companion ? this.companion.id : "",
        list: this.roster.slice(0, 19)
      });
    },

    upsertRoster(pet) {
      if (!pet) return;
      this.roster = this.roster || [];
      const index = this.roster.findIndex((item) => item.id === pet.id);
      if (index >= 0) this.roster[index] = pet;
      else this.roster.unshift(pet);
      if (this.roster.length > 19) this.roster.length = 19;
    },

    loadPondAccount() {
      const saved = readKey(POND_STORAGE);
      const validIds = POND_THEMES.map((item) => item.id);
      const unlocked = new Set(["summer"]);
      if (saved && saved.version === 1 && Array.isArray(saved.unlockedThemes)) {
        saved.unlockedThemes.forEach((id) => { if (validIds.includes(id)) unlocked.add(id); });
      }
      const theme = saved && saved.version === 1 && unlocked.has(saved.pondTheme) ? saved.pondTheme : "summer";
      // 莲子跨伙伴通用：首次升级自动继承旧伙伴存档里的莲子，老玩家不会丢奖励。
      const fallbackSnacks = this.companion && Number.isFinite(this.companion.snacks) ? this.companion.snacks : 0;
      const snacks = saved && saved.version === 1 && Number.isFinite(saved.snacks)
        ? clamp(Math.floor(saved.snacks), 0, 999)
        : clamp(Math.floor(fallbackSnacks), 0, 999);
      const endlessBest = saved && saved.version === 1 && Number.isFinite(saved.endlessBest)
        ? clamp(Math.floor(saved.endlessBest), 0, 9999) : 0;
      const metCount = this.loadCollection ? this.loadCollection().length : 0;
      const endlessUnlocked = !!(
        (saved && saved.version === 1 && saved.endlessUnlocked)
        || endlessBest > 0 || metCount > 0 || (this.companion && this.companion.adventures > 0)
      );
      this.pondAccount = {
        version: 1, snacks, pondTheme: theme, unlockedThemes: Array.from(unlocked),
        endlessBest, endlessUnlocked
      };
      this.syncPondAccountData();
      if (!this.data.petQuote) this.setData({ petQuote: this.routeQuote((this.companion && this.companion.routeId) || "king", 0) });
    },

    unlockEndlessMode() {
      if (!this.pondAccount) this.loadPondAccount();
      if (this.pondAccount.endlessUnlocked) return;
      this.pondAccount.endlessUnlocked = true;
      this.syncPondAccountData();
      this.savePondAccount();
    },

    recordEndlessResult(jumps) {
      if (!this.pondAccount) this.loadPondAccount();
      const score = Math.max(0, Math.floor(jumps || 0));
      const isNewBest = score > (this.pondAccount.endlessBest || 0);
      if (isNewBest) this.pondAccount.endlessBest = score;
      this.pondAccount.endlessUnlocked = true;
      const reward = score >= 5 ? Math.min(12, Math.floor(score / 5)) : (score >= 3 ? 1 : 0);
      if (reward > 0) this.pondAccount.snacks = clamp(this.pondAccount.snacks + reward, 0, 999);
      this.syncPondAccountData();
      this.savePondAccount();
      return { isNewBest, best: this.pondAccount.endlessBest, reward };
    },

    receiveShareCard(query) {
      if (!query || !query.route) return false;
      const route = this.getRouteById(String(query.route));
      if (!route) return false;
      let rawName = "";
      try { rawName = decodeURIComponent(String(query.name || "")); } catch (error) { rawName = String(query.name || ""); }
      const name = rawName.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 12) || "小荷";
      const best = Math.max(0, Math.min(9999, Math.floor(Number(query.best) || 0)));
      this.setData({
        visitorCard: {
          routeId: route.id,
          routeName: route.name,
          name,
          best,
          quote: this.routeQuote(route.id, 0)
        }
      });
      return true;
    },

    dismissVisitorCard() {
      this.setData({ visitorCard: null });
      this.playSound("select");
    },

    adoptFromVisitor() {
      const card = this.data.visitorCard;
      this.setData({ visitorCard: null });
      if (!card || !this.data.threeReady) return;
      this.openRoutes(this.companion ? "new" : undefined);
      this.selectRoute({ currentTarget: { dataset: { id: card.routeId } } });
      this.playSound("select");
    },

    sharedSnacks() {
      if (!this.pondAccount) this.loadPondAccount();
      return this.pondAccount.snacks;
    },

    setSharedSnacks(value) {
      if (!this.pondAccount) this.loadPondAccount();
      const snacks = clamp(Math.floor(value || 0), 0, 999);
      this.pondAccount.snacks = snacks;
      this.setData({ snacks, statusSnacks: snacks });
      this.savePondAccount();
    },

    savePondAccount() {
      if (!this.pondAccount) return false;
      return writeKey(POND_STORAGE, this.pondAccount);
    },

    syncPondAccountData() {
      if (!this.pondAccount) return;
      const unlocked = this.pondAccount.unlockedThemes;
      const list = POND_THEMES.map((item) => ({
        id: item.id, name: item.name, cost: item.cost, unlocked: unlocked.indexOf(item.id) >= 0
      }));
      this.setData({
        snacks: this.pondAccount.snacks,
        statusSnacks: this.pondAccount.snacks,
        pondTheme: this.pondAccount.pondTheme,
        unlockedThemes: unlocked.slice(),
        pondThemeList: list,
        endlessBest: this.pondAccount.endlessBest || 0,
        endlessUnlocked: !!this.pondAccount.endlessUnlocked
      });
    },

    choosePondTheme(event) {
      const id = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id;
      const theme = POND_THEMES.find((item) => item.id === id);
      if (!theme) return;
      if (!this.pondAccount) this.loadPondAccount();
      const unlocked = this.pondAccount.unlockedThemes.indexOf(id) >= 0;
      if (!unlocked) {
        if (this.pondAccount.snacks < theme.cost) {
          this.setData({ storageNotice: "解锁「" + theme.name + "」还差 " + (theme.cost - this.pondAccount.snacks) + " 颗莲子（闯关可带回）" });
          this.playSound("select");
          return;
        }
        this.pondAccount.snacks -= theme.cost;
        this.pondAccount.unlockedThemes.push(id);
        this.playSound("perfect", { rate: 1.19 });
        this.vibrate("medium");
        this.setData({ storageNotice: "已解锁「" + theme.name + "」氛围！" });
      } else {
        this.playSound("select");
        this.setData({ storageNotice: "" });
      }
      this.pondAccount.pondTheme = id;
      this.syncPondAccountData();
      this.savePondAccount();
      this.applyPondTheme(id);
    },

    routeQuote(routeId, index) {
      const list = ROUTE_QUOTES[routeId] || ROUTE_QUOTES.king;
      const i = index === undefined ? Math.floor(Math.random() * list.length) : ((index % list.length) + list.length) % list.length;
      return list[i];
    },

    speakQuote(routeId, quiet) {
      const id = (typeof routeId === "string" && routeId) || this.data.selectedRouteId || (this.companion && this.companion.routeId) || "king";
      const list = ROUTE_QUOTES[id] || ROUTE_QUOTES.king;
      this.quoteIndex = ((this.quoteIndex === undefined ? -1 : this.quoteIndex) + 1) % list.length;
      this.setData({ petQuote: list[this.quoteIndex] });
      if (!quiet) {
        this.playSound("select");
        this.vibrate("light");
      }
    },

    updateCompanionSummary() {
      const pet = this.companion;
      const roster = this.roster || (pet ? [pet] : []);
      const rosterList = roster.map((item) => {
        const route = this.getRouteById(item.routeId);
        return {
          id: item.id,
          name: item.name,
          routeId: item.routeId,
          routeName: route ? route.name : "",
          stageIndex: this.getGrowthStage(item.growth).index,
          active: !!(pet && pet.id === item.id)
        };
      });
      this.setData({
        hasCompanion: !!pet,
        savedPetName: pet ? pet.name : "",
        savedPetRoute: pet ? this.getRouteById(pet.routeId).name : "",
        savedPetStage: pet ? this.getGrowthStage(pet.growth).name : "",
        rosterList,
        rosterCount: rosterList.length
      });
    },

    saveCompanion() {
      this.saveAdventure();
      if (!this.companionActive || !this.getSelectedRoute()) return false;
      this.companion = {
        version: 1, name: this.data.petName, routeId: this.data.selectedRouteId,
        id: this.companionId, lastRewardedRunId: this.lastRewardedRunId || "",
        growth: this.data.growth, food: this.data.food, affection: this.data.affection, play: this.data.play,
        snacks: this.data.snacks, adventures: this.data.adventures,
        careCounts: Object.assign({}, this.careCounts)
      };
      this.upsertRoster(this.companion);
      const stored = writeKey(PET_STORAGE, this.companion);
      this.saveRoster();
      if (!stored) {
        this.setData({ storageNotice: "暂时无法保存，离开前请检查设备存储空间" });
      }
      this.updateCompanionSummary();
      if (stored && this.runRewarded && this.currentRun && this.lastRewardedRunId === this.currentRun.id) {
        this.rewardStored = true;
        this.clearSavedAdventure();
      }
      return stored;
    },

    switchCompanion(event) {
      const id = event && event.currentTarget && event.currentTarget.dataset && event.currentTarget.dataset.id;
      if (!id || !this.roster || !this.roster.length) return;
      const target = this.roster.find((item) => item.id === id);
      if (!target || (this.companion && this.companion.id === target.id)) return;
      this.saveCompanion();
      this.companion = target;
      this.companionId = target.id;
      this.lastRewardedRunId = target.lastRewardedRunId || "";
      this.companionActive = false;
      writeKey(PET_STORAGE, this.companion);
      this.saveRoster();
      this.updateCompanionSummary();
      if (this.refreshAdventureSummary) this.refreshAdventureSummary();
      this.setData({ petQuote: this.routeQuote(target.routeId, 0) });
      if (this.data.phase === "status" && this.openStatus) {
        this.openStatus();
      } else if (this.data.threeReady) {
        this.showNurturePreview();
        this.cameraSnap();
        this.playSound("select");
      }
    },

    resumeCompanion() {
      if (!this.data.threeReady || !this.companion) return;
      const pet = this.companion;
      this.companionId = pet.id;
      this.lastRewardedRunId = pet.lastRewardedRunId || "";
      const route = this.getRouteById(pet.routeId);
      const stage = this.getGrowthStage(pet.growth);
      this.clearChallengeObjects();
      this.endlessMode = false;
      this.companionActive = true;
      this.perk = PERKS[route.perk];
      this.careCounts = Object.assign({ feed: 0, pet: 0, play: 0 }, pet.careCounts);
      this.petStage = stage.index;
      const need = this.needState(pet.food, pet.affection, pet.play);
      this.setData({
        phase: "nurture", petName: pet.name, selectedRouteId: route.id,
        selectedRouteName: route.name, selectedPerkName: this.perk.name, selectedPerkText: this.perk.text,
        growth: pet.growth, growthPercent: clamp(Math.round(pet.growth / 118 * 100), 0, 100),
        food: pet.food, affection: pet.affection, play: pet.play,
        snacks: this.sharedSnacks(), adventures: pet.adventures,
        souvenirs: SOUVENIRS.filter((item) => pet.adventures >= item.at).map((item) => item.name),
        canChallenge: stage.index >= 3, stageName: stage.name, chapter: pet.name + "的池塘",
        careTitle: stage.index >= 3 ? this.careTitle() : "", careKey: this.careTopKey(),
        needKey: need.key, needHint: need.hint, careBusy: false, actionLabel: "",
        gameOver: false, transition: false, petHabit: this.habitText(),
        petQuote: this.routeQuote(route.id, stage.index >= 3 ? 2 : 0)
      });
      this.spawnPet(stage.index);
      this.floatLeaves.visible = true;
      this.updateHomeDecor();
      this.applyPondTheme(this.data.pondTheme);
      this.cameraSnap();
    },

    openNewCompanion() {
      const open = () => { this.openRoutes("new"); };
      const wxApi = getApi();
      if (!wxApi || !wxApi.showModal) { open(); return; }
      wxApi.showModal({
        title: "结识新的伙伴",
        content: "当前伙伴会留在荷塘名册里，随时可以切回来陪伴。已收集的路线、莲子和荷塘氛围都会保留。",
        confirmText: "去看看",
        success: (result) => { if (result.confirm) open(); }
      });
    },

    cancelNewCompanion() {
      if (this.companion) this.resumeCompanion(); else this.goHome();
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
      const wxApi = getApi();
      if (!wxApi || !wxApi.showModal) { done(current || "小荷"); return; }
      wxApi.showModal({
        title: "给伙伴取个名字", editable: true, placeholderText: "最多 12 个字",
        content: current || "", confirmText: "就叫这个",
        success: (result) => {
          if (result.confirm) done((result.content || current || "小荷").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 12) || "小荷");
        }
      });
    },

    returnToPond() {
      this.saveCompanion();
      if (this.companionActive && this.companion) this.resumeCompanion();
      else this.openRoutes();
    },

    beginCompanion(name) {
      if (!this.data.threeReady || !this.getSelectedRoute()) return;
      if (this.companion) this.upsertRoster(this.companion);
      this.newCompanionIdentity();
      this.showNurturePreview();
      this.companionActive = true;
      this.petStage = 0;
      this.careCounts = { feed: 0, pet: 0, play: 0 };
      this.setData({
        phase: "nurture",
        petName: name,
        choosingNew: false,
        snacks: this.sharedSnacks(), adventures: 0, souvenirs: [], rewardText: "", storageNotice: "", petHabit: "",
        petQuote: this.routeQuote(this.data.selectedRouteId, 0),
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
      this.recordMemory("birth", { title: "第一次相遇", note: "从一只小蝌蚪开始，和你一起长大。", stage: 0 });
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

    // ------------------------------------------------------------------ 养成与追泡泡

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

      const lowest = Math.min(next.food, next.affection, next.play);
      const gain = Math.round((10 + lowest / 10) * this.perkValue("growth"));
      const growth = clamp(this.data.growth + gain, 0, 140);
      const stage = this.getGrowthStage(growth);

      if (!this.careCounts) this.careCounts = { feed: 0, pet: 0, play: 0 };
      this.careCounts[boost.type] += 1;

      const changed = stage.index !== (this.petStage === undefined ? 0 : this.petStage);
      this.petStage = stage.index;
      if (changed) this.spawnPet(stage.index);

      const need = this.needState(next.food, next.affection, next.play);
      const done = stage.index >= 3;
      const nextSnacks = Math.max(0, this.data.snacks - (snack ? 1 : 0));
      if (snack) this.setSharedSnacks(nextSnacks);
      this.setData({
        food: next.food,
        affection: next.affection,
        play: next.play,
        snacks: nextSnacks,
        growth,
        growthPercent: clamp(Math.round((growth / 118) * 100), 0, 100),
        stageName: stage.name,
        canChallenge: done,
        careTitle: done ? this.careTitle() : this.data.careTitle,
        careKey: done ? this.careTopKey() : this.data.careKey,
        petHabit: this.habitText(),
        petQuote: this.routeQuote(this.data.selectedRouteId, done ? 2 : boost.type === "feed" ? 1 : 0),
        needKey: need.key,
        needHint: need.hint,
        message: done ? "小青蛙长成了，可以去闯关。" : boost.text
      });
      this.saveCompanion();
      if (changed) this.recordMemory("growth-" + stage.index, {
        title: ["初遇", "长出后腿啦", "四肢齐全啦", "长成小青蛙"][stage.index],
        note: stage.name, stage: stage.index
      });
    },

    startBubbleGame() {
      if (this.data.careBusy || this.data.phase !== "nurture") return;
      this.bubbleGame = { start: Date.now(), duration: 10000, score: 0, goldHit: false };
      this.setData({ bubblePlaying: true, bubbleScore: 0, bubbleSeconds: 10, careBusy: true, actionLabel: "追泡泡" });
      this.clearPlayBubbles();
      this.playBubbles = [];
      for (let slot = 0; slot < 3; slot += 1) this.spawnPlayBubble(slot);
    },

    clearPlayBubbles() {
      (this.playBubbles || []).forEach((bubble) => this.removeObject(bubble));
      if (this.playBubble && !(this.playBubbles || []).includes(this.playBubble)) this.removeObject(this.playBubble);
      this.playBubbles = [];
      this.playBubble = null;
    },

    spawnPlayBubble(slot) {
      if (!this.bubbleGame) return;
      const index = typeof slot === "number" ? slot : 0;
      this.playBubbles = this.playBubbles || [];
      if (this.playBubbles[index]) this.removeObject(this.playBubbles[index]);
      const T = this.THREE;
      const golden = index > 0 && Math.random() < 0.36;
      const material = new T.MeshStandardMaterial({
        color: golden ? 0xffe27a : 0xb9f5ef,
        emissive: golden ? 0x7c5612 : 0x000000,
        emissiveIntensity: golden ? 0.35 : 0,
        transparent: true,
        opacity: golden ? 0.82 : 0.65,
        roughness: golden ? 0.08 : 0.12,
        metalness: golden ? 0.35 : 0.18
      });
      const bubble = new T.Mesh(new this.geo.Sphere(golden ? 0.18 : 0.20, 20, 16), material);
      const laneX = [-0.82, 0, 0.82][index % 3] + (Math.random() - 0.5) * 0.42;
      bubble.position.set(laneX, 0.55 + Math.random() * 0.65, 1.25 + (index - 1) * 0.06);
      bubble.userData = {
        start: Date.now(), slot: index, golden, value: golden ? 2 : 1,
        baseX: laneX, phase: Math.random() * TAU, speed: golden ? 0.11 : 0.07
      };
      this.pondGroup.add(bubble);
      this.playBubbles[index] = bubble;
      this.playBubble = this.playBubbles[0] || bubble;
    },

    touchPlayBubble(touch) {
      const bubbles = (this.playBubbles && this.playBubbles.length) ? this.playBubbles : (this.playBubble ? [this.playBubble] : []);
      if (!bubbles.length || !this.bubbleGame || !touch) return;
      this.camera.updateMatrixWorld();
      let hit = null, bestDist = 52;
      bubbles.forEach((bubble) => {
        if (!bubble) return;
        const p = bubble.position.clone().project(this.camera);
        const distance = Math.hypot((p.x + 1) * this.width / 2 - touch.x, (1 - p.y) * this.height / 2 - touch.y);
        if (distance <= bestDist) { bestDist = distance; hit = bubble; }
      });
      if (!hit) return;
      const golden = !!(hit.userData && hit.userData.golden);
      const value = (hit.userData && hit.userData.value) || 1;
      this.emitBurst(hit.position.clone(), golden ? 0xffe27a : 0xb9f5ef, golden ? 11 : 7);
      this.playSound(golden ? "perfect" : "select", golden ? { rate: 1.19 } : undefined);
      this.bubbleGame.score = Math.min(5, this.bubbleGame.score + value);
      if (golden) this.bubbleGame.goldHit = true;
      this.setData({
        bubbleScore: this.bubbleGame.score,
        actionLabel: golden ? "金色泡泡 ×2！" : "追泡泡"
      });
      this.vibrate(golden ? "medium" : "light");
      if (this.bubbleGame.score >= 5) { this.finishBubbleGame(); return; }
      this.spawnPlayBubble(hit.userData && typeof hit.userData.slot === "number" ? hit.userData.slot : 0);
    },

    finishBubbleGame() {
      if (!this.bubbleGame) return;
      const score = this.bubbleGame.score;
      const goldHit = !!this.bubbleGame.goldHit;
      const played = Date.now() - this.bubbleGame.start >= 1500 || score > 0;
      this.bubbleGame = null;
      this.clearPlayBubbles();
      this.setData({ bubblePlaying: false, careBusy: false, actionLabel: "", bubbleScore: score });
      if (played) {
        this.applyCare(CARE_BOOSTS.play);
        if (goldHit) {
          this.setData({ play: clamp(this.data.play + 5, 0, 100) });
          this.saveCompanion();
        }
      }
      this.setData({
        needHint: goldHit
          ? "点破了金色泡泡！一起追到 " + score + " 分"
          : score ? "一起追到了 " + score + " 个泡泡" : "陪伴本身就很开心"
      });
    },

    updateBubbleGame(now, dt) {
      if (!this.bubbleGame) return;
      const seconds = Math.max(0, Math.ceil((this.bubbleGame.duration - now + this.bubbleGame.start) / 1000));
      if (seconds !== this.data.bubbleSeconds) this.setData({ bubbleSeconds: seconds });
      const bubbles = this.playBubbles || (this.playBubble ? [this.playBubble] : []);
      bubbles.forEach((bubble, index) => {
        if (!bubble) return;
        const meta = bubble.userData || {};
        bubble.position.y += dt * (meta.speed || 0.07);
        if (typeof meta.baseX === "number") {
          bubble.position.x = meta.baseX + Math.sin(now / 520 + (meta.phase || 0)) * (meta.golden ? 0.16 : 0.09);
        }
        if (bubble.position.y > 1.75) this.spawnPlayBubble(typeof meta.slot === "number" ? meta.slot : index);
      });
      if (bubbles.length) {
        const actor = this.actor();
        if (actor) actor.rotation.y = Math.sin(now / 300) * 0.16;
      }
      if (!seconds) this.finishBubbleGame();
    },

    updateCare(now) {
      const motion = this.careMotion;
      if (!motion) return;
      const actor = this.actor();
      const t = clamp((now - motion.start) / motion.duration, 0, 1);
      if (actor) {
        if (motion.type === "feed") {
          this.pose.dy += Math.abs(Math.sin(t * Math.PI * 3)) * 0.10;
          this.pose.rx = Math.sin(t * Math.PI * 6) * 0.10;
        } else if (motion.type === "pet") {
          this.pose.rz = Math.sin(t * Math.PI * 4) * 0.14;
          this.pose.dy += Math.sin(t * Math.PI) * 0.04;
        } else {
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
    }
  });
};
