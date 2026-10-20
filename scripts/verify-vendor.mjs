// `npm run check:vendor`: fails when a file under vendor/ differs from its locked npm package, the English model's digest changes, or THIRD_PARTY_NOTICES.md names a stale version. `npm run ocr:assets` re-copies after a dependency bump.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTICE_VERSIONS, TRAINED_DATA, VENDORED } from './vendor-manifest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (file) => createHash('sha256').update(readFileSync(join(root, file))).digest('hex');
const problems = [];

if (!existsSync(join(root, 'node_modules'))) {
  console.error('Run npm ci first: the vendored files are compared against node_modules.');
  process.exit(1);
}

for (const [source, vendored] of VENDORED) {
  if (!existsSync(join(root, vendored))) problems.push(`${vendored} is missing`);
  else if (!existsSync(join(root, source))) problems.push(`${source} is missing, so ${vendored} cannot be checked`);
  else if (sha256(source) !== sha256(vendored)) problems.push(`${vendored} differs from ${source}; run npm run ocr:assets or revert the edit`);
}

const notices = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
if (!existsSync(join(root, TRAINED_DATA))) problems.push(`${TRAINED_DATA} is missing`);
else {
  const pinned = notices.match(/SHA-256 digest is `([0-9a-f]{64})`/)?.[1];
  if (pinned !== sha256(TRAINED_DATA)) problems.push(`${TRAINED_DATA} does not match the digest pinned in THIRD_PARTY_NOTICES.md`);
}

for (const [packageName, label] of Object.entries(NOTICE_VERSIONS)) {
  const installed = JSON.parse(readFileSync(join(root, 'node_modules', packageName, 'package.json'), 'utf8')).version;
  const stated = notices.match(new RegExp(`\\*\\*${label.replace(/[.]/g, '\\.')} (\\d[\\w.-]*)\\*\\*`))?.[1];
  if (stated !== installed) problems.push(`THIRD_PARTY_NOTICES.md names ${label} ${stated ?? '(no version)'} but ${installed} is installed`);
}

if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
console.log(`Vendor check passed: ${VENDORED.length} files match their locked packages.`);
