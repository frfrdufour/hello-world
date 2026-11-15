// Rules, scoring and the two modes (Classic and Haunted).
import { makeBall, makeSeg, GRAV } from './physics.js';
import { W, H, SCOOP, PORTALS, rampPos } from './table.js';

const SUB = 1 / 1000;
const SAVE_KEY = 'gravewick-hi';

export const ROOMS = [
  { name: 'THE FOYER', desc: 'EVERY SWITCH +5K', say: 'The foyer. Do wipe your feet. And your fingerprints.' },
  { name: 'THE LIBRARY', desc: 'TARGETS SCORE 50K', say: 'The library. Do keep your screams down.' },
  { name: 'SEANCE PARLOR', desc: 'BUMPERS SCORE 25K', say: 'The seance parlor. Somebody here wishes to speak with you.' },
  { name: 'THE KITCHEN', desc: 'SPINNER AND ORBITS', say: 'The kitchen. Tonight we are serving... you.' },
  { name: 'THE ATTIC', desc: 'GARGOYLE SCORES 100K', say: 'The attic. Grimble does not like visitors.' },
  { name: 'THE CELLAR', desc: 'HURRY UP! SHOOT CRYPT', say: 'The cellar. Hurry, before the treasure sinks.' },
];

const HAUNTS = {
  dark: ['LIGHTS OUT', 'Who turned out the lights?'],
  moon: ['MOON GRAVITY', 'The floor is letting go.'],
  tilt: ['THE HOUSE TILTS', 'The house is leaning in for a closer look.'],
  portal: ['PORTALS OPEN', 'Doors that go nowhere. And everywhere.'],
  polter: ['POLTERGEIST', 'The furniture is restless tonight.'],
  mirror: ['MIRROR WORLD', 'Through the looking glass, darling.'],
};

const GRIM_QUIPS = ['Ow!', 'Watch the wings!', 'I felt that in my gravel.', 'Rude!', 'Not the nose!',
  'I am a load bearing gargoyle!', 'Stop that!', 'Stone cold, pal.'];
const DRAIN_QUIPS = ['The house always wins.', 'Mind the gap, darling.', 'Another one for the cellar.',
  'Gone. But not forgotten. Well, mostly forgotten.'];

export const fmt = n => Math.floor(n).toLocaleString('en-US');
const pick = a => a[Math.floor(Math.random() * a.length)];

export class Game {
  constructor(world, table, audio) {
    this.world = world;
    this.table = table;
    this.audio = audio;
    world.onHit = (o, b, imp, nx, ny, t) => this.hit(o, b, imp, nx, ny, t);
    world.onSub = (b, dt) => this.sense(b, dt);
    this.t = 0;
    this.acc = 0;
    this.mode = 'attract';
    this.haunted = false;
    this.msgs = [];
    this.particles = [];
    this.flash = {};
    this.hi = { classic: 0, haunted: 0 };
    try { Object.assign(this.hi, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* no storage */ }
    this.haunt = null;
    this.hauntT = 6;
    this.lastHaunt = '';
    this.tiltA = 0;
    this.lightning = 0;
    this.ink = 400;
    this.history = [];
    this.rewinding = false;
    this.rewindCharge = 1;
    this.resetGame();
  }

  resetGame() {
    Object.assign(this, {
      score: 0, ball: 1, extraBalls: 0, bonus: 0, bonusX: 1, bonusTotal: 0,
      boo: [0, 0, 0], rip: [0, 0, 0], bat: [0, 0, 0],
      cryptLit: true, lockLit: false, locks: 0,
      rooms: [0, 0, 0, 0, 0, 0], roomIdx: 0, room: -1, roomT: 0, hurry: 0,
      multiball: false, wizard: false, jackpotV: 250000,
      grimHits: 0, ebLit: false, ebGiven: false,
      saveT: 0, ballLive: false, skill: -1, skillT: 0,
      tiltM: 0, tilted: false, spinV: 0, spinA: 0,
      serveQ: 0, serveT: 0, charge: 0, charging: false,
      scoopCool: 0, orbitCool: 0, lastSplit: 0, lastKnock: 0, lastSaveMsg: -9,
      rampCount: 0, combo: 0, comboT: 0, lastRamp: 0, kickback: true,
      shake: 0, bonusT: 0, overT: 0, newHi: false, usedHaunted: false,
    });
    this.world.balls.length = 0;
    this.endHaunt();
    this.clearCreative();
    for (const f of this.world.flippers) f.pressed = false;
  }

  // ---------- helpers ----------

  msg(lines, dur = 2.2) {
    if (this.msgs.length > 2) this.msgs.splice(1, this.msgs.length - 2);
    this.msgs.push({ lines, t: dur, dur });
  }

  fl(key, t = 0.2) { this.flash[key] = t; }

  mult() { return (this.wizard ? 3 : 1) * (this.haunt ? 2 : 1); }

  add(n) {
    if (this.mode !== 'play' || this.tilted) return;
    this.score += n * this.mult();
  }

  sw() {
    this.bonus++;
    if (this.room === 0) this.add(5000);
  }

  spark(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 260;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0.4 + Math.random() * 0.3, color });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  realCount() { return this.world.balls.filter(b => !b.ghost).length; }

