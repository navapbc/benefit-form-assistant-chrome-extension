import '../shared/captcha-engine.js';
const engine = globalThis.NavaCaptchaEngine;

// No debugger/CDP, hidden token APIs, arbitrary selectors or page-provided code.
export function createCaptchaService(chromeApi, { now = Date.now, randomId = () => crypto.randomUUID() } = {}) {
  const scopes = new Map();
  let beginning = false;
  const verbs = new Set(['begin', 'observe', 'checkbox', 'capture', 'tiles', 'end']);
  function assertSender(sender) {
    if (sender?.id !== chromeApi.runtime.id || sender?.tab
      || sender?.url !== `chrome-extension://${chromeApi.runtime.id}/sidepanel/index.html`) throw new Error('Only the assistant side panel can operate CAPTCHA.');
  }
  function assertScope(scope) {
    if (!scope || scopes.get(scope.token) !== scope || now() >= scope.deadline) throw new Error('CAPTCHA authorization expired or was canceled.');
  }
  function identity(message) {
    return JSON.stringify([message.sessionEpoch, message.participantSessionId, message.applicationGeneration, message.applicationRevision, message.holder]);
  }
  async function revoke(scope) {
    scopes.delete(scope.token);
    const documentIds = [...new Set((scope.frames || []).map((frame) => frame.documentId))];
    if (documentIds.length) await chromeApi.scripting.executeScript({
      target: { tabId: scope.tabId, documentIds },
      func: (token) => globalThis.NavaCaptchaFrame?.revoke(token), args: [scope.token],
    }).catch(() => {});
  }
  function cancelApplications(ids) {
    for (const scope of scopes.values()) if (ids.includes(scope.applicationId)) void revoke(scope);
  }
  async function mainProbe(tabId) {
    const [probe] = await chromeApi.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => ({ url: location.href, width: innerWidth, height: innerHeight }),
    });
    if (!probe?.documentId || !probe.result?.url) throw new Error('The application document is unavailable.');
    return probe;
  }
  async function check(scope, message, authorize) {
    assertScope(scope);
    if (scope.identity !== identity(message)) throw new Error('The CAPTCHA application authorization changed.');
    const authorized = await authorize(message);
    if (authorized.tabId !== scope.tabId || authorized.applicationId !== scope.applicationId) throw new Error('CAPTCHA application mismatch.');
    const probe = await mainProbe(scope.tabId);
    assertScope(scope);
    if (probe.documentId !== scope.documentId || probe.result.url !== scope.url) {
      void revoke(scope);
      throw new Error('The application page changed; CAPTCHA authorization was canceled.');
    }
    return probe;
  }
  async function observe(scope) {
    assertScope(scope);
    await chromeApi.scripting.executeScript({ target: { tabId: scope.tabId, allFrames: true }, files: ['shared/captcha-engine.js', 'content/captcha-agent.js'] });
    const frames = await chromeApi.scripting.executeScript({
      target: { tabId: scope.tabId, allFrames: true },
      func: async () => globalThis.NavaCaptchaFrame ? await globalThis.NavaCaptchaFrame.observe() : null,
    });
    const [containers] = await chromeApi.scripting.executeScript({
      target: { tabId: scope.tabId, documentIds: [scope.documentId] },
      func: (fixtureEnabled) => [...document.querySelectorAll('iframe')].flatMap((iframe) => {
        let url;
        try { url = new URL(iframe.src); } catch { return []; }
        const kind = globalThis.NavaCaptchaEngine.frameKind(url.href)
          || (fixtureEnabled && url.origin === location.origin && url.pathname === '/demo/captcha-fixture-frame.html' ? url.searchParams.get('kind') : '');
        if (!['checkbox', 'image'].includes(kind) || !iframe.name) return [];
        const r = iframe.getBoundingClientRect();
        const style = getComputedStyle(iframe);
        const visible = r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
          && r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
          && Math.abs(r.width - iframe.offsetWidth) < 2 && Math.abs(r.height - iframe.offsetHeight) < 2
          && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === iframe;
        return [{ name: iframe.name, kind, visible, x: r.x + iframe.clientLeft, y: r.y + iframe.clientTop, width: iframe.clientWidth, height: iframe.clientHeight }];
      }), args: [scope.fixture],
    });
    assertScope(scope);
    scope.frames = frames.filter((frame) => frame.result && (!frame.result.fixture || scope.fixture));
    const candidates = scope.frames.flatMap((frame) => {
      const matching = containers?.result?.filter((container) => container.name === frame.result.name && container.kind === frame.result.kind) || [];
      return matching.length === 1 && matching[0].visible ? [{ ...frame, container: matching[0] }] : [];
    });
    const accepted = candidates.find((frame) => frame.result.status === 'accepted');
    // Avoid ambiguity: a page with multiple widgets must be handled manually.
    if (candidates.filter((frame) => frame.result.kind === 'checkbox').length > 1
      || candidates.filter((frame) => frame.result.kind === 'image' && frame.result.status !== 'waiting').length > 1) {
      scope.view = { status: 'unsupported', reason: 'multiple_widgets' };
    } else if (accepted) {
      scope.view = { status: 'accepted' };
    } else {
      const selected = candidates.find((frame) => ['image', 'unsupported'].includes(frame.result.status))
        || candidates.find((frame) => frame.result.status === 'checkbox');
      scope.selected = selected || null;
      scope.view = selected ? { ...selected.result } : candidates.length ? { status: 'waiting' } : { status: 'missing', reason: 'widget_hidden_or_unsupported' };
    }
    return scope.view;
  }
  async function act(scope, action) {
    assertScope(scope);
    const selected = scope.selected;
    if (!selected) throw new Error('No visible CAPTCHA control is bound.');
    const [result] = await chromeApi.scripting.executeScript({
      target: { tabId: scope.tabId, documentIds: [selected.documentId] },
      func: async (token, deadline, command) => {
        globalThis.NavaCaptchaFrame.arm(token, deadline);
        return globalThis.NavaCaptchaFrame.act(token, command);
      }, args: [scope.token, scope.deadline, action],
    });
    assertScope(scope);
    if (!result?.result?.clicked) throw new Error('The CAPTCHA control did not accept the click request.');
    return result.result;
  }
  async function capture(scope, probe) {
    const view = scope.view;
    const frame = scope.selected;
    if (view?.status !== 'image' || !frame) throw new Error('No supported image challenge is visible.');
    const tab = await chromeApi.tabs.get(scope.tabId);
    if (!tab.active) throw new Error('Keep this application tab active while trying CAPTCHA.');
    const active = await chromeApi.tabs.query({ active: true, windowId: tab.windowId });
    if (active.length !== 1 || active[0].id !== scope.tabId) throw new Error('The active application tab changed.');
    const r = view.gridRect;
    if (![r.x, r.y, r.width, r.height].every(Number.isFinite) || r.x < 0 || r.y < 0 || r.width <= 0 || r.height <= 0
      || r.x + r.width > frame.container.width || r.y + r.height > frame.container.height) throw new Error('The challenge image is clipped.');
    const x = frame.container.x + r.x, y = frame.container.y + r.y;
    if (x + r.width > probe.result.width || y + r.height > probe.result.height) throw new Error('The challenge image is outside the viewport.');
    assertScope(scope);
    const screenshot = await chromeApi.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    assertScope(scope);
    const after = await mainProbe(scope.tabId);
    if (after.documentId !== scope.documentId || after.result.url !== scope.url || after.result.width !== probe.result.width || after.result.height !== probe.result.height || !(await chromeApi.tabs.get(scope.tabId)).active) throw new Error('The application changed during image capture.');
    const afterView = await observe(scope);
    if (afterView.challengeId !== view.challengeId || scope.selected?.documentId !== frame.documentId
      || JSON.stringify(scope.selected?.container) !== JSON.stringify(frame.container)
      || JSON.stringify(afterView.gridRect) !== JSON.stringify(view.gridRect)) throw new Error('The CAPTCHA moved or changed during image capture.');
    const bitmap = await createImageBitmap(await (await fetch(screenshot)).blob());
    try {
      const sx = bitmap.width / probe.result.width, sy = bitmap.height / probe.result.height;
      if (Math.abs(sx - sy) > 0.03 || sx <= 0) throw new Error('Unsupported screenshot scaling.');
      const width = Math.round(r.width * sx), height = Math.round(r.height * sy);
      if (width > 1600 || height > 1600) throw new Error('The CAPTCHA image exceeds capture limits.');
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d').drawImage(bitmap, x * sx, y * sy, r.width * sx, r.height * sy, 0, 0, width, height);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
      if (bytes.length > 1024 * 1024) throw new Error('The CAPTCHA image exceeds transport limits.');
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return { task: view.task, tileCount: view.tileCount, challengeId: view.challengeId, image: `data:image/png;base64,${btoa(binary)}` };
    } finally { bitmap.close(); }
  }
  async function handle(message, sender, authorize) {
    assertSender(sender);
    const verb = message.verb;
    if (!verbs.has(verb)) throw new Error('Unsupported CAPTCHA command.');
    if (verb === 'begin') {
      if (beginning) throw new Error('Another CAPTCHA attempt is starting.');
      beginning = true;
      try {
      const app = await authorize(message);
      for (const scope of scopes.values()) {
        if (now() >= scope.deadline) await revoke(scope);
        else throw new Error('Another CAPTCHA attempt is already active.');
      }
      const probe = await mainProbe(app.tabId);
      if (probe.documentId !== message.documentId || probe.result.url !== app.url) throw new Error('The application document changed before authorization.');
      const token = randomId();
      const url = new URL(app.url);
      const scope = { token, tabId: app.tabId, applicationId: app.applicationId, documentId: probe.documentId, url: app.url,
        fixture: ['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname === '/demo/captcha-fixture.html',
        deadline: now() + 180_000, identity: identity(message), checkboxClicks: 0, rounds: 0, frames: [] };
      scopes.set(token, scope);
      return { token, deadline: scope.deadline };
      } finally { beginning = false; }
    }
    const scope = scopes.get(message.token);
    if (verb === 'end') {
      if (scope) await revoke(scope);
      return { ended: true };
    }
    const probe = await check(scope, message, authorize);
    const previousId = scope.view?.challengeId;
    const previousDocument = scope.selected?.documentId;
    const view = await observe(scope);
    await check(scope, message, authorize);
    if (verb === 'observe') return view;
    if (verb === 'checkbox') {
      if (scope.checkboxClicks || view.status !== 'checkbox') throw new Error('The CAPTCHA checkbox is no longer available.');
      scope.checkboxClicks += 1;
      return act(scope, { type: 'checkbox' });
    }
    if (view.status !== 'image' || previousId !== view.challengeId || previousDocument !== scope.selected?.documentId || message.challengeId !== view.challengeId) throw new Error('The CAPTCHA challenge changed; discard this model answer.');
    if (verb === 'capture') return capture(scope, probe);
    if (scope.rounds >= engine.MAX_ROUNDS) throw new Error('The CAPTCHA retry limit was reached.');
    scope.rounds += 1;
    return act(scope, { type: 'tiles', challengeId: view.challengeId, decision: engine.validateDecision(message.decision, view.tileCount) });
  }
  return { handle, cancelApplications };
}
