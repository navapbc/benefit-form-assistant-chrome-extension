// Type-check ratchet: `npm run typecheck` runs tsc over the extension JavaScript and fails if any file has more errors than types/baseline.json allows. After fixing errors, `npm run typecheck -- --update` lowers the baseline so they cannot return.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'types', 'baseline.json');
const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

const run = spawnSync(process.execPath, [tsc, '-p', root, '--pretty', 'false'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = `${run.stdout}${run.stderr}`;
const counts = {};
const unattributed = [];
for (const line of output.split('\n')) {
  const match = line.match(/^(.+?)\(\d+,\d+\): error TS\d+:/);
  if (match) counts[match[1]] = (counts[match[1]] || 0) + 1;
  else if (/error TS\d+:/.test(line)) unattributed.push(line);
}
if (unattributed.length) {
  console.error(`TypeScript reported errors that belong to no file:\n${unattributed.join('\n')}`);
  process.exit(1);
}

const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
if (process.argv.includes('--update')) {
  writeFileSync(baselinePath, `${JSON.stringify(Object.fromEntries(Object.entries(counts).sort()), null, 2)}\n`);
  console.log(`Baseline written: ${total} errors in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const regressions = Object.entries(counts).filter(([file, count]) => count > (baseline[file] || 0));
const improved = Object.entries(baseline).filter(([file, allowed]) => (counts[file] || 0) < allowed);
if (regressions.length) {
  for (const [file, count] of regressions) console.error(`${file}: ${count} type errors, baseline allows ${baseline[file] || 0}`);
  console.error(`\nFix the new errors (run: npx tsc -p . | grep "${regressions[0][0]}"). Do not raise the baseline.`);
  process.exit(1);
}
console.log(`Typecheck ratchet passed: ${total} known errors, none new.`);
if (improved.length) console.log(`${improved.length} file(s) improved; run npm run typecheck -- --update to lock in the gain.`);
