import http from 'node:http';
import * as demoConnectorData from '../shared/demo-connector-data.mjs';
import { handleMock } from './mock-admin.mjs';
import { storeFromEnvironment } from './store.mjs';

const port = Number(process.env.PORT || 4789);
const sourceId = String(demoConnectorData.FORM_ID);
const schema = demoConnectorData.SCHEMA;

const store = await storeFromEnvironment();
await store.seed();

// The mock serves only the shared fictional CalFresh renewal for record 339619 (id 'mock-recert-339619-calfresh',
// no source key), with its due date computed once at startup.
const calfreshRenewal = demoConnectorData.RECERTIFICATION_CASELOAD
  .find((entry) => entry.recordId === '339619' && entry.programId === 'calfresh');
const recertificationCases = [demoConnectorData.recertificationCase(calfreshRenewal, 'mock-recert')];

function json(response, status, payload, origin) {
  response.writeHead(status, {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Origin': origin || 'null',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  });
  response.end(JSON.stringify(payload));
}

function allowedOrigin(origin) {
  return !origin || origin === 'null' || origin.startsWith('chrome-extension://') || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function requestedSource(url) {
  return url.searchParams.get('sourceId') || url.searchParams.get('formId');
}

/** [status, payload] for one read-only connector resource; every resource except health is scoped to the demo source. */
async function connectorResponse(match, url) {
  const resource = match[2];
  if (resource === 'health') {
    return [200, { ok: true, provider: 'apricot360', organizationName: 'Riverside Community Services', mode: 'local-demo' }];
  }
  if (requestedSource(url) !== sourceId) return [404, { ok: false, error: 'Source not found.' }];
  if (resource === 'schema') return [200, { ok: true, fields: schema }];
  if (resource === 'recertifications') return [200, { ok: true, cases: recertificationCases }];
  const recordId = decodeURIComponent(match[3] || '');
  const row = await store.getRecord(sourceId, recordId);
  if (!row) return [404, { ok: false, error: 'Record not found.' }];
  return [200, { data: [{ id: Number(recordId) || recordId, type: 'records', attributes: { ...row.attributes, form_id: demoConnectorData.FORM_ID, mod_time: row.updatedAt } }] }];
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin || '';
  if (!allowedOrigin(origin)) return json(response, 403, { ok: false, error: 'Origin not allowed.' }, 'null');
  if (request.method === 'OPTIONS') return json(response, 204, {}, origin);
  const url = new URL(request.url, `http://${request.headers.host}`);
  // The only writes are the mock-only /v1/mock/* routes; the connector contract below is read-only.
  const mock = await handleMock(request, url, store);
  if (mock) return json(response, mock[0], mock[1], origin);
  if (request.method !== 'GET') return json(response, 405, { ok: false, error: 'Read-only mock: GET requests only.' }, origin);

  const match = url.pathname.match(/^\/v1\/connectors\/([^/]+)\/(health|schema|recertifications|records(?:\/([^/]+))?)$/);
  if (!match || decodeURIComponent(match[1]) !== 'nava-demo') {
    return json(response, 404, { ok: false, error: 'Connector not found.' }, origin);
  }
  const [status, payload] = await connectorResponse(match, url);
  return json(response, status, payload, origin);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Nava connector mock listening on http://127.0.0.1:${port} (${store.kind} store)`);
});
