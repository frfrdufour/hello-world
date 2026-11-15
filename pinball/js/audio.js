// All sound is made in code: effects, an original waltz, and spoken lines.

const midi = n => 440 * Math.pow(2, (n - 69) / 12);

// Original 16-bar spooky waltz in D minor. Each bar: [bass root, chord notes, three melody notes].
const DM = [38, [62, 65, 69]], GM = [43, [62, 67, 70]], A7 = [45, [61, 64, 67]];
const BB = [46, [62, 65, 70]], ED = [40, [64, 67, 70]];
const BARS = [
  [DM, [74, 77, 81]], [DM, [82, 81, 77]], [GM, [79, 82, 86]], [GM, [84, 82, 79]],
  [A7, [73, 76, 79]], [A7, [81, 79, 76]], [DM, [77, 74, 69]], [A7, [73, 76, 73]],
  [BB, [70, 74, 77]], [GM, [79, 77, 74]], [ED, [76, 79, 82]], [A7, [85, 81, 76]],
  [DM, [74, 81, 77]], [BB, [70, 77, 74]], [A7, [73, 76, 79]], [DM, [74, 0, 0]],
];

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.voiceOn = true;
    this.intense = false;
    this.step = 0;
    this.voices = [];
    this.voiceName = '';
    this.onVoices = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(comp);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);
    this.musBus = ctx.createGain();
    this.musBus.gain.value = 0.3;
    this.musBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextT = ctx.currentTime + 0.2;
    setInterval(() => this.schedule(), 60);
    if ('speechSynthesis' in window) {
      const load = () => { this.voices = speechSynthesis.getVoices(); if (this.onVoices) this.onVoices(); };
      load();
      speechSynthesis.onvoiceschanged = load;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
    if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  tone({ type = 'sine', f = 440, f2 = 0, dur = 0.1, vol = 0.3, at = 0, attack = 0.003, lp = 0, bus = null }) {
    const ctx = this.ctx;
    const t = Math.max(ctx.currentTime, at || ctx.currentTime);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = lp;
      o.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.1, vol = 0.3, type = 'bandpass', f = 1000, f2 = 0, q = 1, at = 0, bus = null }) {
    const ctx = this.ctx;
    const t = Math.max(ctx.currentTime, at || ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  sfx(name, p = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'flipUp':
        this.noise({ dur: 0.035, vol: 0.5, f: 2200, q: 0.8 });
        this.tone({ f: 120, f2: 55, dur: 0.07, vol: 0.5 });
        break;
      case 'flipDown':
        this.noise({ dur: 0.03, vol: 0.2, f: 1200, q: 0.8 });
        this.tone({ f: 80, f2: 45, dur: 0.05, vol: 0.2 });
        break;
      case 'knock':
        this.noise({ dur: 0.025, vol: 0.12 + 0.25 * p, f: 900 + 700 * p, q: 1.5 });
        this.tone({ f: 160, f2: 90, dur: 0.04, vol: 0.1 + 0.15 * p });
        break;
      case 'rubber':
        this.tone({ f: 190, f2: 110, dur: 0.06, vol: 0.12 + 0.2 * p, type: 'triangle' });
        break;
      case 'bumper': {
        const f = [196, 220, 262][p] || 220;
        this.tone({ type: 'square', f: f * 2, f2: f, dur: 0.09, vol: 0.28, lp: 2400 });
        this.tone({ f: f * 4, dur: 0.18, vol: 0.2 });
        this.noise({ dur: 0.03, vol: 0.35, f: 3000 });
        break;
      }
      case 'sling':
        this.noise({ dur: 0.05, vol: 0.45, type: 'highpass', f: 1800 });
        this.tone({ type: 'sawtooth', f: 330, f2: 140, dur: 0.07, vol: 0.25, lp: 1800 });
        break;
      case 'target':
        this.tone({ f: 1320, dur: 0.35, vol: 0.25 });
        this.tone({ f: 1975, dur: 0.25, vol: 0.14 });
        this.noise({ dur: 0.02, vol: 0.25, f: 2500 });
        break;
      case 'roll':
        this.tone({ f: 990, f2: 1480, dur: 0.09, vol: 0.2, type: 'triangle' });
        break;
      case 'spin':
        this.tone({ f: 1500, dur: 0.025, vol: 0.12, type: 'triangle' });
        break;
      case 'orbit':
        this.tone({ type: 'sawtooth', f: 220, f2: 880, dur: 0.3, vol: 0.2, lp: 2500 });
        break;
      case 'outlane':
        this.tone({ type: 'sawtooth', f: 300, f2: 90, dur: 0.5, vol: 0.2, lp: 1200 });
        break;
      case 'scoop':
        this.tone({ type: 'sawtooth', f: 420, f2: 55, dur: 0.6, vol: 0.3, lp: 1400 });
        this.noise({ dur: 0.5, vol: 0.2, type: 'lowpass', f: 900, f2: 120 });
        break;
      case 'eject':
        this.noise({ dur: 0.06, vol: 0.5, f: 1500 });
        this.tone({ f: 90, f2: 200, dur: 0.12, vol: 0.4 });
        break;
      case 'launch':
        this.noise({ dur: 0.08, vol: 0.3 + 0.3 * p, f: 1800 });
        this.tone({ type: 'triangle', f: 90, f2: 320 + 300 * p, dur: 0.22, vol: 0.35 });
        break;
      case 'drain':
        [392, 349, 294, 220].forEach((f, i) =>
          this.tone({ type: 'triangle', f, dur: 0.3, vol: 0.28, at: now + i * 0.17 }));
        break;
      case 'growl': {
        const f = 60 + Math.random() * 30;
        this.tone({ type: 'sawtooth', f: f * 1.6, f2: f, dur: 0.4, vol: 0.4, lp: 500 });
        this.tone({ type: 'square', f: f * 0.5, dur: 0.35, vol: 0.25, lp: 300 });
        this.noise({ dur: 0.3, vol: 0.2, type: 'lowpass', f: 400 });
        break;
      }
      case 'thunder':
        this.noise({ dur: 1.8, vol: 0.6, type: 'lowpass', f: 500, f2: 60 });
        this.noise({ dur: 0.12, vol: 0.4, type: 'highpass', f: 2500 });
        break;
      case 'jackpot':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
          this.tone({ type: 'square', f, dur: 0.16, vol: 0.2, lp: 4000, at: now + i * 0.07 }));
        break;
      case 'room':
        [294, 349, 440, 554].forEach((f, i) =>
          this.tone({ type: 'sawtooth', f, dur: 0.9 - i * 0.1, vol: 0.14, lp: 1800, at: now + i * 0.09 }));
        break;
      case 'start':
        [147, 220, 294, 440, 587].forEach((f, i) =>
          this.tone({ type: 'sawtooth', f, dur: 0.5, vol: 0.16, lp: 2200, at: now + i * 0.1 }));
        break;
      case 'tilt':
        this.tone({ type: 'sawtooth', f: 70, dur: 0.9, vol: 0.45, lp: 600 });
        break;
      case 'nudge':
        this.tone({ f: 70, f2: 40, dur: 0.12, vol: 0.5 });
        break;
      case 'rewind':
        for (let i = 0; i < 14; i++) {
          this.tone({ type: 'triangle', f: 300 + i * 90, dur: 0.07, vol: 0.18, at: now + i * 0.09 });
        }
        break;
      case 'portal':
        this.tone({ f: 200, f2: 1600, dur: 0.18, vol: 0.25 });
        this.tone({ f: 1600, f2: 200, dur: 0.22, vol: 0.2, at: now + 0.1 });
        break;
      case 'ink':
        this.tone({ f: 660, f2: 990, dur: 0.06, vol: 0.15, type: 'triangle' });
        break;
      case 'split':
        this.tone({ f: 500, f2: 1500, dur: 0.25, vol: 0.2, type: 'triangle' });
        this.tone({ f: 500, f2: 250, dur: 0.25, vol: 0.2, type: 'triangle' });
        break;
      case 'rampUp':
        this.noise({ dur: 0.35, vol: 0.22, f: 500, f2: 2600, q: 2 });
        break;
      case 'ramp':
        [440, 587, 740, 880].forEach((f, i) =>
          this.tone({ type: 'triangle', f, dur: 0.14, vol: 0.22, at: now + i * 0.05 }));
        break;
      case 'rampDrop':
        this.tone({ f: 150, f2: 80, dur: 0.07, vol: 0.3 });
        this.noise({ dur: 0.03, vol: 0.2, f: 1400 });
        break;
      case 'laugh':
        this.laugh();
        break;
      case 'bonus':
        this.tone({ type: 'square', f: 880, dur: 0.05, vol: 0.12, lp: 3000 });
        break;
    }
  }

  // A sinister laugh built from a buzzing source and two vowel filters.
  laugh() {
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    const mix = ctx.createGain();
    mix.gain.value = 0.9;
    for (const [f, q, v] of [[720, 7, 1], [1150, 9, 0.6], [2500, 8, 0.25]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const bg = ctx.createGain();
      bg.gain.value = v;
      o.connect(bp); bp.connect(bg); bg.connect(g);
    }
    g.connect(mix); mix.connect(this.sfxBus);
    const n = 7;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.17 + i * i * 0.006;
      const f = 150 - i * 9;
      o.frequency.setValueAtTime(f * 1.25, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.11);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(1.2 - i * 0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    }
    o.start(t0);
    o.stop(t0 + n * 0.2 + 0.4);
  }

  // Pick the most natural voices this browser offers.
  rank(v, want) {
    let s = 0;
    const n = v.name;
    if (/natural|neural|enhanced|premium|siri/i.test(n)) s += 6;
    if (/google|online/i.test(n)) s += 3;
    if (/en[-_]GB/i.test(v.lang)) s += 2;
    if (want.test(n)) s += 4;
    if (/espeak|compact|albert|bad news|good news|bells|boing|bubbles|cellos|whisper|zarvox|trinoids|organ|jester|superstar|wobble|bahh|junior|ralph|fred|kathy|princess/i.test(n)) s -= 20;
    return s;
  }

  bestVoice(want) {
    const en = this.voices.filter(v => /^en/i.test(v.lang));
    if (!en.length) return null;
    if (this.voiceName) {
      const chosen = en.find(v => v.name === this.voiceName);
      if (chosen) return chosen;
    }
    return en.slice().sort((a, b) => this.rank(b, want) - this.rank(a, want))[0];
  }

  // Music scheduler: six eighth-note steps per bar.
  schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const stepDur = 60 / (this.intense ? 148 : 100) / 2;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      if (this.musicOn && !this.muted) this.playStep(this.step, this.nextT, stepDur);
      this.step = (this.step + 1) % (BARS.length * 6);
      this.nextT += stepDur;
    }
  }

  playStep(step, t, sd) {
    const bar = BARS[Math.floor(step / 6)];
    const pos = step % 6;
    const [root, chord] = bar[0];
    const bus = this.musBus;
    if (pos === 0) {
      this.tone({ type: 'triangle', f: midi(root), dur: sd * 2.4, vol: 0.5, at: t, bus });
      this.tone({ type: 'sine', f: midi(root - 12), dur: sd * 2.4, vol: 0.4, at: t, bus });
    }
    if (pos === 2 || pos === 4) {
      for (const n of chord) {
        this.tone({ type: 'square', f: midi(n), dur: sd * 1.3, vol: 0.07, lp: 1200, at: t, bus });
        this.tone({ type: 'square', f: midi(n) * 1.006, dur: sd * 1.3, vol: 0.05, lp: 1200, at: t, bus });
      }
    }
    if (pos % 2 === 0) {
      const n = bar[1][pos / 2];
      if (n) {
        this.tone({ type: 'sine', f: midi(n), dur: sd * 2.6, vol: 0.3, at: t, bus });
        this.tone({ type: 'triangle', f: midi(n + 12), dur: sd * 1.2, vol: 0.1, at: t, bus });
      }
    }
    if (this.intense) {
      this.noise({ dur: 0.03, vol: 0.12, type: 'highpass', f: 6000, at: t, bus });
      if (pos === 3) this.tone({ type: 'triangle', f: midi(root + 12), dur: sd, vol: 0.3, at: t, bus });
    }
  }

  // Spoken lines. host = the Caretaker, vesper = the medium, grim = the gargoyle.
  say(text, role = 'host', pri = 1) {
    if (!this.voiceOn || this.muted || !this.ctx || !('speechSynthesis' in window)) return;
    try {
      const ss = window.speechSynthesis;
      if (ss.speaking || ss.pending) {
        if (pri < 2) return;
        ss.cancel();
      }
      const u = new SpeechSynthesisUtterance(text);
      const female = this.bestVoice(/female|samantha|serena|sonia|libby|aria|jenny|kate|moira|karen|michelle|zira|hazel|victoria/i);
      const male = this.bestVoice(/\bmale|daniel|arthur|oliver|ryan|george|guy|christopher|eric|brian|david|james|alex/i);
      if (role === 'vesper') {
        if (female) { u.voice = female; u.lang = female.lang; }
        u.pitch = 1.05; u.rate = 0.95;
      } else if (role === 'grim') {
        if (male) { u.voice = male; u.lang = male.lang; }
        u.pitch = 0.5; u.rate = 1.1;
      } else {
        if (male) { u.voice = male; u.lang = male.lang; }
        u.pitch = 0.72; u.rate = 0.86;
      }
      u.volume = 0.95;
      ss.speak(u);
    } catch (e) { /* speech not available here */ }
  }
}
