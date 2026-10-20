const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function project(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-modules-'));
  for (const [name, source] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), source);
  }
  return dir;
}

test('the module-graph check reports unresolved imports and import cycles, and accepts a clean graph', async () => {
  const { findProblems } = await import('../scripts/check-modules.mjs');
  const clean = project({ 'a.mjs': "import { b } from './b.mjs'; export const a = b;", 'b.mjs': 'export const b = 1;' });
  assert.deepEqual(findProblems(clean, ['a.mjs', 'b.mjs']), []);

  const missing = project({ 'a.mjs': "import './nope.mjs';" });
  assert.match(findProblems(missing, ['a.mjs']).join('\n'), /a\.mjs imports \.\/nope\.mjs, which does not exist/);

  const cycle = project({ 'a.mjs': "import './b.mjs';", 'b.mjs': "export * from './a.mjs';" });
  assert.match(findProblems(cycle, ['a.mjs', 'b.mjs']).join('\n'), /import cycle: a\.mjs -> b\.mjs -> a\.mjs/);

  const dynamicOnly = project({ 'a.mjs': "await import('./nope.mjs');" });
  assert.deepEqual(findProblems(dynamicOnly, ['a.mjs']), []);
});

test('the package check reports a static import that resolves outside the shipped directories', async () => {
  const { findUnshippedImports } = await import('../scripts/check-modules.mjs');
  const dir = project({
    'sidepanel/main.mjs': "import './ok.mjs'; import '../demo/helper.mjs';",
    'sidepanel/ok.mjs': 'export const ok = 1;',
    'demo/helper.mjs': 'export const helper = 1;',
  });
  const problems = findUnshippedImports(dir, ['sidepanel/main.mjs'], ['sidepanel', 'shared']);
  assert.deepEqual(problems, ['sidepanel/main.mjs imports ../demo/helper.mjs, which is outside the shipped directories']);
  assert.deepEqual(findUnshippedImports(dir, ['sidepanel/ok.mjs'], ['sidepanel']), []);
});

test('top-level await is found anywhere in the static import closure, but not inside functions', async () => {
  const { findTopLevelAwait } = await import('../scripts/check-modules.mjs');
  const clean = project({
    'worker.mjs': "import { start } from './lib/start.mjs'; export function run() { return start(); }",
    'lib/start.mjs': 'export async function start() { return await Promise.resolve(1); }\nexport const later = async () => { await null; };',
  });
  assert.deepEqual(findTopLevelAwait(clean, ['worker.mjs']), []);

  const nested = project({
    'worker.mjs': "import './lib/shared.mjs';",
    'lib/shared.mjs': "export const value = await Promise.resolve(1);\nexport const split = compute(\n  await Promise.resolve(2),\n);\nfunction compute(x) { return x; }",
  });
  const problems = findTopLevelAwait(nested, ['worker.mjs']);
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /lib\/shared\.mjs:1 awaits at top level/);
  assert.match(problems.join('\n'), /lib\/shared\.mjs:3 awaits at top level/);
});

test('a Nava global read is found at any depth, except the allowed page-side names in a named file', async () => {
  const { findNavaGlobalReads } = await import('../scripts/check-modules.mjs');
  const dir = project({
    'a.mjs': "export function f() { return globalThis.NavaFormEngine.x; }\nexport const g = () => root.NavaThing;",
    'b.mjs': "export const page = () => globalThis.NavaCaptchaFrame.arm();\nexport const bad = () => globalThis.NavaOther;",
    'c.mjs': "const ok = globalThis.fetch; export { ok };",
  });
  const problems = findNavaGlobalReads(dir, ['a.mjs', 'b.mjs', 'c.mjs'], { 'b.mjs': ['NavaCaptchaFrame'] });
  assert.deepEqual(problems, [
    'a.mjs:1 reads the global NavaFormEngine',
    'a.mjs:2 reads the global NavaThing',
    'b.mjs:2 reads the global NavaOther',
  ]);
});

test('findUnshippedImports checks the exact shipped list, so a stray repo-root file is not shipped', async () => {
  const { findUnshippedImports } = await import('../scripts/check-modules.mjs');
  const dir = project({
    'background.js': "import './helper.mjs';",
    'helper.mjs': 'export const h = 1;',
    'manifest.json': '{}',
  });
  assert.deepEqual(
    findUnshippedImports(dir, ['background.js'], ['manifest.json', 'background.js', 'sidepanel']),
    ['background.js imports ./helper.mjs, which is outside the shipped directories'],
  );
  assert.deepEqual(findUnshippedImports(dir, ['background.js'], ['manifest.json', 'background.js', 'helper.mjs']), []);
});
