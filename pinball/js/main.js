import { World } from './physics.js';
import { buildTable } from './table.js';
import { AudioSys } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { DMD } from './dmd.js';

const $ = id => document.getElementById(id);
const canvas = $('table');
const table = buildTable();
const world = new World(table);
const audio = new AudioSys();
const game = new Game(world, table, audio);
const renderer = new Renderer(canvas, table, game);
const dmd = new DMD($('dmd'));

let paused = false;

function setHaunted(on) {
  game.setHaunted(on);
  document.body.classList.toggle('haunted', on);
  $('modeToggle').setAttribute('aria-checked', String(on));
  $('modeName').textContent = on ? 'Haunted' : 'Classic';
  $('modeHint').textContent = on
    ? 'The table breaks its own rules. Hauntings, ghost balls, time rewind and walls you draw.'
    : 'Pure 90s pinball. Real-world physics and nothing else.';
}

function setPaused(p) {
  paused = p;
  $('pauseNote').hidden = !p;
}

const KEYS = {
  ShiftLeft: 'L', KeyZ: 'L', ArrowLeft: 'L',
  ShiftRight: 'R', Slash: 'R', ArrowRight: 'R',
  Space: 'P', ArrowDown: 'P',
  ArrowUp: 'N', KeyX: 'N',
};

window.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  audio.init();
  const k = KEYS[e.code];
  if (k || e.code === 'Enter' || e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  if (paused && e.code !== 'KeyP') return;
  if (k === 'L') game.flip(0, true);
  else if (k === 'R') game.flip(1, true);
  else if (k === 'P') {
    if (game.mode === 'attract') game.start(); else game.plunger(true);
  } else if (k === 'N') game.nudge();
  else if (e.code === 'Enter') {
    if (game.mode === 'attract' || game.mode === 'over') game.start();
  } else if (e.code === 'KeyH' || e.code === 'Tab') setHaunted(!game.haunted);
  else if (e.code === 'KeyR') game.tryRewind();
  else if (e.code === 'KeyP') setPaused(!paused);
  else if (e.code === 'KeyM') toggleBtn('muteBtn');
  else if (e.code === 'KeyN') toggleBtn('musicBtn');
  else if (e.code === 'KeyV') toggleBtn('voiceBtn');
});

window.addEventListener('keyup', e => {
  const k = KEYS[e.code];
  if (k === 'L') game.flip(0, false);
  else if (k === 'R') game.flip(1, false);
  else if (k === 'P') game.plunger(false);
});

window.addEventListener('blur', () => {
  game.flip(0, false);
  game.flip(1, false);
  if (game.mode === 'play') setPaused(true);
});

// Buttons.
$('modeToggle').addEventListener('click', e => {
  audio.init();
  setHaunted(!game.haunted);
  e.currentTarget.blur();
});

function toggleBtn(id) {
  const b = $(id);
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  if (id === 'muteBtn') audio.setMuted(!on);
  if (id === 'musicBtn') audio.musicOn = on;
  if (id === 'voiceBtn') {
    audio.voiceOn = on;
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  }
}
for (const id of ['muteBtn', 'musicBtn', 'voiceBtn']) {
  $(id).addEventListener('click', e => {
    audio.init();
    toggleBtn(id);
    e.currentTarget.blur();
  });
}

// Mouse: click to start, drag to draw ectoplasm walls in Haunted mode.
let drawing = null;
const pos = e => {
  const r = canvas.getBoundingClientRect();
  return renderer.toTable(e.clientX - r.left, e.clientY - r.top);
};
canvas.addEventListener('pointerdown', e => {
  audio.init();
  if (paused) { setPaused(false); return; }
  if (game.mode === 'attract') { game.start(); return; }
  drawing = pos(e);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  const p = pos(e);
  if (Math.hypot(p[0] - drawing[0], p[1] - drawing[1]) > 12) {
    if (game.inkStroke(drawing[0], drawing[1], p[0], p[1])) drawing = p;
  }
});
const stopDraw = () => { drawing = null; };
canvas.addEventListener('pointerup', stopDraw);
canvas.addEventListener('pointercancel', stopDraw);

window.addEventListener('resize', () => renderer.resize());

// Side panel read-outs.
function hud() {
  $('inkBar').style.width = Math.round((game.ink / 400) * 100) + '%';
  $('rewinds').textContent = game.rewindCharge > 0 ? 'x' + game.rewindCharge : 'used';
}

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 20));
  last = now;
  if (!paused) game.update(dt);
  renderer.draw();
  dmd.draw(game);
  if (game.haunted) hud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.__pinball = { game, world, table, renderer, audio, setHaunted };
