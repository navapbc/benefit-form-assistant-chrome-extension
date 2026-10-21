const test = require('node:test');
const assert = require('node:assert/strict');
const directoryModule = require('../shared/participant-directory.mjs');
const { memoryStorage } = require('../sidepanel/preview-directory.mjs');

const BASE = 'https://directory.example';
const jwt = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const reply = (status, body) => new Response(JSON.stringify(body), { status });

/** A directory client over a scripted fetch; `calls` records every request. */
function harness(handler, { now = () => Date.parse('2026-10-21T12:00:00Z') } = {}) {
  const calls = [];
  const storage = memoryStorage();
  const fetchImpl = async (url, init = {}) => {
    const call = { url: String(url), method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined, credentials: init.credentials, redirect: init.redirect };
    calls.push(call);
    return handler(call, calls);
  };
  const client = directoryModule.create({ fetchImpl, storage, now });
  return { client, calls, storage };
}

const futureToken = (seconds = 900, email = 'ada@example.com') => jwt({ email, exp: Date.parse('2026-10-21T12:00:00Z') / 1000 + seconds });

async function signedIn(handler, options) {
  const h = harness((call, calls) => {
    if (call.url.endsWith('/auth/sign-in')) return reply(200, { ok: true, token: futureToken(), sessionToken: 'session-1' });
    return handler(call, calls);
  }, options);
  await h.client.saveConfig(BASE);
  await h.client.signIn('ada@example.com', 'pw');
  h.calls.length = 0;
  return h;
}

test('the directory address must be an https origin; http is only for loopback development', () => {
  const { normalizeBase } = directoryModule;
  assert.equal(normalizeBase('https://directory.example/'), BASE);
  for (const bad of ['', 'directory.example', 'http://directory.example', 'https://user:pw@directory.example', 'https://directory.example/path', 'https://directory.example/?q=1', 'https://directory.example/#x', 'ftp://directory.example']) {
    assert.throws(() => normalizeBase(bad), /https:\/\//, bad);
  }
  assert.throws(() => normalizeBase('http://127.0.0.1:8787'));
  assert.equal(normalizeBase('http://127.0.0.1:8787', { allowLoopbackHttp: true }), 'http://127.0.0.1:8787');
  assert.throws(() => normalizeBase('http://example.com', { allowLoopbackHttp: true }));
});

test('sign-in keeps tokens in session storage only and never stores the password', async () => {
  const { client, storage, calls } = harness(() => reply(200, { ok: true, token: futureToken(), sessionToken: 'session-1' }));
  await client.saveConfig(BASE);
  const status = await client.signIn('ada@example.com', 'hunter2-password');
  assert.deepEqual(status, { configured: true, baseUrl: BASE, signedIn: true, email: 'ada@example.com' });
  const local = JSON.stringify(await storage.local.get('nava:directory'));
  const session = JSON.stringify(await storage.session.get('nava:directory-session'));
  assert.doesNotMatch(local + session, /hunter2/);
  assert.doesNotMatch(local, /session-1/);
  assert.match(session, /session-1/);
  assert.equal(calls[0].credentials, 'omit');
  assert.equal(calls[0].redirect, 'error');
});

test('a failed sign-in gives one fixed message and stores nothing', async () => {
  const { client, storage } = harness(() => reply(401, { ok: false, error: 'internal detail that must not surface' }));
  await client.saveConfig(BASE);
  await assert.rejects(client.signIn('ada@example.com', 'bad'), (error) => error.message === 'Sign-in failed. Check your email and password.');
  assert.deepEqual(await storage.session.get('nava:directory-session'), {});
  assert.equal((await client.status()).signedIn, false);
});

test('an unreachable directory gives a fixed message, not the network error', async () => {
  const client = directoryModule.create({ fetchImpl: async () => { throw new TypeError('connect ECONNREFUSED 10.0.0.5:443'); }, storage: memoryStorage() });
  await client.saveConfig(BASE);
  await assert.rejects(client.signIn('a@b.c', 'pw'), (error) => error.message === 'Could not reach the participant directory.');
});

test('find by ID sends the bearer token, encodes the ID, and returns the record', async () => {
  const { client, calls } = await signedIn(() => reply(200, { ok: true, participant: { record_id: '339619' } }));
  assert.deepEqual(await client.findById('339619'), { record_id: '339619' });
  assert.equal(calls[0].url, `${BASE}/participants/339619`);
  assert.match(calls[0].headers.authorization, /^Bearer h\./);
});

test('find by ID returns null for a missing record and rejects an unsafe ID without a request', async () => {
  const { client, calls } = await signedIn(() => reply(404, { ok: false }));
  assert.equal(await client.findById('nope'), null);
  calls.length = 0;
  for (const bad of ['', '../admin', 'a/b', 'a b', 'x'.repeat(65)]) await assert.rejects(client.findById(bad), /Enter a participant ID/, bad);
  assert.equal(calls.length, 0);
});

test('name search posts the name in the body, never the URL, and trims the result shape', async () => {
  const { client, calls } = await signedIn(() => reply(200, { ok: true, matches: [{ recordId: '1', firstName: 'Ada', lastName: 'Lovelace', ssn: '123-45-6789' }, { recordId: '../bad' }] }));
  const matches = await client.searchByName('  lovelace ');
  assert.deepEqual(matches, [{ recordId: '1', firstName: 'Ada', lastName: 'Lovelace' }]);
  assert.equal(calls[0].url, `${BASE}/participants/search`);
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, { name: 'lovelace' });
  await assert.rejects(client.searchByName('a'), /at least 2 characters/);
  await assert.rejects(client.searchByName('x'.repeat(81)), /at least 2 characters/);
});