  // ---------- game flow ----------

  start() {
    this.resetGame();
    this.mode = 'play';
    this.usedHaunted = this.haunted;
    this.audio.sfx('start');
    this.audio.say('Welcome to Gravewick Manor. We so rarely get... living guests.', 'host', 2);
    this.newBall();
  }

  newBall() {
    Object.assign(this, {
      tilted: false, tiltM: 0, bonus: 0, bonusX: 1, boo: [0, 0, 0],
      ballLive: false, saveT: 0, rewindCharge: 1, ink: 400, kickback: true, combo: 0,
    });
    if (this.room < 0) this.cryptLit = true;
    this.msg(['BALL ' + this.ball, 'HOLD SPACE TO PLUNGE'], 2.5);
    this.serve(false);
  }

  serve(auto) {
    const b = makeBall(481, 1022);
    b.inLane = true;
    b.auto = auto ? 0.7 : 0;
    this.world.balls.push(b);
    this.history = [];
    if (!auto) {
      this.skill = Math.floor(Math.random() * 3);
      this.skillT = 0;
    }
  }

  plunger(down) {
    if (this.mode !== 'play') return;
    if (down) { this.charging = true; return; }
    if (!this.charging) return;
    this.launch(1500 + 2900 * this.charge, this.charge);
    this.charging = false;
    this.charge = 0;
  }

  launch(speed, p) {
    let any = false;
    for (const b of this.world.balls) {
      if (b.inLane && b.y > 985 && Math.abs(b.vy) < 80) {
        b.vy = -speed * (0.99 + Math.random() * 0.02);
        any = true;
      }
    }
    if (any) this.audio.sfx('launch', p);
  }

  flip(side, down) {
    const f = this.world.flippers[side];
    const ok = (this.mode === 'play' && !this.tilted) || this.mode === 'attract';
    if (!ok) { f.pressed = false; return; }
    if (down === f.pressed) return;
    f.pressed = down;
    this.audio.sfx(down ? 'flipUp' : 'flipDown');
    if (down && this.mode === 'play') {
      if (side === 0) this.boo.push(this.boo.shift()); else this.boo.unshift(this.boo.pop());
    }
  }

  nudge() {
    if (this.mode !== 'play' || this.tilted) return;
    for (const b of this.world.balls) {
      if (b.held > 0 || b.inLane) continue;
      b.vy -= 140;
      b.vx += (Math.random() - 0.5) * 140;
    }
    this.shake = 7;
    this.audio.sfx('nudge');
    this.tiltM += 1;
    if (this.tiltM > 3.2) {
      this.tilted = true;
      this.saveT = 0;
      for (const f of this.world.flippers) f.pressed = false;
      this.msg(['TILT'], 3);
      this.audio.sfx('tilt');
      this.audio.say('Do not shake the furniture.', 'host', 2);
    } else if (this.tiltM > 2.1) {
      this.msg(['DANGER', 'EASY ON THE HOUSE'], 1.5);
    }
  }

  // ---------- collisions ----------

