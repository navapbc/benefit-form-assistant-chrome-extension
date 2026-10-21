// Write and dataset endpoints that exist only on the mock service. The real connector contract stays read-only.
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_BODY = 256 * 1024;
const text = (value, max) => String(value ?? '').slice(0, max);
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Body too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Body must be JSON.'), { status: 400 }); }
}

/**
 * A write must come from a non-browser client (no Origin header: a browser always sends one on a cross-origin POST) or
 * from an origin listed in `writeOrigins`. `Origin: null`, which sandboxed pages send, and every other origin are refused,
 * and the body must be declared JSON so a cross-origin page cannot skip the preflight with a plain-text form post.
 */
function refuseWrite(request, writeOrigins) {
  if (request.method === 'GET') return null;
  const origin = request.headers.origin;
  if (origin !== undefined && !writeOrigins.has(origin)) return [403, { ok: false, error: 'Origin not allowed to write.' }];
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) return [415, { ok: false, error: 'Send application/json.' }];
  return null;
}

/** [status, payload] for /v1/mock/* requests, or null when the path is not one of them. */
export async function handleMock(request, url, store, { writeOrigins = new Set() } = {}) {
  const match = url.pathname.match(/^\/v1\/mock\/(datasets|records)(?:\/([^/]+))?$/);
  if (!match) return null;
  const refused = refuseWrite(request, writeOrigins);
  if (refused) return refused;
  const [, collection, rawId] = match;
  const id = rawId && decodeURIComponent(rawId);
  try {
    if (collection === 'datasets') {
      if (request.method === 'GET' && !id) return [200, { ok: true, store: store.kind, datasets: await store.listDatasets() }];
      if (request.method === 'GET') {
        const dataset = await store.getDataset(id);
        return dataset ? [200, { ok: true, dataset }] : [404, { ok: false, error: 'Dataset not found.' }];
      }
      if (request.method === 'POST' && !id) {
        const body = await readJson(request);
        if (!ID.test(String(body.id || '')) || !plainObject(body.payload) || !String(body.label || '').trim()) {
          return [400, { ok: false, error: 'A dataset needs an id, a label and a JSON object payload.' }];
        }
        await store.putDataset({ id: body.id, label: text(body.label, 120), scenario: text(body.scenario, 60), description: text(body.description, 400), payload: body.payload });
        return [201, { ok: true, id: body.id }];
      }
    }
    if (collection === 'records' && request.method === 'PUT' && id) {
      const body = await readJson(request);
      const sourceId = String(body.sourceId || '');
      if (!ID.test(id) || !ID.test(sourceId) || !plainObject(body.attributes) || !Object.keys(body.attributes).every((key) => /^field_\d+$/.test(key))) {
        return [400, { ok: false, error: 'A record needs a sourceId and attributes keyed field_<number>.' }];
      }
      await store.putRecord(sourceId, id, body.attributes);
      return [200, { ok: true, recordId: id, sourceId }];
    }
    return [405, { ok: false, error: 'Method not allowed.' }];
  } catch (error) {
    return [error.status || 500, { ok: false, error: error.status ? error.message : 'Mock store error.' }];
  }
}
