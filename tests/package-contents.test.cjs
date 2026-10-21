const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');

test('every extension file the side panel fetches at run time is shipped in the release package', async () => {
  const { SHIPPED } = await import(pathToFileURL(path.join(root, 'scripts/shipped-files.mjs')).href);
  const fetched = new Set();
  for (const name of fs.readdirSync(path.join(root, 'sidepanel')).filter((file) => file.endsWith('.mjs'))) {
    const source = fs.readFileSync(path.join(root, 'sidepanel', name), 'utf8');
    for (const match of source.matchAll(/\bfetch\(\s*[`'"]\.\.\/([^/`'"$]+)\/([^/`'"$]+)/g)) fetched.add(`${match[1]}/${match[2]}`);
  }
  assert.ok(fetched.has('demo/fixtures'), 'the preview fixtures fetch is detected');
  for (const target of fetched) {
    assert.ok(SHIPPED.some((entry) => target === entry || target.startsWith(`${entry}/`)), `${target} is fetched by the side panel but not shipped`);
  }
});
