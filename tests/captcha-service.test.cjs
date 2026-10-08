const test = require('node:test');
const assert = require('node:assert/strict');
async function harness(kind = 'checkbox') {
  const { createCaptchaService } = await import('../background/captcha-service.mjs');
  const state = { url: 'https://benefits.test/application', documentId: 'app-document', now: 1000, actCalls: 0, revoked: [], frameDocument: 'checkbox-document', x: 100, y: 100, captures: 0, moveAfterCapture: false };
  const chrome = { runtime: { id: 'a'.repeat(32) }, scripting: { async executeScript(request) {
    const source = String(request.func || '');
    if (request.files) return [];
    if (source.includes('location.href')) return [{ documentId: state.documentId, result: { url: state.url, width: 900, height: 900 } }];
    if (source.includes('querySelectorAll')) return [{ result: [{ kind, name: 'a-public', visible: true, x: state.x, y: state.y, width: 320, height: 380 }] }];
    if (source.includes('.observe()')) return [{ frameId: 1, documentId: state.frameDocument, result: kind === 'checkbox' ? { kind, name: 'a-public', status: 'checkbox' } : { kind, name: 'a-public', status: 'image', challengeId: 'fixed-public-hash', task: 'Select traffic lights', tileCount: 9, gridRect: { x: 10, y: 25, width: 300, height: 300 } } }];
    if (source.includes('.act(')) { state.actCalls += 1; return [{ result: { clicked: true } }]; }
    if (source.includes('.revoke(')) { state.revoked.push(request.args[0]); return []; }
    throw new Error('Unexpected browser operation');
  } }, tabs: {
    async get() { return { id: 12, active: true, windowId: 4 }; },
    async query() { return [{ id: 12 }]; },
    async captureVisibleTab() { state.captures += 1; if (state.moveAfterCapture) state.x += 50; return 'data:image/png;base64,Zml4dHVyZQ=='; },
  } };
  const service = createCaptchaService(chrome, { now: () => state.now, randomId: () => 'scope-token' });
  const sender = { id: chrome.runtime.id, url: `chrome-extension://${chrome.runtime.id}/sidepanel/index.html` };
  const message = { applicationId: 'app-1', tabId: 12, documentId: state.documentId, sessionEpoch: 1, participantSessionId: 'client-1', applicationGeneration: 0, applicationRevision: 1, holder: 'worker-1' };
  const authorize = async () => ({ tabId: 12, applicationId: 'app-1', url: 'https://benefits.test/application' });
  const send = (verb, extra = {}, caller = sender) => service.handle({ ...message, verb, token: 'scope-token', ...extra }, caller, authorize);
  return { state, service, send, message };
}
test('CAPTCHA service rejects page/content-script senders and arbitrary command verbs', async () => {
  const h = await harness();
  await assert.rejects(h.send('begin', {}, { id: 'a'.repeat(32), url: 'https://benefits.test/application', tab: { id: 12 } }), /side panel/);
  await assert.rejects(h.send('submit'), /Unsupported/); assert.equal(h.state.actCalls, 0);
});
test('CAPTCHA service binds to the application document, current lease authorization and client identity', async () => {
  const h = await harness(); await h.send('begin'); await h.send('observe');
  await assert.rejects(h.send('checkbox', { applicationGeneration: 1 }), /authorization changed/);
  h.state.documentId = 'replaced-document'; await assert.rejects(h.send('checkbox'), /page changed/);
  assert.equal(h.state.actCalls, 0);
});
test('native service executes one authorized checkbox without requesting per-click confirmation', async () => {
  const h = await harness(); await h.send('begin'); await h.send('observe'); await h.send('checkbox');
  assert.equal(h.state.actCalls, 1); await assert.rejects(h.send('checkbox'), /no longer available/);
});
test('revoking or expiring an application blocks every subsequent CAPTCHA action', async () => {
  const h = await harness(); await h.send('begin'); await h.send('observe'); h.service.cancelApplications(['app-1']);
  await assert.rejects(h.send('checkbox'), /expired|canceled/); assert.equal(h.state.actCalls, 0);
  const expired = await harness(); await expired.send('begin'); expired.state.now = 181001;
  await assert.rejects(expired.send('checkbox'), /expired/); assert.equal(expired.state.actCalls, 0);
});
test('concurrent authorization requests cannot start two CAPTCHA scopes', async () => {
  const h = await harness();
  const results = await Promise.allSettled([h.send('begin'), h.send('begin')]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
});
test('only the challenge rectangle is returned from a transient application-tab screenshot', async () => {
  const h = await harness('image'); await h.send('begin'); await h.send('observe');
  const previous = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap, OffscreenCanvas: globalThis.OffscreenCanvas };
  let drawn;
  globalThis.fetch = async () => ({ blob: async () => ({}) });
  globalThis.createImageBitmap = async () => ({ width: 900, height: 900, close() {} });
  globalThis.OffscreenCanvas = class { getContext() { return { drawImage(...args) { drawn = args.slice(1); } }; } async convertToBlob() { return new Blob(['cropped-fixture']); } };
  try {
    const captured = await h.send('capture', { challengeId: 'fixed-public-hash' });
    assert.deepEqual(drawn, [110, 125, 300, 300, 0, 0, 300, 300]);
    assert.equal(captured.image, 'data:image/png;base64,Y3JvcHBlZC1maXh0dXJl');
    assert.equal(captured.tileCount, 9); assert.equal(h.state.captures, 1);
    assert.equal(captured.url, undefined); assert.equal(captured.screenshot, undefined);
  } finally { Object.assign(globalThis, previous); }
});
test('a challenge that moves during screenshot capture is discarded before crop transport', async () => {
  const h = await harness('image'); await h.send('begin'); await h.send('observe'); h.state.moveAfterCapture = true;
  await assert.rejects(h.send('capture', { challengeId: 'fixed-public-hash' }), /moved or changed/);
});
