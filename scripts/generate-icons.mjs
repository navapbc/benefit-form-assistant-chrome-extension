// Draws the extension icons (a form sheet with a verified check) as dependency-free PNGs into icons/: `npm run icons`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 128];
const SUPERSAMPLE = 4;
const NAVY = [24, 48, 94];
const WHITE = [255, 255, 255];
const GREEN = [46, 160, 98];
const MUTED = [176, 190, 214];

function roundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function segmentDistance(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

// Colour at a point of the unit square, or null where the icon is transparent.
function sample(u, v) {
  if (!roundedRect(u, v, 0, 0, 1, 1, 0.22)) return null;
  if (!roundedRect(u, v, 0.24, 0.16, 0.76, 0.84, 0.06)) return NAVY;
  if (segmentDistance(u, v, 0.37, 0.64, 0.46, 0.73) <= 0.045 || segmentDistance(u, v, 0.46, 0.73, 0.64, 0.5) <= 0.045) return GREEN;
  if (roundedRect(u, v, 0.34, 0.26, 0.66, 0.31, 0.025) || roundedRect(u, v, 0.34, 0.36, 0.58, 0.41, 0.025)) return MUTED;
  return WHITE;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0; let g = 0; let b = 0; let covered = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const color = sample((x + (sx + 0.5) / SUPERSAMPLE) / size, (y + (sy + 0.5) / SUPERSAMPLE) / size);
          if (!color) continue;
          [r, g, b] = [r + color[0], g + color[1], b + color[2]];
          covered += 1;
        }
      }
      const offset = (y * size + x) * 4;
      if (covered) pixels.set([Math.round(r / covered), Math.round(g / covered), Math.round(b / covered), Math.round((255 * covered) / samples)], offset);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}

function png(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(root, 'icons'), { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(root, 'icons', `icon-${size}.png`), png(size, render(size)));
  console.log(`icons/icon-${size}.png`);
}
