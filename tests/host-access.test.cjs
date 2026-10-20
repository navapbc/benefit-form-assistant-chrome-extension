const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ensureHostAccess, originPattern } = require('../sidepanel/host-access.mjs');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function fakeChrome({ granted = false, allow = true } = {}) {
  const calls = [];
  return {
    calls,
    permissions: {
      contains: async (request) => { calls.push(['contains', request]); return granted; },
      request: async (request) => { calls.push(['request', request]); return allow; },
    },
  };
}

test('origin patterns cover the whole origin and reject non-web URLs', () => {
  assert.equal(originPattern('https://example.org/a/b?c=1'), 'https://example.org/*');
  assert.equal(originPattern('http://127.0.0.1:4789/v1'), 'http://127.0.0.1/*');
  assert.equal(originPattern('chrome://extensions'), '');
  assert.equal(originPattern('not a url'), '');
});

test('an already granted origin resolves without prompting', async () => {
  const chromeApi = fakeChrome({ granted: true });
  await ensureHostAccess('https://example.org/form', chromeApi);
  assert.deepEqual(chromeApi.calls.map(([name]) => name), ['contains']);
});

test('an ungranted origin prompts once and a refusal throws a plain error', async () => {
  const chromeApi = fakeChrome({ allow: false });
  await assert.rejects(ensureHostAccess('https://example.org/form', chromeApi), /Allow access to https:\/\/example\.org/);
  assert.deepEqual(chromeApi.calls.map(([name]) => name), ['contains', 'request']);
  await ensureHostAccess('https://example.org/form', fakeChrome());
});

test('outside the extension, or for a non-web URL, there is nothing to ask', async () => {
  await ensureHostAccess('https://example.org', {});
  await ensureHostAccess('chrome://extensions', fakeChrome());
});

test('the manifest keeps built-in access to the pilot sites and optional access to the rest', () => {
  assert.deepEqual(manifest.content_scripts[0].matches, manifest.host_permissions);
  assert.ok(manifest.host_permissions.every((pattern) => !/^https?:\/\/\*\//.test(pattern)));
  assert.deepEqual(manifest.optional_host_permissions, ['http://*/*', 'https://*/*']);
  assert.ok(!manifest.permissions.includes('activeTab'));
});
