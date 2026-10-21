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

test('counter keys are stable, case-insensitive for email, and hold no address', async () => {
  const { emailKey, ipKey, pairKey } = await import(guardsUrl);
  assert.equal(emailKey('Ada@Example.com '), emailKey('ada@example.com'));
  assert.notEqual(emailKey('ada@example.com'), emailKey('bob@example.com'));
  assert.doesNotMatch(emailKey('ada@example.com') + pairKey('ada@example.com', '1.2.3.4'), /ada|example/);
  assert.equal(ipKey('203.0.113.9'), 'ip:203.0.113.9');
  assert.equal(pairKey('Ada@Example.com', '1.2.3.4'), pairKey(' ada@example.com', '1.2.3.4'));
  assert.notEqual(pairKey('ada@example.com', '1.2.3.4'), pairKey('ada@example.com', '5.6.7.8'), 'each address has its own pair counter');
});

test('the pair limit is tight, and the email-wide limit is high enough that a third party cannot cheaply lock someone out', async () => {
  const { EMAIL_IP_LIMIT, IP_LIMIT, EMAIL_LIMIT } = await import(guardsUrl);
  assert.equal(EMAIL_IP_LIMIT, 5);
  assert.ok(IP_LIMIT > EMAIL_IP_LIMIT);
  assert.ok(EMAIL_LIMIT > IP_LIMIT, 'one address reaches its own limits before it can lock an email for everyone');
});

const skip = postgresUrl ? false : 'set MOCK_TEST_DATABASE_URL to run the limiter against a database';

async function withLimiter(action) {
  const { createLimiter } = await import(guardsUrl);
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: postgresUrl, max: 8 });
  const prefix = `test:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  try {
    await action({ limiter: createLimiter(pool, 15), pool, key: (name) => `${prefix}:${name}` });
  } finally {
    await pool.query("delete from auth_attempts where key like $1", [`${prefix}%`]);
    await pool.end();
  }
}

test('reserve counts each attempt, locks after the limit with a wait, and keeps keys apart', { skip }, async () => {
  await withLimiter(async ({ limiter, key }) => {
    for (let i = 1; i <= 5; i += 1) assert.equal(await limiter.reserve(key('a'), 5), 0, `attempt ${i} is within the limit`);
    const wait = await limiter.reserve(key('a'), 5);
    assert.ok(wait > 0 && wait <= 15 * 60, `the sixth is refused for ${wait}s`);
    assert.equal(await limiter.reserve(key('b'), 5), 0, 'another key is unaffected');
  });
});

test('parallel attempts cannot all slip past the limit: exactly the limit is allowed', { skip }, async () => {
  await withLimiter(async ({ limiter, key }) => {
    const results = await Promise.all(Array.from({ length: 20 }, () => limiter.reserve(key('burst'), 5)));
    assert.equal(results.filter((wait) => wait === 0).length, 5, 'five get through');
    assert.equal(results.filter((wait) => wait > 0).length, 15, 'the other fifteen are refused');
  });
});

test('a success gives its attempt back or clears the count, and an old window starts over', { skip }, async () => {
  await withLimiter(async ({ limiter, pool, key }) => {
    for (let i = 0; i < 5; i += 1) await limiter.reserve(key('ip'), 5);
    await limiter.release(key('ip'));
    assert.equal(await limiter.reserve(key('ip'), 5), 0, 'releasing frees one attempt');
    assert.ok(await limiter.reserve(key('ip'), 5) > 0);

    for (let i = 0; i < 5; i += 1) await limiter.reserve(key('pair'), 5);
    await limiter.clear(key('pair'));
    assert.equal(await limiter.reserve(key('pair'), 5), 0, 'clearing resets the count');

    await limiter.release(key('never-used'));
    const { rows } = await pool.query('select 1 from auth_attempts where key = $1', [key('never-used')]);
    assert.equal(rows.length, 0, 'releasing an unknown key creates nothing');

    await pool.query("insert into auth_attempts (key, failures, window_started) values ($1, 99, now() - interval '20 minutes')", [key('old')]);
    assert.equal(await limiter.reserve(key('old'), 5), 0, 'a 20-minute-old window no longer counts');
    const { rows: [row] } = await pool.query('select failures from auth_attempts where key = $1', [key('old')]);
    assert.equal(row.failures, 1);
  });
});
