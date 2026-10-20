import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VENDORED } from './vendor-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'vendor', 'tesseract');
const coreDestination = path.join(destination, 'core');
const licenseDestination = path.join(root, 'vendor', 'licenses');

await Promise.all([
  mkdir(coreDestination, { recursive: true }),
  mkdir(path.join(destination, 'lang-data'), { recursive: true }),
  mkdir(licenseDestination, { recursive: true }),
]);

const copies = VENDORED;

for (const [source, target] of copies) {
  await copyFile(path.join(root, source), path.join(root, target));
}

const languagePath = path.join(destination, 'lang-data', 'eng.traineddata.gz');
try {
  const language = await stat(languagePath);
  if (language.size < 100000) throw new Error('English trained data is unexpectedly small.');
} catch (error) {
  throw new Error(`Missing vendor/tesseract/lang-data/eng.traineddata.gz. Download the pinned English fast model before packaging. ${error.message}`);
}

console.log(`Bundled ${copies.length} vendored assets and verified the English trained-data file.`);
