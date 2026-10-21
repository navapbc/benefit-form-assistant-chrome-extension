// Simulated participant directory for the extension-free preview: an in-memory store and a fetch that answers like the
// real API from the shared fictional client records. Any email and password signs in; nothing leaves the page.

/** chrome.storage-shaped areas backed by plain objects. */
function memoryStorage() {
  const area = () => {
    const data = {};
    return {
      async get(key) { return key in data ? { [key]: structuredClone(data[key]) } : {}; },
      async set(values) { Object.assign(data, structuredClone(values)); },
      async remove(key) { delete data[key]; },
    };
  };
  return { local: area(), session: area() };
}

const base64Url = (value) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** A fetch that serves /auth/sign-in, /auth/token, /auth/sign-out, /participants/:id and /participants/search. */
function previewDirectoryFetch(records) {
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const mint = (email) => `${base64Url({ alg: 'none' })}.${base64Url({ email, exp: Math.floor(Date.now() / 1000) + 900 })}.preview`;
  return async (url, init = {}) => {
    const { pathname } = new URL(url);
    const body = init.body ? JSON.parse(init.body) : {};
    if (pathname === '/auth/sign-in') return body.email && body.password ? reply(200, { ok: true, token: mint(body.email), sessionToken: 'preview-session' }) : reply(401, { ok: false });
    if (pathname === '/auth/token') return reply(200, { ok: true, token: mint('preview@example.com') });
    if (pathname === '/auth/sign-out') return reply(200, { ok: true });
    if (!/^Bearer /.test(init.headers?.authorization || '')) return reply(401, { ok: false });
    if (pathname === '/participants/search') {
      const needle = String(body.name || '').toLowerCase();
      const matches = records
        .map((record) => ({ recordId: record.record_id, firstName: record.participant?.name?.first || '', lastName: record.participant?.name?.last || '' }))
        .filter((match) => `${match.firstName} ${match.lastName}`.toLowerCase().includes(needle));
      return reply(200, { ok: true, matches });
    }
    const id = decodeURIComponent(pathname.replace('/participants/', ''));
    const record = records.find((candidate) => candidate.record_id === id);
    return record ? reply(200, { ok: true, participant: structuredClone(record) }) : reply(404, { ok: false });
  };
}

export { memoryStorage, previewDirectoryFetch };
