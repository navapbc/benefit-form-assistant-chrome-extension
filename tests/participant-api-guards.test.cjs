const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const guardsUrl = pathToFileURL(path.join(__dirname, '../participant-api/src/guards.ts')).href;
const postgresUrl = process.env.MOCK_TEST_DATABASE_URL;
const allowed = new Set(['chrome-extension://abc']);

test('browser requests need an allow-listed origin and a JSON body; non-browser clients and reads pass', async () => {
  const { checkBrowserRequest } = await import(guardsUrl);
  const post = (extra) => checkBrowserRequest({ method: 'POST', contentType: 'application/json', ...extra }, allowed);
  assert.equal(post({ origin: 'chrome-extension://abc' }), null);
  assert.equal(post({}), null, 'no Origin means a non-browser client');
  assert.equal(post({ contentType: 'application/json; charset=utf-8' }), null);
  assert.deepEqual(post({ origin: 'null' }), { status: 403, error: 'Origin not allowed.' }, 'sandboxed pages send Origin: null');
  assert.equal(post({ origin: 'https://evil.example' }).status, 403);
  assert.equal(post({ origin: 'chrome-extension://other' }).status, 403);
  assert.equal(post({ origin: '' }).status, 403);
  for (const contentType of [undefined, '', 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/jsonp']) {
    assert.equal(post({ contentType }).status, 415, String(contentType));
  }
  assert.equal(post({ origin: 'https://evil.example', contentType: 'text/plain' }).status, 403, 'the origin is checked first');
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(checkBrowserRequest({ method, origin: 'https://evil.example' }, allowed), null, method);
});

test('the client address is the last X-Forwarded-For entry, the one the proxy adds', async () => {
  const { clientIp } = await import(guardsUrl);
  assert.equal(clientIp('203.0.113.9'), '203.0.113.9');
  assert.equal(clientIp('1.1.1.1, 203.0.113.9'), '203.0.113.9', 'a client-supplied first entry is ignored');
  assert.equal(clientIp(undefined), 'unknown');
  assert.equal(clientIp(''), 'unknown');
  assert.equal(clientIp('x'.repeat(65)), 'unknown');
});

test('failure keys are stable, case-insensitive for email, and hold no address', async () => {
  const { emailKey, ipKey } = await import(guardsUrl);
  assert.equal(emailKey('Ada@Example.com '), emailKey('ada@example.com'));
  assert.notEqual(emailKey('ada@example.com'), emailKey('bob@example.com'));
  assert.doesNotMatch(emailKey('ada@example.com'), /ada|example/);
  assert.equal(ipKey('203.0.113.9'), 'ip:203.0.113.9');
});

const skip = postgresUrl ? false : 'set MOCK_TEST_DATABASE_URL to run the limiter against a database';
test('the limiter locks a key after its limit, reports the wait, resets after success, and expires', { skip }, async () => {
  const { createLimiter } = await import(guardsUrl);
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: postgresUrl, max: 1 });
  const key = `test:${Date.now()}`;
  const other = `test:other:${Date.now()}`;
  const limiter = createLimiter(pool, 15);
  try {
    for (let i = 0; i < 4; i += 1) await limiter.recordFailure(key);
    assert.equal(await limiter.lockedFor(key, 5), 0, 'four failures is under a limit of five');
    await limiter.recordFailure(key);
    const wait = await limiter.lockedFor(key, 5);
    assert.ok(wait > 0 && wait <= 15 * 60, `locked for ${wait}s`);
    assert.equal(await limiter.lockedFor(other, 5), 0, 'another key is unaffected');
    await limiter.clear(key);
    assert.equal(await limiter.lockedFor(key, 5), 0, 'success clears the count');

    // An expired window starts over instead of carrying old failures.
    await pool.query("insert into auth_attempts (key, failures, window_started) values ($1, 99, now() - interval '20 minutes')", [other]);
    assert.equal(await limiter.lockedFor(other, 5), 0, 'a 20-minute-old window no longer counts');
    await limiter.recordFailure(other);
    const { rows } = await pool.query('select failures from auth_attempts where key = $1', [other]);
    assert.equal(rows[0].failures, 1);
  } finally {
    await pool.query('delete from auth_attempts where key = any($1)', [[key, other]]);
    await pool.end();
  }
});
