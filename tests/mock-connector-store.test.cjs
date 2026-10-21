const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const postgresUrl = process.env.MOCK_TEST_DATABASE_URL;

function freePort() {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function withMock(environment, action) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, 'connector-service/mock-server.mjs')], {
    env: { PATH: process.env.PATH, PORT: String(port), ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => reject(new Error(`mock exited with ${code}`)));
      child.stdout.once('data', resolve);
    });
    return await action(`http://127.0.0.1:${port}`);
  } finally {
    child.kill();
  }
}

const call = async (base, route, init) => {
  const response = await fetch(`${base}${route}`, init);
  return { status: response.status, body: await response.json() };
};
const send = (method, body) => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('mock writes refuse browser origins that are not allow-listed, including Origin: null, and non-JSON bodies', async () => {
  await withMock({ MOCK_STORE: 'memory', MOCK_WRITE_ORIGINS: 'http://127.0.0.1:9999' }, async (base) => {
    const body = JSON.stringify({ sourceId: '99', attributes: { field_101: 'X' } });
    const put = (headers) => fetch(`${base}/v1/mock/records/csrf-1`, { method: 'PUT', headers, body });
    // Node's fetch lets a test set Origin, which a browser page could not forge but a sandboxed page can send as "null".
    assert.equal((await put({ 'content-type': 'application/json', origin: 'null' })).status, 403);
    assert.equal((await put({ 'content-type': 'application/json', origin: 'https://evil.example' })).status, 403);
    assert.equal((await put({ 'content-type': 'application/json', origin: 'chrome-extension://someotherextension' })).status, 403);
    assert.equal((await put({ 'content-type': 'text/plain' })).status, 415);
    assert.equal((await put({})).status, 415);
    assert.equal((await put({ 'content-type': 'application/json', origin: 'http://127.0.0.1:9999' })).status, 200);
    assert.equal((await put({ 'content-type': 'application/json' })).status, 200, 'a non-browser client sends no Origin');
    // Reads stay open to the connector's allowed origins; only writes are restricted.
    assert.equal((await fetch(`${base}/v1/mock/datasets`, { headers: { origin: 'null' } })).status, 200);
  });
});

function suite(label, environment, kind, cleanup) {
  test(`${label}: serves the demo record and preset scenarios`, async () => {
    await withMock(environment, async (base) => {
      const record = await call(base, '/v1/connectors/nava-demo/records/339619?sourceId=99');
      assert.equal(record.status, 200);
      assert.equal(record.body.data[0].attributes.field_101, 'Celeste');
      assert.ok(record.body.data[0].attributes.mod_time);
      const datasets = await call(base, '/v1/mock/datasets');
      assert.equal(datasets.body.store, kind);
      assert.deepEqual(datasets.body.datasets.filter((d) => d.isPreset).map((d) => d.id).sort(), ['complete', 'different-mailing-address', 'homeless', 'missing-home-zip']);
      const zip = await call(base, '/v1/mock/datasets/missing-home-zip');
      assert.equal(zip.body.dataset.payload.address.residential.zip, '');
    });
  });

  test(`${label}: saves custom datasets and records, rejects bad input, protects presets`, async () => {
    const id = `test-${Date.now()}`;
    try {
      await withMock(environment, async (base) => {
        const saved = await call(base, '/v1/mock/datasets', send('POST', { id, label: 'Custom', payload: { record_id: id, participant: { name: { first: 'Test' } } } }));
        assert.equal(saved.status, 201);
        assert.equal((await call(base, `/v1/mock/datasets/${id}`)).body.dataset.payload.participant.name.first, 'Test');
        assert.equal((await call(base, '/v1/mock/datasets', send('POST', { id: 'bad id!', label: 'x', payload: {} }))).status, 400);
        assert.equal((await call(base, '/v1/mock/datasets', send('POST', { id: 'complete', label: 'x', payload: {} }))).status, 409);
        const put = await call(base, `/v1/mock/records/${id}`, send('PUT', { sourceId: '99', attributes: { field_101: 'Saved' } }));
        assert.equal(put.status, 200);
        const read = await call(base, `/v1/connectors/nava-demo/records/${id}?sourceId=99`);
        assert.equal(read.body.data[0].attributes.field_101, 'Saved');
        assert.equal((await call(base, `/v1/mock/records/${id}`, send('PUT', { sourceId: '99', attributes: { evil: 1 } }))).status, 400);
        assert.equal((await call(base, '/v1/connectors/nava-demo/records/339619?sourceId=99', send('POST', {}))).status, 405);
      });
      if (kind === 'postgres') {
        // Survives a restart: the data is in the database, not the process.
        await withMock(environment, async (base) => {
          assert.equal((await call(base, `/v1/connectors/nava-demo/records/${id}?sourceId=99`)).body.data[0].attributes.field_101, 'Saved');
        });
      }
    } finally {
      await cleanup?.(id);
    }
  });
}

suite('memory store', { MOCK_STORE: 'memory' }, 'memory');

if (postgresUrl) {
  suite('postgres store', { DATABASE_URL: postgresUrl }, 'postgres', async (id) => {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: postgresUrl, max: 1 });
    await pool.query('delete from mock_records where record_id = $1', [id]);
    await pool.query('delete from mock_datasets where id = $1 and not is_preset', [id]);
    await pool.end();
  });
} else {
  test('postgres store', { skip: 'set MOCK_TEST_DATABASE_URL to run against a database' }, () => {});
}