  hit(o, b, imp, nx, ny, t) {
    const A = this.audio;
    if (!o.type) {
      if (imp > 260 && this.t - this.lastKnock > 0.04) {
        this.lastKnock = this.t;
        A.sfx('knock', Math.min(1, imp / 2500));
      }
      return;
    }
    if (this.t - o.last < 0.07) return;
    switch (o.type) {
      case 'flipper':
        if (imp > 400) { o.last = this.t; A.sfx('rubber', Math.min(1, imp / 2500)); }
        break;
      case 'sling':
        if (imp > 90 && t > 0.1 && t < 0.9) {
          o.last = this.t;
          b.vx += nx * 950; b.vy += ny * 950;
          this.fl('sling' + o.side, 0.15);
          A.sfx('sling');
          this.add(110);
          this.sw();
          this.spark(b.x, b.y, 5);
        }
        break;
      case 'bumper':
        if (imp > 15) {
          o.last = this.t;
          b.vx += nx * 800; b.vy += ny * 800;
          this.fl('bumper' + o.idx, 0.22);
          A.sfx('bumper', o.idx);
          this.add(this.room === 2 ? 25000 : 1000);
          this.sw();
          this.spark(b.x, b.y, 8);
        }
        break;
      case 'target':
        if (imp > 60) { o.last = this.t; this.target(o, b); }
        break;
      case 'grimble':
        if (imp > 60) { o.last = this.t; this.grimble(b, nx, ny); }
        break;
      case 'ink':
        o.last = this.t;
        A.sfx('ink');
        this.add(250);
        break;
    }
  }

  target(o, b) {
    const arr = this[o.bank];
    this.audio.sfx('target');
    this.fl('t_' + o.bank + o.idx, 0.3);
    this.add(this.room === 1 ? 50000 : 2500);
    this.sw();
    this.spark(b.x, b.y, 4);
    arr[o.idx] = 1;
    if (!arr.every(Boolean)) return;
    arr.fill(0);
    this.fl('bank_' + o.bank, 1);
    if (o.bank === 'rip') {
      if (this.cryptLit) this.add(25000);
      this.cryptLit = true;
      this.msg(['R . I . P', 'THE CRYPT IS OPEN']);
      this.audio.say('The crypt is open.', 'host');
    } else {
      if (this.multiball || this.lockLit) this.add(50000);
      else {
        this.lockLit = true;
        this.msg(['B . A . T', 'LOCK IS LIT']);
        this.audio.say('Lock is lit. Feed the crypt.', 'vesper');
      }
    }
  }

  grimble(b, nx, ny) {
    this.grimHits++;
    b.vx += nx * 300; b.vy += ny * 300;
    this.add(this.room === 4 ? 100000 : 5000);
    this.sw();
    this.audio.sfx('growl');
    this.fl('grimble', 0.45);
    this.shake = Math.max(this.shake, 3);
    this.spark(b.x, b.y, 10);
    if (this.grimHits % 3 === 1) this.audio.say(pick(GRIM_QUIPS), 'grim');
    if (this.grimHits % 5 === 0) {
      this.add(50000);
      this.msg(['GARGOYLE RAGE', '50,000']);
      this.audio.sfx('thunder');
      this.lightning = 0.35;
    }
    if (this.grimHits >= 12 && !this.ebGiven && !this.ebLit) {
      this.ebLit = true;
      this.msg(['EXTRA BALL IS LIT', 'SHOOT THE CRYPT']);
    }
    if (this.haunted) this.splitBall(b);
  }

  // ---------- sensors (run every physics step) ----------

  sense(b, dt) {
    if (this.mode !== 'play') return;
    if (b.tp > 0) b.tp -= dt;
    if (b.inLane) {
      if (b.x < 460) {
        b.inLane = false;
        if (!this.ballLive) {
          this.ballLive = true;
          this.saveT = 12;
          this.skillT = 6;
        }
      }
    } else if (b.x > 466 && b.y > 900) b.inLane = true;

    if (b.vy < -500) {
      for (const r of this.table.ramps) {
        const g = r.gate;
        if (b.py >= g.y && b.y < g.y && b.x > g.x1 && b.x < g.x2) {
          const p = rampPos(r, 0);
          b.rampId = r.id; b.rs = 0; b.rc = 0;
          b.rv = Math.min(1900, Math.hypot(b.vx, b.vy));
          b.x = p.x; b.y = p.y;
          this.audio.sfx('rampUp');
          return;
        }
      }
    }

    for (const s of this.table.sensors) {
      const dx = b.x - s.x, dy = b.y - s.y;
      const inside = dx * dx + dy * dy < s.r * s.r;
      if (inside && !b.sens[s.id]) this.sensor(s, b);
      b.sens[s.id] = inside;
    }

    if (b.x < 62 && (b.py - 612) * (b.y - 612) < 0) this.spinV = b.vy / 55;
    if (b.vy < 0 && b.py >= 450 && b.y < 450 && this.t - this.orbitCool > 1) {
      if (b.x < 62) this.orbit(0);
      else if (b.x > 420 && b.x < 462) this.orbit(1);
    }

    if (this.haunt && this.haunt.type === 'portal' && b.tp <= 0) {
      for (let i = 0; i < 2; i++) {
        const p = PORTALS[i], dx = b.x - p.x, dy = b.y - p.y;
        if (dx * dx + dy * dy < 17 * 17) {
          const q = PORTALS[1 - i];
          this.spark(b.x, b.y, 10, '#b06cff');
          b.x = q.x; b.y = q.y; b.tp = 0.7;
          this.spark(b.x, b.y, 10, '#b06cff');
          this.audio.sfx('portal');
          this.add(2500);
          break;
        }
      }
    }
  }

