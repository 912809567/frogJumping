const {
  MALE_ROUTES, SKILLS, DISTRICTS, JUMP_PLAN, JUMP_GOAL, BUG_GOAL, PERFECT_PITCHES,
  SINK_TIME, WIND_SPEED, CHARGE_TIME, JUMP_MIN, JUMP_SPAN,
  ANTICIPATE_TIME, FLIGHT_TIME, LANDING_TIME, SETTLE_TIME,
  INPUT_BUFFER, JUMP_LIVES, RESPAWN_DELAY, PERFECT_SCORE,
  TAU, clamp, lerp, easeOutQuad, easeInQuad, angleDelta, lerpAngle, turnToward
} = require("./config");

module.exports = function attachJumpLevel(page) {
  Object.assign(page, {
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

    startJumpChallenge() {
      if (this.data.careBusy || this.data.phase !== "nurture" || !this.data.threeReady) return;
      if (!this.data.canChallenge) {
        this.setData({ message: "还没长成小青蛙，再陪它一会儿。" });
        return;
      }
      if (!this.resumeAdventure()) this.setupJumpLevel();
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

      this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 0.52, this.materials);
      this.frogGroup.position.copy(first.position);
      this.frogGroup.position.y = 0.10;
      this.pondGroup.add(this.frogGroup);

      this.charge = 0;
      this.pendingChargeAt = 0;
      this.respawnAt = 0;
      this.runStartedAt = Date.now();
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
      this.setData({ districtName: district.name, districtNumber: number + 1, chapter: "荷叶小径 · " + district.name });
      const theme = this.activePondTheme;
      if (!theme || theme.id === "summer") {
        if (this.materials.water) this.materials.water.color.setHex(district.water).convertSRGBToLinear();
        if (this.scene.background) this.scene.background.setHex(district.sky);
        if (this.scene.fog) this.scene.fog.color.setHex(district.sky);
      } else {
        const T = this.THREE;
        if (this.materials.water) {
          const w = new T.Color(theme.water).lerp(new T.Color(district.water), 0.22);
          this.materials.water.color.copy(w).convertSRGBToLinear();
        }
        if (this.scene.background) this.scene.background.setHex(theme.bg);
        if (this.scene.fog) this.scene.fog.color.setHex(theme.bg);
      }
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
      this.setData({
        jumps: checkpoint.jumps, perfect: checkpoint.perfect, resting: false,
        jumpCombo: this.restoringAdventure ? checkpoint.combo || 0 : 0,
        isJumping: false, isCharging: false, gameOver: false, transition: false
      });
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
      this.setData({
        skillName: skill.name, skillText: skill.text, skillSymbol: skill.symbol,
        skillReady: true, skillArmed: false, skillStatus: "可用"
      });
    },

    activateSkill() {
      if (this.data.phase !== "levelJump" || !this.data.skillReady || this.data.resting
        || this.data.gameOver || this.data.transition || this.respawnAt || this.jumpState || this.data.isCharging) return;
      const id = this.skillId;
      this.setData({
        skillReady: false, skillArmed: id === "glide" || id === "rescue" || id === "forecast",
        skillStatus: id === "anchor" ? "已稳住" : id === "slow" ? "静心 6 秒" : "已就绪"
      });
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
      const radius = Math.hypot(from.position.x, from.position.z);
      const pull = clamp((radius - 3.4) / 2.4, 0, 1);
      const toCenter = Math.atan2(-from.position.x, -from.position.z);
      const previous = this.trailHeading === undefined ? toCenter + 0.9 : this.trailHeading;
      const tangentA = toCenter + Math.PI / 2;
      const tangentB = toCenter - Math.PI / 2;
      const tangent = Math.abs(angleDelta(previous, tangentA)) <= Math.abs(angleDelta(previous, tangentB))
        ? tangentA : tangentB;
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
      this.trailHeading = toCenter;
      return this.placeGameLeaf(
        from.position.x + Math.sin(toCenter) * gap,
        from.position.z + Math.cos(toCenter) * gap,
        index + 1, toCenter, plan
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
        leaf.userData.wind = { amp: plan.wind, ax: Math.cos(angle), az: -Math.sin(angle) };
      }
      return leaf;
    },

    leafPositionAt(leaf, timeMs) {
      const drift = leaf.userData.drift;
      if (!drift) return leaf.position.clone();
      const k = Math.sin(((timeMs - (this.motionOffset || 0)) / 1000) * drift.speed) * drift.amp;
      return leaf.userData.anchor.clone().add(new this.THREE.Vector3(drift.ax * k, 0, drift.az * k));
    },

    leafScore(point, leaf, target) {
      const center = target || leaf.position;
      const tolerance = 0.86 * this.perkValue("tolerance");
      const rx = (leaf.userData.rx || 1.0) * tolerance;
      const rz = (leaf.userData.rz || 0.7) * tolerance;
      const dx = (point.x - center.x) / rx;
      const dz = (point.z - center.z) / rz;
      return Math.sqrt(dx * dx + dz * dz);
    },

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
        from.x + (dx / length) * distance, 0.12, from.z + (dz / length) * distance
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
      const rx = leaf.userData.rx || 1.0, rz = leaf.userData.rz || 0.7;
      const weightX = 1 / (rx * rx), weightZ = 1 / (rz * rz);
      const divisor = ux * ux * weightX + uz * uz * weightZ;
      const distance = divisor ? -(ux * ox * weightX + uz * oz * weightZ) / divisor : JUMP_MIN;
      const ideal = clamp((distance - JUMP_MIN) / this.jumpSpan(), 0, 1);
      const lower = Math.floor(ideal * 100) / 100, upper = Math.min(1, lower + 0.01);
      return this.landingFor(lower, now).score <= this.landingFor(upper, now).score ? lower : upper;
    },

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
      this.playSound("charge");
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

      const raw = clamp((now - this.chargeStart) / this.chargeTime(), 0, 1);
      this.charge = easeInQuad(raw);
      const landing = this.landingFor(this.charge, now);
      const tone = landing.score <= 0.55 ? "perfect" : landing.score <= 0.96 ? "good" : landing.score <= 1.2 ? "close" : "far";

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
          new T.Vector3(0, 0, 0), new T.Vector3(0, 0, 0)
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
      if (!landing) landing = this.landingFor(this.charge || 0, Date.now());
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
      this.stopSound("charge"); this.playSound("jump");
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
        crouch: charge * 0.30,
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
        (this.frogGroup.userData.hindLegs || []).forEach((leg) => { leg.rotation.x = -Math.sin(t * Math.PI) * 0.85; });
        (this.frogGroup.userData.frontLegs || []).forEach((leg) => { leg.rotation.x = Math.sin(t * Math.PI) * 0.55; });
        if (t >= 1) this.resolveLanding(now);
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
      const landed = state.score <= 1.08;
      if (!landed) { this.missRun(); return; }

      this.frogGroup.position.copy(this.leafPositionAt(leaf, now));
      this.frogGroup.position.y = 0.10;

      const jumps = this.data.jumps + 1;
      const perfect = state.score <= PERFECT_SCORE && !state.assisted;
      const perfectCount = this.data.perfect + (perfect ? 1 : 0);
      this.noteCombo("jump", perfect);
      const combo = perfect ? Math.max(1, this.data.jumpCombo || 1) : 0;
      const rate = perfect ? PERFECT_PITCHES[Math.min(combo - 1, PERFECT_PITCHES.length - 1)] : 1;
      this.landingMotion = { start: now };
      leaf.userData.landingAt = now;
      this.playSound(perfect ? "perfect" : "land", { rate });
      if (perfect) {
        const ringSize = 1.0 + Math.min(combo - 1, 5) * 0.14;
        this.emitRing(this.frogGroup.position, ringSize, 0xffe27a);
        if (combo >= 2) this.emitRing(this.frogGroup.position, ringSize * 0.68, 0xfff6c2);
      } else {
        this.emitRing(this.frogGroup.position, 0.7);
      }
      this.emitBurst(
        this.frogGroup.position.clone().add(new this.THREE.Vector3(0, 0.2, 0)),
        perfect ? (combo >= 3 ? 0xfff09a : 0xffe082) : 0xe7f7c3,
        perfect ? 12 + Math.min(combo - 1, 5) * 2 : 7
      );
      this.vibrate(perfect ? "heavy" : "medium");

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
            ? (combo >= 2 ? "完美连击 ×" + combo + "！" : "正中叶心！完美 ×" + perfectCount)
            : state.score <= 1 ? "稳稳落叶" : "刚好踩住叶边"
      });
      if (perfect) this.recordMemory("perfect", { title: "第一次正中叶心", note: "轻轻一跃，稳稳落在荷叶中央。", stage: 3 });

      if (jumps >= JUMP_GOAL) {
        this.saveAdventure();
        this.scheduleScene("setupBugLevel", 780);
        this.setData({ chapter: "01 · 通关" });
        return;
      }

      this.removeObject(this.jumpLeaves[0]);
      this.jumpLeaves = [leaf, this.createNextGameLeaf(leaf, jumps)];
      if (jumps % 5 === 0) {
        this.checkpointState = { jumps, perfect: perfectCount, position: leaf.position.clone(), heading: this.trailHeading, combo: this.data.jumpCombo };
        this.sinkStart = 0; this.sinkLeaf = null;
        this.setData({ resting: false, checkpoint: jumps, message: "前往" + DISTRICTS[Math.min(3, jumps / 5)].name });
        this.applyDistrict(jumps); this.resetSkill();
      }
      this.syncChargeTarget();
      this.saveAdventure();
    },

    missRun(reason) {
      this.noteCombo("jump", false);
      if (this.checkpointState) this.checkpointState.combo = 0;
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
        attempts, falls: this.runFalls, isJumping: false, isCharging: false,
        chargePercent: 0, chargeTone: "far",
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

    updateRespawn(now) {
      if (!this.respawnAt || now < this.respawnAt) return;
      this.respawnAt = 0;
      this.splashMotion = null;
      if (!this.frogGroup || !this.jumpLeaves.length || this.data.gameOver) return;
      this.restoreCheckpoint();
      this.setData({ message: "回到第 " + this.data.checkpoint + " 片荷叶，再试一次。" });
    },

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
        gameOver: true, isJumping: false, isCharging: false, chargePercent: 0, message,
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

    updateLanding(now) {
      const motion = this.landingMotion;
      if (!motion) return;
      const t = (now - motion.start) / (LANDING_TIME + SETTLE_TIME);
      if (t >= 1) { this.landingMotion = null; return; }
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
      (this.jumpLeaves || []).forEach((leaf) => {
        if (!leaf.userData.landingAt) return;
        const age = (now - leaf.userData.landingAt) / 900;
        if (age >= 1) { leaf.rotation.x = 0; leaf.rotation.z = 0; leaf.userData.landingAt = 0; return; }
        const pulse = Math.sin(Math.max(0, age) * Math.PI * 3) * Math.exp(-age * 4);
        leaf.rotation.x = pulse * 0.055; leaf.rotation.z = -pulse * 0.035;
      });
    },

    updateSplash(now) {
      if (!this.splashMotion || !this.frogGroup) return;
      const t = (now - this.splashMotion.start) / 460;
      if (t >= 1) { this.frogGroup.visible = false; return; }
      this.frogGroup.position.y = 0.10 - easeInQuad(t) * 1.6;
      this.pose.rz = t * 0.8;
    },

    clearCharge() {
      this.stopSound("charge");
      this.charge = 0;
      this.pendingChargeAt = 0;
      this.chargeStart = 0;
      this.showPreview(false);
    }
  });
};
