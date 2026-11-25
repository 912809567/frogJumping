const {
  MALE_ROUTES, JUMP_GOAL, BUG_GOAL,
  TONGUE_OUT, TONGUE_HOLD, TONGUE_BACK, TONGUE_RANGE,
  TAU, clamp, damp, easeOutQuad
} = require("./config");

const BUG_NAMES = {
  dragonfly: "蜻蜓",
  butterfly: "蝴蝶",
  gnat: "小飞虫",
  goldbug: "金萤虫",
  bee: "红蜂"
};

module.exports = function attachBugLevel(page) {
  Object.assign(page, {
    setupBugLevel() {
      this.ensureAdventure();
      if (this.homeLeaf) this.homeLeaf.visible = false;
      this.clearChallengeObjects();
      this.removeObject(this.petGroup);
      this.removeObject(this.frogGroup);
      this.petGroup = null;
      this.removeObject(this.districtDecor); this.districtDecor = null;
      this.caughtKinds = { gnat: 0, dragonfly: 0, butterfly: 0 };
      this.stunUntil = 0;

      this.jumpLeaves = [];
      const base = this.createGameLeaf(0, 3.0, 99);
      base.scale.setScalar(1.5);
      this.jumpLeaves = [base];

      this.frogGroup = this.ensureArt().makeFrog(this.getSelectedRoute() || MALE_ROUTES[0], 0.85, this.materials);
      this.frogGroup.position.set(0, 0.12, 3.0);
      this.frogGroup.rotation.y = Math.PI;
      this.pondGroup.add(this.frogGroup);
      this.popIn(this.frogGroup);

      // 0..9 为常规可捕食昆虫（保证前十只均为常规虫），10 为带刺红蜂，11 为双倍金萤虫。
      this.insects = [];
      for (let i = 0; i < 10; i += 1) this.spawnInsect(i);
      this.spawnInsect(10, "bee");
      this.spawnInsect(11, "goldbug");
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
        message: "拖动瞄准，松手伸舌。金萤虫双倍且掉莲子，红蜂会蛰嘴别舔！"
      });
      this.cameraSnap();
      this.saveAdventure();
    },

    spawnInsect(index, forceKind) {
      if (this.insects.length > 14) return;
      const kinds = ["dragonfly", "butterfly", "gnat"];
      const kind = forceKind || kinds[index % kinds.length];
      const insect = this.ensureArt().makeInsect(kind, this.materials);
      const rx = (index * 0.618) % 1;
      const ry = (index * 0.3733) % 1;
      const rz = (index * 0.7919) % 1;
      insect.position.set(
        (rx * 2 - 1) * (forceKind ? 0.95 : 1.15),
        0.95 + ry * 1.65,
        0.75 + rz * 1.25
      );
      insect.userData.baseY = insect.position.y;
      insect.userData.kind = kind;
      insect.userData.baseX = insect.position.x;
      insect.userData.baseZ = insect.position.z;
      insect.userData.speed = 0.16 + ((index % 5) * 0.05);
      insect.userData.phase = index * 0.9;
      if (kind === "goldbug") {
        insect.userData.bonus = true;
        insect.userData.expiresAt = Date.now() + 7500;
      }
      if (kind === "bee") insect.userData.hazard = true;
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

      let best = 52;
      let hit = null;
      const projected = new this.THREE.Vector3();
      this.insects.forEach((insect) => {
        projected.copy(insect.position).project(this.camera);
        if (projected.z < -1 || projected.z > 1) return;
        const dx = (projected.x - this.pointer.x) * this.width * 0.5;
        const dy = (projected.y - this.pointer.y) * this.height * 0.5;
        const distance = Math.hypot(dx, dy);
        if (distance < best) { best = distance; hit = insect; }
      });

      this.aimHit = hit;
      if (hit) {
        this.aimWorld.copy(hit.position);
      } else {
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

    mouthWorld() {
      if (!this.frogGroup) return new this.THREE.Vector3(0, 1, 3);
      this.frogGroup.updateMatrixWorld(true);
      if (this.frogGroup.userData.mouthAnchor) return this.frogGroup.userData.mouthAnchor.getWorldPosition(new this.THREE.Vector3());
      return this.frogGroup.localToWorld(new this.THREE.Vector3(0, 0.92, 0.50));
    },

    updateAimMarker() {
      if (!this.aimMarker) return;
      if (!this.data.isAiming) { this.aimMarker.visible = false; return; }
      this.aimMarker.visible = true;
      this.aimMarker.position.copy(this.aimWorld);
      this.aimMarker.quaternion.copy(this.camera.quaternion);
      const inRange = this.mouthWorld().distanceTo(this.aimWorld) <= TONGUE_RANGE;
      const hit = this.aimHit;
      const isBee = hit && hit.userData.kind === "bee";
      const isGold = hit && hit.userData.kind === "goldbug";
      const color = !inRange ? 0x8f9a92 : isBee ? 0xff5a52 : isGold ? 0xfff37a : hit ? 0xffe98a : 0xffffff;
      this.aimMarker.children[0].material.color.setHex(color);
      this.aimMarker.scale.setScalar(inRange && hit ? (isGold ? 1.22 : 1.1) : 1.0);
      const behavior = hit && hit.userData.behavior;
      const hint = hit
        ? BUG_NAMES[hit.userData.kind] + " · " + (isBee ? "别舔！会蛰嘴" : !inRange ? "等它飞近" : isGold ? "双倍+莲子！" : behavior === "hover" ? "正在悬停" : "够得着")
        : "";
      if (hint !== this.data.bugHint) this.setData({ bugHint: hint });
    },

    fireTongue() {
      if (this.data.phase !== "levelBug" || !this.frogGroup || this.tongueState
        || this.data.paused || this.data.transition || this.data.gameOver) return;
      if (this.stunUntil && Date.now() < this.stunUntil) {
        this.setData({ message: "嘴巴还在发麻，稍等一下…" });
        return;
      }
      const T = this.THREE;
      this.playSound("tongue");
      const from = this.mouthWorld();
      const aimed = this.aimHit && this.insects.indexOf(this.aimHit) >= 0 ? this.aimHit : null;
      let target = (aimed ? aimed.position : this.aimWorld).clone();

      const distance = from.distanceTo(target);
      const outOfRange = distance > TONGUE_RANGE;
      let hit = aimed;
      if (outOfRange) {
        target = from.clone().add(target.clone().sub(from).normalize().multiplyScalar(TONGUE_RANGE));
        hit = null;
      }

      this.tongueState = {
        start: Date.now(), from, target, hit, scored: false,
        duration: TONGUE_OUT + TONGUE_HOLD + TONGUE_BACK
      };

      if (!hit) {
        this.noteCombo("bug", false);
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
      else reach = Math.pow(clamp(1 - (elapsed - TONGUE_OUT - TONGUE_HOLD) / TONGUE_BACK, 0, 1), 1.25);

      const end = state.from.clone().lerp(state.target, reach);
      const delta = end.clone().sub(state.from);
      const length = Math.max(0.001, delta.length());
      this.tongueMesh.position.copy(state.from).lerp(end, 0.5);
      this.tongueMesh.scale.set(1, length, 1);
      this.tongueMesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
      this.tongueTip.position.copy(end);
      const elastic = elapsed > TONGUE_OUT + TONGUE_HOLD ? Math.sin(clamp((elapsed - TONGUE_OUT - TONGUE_HOLD) / TONGUE_BACK, 0, 1) * Math.PI) : 0;
      this.tongueTip.scale.set(1 + elastic * 0.22, 1 - elastic * 0.12, 1 + elastic * 0.22);

      if (state.hit && !state.scored && reach > 0.9) {
        state.scored = true;
        state.hit.userData.caught = now;
        const burstColor = state.hit.userData.kind === "bee" ? 0xff6257 : state.hit.userData.kind === "goldbug" ? 0xfff085 : 0xffe98a;
        this.emitBurst(state.hit.position.clone(), burstColor, state.hit.userData.kind === "goldbug" ? 12 : 6);
      }

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
    },

    scoreBug(insect) {
      if (!insect || this.insects.indexOf(insect) < 0) return;
      const kind = insect.userData.kind;
      const pos = insect.position.clone();
      this.removeObject(insect);
      this.insects = this.insects.filter((item) => item !== insect);

      // 误舔带刺红蜂：不计进度、断连击、短暂发晕 1.1 秒
      if (kind === "bee") {
        this.stunUntil = Date.now() + 1100;
        this.noteCombo("bug", false);
        this.playSound("land", { rate: 0.68 });
        this.vibrate("heavy");
        this.shake = { start: Date.now(), amp: 0.14, duration: 280 };
        this.emitRing(pos, 0.75, 0xff6b61);
        this.emitBurst(pos, 0xff6b61, 10);
        this.setData({ bugHint: "", message: "哎呀！被红蜂蛰到了，缓一缓…" });
        this.spawnInsect(10 + Math.floor(Math.random() * 5), "bee");
        this.saveAdventure();
        return;
      }

      const isGold = kind === "goldbug";
      const bugs = Math.min(BUG_GOAL, this.data.bugs + (isGold ? 2 : 1));
      this.caughtKinds = this.caughtKinds || { gnat: 0, dragonfly: 0, butterfly: 0 };
      const trackKey = isGold ? "dragonfly" : kind;
      this.caughtKinds[trackKey] = (this.caughtKinds[trackKey] || 0) + 1;

      if (isGold) {
        this.setSharedSnacks(this.sharedSnacks() + 1);
        this.emitRing(pos, 0.85, 0xffe27a);
        this.emitBurst(pos, 0xffe27a, 14);
        this.playSound("perfect", { rate: 1.26 });
        this.vibrate("heavy");
      } else {
        this.emitRing(pos, 0.45);
        this.playSound("swallow");
        this.vibrate("medium");
      }

      this.setData({
        bugs, bugHint: "",
        caughtKinds: Object.keys(this.caughtKinds).map((key) => ({ name: BUG_NAMES[key], count: this.caughtKinds[key] })),
        message: bugs >= BUG_GOAL
          ? "捕虫成功，荷花池通关。"
          : isGold
            ? "抓到金萤虫！+2 进度 · 莲子 +1"
            : "吃到一只" + (BUG_NAMES[kind] || "小虫") + "！"
      });
      this.swallowUntil = Date.now() + 350;
      this.noteCombo("bug", true);
      this.recordMemory("catch", { title: "第一只小虫", note: "长舌头一伸，第一次吃到了" + (BUG_NAMES[kind] || "小虫") + "。", stage: 3 });
      if (bugs >= BUG_GOAL) {
        this.adventureFinishedAt = Date.now();
        this.scheduleScene("showReturnChoice", 820);
      } else {
        this.spawnInsect(bugs + 7, isGold ? "goldbug" : undefined);
      }
      this.saveAdventure();
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
      } else if (data.kind === "goldbug") {
        x = data.baseX + Math.sin(t * 2.1) * 0.44;
        y = data.baseY + Math.sin(t * 3.4) * 0.24;
        z = data.baseZ + Math.cos(t * 1.6) * 0.55;
        behavior = "shimmer";
      } else if (data.kind === "bee") {
        x = data.baseX + Math.sin(t * 1.55) * 0.40;
        y = data.baseY + Math.sin(t * 3.1) * 0.14;
        z = data.baseZ + Math.sin(t * 1.15) * 0.50;
        behavior = "buzz";
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
      if (this.stunUntil && now < this.stunUntil) {
        this.pose.rz += Math.sin(now * 0.045) * 0.16;
      } else if (this.stunUntil && now >= this.stunUntil) {
        this.stunUntil = 0;
      }
      const expired = [];
      this.insects.forEach((insect, index) => {
        if (insect.userData.caught) return;
        const data = insect.userData;
        if (data.expiresAt && now > data.expiresAt && this.aimHit !== insect) {
          expired.push(insect);
          return;
        }
        const flight = this.insectFlightAt(insect, time);
        if (data.flee) {
          const t = (now - data.flee.at) / data.flee.duration;
          if (t >= 1) data.flee = null;
          else {
            flight.y += Math.sin(t * Math.PI) * 0.45;
            flight.x = clamp(flight.x + Math.sin(t * Math.PI) * 0.25, -1.18, 1.18);
          }
        }
        insect.position.set(flight.x, flight.y, flight.z);
        data.behavior = flight.behavior;
        (data.wings || []).forEach((wing, wingIndex) => {
          const flap = data.kind === "bee" ? 38 : 26;
          wing.rotation.z = Math.sin(time * flap + index) * 0.7 * (wingIndex ? 1 : -1);
        });
        const targeted = this.aimHit === insect;
        const pulse = data.kind === "goldbug" ? 1.08 + Math.sin(time * 9) * 0.08 : 1;
        const targetScale = targeted ? 1.18 + Math.sin(time * 12) * 0.06 : pulse;
        const current = insect.scale.x || 1;
        insect.scale.setScalar(damp(current, targetScale, 14, dt));
      });
      if (expired.length) {
        expired.forEach((insect) => {
          this.removeObject(insect);
          this.insects = this.insects.filter((item) => item !== insect);
          this.spawnInsect(11 + Math.floor(Math.random() * 5), "goldbug");
        });
      }
      if (this.data.isAiming && this.aimHit && !this.tongueState) {
        this.aimWorld.copy(this.aimHit.position); this.updateAimMarker();
      }
    }
  });
};