  sensor(s, b) {
    const A = this.audio;
    switch (s.kind) {
      case 'lane': {
        this.sw();
        A.sfx('roll');
        if (this.skill >= 0) {
          if (s.idx === this.skill && this.skillT > 0) {
            this.add(100000);
            this.msg(['SKILL SHOT', '100,000']);
            A.sfx('jackpot');
          }
          this.skill = -1;
        }
        this.add(this.boo[s.idx] ? 500 : 3000);
        this.boo[s.idx] = 1;
        if (this.boo.every(Boolean)) {
          this.boo = [0, 0, 0];
          this.bonusX = Math.min(5, this.bonusX + 1);
          this.add(10000);
          this.fl('boo', 1);
          this.msg(['B O O !', 'BONUS X' + this.bonusX]);
          A.say('Boo!', 'vesper');
          if (this.haunted) this.rewindCharge = Math.min(2, this.rewindCharge + 1);
        }
        break;
      }
      case 'inlane':
        this.add(1000); this.sw(); A.sfx('roll');
        break;
      case 'outlane':
        this.add(5000); this.sw();
        if (s.id === 'ol' && this.kickback && !this.tilted) {
          this.kickback = false;
          b.x = 39; b.vx = 0; b.vy = -2700;
          this.fl('kick', 0.5);
          A.sfx('eject');
          this.msg(['KICKBACK', 'THE BUTLER SAVES YOU'], 1.6);
          A.say('Allow me.', 'host');
        } else A.sfx('outlane');
        break;
      case 'scoop':
        if (!b.ghost && this.t > this.scoopCool) this.scoop(b);
        break;
    }
  }

  orbit(side) {
    this.orbitCool = this.t;
    this.sw();
    this.fl('orbit' + side, 0.6);
    if (this.multiball) this.jackpot();
    else {
      this.add(this.room === 3 ? 100000 : 10000);
      this.audio.sfx('orbit');
    }
  }

  // Move a ball along its ramp. Slow shots roll back down, like the real thing.
  rampStep(b, dt) {
    const r = this.table.ramps[b.rampId - 1];
    for (let k = 0; k < 4; k++) {
      const h = dt / 4;
      const p = rampPos(r, b.rs);
      const climb = b.rs < r.crest ? 1.7 : 1;
      b.rv += (this.world.gx * p.tx + this.world.gy * p.ty) * climb * h;
      b.rv *= 1 - 0.3 * h;
      if (b.rs >= r.crest && b.rv > 950) b.rv = 950;
      b.rs += b.rv * h;
      if (!b.rc && b.rs >= r.crest) { b.rc = 1; this.rampMade(r); }
    }
    if (b.rs >= r.total) {
      const p = rampPos(r, r.total);
      b.rampId = 0; b.x = p.x; b.y = p.y; b.vx = p.tx * 220; b.vy = p.ty * 220;
      this.audio.sfx('rampDrop');
      this.history = [];
      return;
    }
    if (b.rs <= 0) {
      const p = rampPos(r, 0);
      b.rampId = 0; b.x = p.x; b.y = p.y + 2; b.vx = p.tx * b.rv; b.vy = p.ty * b.rv;
      return;
    }
    const p = rampPos(r, b.rs);
    b.x = p.x; b.y = p.y; b.vx = p.tx * b.rv; b.vy = p.ty * b.rv;
  }