test('a token near expiry is refreshed through the session token before the call', async () => {
  let clock = Date.parse('2026-10-21T12:00:00Z');
  const { client, calls } = await signedIn((call) => {
    if (call.url.endsWith('/auth/token')) return reply(200, { ok: true, token: futureToken(900, 'ada@example.com') });
    return reply(200, { ok: true, participant: { record_id: '1' } });
  }, { now: () => clock });
  clock += 14 * 60_000 + 30_000;
  await client.findById('1');
  assert.deepEqual(calls.map((call) => call.url.replace(BASE, '')), ['/auth/token', '/participants/1']);
  assert.deepEqual(calls[0].body, { sessionToken: 'session-1' });
});

test('a 401 is retried once with a fresh token; a second 401 ends the session', async () => {
  let participantCalls = 0;
  const { client } = await signedIn((call) => {
    if (call.url.endsWith('/auth/token')) return reply(200, { ok: true, token: futureToken() });
    participantCalls += 1;
    return participantCalls === 1 ? reply(401, { ok: false }) : reply(200, { ok: true, participant: { record_id: '1' } });
  });
  assert.deepEqual(await client.findById('1'), { record_id: '1' });
  assert.equal(participantCalls, 2);

  const rejecting = await signedIn((call) => (call.url.endsWith('/auth/token') ? reply(200, { ok: true, token: futureToken() }) : reply(401, { ok: false })));
  await assert.rejects(rejecting.client.findById('1'), (error) => error.name === 'DirectoryAuthError');
  assert.equal((await rejecting.client.status()).signedIn, false);
});

test('an expired session fails refresh with a sign-in error and clears the stored tokens', async () => {
  const { client, storage } = await signedIn((call) => (call.url.endsWith('/auth/token') ? reply(401, { ok: false }) : reply(401, { ok: false })));
  await assert.rejects(client.findById('1'), (error) => error.name === 'DirectoryAuthError' && /Sign in again/.test(error.message));
  assert.deepEqual(await storage.session.get('nava:directory-session'), {});
});

test('a 403 explains that the account has no directory access, without signing the user out', async () => {
  const { client } = await signedIn(() => reply(403, { ok: false, error: 'Forbidden' }));
  await assert.rejects(client.searchByName('ada'), /does not have access/);
  assert.equal((await client.status()).signedIn, true);
});

