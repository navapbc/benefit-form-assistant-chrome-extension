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