  rampMade(r) {
    this.rampCount++;
    this.sw();
    this.fl('ramp' + r.id, 1);
    this.combo = this.comboT > 0 && this.lastRamp !== r.id ? this.combo + 1 : 1;
    this.lastRamp = r.id;
    this.comboT = 7;
    if (this.multiball) { this.jackpot(); return; }
    const val = 20000 * this.combo;
    this.add(val);
    this.audio.sfx('ramp');
    if (this.combo > 1) {
      this.msg([this.combo + 'X COMBO', fmt(val * this.mult())], 1.5);
      if (this.combo === 3) this.audio.say('Showing off, are we?', 'vesper');
    } else this.msg([r.name, fmt(val * this.mult())], 1.2);
    if (this.rampCount % 3 === 0 && !this.kickback) {
      this.kickback = true;
      this.msg(['KICKBACK IS LIT']);
    }
    if (this.rampCount % 5 === 0) {
      this.add(100000);
      this.msg(['BAT SWARM', '100,000']);
      this.audio.sfx('laugh');
      this.lightning = 0.4;
    }
  }

  jackpot() {
    this.add(this.jackpotV);
    this.msg(['JACKPOT', fmt(this.jackpotV * this.mult())], 1.6);
    this.audio.sfx('jackpot');
    this.audio.say('Jackpot! Frightfully good.', 'vesper');
    this.lightning = 0.25;
  }

  scoop(b) {
    b.held = 1.6; b.lock = false;
    b.x = SCOOP.x; b.y = SCOOP.y; b.vx = b.vy = 0;
    this.audio.sfx('scoop');
    this.fl('scoop', 1.6);
    this.sw();
    this.add(5000);
    if (this.room === 5 && this.hurry > 0) {
      this.add(this.hurry);
      this.msg(['CELLAR TREASURE', fmt(this.hurry * this.mult())]);
      this.audio.sfx('jackpot');
      this.endRoom();
    }
    if (this.multiball) this.jackpot();
    if (this.ebLit) {
      this.ebLit = false; this.ebGiven = true; this.extraBalls++;
      this.msg(['EXTRA BALL']);
      this.audio.say('An extra life. How unfair to the dead.', 'host', 2);
    }
    if (this.lockLit && !this.multiball) {
      this.lockLit = false;
      this.locks++;
      if (this.locks >= 3) this.startMultiball(false);
      else {
        b.lock = true; b.held = 1.0;
        this.msg(['BALL ' + this.locks + ' LOCKED', (3 - this.locks) + ' MORE FOR MULTIBALL']);
        this.audio.say('Locked away. Safe and sound.', 'vesper');
      }
    } else if (this.cryptLit && !this.multiball && this.room < 0) {
      this.cryptLit = false;
      if (this.roomIdx >= ROOMS.length) this.startMultiball(true);
      else this.startRoom(this.roomIdx++);
    }
  }

  startRoom(i) {
    this.room = i;
    this.rooms[i] = 1;
    this.roomT = 30;
    if (i === 5) this.hurry = 1000000;
    this.msg([ROOMS[i].name, ROOMS[i].desc], 3);
    this.audio.sfx('room');
    this.audio.say(ROOMS[i].say, 'host', 2);
  }

  endRoom() {
    this.room = -1;
    this.hurry = 0;
    if (this.multiball) return;
    this.cryptLit = true;
    if (this.roomIdx >= ROOMS.length) this.msg(['MIDNIGHT MADNESS', 'SHOOT THE CRYPT'], 3);
  }

  startMultiball(wiz) {
    this.multiball = true;
    this.wizard = wiz;
    this.locks = 0;
    this.jackpotV = wiz ? 500000 : 250000;
    this.saveT = 15;
    this.serveQ += 2;
    this.serveT = 0.8;
    this.history = [];
    this.audio.intense = true;
    this.audio.sfx('thunder');
    this.lightning = 0.5;
    if (wiz) {
      this.msg(['MIDNIGHT MADNESS', 'ALL SCORES X3'], 3.5);
      this.audio.say('Midnight! The whole house is awake!', 'host', 2);
    } else {
      this.msg(['GHOST MULTIBALL', 'JACKPOTS ARE LIT'], 3.5);
      this.audio.say('The spirits are loose!', 'vesper', 2);
      this.audio.sfx('laugh');
    }
  }

