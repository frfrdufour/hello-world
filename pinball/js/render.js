// Draws the table. Everything is drawn in table millimetres and scaled to the screen.
import { W, H, CX, SCOOP, PORTALS, WINDOWS } from './table.js';

const TAU = Math.PI * 2;

const TH = {
  classic: {
    cab: '#0e0810', bgA: '#1c1233', bgB: '#4b2247', bgC: '#170d20', moon: '#f4e7b8', art: '#0d0714',
    wall: '#b98a3e', wallHi: '#f2dca4', poly: '#5c1f30', polyEdge: '#d9a54f',
    flip: '#f4c542', flipEdge: '#7a4c00', rubber: '#d8493a',
    lit: '#ffc933', unlit: '#4a3622', glow: '255,190,60', text: '#f2dca4',
    iris: '#3aa655', eye: '#d32f2f', stone: '#8b8794', stoneDark: '#4c4956',
  },
  haunted: {
    cab: '#010406', bgA: '#020d16', bgB: '#07303a', bgC: '#01070b', moon: '#b9fff0', art: '#00060a',
    wall: '#2fe6c8', wallHi: '#d2fff7', poly: '#0a2836', polyEdge: '#8a6bff',
    flip: '#a97bff', flipEdge: '#2c1470', rubber: '#2fe6c8',
    lit: '#7dffb0', unlit: '#0f3a3a', glow: '90,255,200', text: '#b9fff0',
    iris: '#b06cff', eye: '#7dffb0', stone: '#5f8f96', stoneDark: '#1f4149',
  },
};

