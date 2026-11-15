// Physics in real-world units: millimetres and seconds.
// A real table is about 514 x 1067 mm, the ball is 27 mm wide,
// and the playfield slope gives roughly 950 mm/s^2 of pull on a rolling ball.

export const BALL_R = 13.5;
export const GRAV = 950;

const MAX_V = 5500;
const MU = 0.1;

const FLIP_UP_SPEED = 34;    // rad/s, full stroke in about 30 ms
const FLIP_DOWN_SPEED = 18;
const FLIP_UP_ACC = 6000;
const FLIP_DOWN_ACC = 2500;

let nextId = 1;

export function makeSeg(x1, y1, x2, y2, o = {}) {
  const s = { x1, y1, x2, y2, e: 0.3, w: 2.5, active: true, last: -1, ...o };
  s.dx = x2 - x1;
  s.dy = y2 - y1;
  s.l2 = s.dx * s.dx + s.dy * s.dy || 1e-9;
  return s;
}

export function makeBall(x, y) {
  return {
    id: nextId++, x, y, px: x, py: y, vx: 0, vy: 0, r: BALL_R,
    held: 0, lock: false, ghost: false, life: 0, inLane: false, auto: 0,
    tp: 0, still: 0, sens: {},
  };
}

export class Flipper {
  constructor(px, py, side) {
    this.type = 'flipper';
    this.last = -1;
    this.px = px; this.py = py; this.side = side;
    this.len = 76; this.r0 = 9; this.r1 = 5;
    const A = 0.5;
    this.rest = side < 0 ? A : Math.PI - A;
    this.up = side < 0 ? -A : Math.PI + A;
    this.dir = Math.sign(this.up - this.rest);
    this.angle = this.rest;
    this.omega = 0;
    this.pressed = false;
  }

  step(dt) {
    const goal = this.pressed ? this.up : this.rest;
    if (this.angle === goal) { this.omega = 0; return; }
    const target = this.pressed ? this.dir * FLIP_UP_SPEED : -this.dir * FLIP_DOWN_SPEED;
    const acc = (this.pressed ? FLIP_UP_ACC : FLIP_DOWN_ACC) * dt;
    const d = target - this.omega;
    this.omega += Math.max(-acc, Math.min(acc, d));
    this.angle += this.omega * dt;
    const lo = Math.min(this.rest, this.up), hi = Math.max(this.rest, this.up);
    if (this.angle <= lo) { this.angle = lo; this.omega = 0; }
    if (this.angle >= hi) { this.angle = hi; this.omega = 0; }
  }
}

// Push the ball out of a surface and bounce it. Returns the impact speed.
function resolve(b, nx, ny, pen, e, svx, svy) {
  b.x += nx * pen;
  b.y += ny * pen;
  const rvx = b.vx - svx, rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return 0;
  const imp = -vn;
  const ee = imp < 45 ? 0 : e;
  const tx = -ny, ty = nx;
  let vt = rvx * tx + rvy * ty;
  const loss = Math.min(MU * (1 + ee) * imp, Math.abs(vt) * 0.2857);
  vt -= Math.sign(vt) * loss;
  const nvn = imp * ee;
  b.vx = svx + nx * nvn + tx * vt;
  b.vy = svy + ny * nvn + ty * vt;
  return imp;
}

export class World {
  constructor(table) {
    this.segs = table.segs;
    this.circles = table.circles;
    this.flippers = table.flippers;
    this.extraSegs = [];
    this.balls = [];
    this.gx = 0;
    this.gy = GRAV;
    this.onHit = null;
    this.onSub = null;
  }

  collideSeg(b, s) {
    if (!s.active) return;
    let t = ((b.x - s.x1) * s.dx + (b.y - s.y1) * s.dy) / s.l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = s.x1 + s.dx * t, cy = s.y1 + s.dy * t;
    let nx = b.x - cx, ny = b.y - cy;
    const min = b.r + s.w;
    const d2 = nx * nx + ny * ny;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d; ny /= d;
    if (s.ow) {
      if (nx * s.onx + ny * s.ony <= 0) return;
      if (b.vx * s.onx + b.vy * s.ony >= 0) return;
    }
    const imp = resolve(b, nx, ny, min - d, s.e, 0, 0);
    if (imp > 0 && this.onHit) this.onHit(s, b, imp, nx, ny, t);
  }

  collideCircle(b, c) {
    if (!c.active) return;
    let nx = b.x - c.x, ny = b.y - c.y;
    const min = b.r + c.r;
    const d2 = nx * nx + ny * ny;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d; ny /= d;
    const imp = resolve(b, nx, ny, min - d, c.e, 0, 0);
    if (imp > 0 && this.onHit) this.onHit(c, b, imp, nx, ny, 0.5);
  }

  collideFlipper(b, f) {
    const c = Math.cos(f.angle), s = Math.sin(f.angle);
    let t = ((b.x - f.px) * c + (b.y - f.py) * s) / f.len;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const cx = f.px + c * f.len * t, cy = f.py + s * f.len * t;
    const rad = f.r0 + (f.r1 - f.r0) * t;
    let nx = b.x - cx, ny = b.y - cy;
    const min = b.r + rad;
    const d2 = nx * nx + ny * ny;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-6;
    nx /= d; ny /= d;
    const svx = -f.omega * (cy - f.py), svy = f.omega * (cx - f.px);
    const imp = resolve(b, nx, ny, min - d, 0.42, svx, svy);
    if (imp > 0 && this.onHit) this.onHit(f, b, imp, nx, ny, t);
  }

  step(dt) {
    for (const f of this.flippers) f.step(dt);
    const balls = this.balls;
    const drag = 1 - 0.06 * dt;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.held > 0) continue;
      b.px = b.x; b.py = b.y;
      b.vx = (b.vx + this.gx * dt) * drag;
      b.vy = (b.vy + this.gy * dt) * drag;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > MAX_V * MAX_V) {
        const k = MAX_V / Math.sqrt(sp2);
        b.vx *= k; b.vy *= k;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      for (let j = 0; j < this.segs.length; j++) this.collideSeg(b, this.segs[j]);
      for (let j = 0; j < this.extraSegs.length; j++) this.collideSeg(b, this.extraSegs[j]);
      for (let j = 0; j < this.circles.length; j++) this.collideCircle(b, this.circles[j]);
      for (let j = 0; j < this.flippers.length; j++) this.collideFlipper(b, this.flippers[j]);
    }
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.held > 0) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if (c.held > 0) continue;
        let nx = a.x - c.x, ny = a.y - c.y;
        const min = a.r + c.r;
        const d2 = nx * nx + ny * ny;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-6;
        nx /= d; ny /= d;
        const half = (min - d) / 2;
        a.x += nx * half; a.y += ny * half;
        c.x -= nx * half; c.y -= ny * half;
        const vn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (vn < 0) {
          const j2 = -0.95 * vn;
          a.vx += nx * j2; a.vy += ny * j2;
          c.vx -= nx * j2; c.vy -= ny * j2;
        }
      }
    }
    if (this.onSub) for (let i = 0; i < balls.length; i++) if (balls[i].held <= 0) this.onSub(balls[i], dt);
  }
}
