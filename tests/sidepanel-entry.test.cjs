const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const modulesUnder = (directory) => fs.readdirSync(path.join(root, directory)).filter((name) => name.endsWith('.mjs')).map((name) => `${directory}/${name}`);

test('no ES module reads a Nava global at any depth: dependencies come from imports, and only the facade touches the classic files', async () => {
  const { findNavaGlobalReads } = await import(pathToFileURL(path.join(root, 'scripts/check-modules.mjs')).href);
  const files = ['background.js', ...modulesUnder('sidepanel'), ...modulesUnder('shared'), ...modulesUnder('background')]
    .filter((file) => file !== 'shared/engines.mjs');
  // Code the CAPTCHA service injects into an application page reads that page's own globals.
  assert.deepEqual(findNavaGlobalReads(root, files, { 'background/captcha-service.mjs': ['NavaCaptchaFrame', 'NavaCaptchaEngine'] }), []);
  assert.equal(fs.existsSync(path.join(root, 'sidepanel/legacy-globals.mjs')), false, 'the migration bridge is gone');
});

test('the side panel page loads one module entry and only the vendored unzipper as a classic script', () => {
  const html = read('sidepanel/index.html');
  const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"/g)].map((match) => ({ module: /type="module"/.test(match[1]), src: match[2] }));
  assert.deepEqual(scripts, [{ module: false, src: '../vendor/fflate.min.js' }, { module: true, src: 'main.mjs' }]);
});

test('the side panel entry imports cleanly in preview mode and renders its first screen', async () => {
  const appRoot = { innerHTML: '', addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
  Object.assign(globalThis, {
    location: { search: '?preview=1', href: 'chrome-extension://x/sidepanel/index.html?preview=1' },
    requestAnimationFrame: (callback) => setTimeout(callback, 0),
    document: { getElementById: (id) => (id === 'app' ? appRoot : null), addEventListener() {}, querySelector: () => null },
  });
  await import(pathToFileURL(path.join(root, 'sidepanel/main.mjs')).href);
  const deadline = Date.now() + 3000;
  while (!/<section|<h1/.test(appRoot.innerHTML) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.match(appRoot.innerHTML, /<section|<h1/, 'the first screen rendered');
});