// Small repeatable random for the starfield.
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export class Renderer {
  constructor(canvas, table, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.table = table;
    this.game = game;
    this.stat = document.createElement('canvas');
    this.dark = document.createElement('canvas');
    this.statKey = '';
    this.matrix = new DOMMatrix();
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.max(50, Math.round(r.width * dpr));
    this.canvas.height = Math.max(50, Math.round(r.height * dpr));
    this.s = Math.min(this.canvas.height / H, this.canvas.width / W);
    this.dark.width = this.canvas.width;
    this.dark.height = this.canvas.height;
    this.statKey = '';
  }

  // Convert a mouse position (CSS pixels inside the canvas) to table millimetres.
  toTable(px, py) {
    const p = this.matrix.inverse().transformPoint(new DOMPoint(px * this.dpr, py * this.dpr));
    return [p.x, p.y];
  }

  // ---------- static layer ----------

  drawStatic(th, key) {
    this.statKey = key;
    const s = this.s, cv = this.stat;
    cv.width = Math.round(W * s);
    cv.height = Math.round(H * s);
    const c = cv.getContext('2d');
    c.setTransform(s, 0, 0, s, 0, 0);
    c.fillStyle = th.cab;
    c.fillRect(0, 0, W, H);

    c.save();
    c.beginPath();
    c.moveTo(20, H); c.lineTo(20, 260);
    c.arc(260, 260, 240, Math.PI, TAU);
    c.lineTo(500, H);
    c.closePath();
    c.clip();

    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.bgA); g.addColorStop(0.55, th.bgB); g.addColorStop(1, th.bgC);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    const rnd = rng(7);
    for (let i = 0; i < 90; i++) {
      c.globalAlpha = 0.25 + rnd() * 0.6;
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(20 + rnd() * 440, 20 + rnd() * 560, 0.5 + rnd() * 1.1, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;

    // Moon.
    const mg = c.createRadialGradient(CX, 100, 10, CX, 100, 120);
    mg.addColorStop(0, th.moon); mg.addColorStop(0.5, th.moon + '55'); mg.addColorStop(1, th.moon + '00');
    c.fillStyle = mg;
    c.fillRect(100, 0, 300, 240);
    c.fillStyle = th.moon;
    c.beginPath(); c.arc(CX, 100, 52, 0, TAU); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.08)';
    for (const [x, y, r] of [[225, 85, 10], [262, 112, 14], [238, 126, 6], [268, 78, 5]]) {
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }

    this.drawManor(c, th);

    // Ground fog.
    for (let i = 0; i < 9; i++) {
      c.fillStyle = 'rgba(190,200,230,0.045)';
      c.beginPath();
      c.ellipse(60 + rnd() * 380, 790 + rnd() * 230, 90 + rnd() * 80, 16 + rnd() * 16, 0, 0, TAU);
      c.fill();
    }

    // Shooter lane.
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(462, 130, 40, H);

    // Playfield lettering.
    c.fillStyle = th.text;
    c.globalAlpha = 0.55;
    c.textAlign = 'center';
    c.font = 'bold 11px Georgia, serif';
    c.fillText('CRYPT', SCOOP.x, 440);
    c.fillText('GRIMBLE', CX, 546);
    c.save(); c.translate(40, 420); c.rotate(-Math.PI / 2); c.fillText('O R B I T', 0, 0); c.restore();
    c.save(); c.translate(442, 420); c.rotate(-Math.PI / 2); c.fillText('O R B I T', 0, 0); c.restore();
    c.font = 'italic bold 15px Georgia, serif';
    c.fillText('Gravewick Manor', CX, 1058);
    c.globalAlpha = 1;
    c.restore();

    // Solid shapes.
    for (const p of this.table.polys) {
      c.beginPath();
      p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = th.poly;
      c.fill();
    }

    // Walls.
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const pass of [[6, th.wall], [1.6, th.wallHi]]) {
      c.lineWidth = pass[0];
      c.strokeStyle = pass[1];
      for (const pts of this.table.lines) {
        c.beginPath();
        pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
    }
  }

  drawManor(c, th) {
    c.fillStyle = th.art;
    c.beginPath();
    c.moveTo(60, 800); c.quadraticCurveTo(CX, 735, 422, 800); c.lineTo(422, 830); c.lineTo(60, 830);
    c.closePath(); c.fill();
    c.fillRect(165, 665, 152, 115);              // main hall
    c.fillRect(222, 600, 38, 70);                // tower
    c.beginPath(); c.moveTo(214, 602); c.lineTo(241, 560); c.lineTo(268, 602); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(158, 667); c.lineTo(190, 640); c.lineTo(222, 667); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(260, 667); c.lineTo(292, 640); c.lineTo(324, 667); c.closePath(); c.fill();
    c.fillRect(300, 628, 8, 30);                 // chimney
    c.fillRect(239, 548, 2, 14);                 // spire
    // Bare tree.
    c.strokeStyle = th.art; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(120, 790); c.lineTo(124, 735); c.lineTo(108, 708);
    c.moveTo(124, 735); c.lineTo(140, 712); c.lineTo(138, 696);
    c.moveTo(116, 722); c.lineTo(100, 722);
    c.stroke();
    // Tombstones.
    for (const [x, y] of [[352, 772], [372, 778], [98, 782]]) {
      c.beginPath(); c.moveTo(x - 6, y + 12); c.lineTo(x - 6, y); c.arc(x, y, 6, Math.PI, 0); c.lineTo(x + 6, y + 12);
      c.closePath(); c.fill();
    }
    // Door.
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.beginPath(); c.moveTo(232, 780); c.lineTo(232, 758); c.arc(241, 758, 9, Math.PI, 0); c.lineTo(250, 780);
    c.closePath(); c.fill();
  }

  // ---------- helpers ----------

  light(c, x, y, r, on, th, color) {
    if (on > 0) {
      const g = c.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6);
      g.addColorStop(0, `rgba(${th.glow},${0.55 * on})`);
      g.addColorStop(1, `rgba(${th.glow},0)`);
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r * 2.6, 0, TAU); c.fill();
    }
    c.fillStyle = on > 0 ? (color || th.lit) : th.unlit;
    c.globalAlpha = on > 0 ? 0.55 + 0.45 * on : 1;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }

  letter(c, ch, x, y, on, th, size = 10) {
    c.fillStyle = on ? '#1a0d00' : th.text;
    c.globalAlpha = on ? 1 : 0.5;
    c.font = `bold ${size}px Georgia, serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(ch, x, y + 0.5);
    c.globalAlpha = 1;
  }

  // ---------- frame ----------

  draw() {
    const g = this.game, c = this.ctx, cv = this.canvas;
    const th = TH[g.haunted ? 'haunted' : 'classic'];
    const key = (g.haunted ? 'h' : 'c') + cv.width + 'x' + cv.height;
    if (key !== this.statKey) this.drawStatic(th, key);

    const blink = Math.floor(g.t * 4) % 2 === 0;
    const fast = Math.floor(g.t * 8) % 2 === 0;
    const fl = k => Math.min(1, (g.flash[k] || 0) * 5);

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = th.cab;
    c.fillRect(0, 0, cv.width, cv.height);

    // Table transform, including the Haunted mode tilt and mirror.
    const a = g.tiltA || 0;
    const mirror = g.hauntEnv('mirror');
    let s = this.s;
    if (a) {
      const ca = Math.cos(a), sa = Math.abs(Math.sin(a));
      s = Math.min(s, cv.height / (H * ca + W * sa), cv.width / (W * ca + H * sa));
    }
    c.translate(cv.width / 2, cv.height / 2);
    if (g.shake > 0.3) c.translate((Math.random() - 0.5) * g.shake * this.dpr, (Math.random() - 0.5) * g.shake * this.dpr);
    c.rotate(a);
    c.scale(s * (1 - 2 * mirror || 0.02), s);
    c.translate(-W / 2, -H / 2);
    this.matrix = c.getTransform();

    c.drawImage(this.stat, 0, 0, W, H);

    // Manor windows show which rooms you have explored.
    WINDOWS.forEach(([x, y], i) => {
      const active = g.room === i;
      const on = active ? (fast ? 1 : 0.25) : g.rooms[i] ? 0.85 : (g.roomIdx === i && g.cryptLit && blink ? 0.3 : 0);
      if (on > 0) {
        const gr = c.createRadialGradient(x, y, 2, x, y, 26);
        gr.addColorStop(0, `rgba(${th.glow},${0.5 * on})`); gr.addColorStop(1, `rgba(${th.glow},0)`);
        c.fillStyle = gr; c.fillRect(x - 26, y - 26, 52, 52);
      }
      c.fillStyle = on > 0 ? th.lit : '#241a2c';
      c.globalAlpha = on > 0 ? 0.4 + 0.6 * on : 1;
      c.fillRect(x - 7, y - 10, 14, 20);
      c.globalAlpha = 1;
      c.fillStyle = th.art;
      c.fillRect(x - 0.7, y - 10, 1.4, 20); c.fillRect(x - 7, y - 0.7, 14, 1.4);
    });

    // Top lanes: B O O.
    const booFlash = fl('boo');
    ['B', 'O', 'O'].forEach((ch, i) => {
      const x = 197 + i * 44;
      const skill = g.skill === i && fast;
      this.light(c, x, 172, 10, g.boo[i] || booFlash || skill ? 1 : 0, th, skill ? '#ffffff' : null);
      this.letter(c, ch, x, 172, g.boo[i] || booFlash || skill, th);
    });

    // Bonus multiplier lights.
    for (let i = 2; i <= 5; i++) {
      const x = CX + (i - 3.5) * 30;
      this.light(c, x, 872, 8, g.bonusX >= i ? 1 : 0, th);
      this.letter(c, i + 'X', x, 872, g.bonusX >= i, th, 7);
    }

    // Target banks.
    for (const [bank, x, lx, word] of [['rip', 68, 86, 'RIP'], ['bat', 414, 396, 'BAT']]) {
      const done = fl('bank_' + bank);
      for (let i = 0; i < 3; i++) {
        const y = 470 + i * 40, on = g[bank][i] || done || fl('t_' + bank + i);
        this.light(c, lx, y + 15, 7, on ? 1 : 0, th);
        this.letter(c, word[i], lx, y + 15, on, th, 8);
        c.fillStyle = on ? th.lit : th.rubber;
        c.fillRect(x - 3, y, 6, 30);
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 0.8;
        c.strokeRect(x - 3, y, 6, 30);
      }
    }

    // Orbit arrows.
    for (let i = 0; i < 2; i++) {
      const x = i ? 440 : 42;
      const on = fl('orbit' + i) || (g.multiball && fast) || (g.room === 3 && blink);
      c.fillStyle = on ? th.lit : th.unlit;
      c.beginPath(); c.moveTo(x, 560); c.lineTo(x - 9, 580); c.lineTo(x + 9, 580); c.closePath(); c.fill();
    }

    // The Crypt.
    {
      const lit = g.cryptLit || g.lockLit || g.ebLit || g.multiball || g.hurry > 0;
      const on = fl('scoop') || (lit && blink);
      if (on) {
        const gr = c.createRadialGradient(SCOOP.x, SCOOP.y, 4, SCOOP.x, SCOOP.y, 46);
        gr.addColorStop(0, `rgba(${th.glow},0.6)`); gr.addColorStop(1, `rgba(${th.glow},0)`);
        c.fillStyle = gr; c.beginPath(); c.arc(SCOOP.x, SCOOP.y, 46, 0, TAU); c.fill();
      }
      c.fillStyle = '#000';
      c.beginPath(); c.arc(SCOOP.x, SCOOP.y, 14, 0, TAU); c.fill();
      c.strokeStyle = on ? th.lit : th.unlit; c.lineWidth = 2; c.stroke();
      this.light(c, SCOOP.x - 14, 458, 6, g.lockLit && blink ? 1 : 0, th, '#ff5a5a');
      this.light(c, SCOOP.x + 14, 458, 6, g.ebLit && blink ? 1 : 0, th, '#ffffff');
      for (let i = 0; i < 2; i++) this.light(c, SCOOP.x - 8 + i * 16, 474, 4, g.locks > i ? 1 : 0, th, '#ff5a5a');
    }

    // Shoot again light.
    this.light(c, CX, 1018, 9, (g.saveT > 0 && g.mode === 'play' && (g.saveT > 3 || fast)) || g.extraBalls > 0 ? 1 : 0, th);

    // Portals.
    const pe = g.hauntEnv('portal');
    if (pe > 0) {
      PORTALS.forEach((p, i) => {
        for (let k = 0; k < 4; k++) {
          c.strokeStyle = i ? `rgba(255,150,60,${0.8 * pe})` : `rgba(120,160,255,${0.8 * pe})`;
          c.lineWidth = 2.5;
          c.beginPath();
          const r = 6 + k * 4 + 2 * Math.sin(g.t * 6 + k);
          c.ellipse(p.x, p.y, r * pe, r * pe, 0, g.t * 3 + k, g.t * 3 + k + 4.4);
          c.stroke();
        }
      });
    }

    // Spinner and gate.
    {
      const wdt = Math.abs(Math.cos(g.spinA)) * 17 + 1.5;
      c.fillStyle = Math.cos(g.spinA) > 0 ? th.rubber : th.lit;
      c.fillRect(42 - 17, 612 - wdt / 2, 34, wdt);
      c.strokeStyle = th.wallHi; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(22, 612); c.lineTo(62, 612); c.stroke();
      c.strokeStyle = th.wallHi; c.lineWidth = 2;
      c.beginPath(); c.moveTo(462, 245); c.lineTo(462, 131); c.stroke();
    }

    // Slingshot flash.
    for (let i = 0; i < 2; i++) {
      const f = fl('sling' + i);
      c.strokeStyle = f ? '#fff' : th.rubber;
      c.lineWidth = f ? 7 : 4;
      c.lineCap = 'round';
      c.beginPath();
      if (i) { c.moveTo(384, 790); c.lineTo(332, 912); } else { c.moveTo(98, 790); c.lineTo(150, 912); }
      c.stroke();
    }

    // Bumpers (watchful eyes) and Grimble.
    const balls = g.world.balls;
    for (const o of this.table.circles) {
      if (o.type === 'bumper') this.drawBumper(c, o, th, fl('bumper' + o.idx), balls);
      else this.drawGrimble(c, o, th, fl('grimble'), g);
    }

    // Ectoplasm ink walls.
    for (const sg of g.world.extraSegs) {
      const al = Math.min(1, sg.life / 1.5);
      c.strokeStyle = `rgba(125,255,176,${0.25 * al})`; c.lineWidth = 12; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sg.x1, sg.y1); c.lineTo(sg.x2, sg.y2); c.stroke();
      c.strokeStyle = `rgba(220,255,235,${al})`; c.lineWidth = 4;
      c.stroke();
    }

    // Plunger.
    {
      const pull = g.charge * 26;
      c.fillStyle = th.wallHi;
      c.fillRect(477, 1044 + pull, 8, 40);
      c.fillStyle = th.rubber;
      c.fillRect(471, 1040 + pull, 20, 6);
    }

    // Flippers.
    for (const f of g.world.flippers) this.drawFlipper(c, f, th);

    // Balls.
    for (const b of balls) {
      if (b.held > 0) continue;
      if (b.ghost) {
        c.globalAlpha = Math.min(0.75, b.life / 2);
        const gr = c.createRadialGradient(b.x - 4, b.y - 4, 1, b.x, b.y, b.r);
        gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#3ef5a0');
        c.fillStyle = gr;
        c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
        c.globalAlpha = 1;
        continue;
      }
      if (g.haunted) {
        c.fillStyle = `rgba(${th.glow},0.16)`;
        for (let k = 1; k <= 4; k++) {
          c.beginPath(); c.arc(b.x - b.vx * 0.006 * k, b.y - b.vy * 0.006 * k, b.r * (1 - k * 0.13), 0, TAU); c.fill();
        }
      }
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.arc(b.x + 3, b.y + 4, b.r, 0, TAU); c.fill();
      const gr = c.createRadialGradient(b.x - 5, b.y - 6, 1, b.x, b.y, b.r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, '#cfd3da'); gr.addColorStop(1, '#4d5260');
      c.fillStyle = gr;
      c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
    }

    // Sparks.
    for (const p of g.particles) {
      c.globalAlpha = Math.min(1, p.t * 3);
      c.fillStyle = p.color || th.lit;
      c.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    c.globalAlpha = 1;

    // Attract and game over text on the table.
    if (g.mode === 'attract' || g.mode === 'over') {
      c.save();
      if (mirror > 0.5) { c.translate(W, 0); c.scale(-1, 1); }
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.fillRect(70, 395, 342, 74);
      c.fillStyle = th.text;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 22px Georgia, serif';
      c.fillText(g.mode === 'over' ? 'GAME OVER' : 'GRAVEWICK MANOR', CX, 420);
      c.font = '13px Georgia, serif';
      if (blink || g.mode === 'over') c.fillText(g.mode === 'over' ? 'Thank you for visiting' : 'Press Enter to play', CX, 448);
      c.restore();
    }

    this.overlays(g, th, balls);
  }

  overlays(g, th, balls) {
    const c = this.ctx, cv = this.canvas;
    const de = g.hauntEnv('dark');
    if (de > 0) {
      const d = this.dark.getContext('2d');
      d.setTransform(1, 0, 0, 1, 0, 0);
      d.globalCompositeOperation = 'source-over';
      d.clearRect(0, 0, cv.width, cv.height);
      d.fillStyle = `rgba(0,0,0,${0.96 * de})`;
      d.fillRect(0, 0, cv.width, cv.height);
      d.setTransform(this.matrix);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r) => {
        const gr = d.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = gr; d.beginPath(); d.arc(x, y, r, 0, TAU); d.fill();
      };
      for (const b of balls) hole(b.x, b.y, 105);
      for (const f of g.world.flippers) hole(f.px + Math.cos(f.angle) * 38, f.py + Math.sin(f.angle) * 38, 55);
      for (const o of this.table.circles) {
        const k = o.type === 'bumper' ? 'bumper' + o.idx : 'grimble';
        if (g.flash[k]) hole(o.x, o.y, 80);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.dark, 0, 0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    const me = g.hauntEnv('moon');
    if (me > 0) {
      c.fillStyle = `rgba(120,150,255,${0.1 * me})`;
      c.fillRect(0, 0, cv.width, cv.height);
    }
    if (g.lightning > 0) {
      c.fillStyle = `rgba(255,255,255,${Math.min(0.7, g.lightning * 1.6) * (Math.random() > 0.3 ? 1 : 0.3)})`;
      c.fillRect(0, 0, cv.width, cv.height);
    }
    if (g.rewinding) {
      c.fillStyle = 'rgba(120,60,200,0.22)';
      c.fillRect(0, 0, cv.width, cv.height);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      for (let y = (g.t * 300) % 8; y < cv.height; y += 8) c.fillRect(0, y, cv.width, 2);
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.font = `bold ${Math.round(26 * this.dpr)}px Georgia, serif`;
      c.fillText('<<  REWIND', cv.width / 2, cv.height * 0.3);
    }
  }

  drawBumper(c, o, th, f, balls) {
    const r = o.r + f * 3;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath(); c.arc(o.x + 3, o.y + 4, r, 0, TAU); c.fill();
    if (f) {
      const gr = c.createRadialGradient(o.x, o.y, r * 0.5, o.x, o.y, r * 2.4);
      gr.addColorStop(0, `rgba(${th.glow},${0.7 * f})`); gr.addColorStop(1, `rgba(${th.glow},0)`);
      c.fillStyle = gr; c.beginPath(); c.arc(o.x, o.y, r * 2.4, 0, TAU); c.fill();
    }
    c.fillStyle = f ? '#fff' : th.rubber;
    c.beginPath(); c.arc(o.x, o.y, r, 0, TAU); c.fill();
    const sg = c.createRadialGradient(o.x - 5, o.y - 6, 2, o.x, o.y, 19);
    sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, '#cfc7b4');
    c.fillStyle = sg;
    c.beginPath(); c.arc(o.x, o.y, 19, 0, TAU); c.fill();
    // The pupil follows the nearest ball.
    let dx = 0, dy = 0, best = 1e9;
    for (const b of balls) {
      const d = Math.hypot(b.x - o.x, b.y - o.y);
      if (d < best) { best = d; dx = (b.x - o.x) / (d || 1); dy = (b.y - o.y) / (d || 1); }
    }
    const k = best < 1e8 ? 7 : 0;
    c.fillStyle = th.iris;
    c.beginPath(); c.arc(o.x + dx * k, o.y + dy * k, 9.5, 0, TAU); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(o.x + dx * (k + 1.5), o.y + dy * (k + 1.5), f ? 2.5 : 4.5, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath(); c.arc(o.x + dx * k - 3, o.y + dy * k - 3, 1.6, 0, TAU); c.fill();
  }

  drawGrimble(c, o, th, f, g) {
    const x = o.x + (f ? (Math.random() - 0.5) * 5 * f : 0);
    const y = o.y + (f ? (Math.random() - 0.5) * 5 * f : 0);
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath(); c.arc(x + 3, y + 5, o.r + 2, 0, TAU); c.fill();
    // Wings and horns.
    c.fillStyle = th.stoneDark;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.moveTo(x + sx * 14, y - 4); c.lineTo(x + sx * 38, y - 20); c.lineTo(x + sx * 34, y - 4);
      c.lineTo(x + sx * 40, y + 6); c.lineTo(x + sx * 30, y + 6); c.lineTo(x + sx * 26, y + 14); c.lineTo(x + sx * 14, y + 10);
      c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + sx * 8, y - 15); c.lineTo(x + sx * 16, y - 32); c.lineTo(x + sx * 17, y - 9); c.closePath(); c.fill();
    }
    const sg = c.createRadialGradient(x - 6, y - 7, 2, x, y, o.r);
    sg.addColorStop(0, f ? '#ffffff' : th.stone); sg.addColorStop(1, th.stoneDark);
    c.fillStyle = sg;
    c.beginPath(); c.arc(x, y, o.r, 0, TAU); c.fill();
    // Eyes.
    const eg = 0.5 + 0.5 * Math.sin(g.t * 3) + f;
    for (const sx of [-1, 1]) {
      const gr = c.createRadialGradient(x + sx * 7, y - 4, 0.5, x + sx * 7, y - 4, 9);
      gr.addColorStop(0, th.eye); gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = Math.min(1, 0.5 + 0.4 * eg);
      c.fillStyle = gr; c.beginPath(); c.arc(x + sx * 7, y - 4, 9, 0, TAU); c.fill();
      c.globalAlpha = 1;
      c.fillStyle = th.eye;
      c.beginPath(); c.arc(x + sx * 7, y - 4, f ? 4 : 2.6, 0, TAU); c.fill();
      c.strokeStyle = '#1a1a1a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + sx * 12, y - 12); c.lineTo(x + sx * 3, y - 8); c.stroke();
    }
    // Mouth with fangs.
    c.strokeStyle = '#141414'; c.lineWidth = 1.8;
    c.beginPath();
    if (f) c.ellipse(x, y + 9, 6, 5, 0, 0, TAU);
    else { c.moveTo(x - 9, y + 10); c.quadraticCurveTo(x, y + 4, x + 9, y + 10); }
    c.stroke();
    c.fillStyle = '#f5f0e0';
    for (const sx of [-1, 1]) {
      c.beginPath(); c.moveTo(x + sx * 6, y + 8); c.lineTo(x + sx * 4.5, y + 13); c.lineTo(x + sx * 3, y + 7.4); c.closePath(); c.fill();
    }
  }

  drawFlipper(c, f, th) {
    const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
    const tx = f.px + ca * f.len, ty = f.py + sa * f.len;
    const nx = -sa, ny = ca;
    const path = () => {
      c.beginPath();
      c.moveTo(f.px + nx * f.r0, f.py + ny * f.r0);
      c.lineTo(tx + nx * f.r1, ty + ny * f.r1);
      c.arc(tx, ty, f.r1, f.angle + Math.PI / 2, f.angle - Math.PI / 2, true);
      c.lineTo(f.px - nx * f.r0, f.py - ny * f.r0);
      c.arc(f.px, f.py, f.r0, f.angle - Math.PI / 2, f.angle + Math.PI / 2, true);
      c.closePath();
    };
    c.save();
    c.translate(3, 4);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    path(); c.fill();
    c.restore();
    path();
    c.fillStyle = th.rubber;
    c.fill();
    c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.stroke();
    // Bat body on top of the rubber.
    c.strokeStyle = th.flip; c.lineCap = 'round'; c.lineWidth = 8;
    c.beginPath(); c.moveTo(f.px, f.py); c.lineTo(f.px + ca * (f.len - 6), f.py + sa * (f.len - 6)); c.stroke();
    c.fillStyle = th.flipEdge;
    c.beginPath(); c.arc(f.px, f.py, 4, 0, TAU); c.fill();
  }
}
