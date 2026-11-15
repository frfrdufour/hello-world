// Table layout for Gravewick Manor. All sizes in millimetres.
import { makeSeg, Flipper } from './physics.js';

export const W = 520;
export const H = 1080;
export const CX = 241; // centre line of the playfield (the shooter lane sits on the right)

export const SCOOP = { x: 385, y: 402 };
export const PORTALS = [{ x: 135, y: 420 }, { x: 335, y: 650 }];
export const WINDOWS = [
  [241, 690], [188, 690], [294, 690], [188, 735], [241, 625], [294, 735],
];

// Ramps are raised wire tracks. A ball that enters one rides the track above the playfield.
function buildRamp(id, name, gate, ctrl) {
  const pts = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    for (let k = 0; k < 12; k++) {
      const t = k / 12, t2 = t * t, t3 = t2 * t;
      const f = j => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
        + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      pts.push([f(0), f(1)]);
    }
  }
  pts.push(ctrl[n - 1]);
  const cum = [0];
  let crest = 0, minY = 1e9;
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    if (pts[i][1] < minY) { minY = pts[i][1]; crest = cum[i]; }
  }
  return { id, name, gate, pts, cum, total: cum[cum.length - 1], crest };
}

// Position and direction at distance s along a ramp.
export function rampPos(r, s) {
  const cum = r.cum;
  let lo = 0, hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid; else hi = mid - 1;
  }
  const a = r.pts[lo], b = r.pts[lo + 1];
  const len = cum[lo + 1] - cum[lo] || 1;
  const t = Math.max(0, Math.min(1, (s - cum[lo]) / len));
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / len, ty: (b[1] - a[1]) / len };
}

export function buildTable() {
  const segs = [], circles = [], lines = [], polys = [];
  const wall = (pts, o = {}) => {
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push(makeSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], o));
    }
    lines.push(pts);
  };
  const mir = pts => pts.map(([x, y]) => [2 * CX - x, y]);
  const both = (pts, o) => { wall(pts, o); wall(mir(pts), o); };

  // Outer shell: left wall, top arch, right wall.
  const arch = [];
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI + (Math.PI * i) / 30;
    arch.push([260 + 240 * Math.cos(a), 260 + 240 * Math.sin(a)]);
  }
  wall([[20, H], ...arch, [500, H]]);

  // Shooter lane.
  wall([[462, H], [462, 245]]);
  wall([[462, 1040], [500, 1040]]);
  const gate = makeSeg(462, 245, 462, 130, { ow: true, onx: -1, ony: 0, w: 1.5, e: 0.2 });
  segs.push(gate);

  // Bulges that push a falling ball off the side walls.
  const bulge = [[20, 770], [50, 740], [50, 700], [20, 640]];
  both(bulge);
  polys.push(bulge, mir(bulge));

  // Inlane and outlane guides.
  both([[58, 790], [58, 905], [133, 953]]);
  both([[58, 905], [58, H]]);
  const block = [[58, 905], [133, 953], [140, 978], [118, H], [58, H]];
  polys.push(block, mir(block));

  // Slingshots.
  const sling = [[98, 790], [98, 885], [150, 912]];
  both(sling);
  polys.push(sling, mir(sling));
  segs.push(makeSeg(98, 790, 150, 912, { type: 'sling', side: 0, e: 0.4 }));
  segs.push(makeSeg(384, 790, 332, 912, { type: 'sling', side: 1, e: 0.4 }));

  // Orbit lanes.
  both([[64, 330], [64, 600]]);

  // Top rollover lanes.
  for (const x of [175, 219, 263, 307]) wall([[x, 150], [x, 195]]);

  // The Crypt (scoop).
  wall([[366, 410], [366, 385], [385, 371], [404, 385], [404, 410]]);

  // Standup targets.
  for (let i = 0; i < 3; i++) {
    const y = 470 + i * 40;
    segs.push(makeSeg(68, y, 68, y + 30, { type: 'target', bank: 'rip', idx: i, e: 0.45, w: 2 }));
    segs.push(makeSeg(414, y, 414, y + 30, { type: 'target', bank: 'bat', idx: i, e: 0.45, w: 2 }));
  }

  // Pop bumpers and the gargoyle.
  [[190, 290], [292, 290], [241, 370]].forEach(([x, y], idx) => {
    circles.push({ type: 'bumper', idx, x, y, hx: x, hy: y, r: 24, e: 0.5, active: true, last: -1 });
  });
  circles.push({ type: 'grimble', x: CX, y: 505, hx: CX, hy: 505, r: 20, e: 0.55, active: true, last: -1 });

  const flippers = [new Flipper(141, 960, -1), new Flipper(341, 960, 1)];

  const sensors = [
    { id: 'l0', kind: 'lane', idx: 0, x: 197, y: 172, r: 13 },
    { id: 'l1', kind: 'lane', idx: 1, x: 241, y: 172, r: 13 },
    { id: 'l2', kind: 'lane', idx: 2, x: 285, y: 172, r: 13 },
    { id: 'il', kind: 'inlane', x: 78, y: 850, r: 14 },
    { id: 'ir', kind: 'inlane', x: 404, y: 850, r: 14 },
    { id: 'ol', kind: 'outlane', x: 39, y: 850, r: 14 },
    { id: 'or', kind: 'outlane', x: 443, y: 850, r: 14 },
    { id: 'sc', kind: 'scoop', x: SCOOP.x, y: SCOOP.y, r: 11 },
  ];

  const leftCtrl = [[143, 470], [140, 390], [124, 305], [92, 258], [58, 272], [42, 330], [42, 600], [58, 735], [78, 792]];
  const ramps = [
    buildRamp(1, 'STAIRCASE', { x1: 118, x2: 168, y: 470 }, leftCtrl),
    buildRamp(2, 'BELFRY', { x1: 314, x2: 362, y: 470 }, mir(leftCtrl)),
  ];

  return { segs, circles, flippers, lines, polys, sensors, gate, ramps };
}