  // ---------- per-frame update ----------

  update(dt) {
    this.t += dt;
    for (const k in this.flash) {
      this.flash[k] -= dt;
      if (this.flash[k] <= 0) delete this.flash[k];
    }
    this.shake *= Math.exp(-dt * 9);
    if (this.lightning > 0) this.lightning -= dt;
    if (this.msgs.length) {
      this.msgs[0].t -= dt;
      if (this.msgs[0].t <= 0) this.msgs.shift();
    }
    for (const p of this.particles) {
      p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
    }
    this.particles = this.particles.filter(p => p.t > 0);

    this.spinV *= Math.exp(-dt * 1.4);
    if (Math.abs(this.spinV) < 1.2) this.spinV = 0;
    const before = Math.floor(this.spinA / Math.PI);
    this.spinA += this.spinV * dt;
    if (Math.floor(this.spinA / Math.PI) !== before && this.mode === 'play') {
      this.add(this.room === 3 ? 10000 : 100);
      this.audio.sfx('spin');
    }

    if (this.rewinding) { this.doRewind(); return; }

    this.applyHaunt(dt);
    this.acc += dt;
    let n = 0;
    while (this.acc >= SUB && n < 80) { this.world.step(SUB); this.acc -= SUB; n++; }
    if (n >= 80) this.acc = 0;

    if (this.mode === 'play') this.playUpdate(dt);
    else if (this.mode === 'bonus') {
      this.bonusT -= dt;
      if (this.bonusT <= 0) this.afterBonus();
    } else if (this.mode === 'over') {
      this.overT -= dt;
      if (this.overT <= 0) this.mode = 'attract';
    }
  }