test('server error bodies are never surfaced', async () => {
  const { client } = await signedIn(() => reply(500, { ok: false, error: 'stack trace /srv/app/secret.js' }));
  await assert.rejects(client.findById('1'), (error) => !/secret|stack/.test(error.message));
});

test('changing the directory address signs the user out; the same address keeps the session', async () => {
  const { client } = await signedIn(() => reply(200, { ok: true }));
  await client.saveConfig(BASE);
  assert.equal((await client.status()).signedIn, true);
  await client.saveConfig('https://other.example');
  assert.equal((await client.status()).signedIn, false);
});

test('sign-out clears the local session even when the directory cannot be reached', async () => {
  const { client, storage } = await signedIn(() => reply(200, { ok: true }));
  const offline = directoryModule.create({ fetchImpl: async () => { throw new TypeError('offline'); }, storage });
  await offline.signOut();
  assert.deepEqual(await storage.session.get('nava:directory-session'), {});
  assert.equal((await client.status()).signedIn, false);
});

test('signing out tells the directory to end the session', async () => {
  const { client, calls } = await signedIn(() => reply(200, { ok: true }));
  await client.signOut();
  assert.equal(calls[0].url, `${BASE}/auth/sign-out`);
  assert.deepEqual(calls[0].body, { sessionToken: 'session-1' });
});

test('using the client before signing in asks for a sign-in', async () => {
  const { client } = harness(() => reply(200, { ok: true }));
  await client.saveConfig(BASE);
  await assert.rejects(client.findById('1'), (error) => error.name === 'DirectoryAuthError');
});

test('the address provided by the code is used without saving one, and a saved address overrides it', async () => {
  const calls = [];
  const fetchImpl = async (url) => { calls.push(String(url)); return reply(200, { ok: true, token: futureToken(), sessionToken: 's' }); };
  const client = directoryModule.create({ fetchImpl, storage: memoryStorage(), defaultBaseUrl: BASE });
  assert.equal((await client.status()).configured, true);
  await client.signIn('a@b.c', 'pw');
  assert.equal(calls[0], `${BASE}/auth/sign-in`);
  assert.equal((await client.status()).signedIn, true);
  await client.saveConfig('https://other.example');
  assert.equal((await client.status()).signedIn, false);
  assert.equal((await client.config()).baseUrl, 'https://other.example');
});

test('the shipped config names an https directory and contains no account credentials', () => {
  const config = require('../shared/directory-config.mjs');
  assert.equal(directoryModule.normalizeBase(config.DIRECTORY_URL), config.DIRECTORY_URL);
  assert.equal('DEV_TEST_ACCOUNT' in config, false, 'the repository is public: the test account lives in a gitignored local file');
  const fs = require('node:fs');
  const path = require('node:path');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../shared/directory-config.mjs'), 'utf8'), /password:\s*'/);
});

test('the dev test account loads from the local file, and anything missing or malformed means no account', async () => {
  const { loadDevTestAccount } = require('../shared/directory-config.mjs');
  const account = await loadDevTestAccount(async (specifier) => {
    assert.equal(specifier, './directory-config.local.mjs');
    return { DEV_TEST_ACCOUNT: { email: 'dev@example.com', password: 'pw-123', extra: 'dropped' } };
  });
  assert.deepEqual(account, { email: 'dev@example.com', password: 'pw-123' });
  assert.ok(Object.isFrozen(account));
  for (const [label, importer] of [
    ['file missing', async () => { throw new TypeError('Failed to fetch dynamically imported module'); }],
    ['no export', async () => ({})],
    ['wrong types', async () => ({ DEV_TEST_ACCOUNT: { email: 1, password: 2 } })],
    ['empty values', async () => ({ DEV_TEST_ACCOUNT: { email: '', password: '' } })],
    ['null export', async () => ({ DEV_TEST_ACCOUNT: null })],
  ]) {
    assert.equal(await loadDevTestAccount(importer), null, label);
  }
});
