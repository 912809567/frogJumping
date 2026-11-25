const SETTINGS_KEY = 'tadpole-settings-v1';

module.exports = function shell(page) {
  Object.assign(page.data, { soundEnabled: true, hapticEnabled: true, qualityMode: 'auto',
    statusGrowth: 0, statusFood: 0, statusAffection: 0, statusPlay: 0, statusSnacks: 0,
    statusAdventures: 0, statusSkill: '', statusPerk: '', statusHabit: '' });

  Object.assign(page, {
    loadPreferences() {
      let saved;
      try { if (typeof wx !== 'undefined' && wx.getStorageSync) saved = wx.getStorageSync(SETTINGS_KEY); } catch (error) {}
      if (!saved || saved.version !== 1) return;
      const patch = {};
      ['soundEnabled', 'hapticEnabled'].forEach(key => { if (typeof saved[key] === 'boolean') patch[key] = saved[key]; });
      if (['auto','high','smooth'].includes(saved.qualityMode)) patch.qualityMode = saved.qualityMode;
      this.setData(patch);
    },

    savePreferences() {
      try {
        if (typeof wx !== 'undefined' && wx.setStorageSync) wx.setStorageSync(SETTINGS_KEY, {
          version: 1, soundEnabled: this.data.soundEnabled, hapticEnabled: this.data.hapticEnabled,
          qualityMode: this.data.qualityMode
        });
      } catch (error) { this.setData({ storageNotice: '设置暂时无法保存，本次仍然有效' }); }
    },

    startGame() {
      if (!this.data.threeReady) return;
      this.playSound('select');
      if (this.resumeAdventure()) return;
      if (this.companion) this.resumeCompanion();
      else this.openRoutes();
    },

    goHome() {
      this.stopAllSounds();
      const quote = this.routeQuote ? this.routeQuote((this.companion && this.companion.routeId) || 'king', 0) : '';
      if (!this.data.threeReady) { this.setData({phase:'home',chapter:'初夏的池塘',petQuote:quote});return; }
      this.openRoutes('home');
      if (this.applyPondTheme) this.applyPondTheme(this.data.pondTheme);
      this.setData({ phase: 'home', chapter: '初夏的池塘', actionLabel: '', storageNotice: '', petQuote: quote });
      this.cameraSnap();
    },

    openStatus() {
      this.saveCompanion();
      const pet = this.companion;
      const route = pet && this.getRouteById(pet.routeId);
      const skill = route && this.skillForRoute(route.id);
      const skillNames = { glide: '轻风滑翔', anchor: '定叶术', forecast: '叶心计算', slow: '静心时刻', rescue: '莲叶相助' };
      this.setData({ phase: 'status', chapter: '伙伴档案',
        statusGrowth: pet ? Math.min(100, Math.round(pet.growth / 118 * 100)) : 0,
        statusFood: pet ? pet.food : 0, statusAffection: pet ? pet.affection : 0,
        statusPlay: pet ? pet.play : 0, statusSnacks: this.sharedSnacks ? this.sharedSnacks() : (pet ? pet.snacks : 0),
        statusAdventures: pet ? pet.adventures : 0, statusSkill: skillNames[skill] || '',
        statusPerk: route ? ({steady:'稳重',nimble:'轻盈',leap:'远跳',serene:'从容',kindred:'亲和'})[route.perk] : '' });
      if (this.data.threeReady) { this.showNurturePreview(); this.cameraSnap(); }
      this.playSound('select');
    },

    openSettings() {
      this.saveCompanion();
      this.setData({ phase: 'settings', chapter: '池塘设置', storageNotice: '' });
      this.playSound('select');
    },

    toggleSetting(event) {
      const key = event.currentTarget.dataset.key;
      if (!['soundEnabled', 'hapticEnabled'].includes(key)) return;
      this.setData({ [key]: !this.data[key] });
      if (key === 'soundEnabled' && !this.data.soundEnabled) this.stopAllSounds();
      this.savePreferences();
      if (key === 'soundEnabled') this.playSound('select');
      if (key === 'hapticEnabled') this.vibrate('light');
    },

    chooseQuality(event) {
      const qualityMode = event.currentTarget.dataset.mode;
      if (!['auto', 'high', 'smooth'].includes(qualityMode)) return;
      this.setData({ qualityMode });
      this.applyQualityPreference(); this.savePreferences(); this.playSound('select');
    },

    applyQualityPreference() {
      if (!this.renderQuality || !this.renderer || !this.renderer.setPixelRatio) return;
      const ratio = this.data.qualityMode === 'smooth' ? Math.min(1.5, this.renderQuality.max) : this.renderQuality.max;
      this.renderer.setPixelRatio(ratio); this.renderQuality.current = ratio;
      this.renderQuality.changedAt = Date.now() - 15000;
      this.resetRenderQualityWindow(Date.now(), 2000);
    },

    playSound(name, options) {
      if (!this.data.soundEnabled || typeof wx === 'undefined' || !wx.createInnerAudioContext) return;
      if (!['select','charge','jump','land','perfect','tongue','swallow'].includes(name)) return;
      this.audioVoices = this.audioVoices || {};
      try {
        let voice = this.audioVoices[name];
        if (!voice) {
          voice = wx.createInnerAudioContext(); voice.src = this.assetPath ? this.assetPath('assets/audio/' + name + '.wav') : '/assets/audio/' + name + '.wav';
          voice.volume = name === 'charge' ? .22 : .38; voice.obeyMuteSwitch = true;
          if (voice.onError) voice.onError(() => {});
          this.audioVoices[name] = voice;
        }
        const rate = options && Number.isFinite(options.rate) ? Math.max(.5, Math.min(2, options.rate)) : 1;
        try { voice.playbackRate = rate; } catch (error) {}
        voice.stop(); voice.play();
      } catch (error) {}
    },

    stopSound(name) {
      const voice = this.audioVoices && this.audioVoices[name];
      if (voice) { try { voice.stop(); } catch (error) {} }
    },

    stopAllSounds() {
      Object.keys(this.audioVoices || {}).forEach(name => this.stopSound(name));
    },

    disposeAudio() {
      this.stopAllSounds();
      Object.keys(this.audioVoices || {}).forEach(name => { try { this.audioVoices[name].destroy(); } catch (error) {} });
      this.audioVoices = null;
    }
  });
};
