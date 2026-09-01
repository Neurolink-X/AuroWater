/**
 * Generates AuroWater PWA PNGs (navy + cyan "AW") into public/icons.
 * No native deps — zlib PNG encoder.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'icons');

const NAVY = [10, 22, 40, 255];
const CYAN = [6, 182, 212, 255];
const WHITE = [255, 255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function rgbaPng(width, height, getPixel) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const p = getPixel(x, y);
      const i = rowStart + 1 + x * 4;
      raw[i] = p[0];
      raw[i + 1] = p[1];
      raw[i + 2] = p[2];
      raw[i + 3] = p[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 5×7 glyphs */
const GLYPHS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
};

function drawIcon(size, { maskable = false, mono = false } = {}) {
  const pad = maskable ? size * 0.18 : size * 0.12;
  const inner = size - pad * 2;
  const letters = ['A', 'W'];
  const gap = inner * 0.08;
  const glyphW = (inner - gap) / 2;
  const cell = Math.min(glyphW / 5, inner / 7);
  const totalW = cell * 5 * 2 + gap;
  const totalH = cell * 7;
  const ox0 = (size - totalW) / 2;
  const oy = (size - totalH) / 2;
  const fg = mono ? WHITE : CYAN;
  const bg = mono ? [0, 0, 0, 0] : NAVY;

  return rgbaPng(size, size, (x, y) => {
    if (!mono) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < size * 0.08) {
        /* keep bg */
      }
    }
    for (let li = 0; li < 2; li++) {
      const glyph = GLYPHS[letters[li]];
      const ox = ox0 + li * (cell * 5 + gap);
      const gx = Math.floor((x - ox) / cell);
      const gy = Math.floor((y - oy) / cell);
      if (gx >= 0 && gx < 5 && gy >= 0 && gy < 7 && glyph[gy][gx] === '1') {
        return fg;
      }
    }
    return bg;
  });
}

mkdirSync(OUT, { recursive: true });

const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];
for (const s of sizes) {
  writeFileSync(join(OUT, `icon-${s}x${s}.png`), drawIcon(s));
}

writeFileSync(join(OUT, 'icon-maskable-192x192.png'), drawIcon(192, { maskable: true }));
writeFileSync(join(OUT, 'icon-maskable-512x512.png'), drawIcon(512, { maskable: true }));
writeFileSync(join(OUT, 'icon-monochrome-192x192.png'), drawIcon(192, { mono: true }));
writeFileSync(join(OUT, 'apple-touch-icon.png'), drawIcon(180));
writeFileSync(join(OUT, 'shortcut-water.png'), drawIcon(96));
writeFileSync(join(OUT, 'shortcut-plumber.png'), drawIcon(96));
writeFileSync(join(OUT, 'shortcut-orders.png'), drawIcon(96));

console.log(`Wrote ${sizes.length + 6} icons to ${OUT}`);