  playUpdate(dt) {
    const balls = this.world.balls;
    if (this.charging) this.charge = Math.min(1, this.charge + dt / 1.1);
    if (this.ballLive && this.saveT > 0) this.saveT -= dt;
    if (this.skillT > 0) this.skillT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.tiltM = Math.max(0, this.tiltM - dt * 0.5);

    if (this.room >= 0) {
      this.roomT -= dt;
      if (this.room === 5) this.hurry = Math.max(100000, Math.round((1e6 - (30 - this.roomT) * 30000) / 1000) * 1000);
      if (this.roomT <= 0) {
        this.msg(['ROOM COMPLETE', this.rooms.filter(Boolean).length + ' OF 6 EXPLORED']);
        this.endRoom();
      }
    }

    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.held > 0) {
        b.held -= dt;
        if (b.held <= 0) {
          b.held = 0;
          if (b.lock) {
            balls.splice(i, 1);
            this.serve(false);
          } else {
            b.x = SCOOP.x; b.y = SCOOP.y + 20;
            b.vx = -0.353 * 620; b.vy = 0.936 * 620;
            this.scoopCool = this.t + 0.7;
            this.audio.sfx('eject');
            this.history = [];
          }
        }
        continue;
      }
      if (b.rampId) { this.rampStep(b, dt); continue; }
      if (b.inLane && b.auto > 0) {
        b.auto -= dt;
        if (b.auto <= 0 && b.y > 985) {
          b.vy = -(3800 + Math.random() * 200);
          this.audio.sfx('launch', 1);
        }
      }
      if (b.ghost) {
        b.life -= dt;
        if (b.life <= 0) {
          this.spark(b.x, b.y, 12, '#7dffb0');
          balls.splice(i, 1);
          continue;
        }
      }
      const sp = Math.abs(b.vx) + Math.abs(b.vy);
      if (sp < 10 && !b.inLane) {
        b.still += dt;
        if (b.still > 2) { b.vy -= 320; b.vx += (Math.random() - 0.5) * 300; b.still = 0; }
      } else b.still = 0;
      if (b.y > H + 30 || b.y < -80 || b.x < -80 || b.x > W + 80) {
        balls.splice(i, 1);
        this.drained(b);
        if (this.mode !== 'play' || this.rewinding) return;
      }
    }

    if (this.serveQ > 0) {
      this.serveT -= dt;
      const busy = balls.some(b => b.inLane);
      if (this.serveT <= 0 && !busy) {
        this.serve(true);
        this.serveQ--;
        this.serveT = 1.1;
      }
    }

    if (this.multiball && this.realCount() + this.serveQ <= 1) {
      this.multiball = false;
      this.audio.intense = false;
      if (this.wizard) {
        this.wizard = false;
        this.rooms.fill(0);
        this.roomIdx = 0;
        this.cryptLit = true;
        this.msg(['THE MANOR SLEEPS', 'ROOMS RESET']);
      } else this.msg(['MULTIBALL OVER']);
    }

    // Haunted mode extras.
    const segs = this.world.extraSegs;
    for (let i = segs.length - 1; i >= 0; i--) {
      segs[i].life -= dt;
      if (segs[i].life <= 0) segs.splice(i, 1);
    }
    if (this.haunted) {
      this.ink = Math.min(400, this.ink + 45 * dt);
      if (!this.haunt && balls.some(b => !b.inLane && !b.ghost)) {
        this.hauntT -= dt;
        if (this.hauntT <= 0) this.startHaunt();
      }
      this.history.push(balls.map(b => ({ ...b, sens: { ...b.sens } })));
      if (this.history.length > 240) this.history.shift();
    }
  }

  drained(b) {
    if (b.ghost) return;
    const real = this.realCount() + this.serveQ;
    if (this.tilted) {
      if (real === 0) this.endBall();
      return;
    }
    if (this.saveT > 0) {
      this.serveQ++;
      this.serveT = Math.min(this.serveT, 0.4);
      if (this.t - this.lastSaveMsg > 3) {
        this.lastSaveMsg = this.t;
        this.msg(['BALL SAVED']);
        this.audio.say('Not yet, dear. The house is not finished with you.', 'vesper');
      }
      return;
    }
    if (real === 0 && this.haunted && this.rewindCharge > 0 && this.history.length > 50) {
      this.startRewind();
      return;
    }
    this.audio.sfx('drain');
    if (real === 0) this.endBall();
  }

  endBall() {
    const balls = this.world.balls;
    balls.length = 0;
    this.endHaunt();
    this.world.extraSegs.length = 0;
    this.history = [];
    this.multiball = false; this.wizard = false;
    this.audio.intense = false;
    this.room = -1; this.hurry = 0;
    this.serveQ = 0;
    this.charging = false; this.charge = 0;
    for (const f of this.world.flippers) f.pressed = false;
    this.bonusTotal = this.tilted ? 0
      : (this.bonus * 1000 + this.rooms.filter(Boolean).length * 25000) * this.bonusX;
    this.mode = 'bonus';
    this.bonusT = 3.2;
    if (!this.tilted) {
      if (Math.random() < 0.4) this.audio.sfx('laugh');
      else this.audio.say(pick(DRAIN_QUIPS), 'host');
    }
  }

  afterBonus() {
    this.score += this.bonusTotal;
    if (this.extraBalls > 0) {
      this.extraBalls--;
      this.msg(['SHOOT AGAIN']);
    } else this.ball++;
    if (this.ball > 3) { this.gameOver(); return; }
    this.mode = 'play';
    this.newBall();
  }

  gameOver() {
    this.mode = 'over';
    this.overT = 7;
    const key = this.usedHaunted ? 'haunted' : 'classic';
    this.newHi = this.score > (this.hi[key] || 0);
    if (this.newHi) {
      this.hi[key] = this.score;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.hi)); } catch (e) { /* no storage */ }
      this.audio.sfx('jackpot');
      this.audio.say('A new record. The portraits are impressed.', 'host', 2);
    } else this.audio.say('Do come again. We are always home.', 'host', 2);
  }

  // ---------- Haunted mode ----------

  setHaunted(on) {
    if (on === this.haunted) return;
    this.haunted = on;
    if (on) {
      if (this.mode === 'play') this.usedHaunted = true;
      this.hauntT = 5;
      this.ink = 400;
      this.rewindCharge = Math.max(this.rewindCharge, 1);
      this.msg(['HAUNTED MODE', 'REALITY IS OPTIONAL'], 2.5);
      this.audio.sfx('thunder');
      this.lightning = 0.4;
      this.audio.say('Now things get... strange.', 'host', 2);
    } else {
      this.endHaunt();
      this.clearCreative();
      this.msg(['CLASSIC MODE', 'PURE PINBALL'], 2.5);
    }
  }

  clearCreative() {
    this.world.extraSegs.length = 0;
    const balls = this.world.balls;
    for (let i = balls.length - 1; i >= 0; i--) if (balls[i].ghost) balls.splice(i, 1);
    this.rewinding = false;
    this.history = [];
  }

  startHaunt(type) {
    const types = Object.keys(HAUNTS).filter(k => k !== this.lastHaunt);
    type = type || pick(types);
    this.lastHaunt = type;
    this.haunt = { type, t: 13, dur: 13 };
    this.msg([HAUNTS[type][0], 'ALL SCORES X2'], 2.5);
    this.audio.sfx('thunder');
    this.lightning = 0.4;
    this.audio.say(HAUNTS[type][1], 'vesper');
  }

  endHaunt() {
    this.haunt = null;
    this.hauntT = 8 + Math.random() * 6;
    this.tiltA = 0;
    for (const c of this.world.circles) { c.x = c.hx; c.y = c.hy; }
    this.world.gx = 0;
    this.world.gy = GRAV;
  }

  // Strength of the current haunting, easing in and out (0 to 1).
  hauntEnv(type) {
    const h = this.haunt;
    if (!h || h.type !== type) return 0;
    return Math.max(0, Math.min(1, (h.dur - h.t) / 1.2, h.t / 1.2));
  }

  applyHaunt(dt) {
    const h = this.haunt;
    if (!h) return;
    h.t -= dt;
    if (h.t <= 0) { this.endHaunt(); return; }
    const el = h.dur - h.t;
    const env = Math.min(1, el / 1.2, h.t / 1.2);
    let g = GRAV, a = 0;
    if (h.type === 'moon') g = GRAV * (1 - 0.68 * env);
    if (h.type === 'tilt') a = 0.3 * env * Math.sin(el * 1.25);
    if (h.type === 'polter') {
      this.world.circles.forEach((c, i) => {
        c.x = c.hx + env * 34 * Math.sin(el * 1.4 + i * 2.1);
        c.y = c.hy + env * 22 * Math.cos(el * 1.9 + i * 1.3);
      });
    }
    this.tiltA = a;
    this.world.gx = g * Math.sin(a);
    this.world.gy = g * Math.cos(a);
  }

  splitBall(b) {
    const ghosts = this.world.balls.filter(x => x.ghost).length;
    if (ghosts >= 2 || this.t - this.lastSplit < 1.5 || b.ghost) return;
    this.lastSplit = this.t;
    const nb = makeBall(b.x, b.y);
    const c = Math.cos(0.7), s = Math.sin(0.7);
    nb.vx = b.vx * c - b.vy * s;
    nb.vy = b.vx * s + b.vy * c;
    nb.x += nb.vx * 0.004; nb.y += nb.vy * 0.004;
    nb.ghost = true;
    nb.life = 14;
    this.world.balls.push(nb);
    this.audio.sfx('split');
    this.msg(['ECTO SPLIT', 'GHOST BALL']);
  }

  tryRewind() {
    if (!this.haunted || this.mode !== 'play' || this.rewinding) return;
    if (this.rewindCharge <= 0 || this.history.length < 50) return;
    this.startRewind();
  }

  startRewind() {
    this.rewindCharge--;
    this.rewinding = true;
    this.rewN = Math.min(this.history.length, 170);
    this.msg(['TIME UNWINDS'], 1.6);
    this.audio.sfx('rewind');
    this.audio.say('Let us try that again.', 'vesper');
  }

  doRewind() {
    let snap = null;
    for (let k = 0; k < 2 && this.rewN > 0 && this.history.length; k++) {
      snap = this.history.pop();
      this.rewN--;
    }
    if (snap) {
      const balls = this.world.balls;
      balls.length = 0;
      for (const b of snap) balls.push(b);
    }
    if (this.rewN <= 0 || !this.history.length) {
      this.rewinding = false;
      this.history = [];
      this.saveT = Math.max(this.saveT, 1.5);
    }
  }

  // Draw a short-lived wall with the mouse (Haunted mode only).
  inkStroke(x1, y1, x2, y2) {
    if (!this.haunted || this.mode !== 'play') return false;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3 || this.ink < len) return false;
    this.ink -= len;
    this.world.extraSegs.push(makeSeg(x1, y1, x2, y2, { type: 'ink', life: 5, e: 0.55, w: 2 }));
    return true;
  }
}
