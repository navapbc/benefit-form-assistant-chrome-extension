// Renders the extension icons from icons/source/nava-logo.svg into icons/icon-<size>.png: `npm run icons`. Needs the dev dependency @napi-rs/canvas (run npm ci first).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIZES = [16, 32, 48, 128];
const logo = await loadImage(readFileSync(join(root, 'icons', 'source', 'nava-logo.svg')));

for (const size of SIZES) {
  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(logo, 0, 0, size, size);
  writeFileSync(join(root, 'icons', `icon-${size}.png`), canvas.toBuffer('image/png'));
  console.log(`icons/icon-${size}.png`);
}
