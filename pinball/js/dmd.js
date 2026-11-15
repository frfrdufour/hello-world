// Dot-matrix display: 128 x 32 dots with four brightness levels, like a 90s machine.
import { ROOMS, fmt } from './game.js';

const DW = 128, DH = 32, CELL = 3;
const PALETTES = {
  classic: [[38, 14, 2], [120, 48, 4], [205, 96, 8], [255, 158, 30]],
  haunted: [[4, 26, 24], [10, 96, 82], [30, 180, 150], [110, 255, 215]],
};

export class DMD {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = DW * CELL;
    canvas.height = DH * CELL;
    this.out = canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = DW;
    this.buf.height = DH;
    this.c = this.buf.getContext('2d', { willReadFrequently: true });
    this.img = this.out.createImageData(DW * CELL, DH * CELL);
  }

  text(str, x, y, size, align = 'center') {
    const c = this.c;
    c.textAlign = align;
    c.textBaseline = 'middle';
    let s = size;
    do {
      c.font = `bold ${s}px "Courier New", Courier, monospace`;
      s--;
    } while (c.measureText(str).width > DW - 2 && s > 6);
    c.fillText(str, x, y);
  }

  draw(g) {
    const c = this.c;
    c.clearRect(0, 0, DW, DH);
    c.fillStyle = '#fff';
    const blink = Math.floor(g.t * 5) % 2 === 0;

    if (g.msgs.length) {
      const m = g.msgs[0];
      const fresh = m.dur - m.t < 0.5 && !blink;
      if (!fresh) {
        if (m.lines.length === 1) this.text(m.lines[0], 64, 17, 18);
        else {
          this.text(m.lines[0], 64, 9, 14);
          this.text(m.lines[1], 64, 24, 10);
        }
      }
    } else if (g.mode === 'attract') {
      const pages = [
        ['GRAVEWICK', 'MANOR'],
        ['PRESS ENTER', 'TO PLAY'],
        ['CLASSIC BEST', fmt(g.hi.classic || 0)],
        ['HAUNTED BEST', fmt(g.hi.haunted || 0)],
      ];
      const p = pages[Math.floor(g.t / 2.4) % pages.length];
      this.text(p[0], 64, 9, 14);
      this.text(p[1], 64, 24, 12);
    } else if (g.mode === 'play') {
      this.text(fmt(g.score), 64, 11, 18);
      this.text('BALL ' + g.ball, 2, 26, 9, 'left');
      let status = '';
      if (g.tilted) status = 'TILT';
      else if (g.haunt) status = 'HAUNTING ' + Math.ceil(g.haunt.t);
      else if (g.room === 5) status = 'CELLAR ' + fmt(g.hurry);
      else if (g.room >= 0) status = ROOMS[g.room].name.replace('THE ', '') + ' ' + Math.ceil(g.roomT);
      else if (g.multiball) status = 'JACKPOTS LIT';
      else if (g.world.balls.some(b => b.inLane && !b.auto)) status = blink ? 'HOLD SPACE' : '';
      else if (g.lockLit) status = 'LOCK LIT';
      else if (g.cryptLit) status = 'CRYPT OPEN';
      this.text(status, 126, 26, 9, 'right');
    } else if (g.mode === 'bonus') {
      this.text(`BONUS ${g.bonus}K X${g.bonusX}`, 64, 9, 12);
      this.text(fmt(g.bonusTotal), 64, 23, 14);
    } else {
      this.text(g.newHi && blink ? 'NEW HIGH SCORE' : 'GAME OVER', 64, 9, 14);
      this.text(fmt(g.score), 64, 24, 12);
    }
    this.present(g.haunted ? PALETTES.haunted : PALETTES.classic);
  }

  present(pal) {
    const src = this.c.getImageData(0, 0, DW, DH).data;
    const out = this.img.data;
    const rowLen = DW * CELL * 4;
    for (let y = 0; y < DH; y++) {
      for (let x = 0; x < DW; x++) {
        const a = src[(y * DW + x) * 4 + 3];
        const col = pal[a > 190 ? 3 : a > 110 ? 2 : a > 45 ? 1 : 0];
        for (let dy = 0; dy < CELL; dy++) {
          for (let dx = 0; dx < CELL; dx++) {
            const i = (y * CELL + dy) * rowLen + (x * CELL + dx) * 4;
            const on = dx < 2 && dy < 2;
            out[i] = on ? col[0] : 6;
            out[i + 1] = on ? col[1] : 4;
            out[i + 2] = on ? col[2] : 4;
            out[i + 3] = 255;
          }
        }
      }
    }
    this.out.putImageData(this.img, 0, 0);
  }
}
