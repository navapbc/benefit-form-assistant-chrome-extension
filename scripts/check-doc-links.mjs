// Check the handoff's local files and anchors so the team can follow setup links.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const documents = [
  'README.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/archive/RELEASE_NOTES_v0.14.md',
  'docs/archive/RELEASE_NOTES_v0.15.md',
  'docs/FEATURE_GUIDE.md',
  'docs/TESTER_GUIDE.md',
  'docs/PRODUCTION_GAPS.md',
  'docs/TEST_RESULTS.md',
];
const cache = new Map();
function anchors(file) {
  if (cache.has(file)) return cache.get(file);
  const source = readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  const ids = new Set();
  const duplicates = new Map();
  for (const match of source.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const slug = match[1].toLowerCase().replace(/<[^>]*>/g, '')
      .replace(/[\p{P}\p{S}]/gu, (character) => character === '-' || character === '_' ? character : '')
      .replace(/\s/g, '-');
    const seen = duplicates.get(slug) || 0;
    ids.add(seen ? `${slug}-${seen}` : slug);
    duplicates.set(slug, seen + 1);
  }
  for (const match of source.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) ids.add(match[1]);
  cache.set(file, ids);
  return ids;
}
const failures = [];
let checked = 0;
for (const document of documents) {
  const file = resolve(root, document);
  const source = readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue;
    const [path, fragment] = href.split('#');
    const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
    checked += 1;
    if (!existsSync(target)) failures.push(`${document}: missing ${href}`);
    else if (fragment && target.endsWith('.md') && !anchors(target).has(decodeURIComponent(fragment))) {
      failures.push(`${document}: missing anchor ${href}`);
    }
  }
}
for (const failure of failures) console.error(failure);
console.log(`Checked ${checked} local documentation links across ${documents.length} handoff documents.`);
if (failures.length) process.exitCode = 1;
