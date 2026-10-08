(function installCaptchaFrame(root) {
  'use strict';
  if (root.NavaCaptchaFrame) return;
  const engine = root.NavaCaptchaEngine;
  const fixture = ['127.0.0.1', 'localhost'].includes(location.hostname)
    && location.pathname === '/demo/captcha-fixture-frame.html';
  const kind = engine.frameKind(location.href) || (fixture ? new URLSearchParams(location.search).get('kind') : '');
  const revoked = new Set();
  let authorization = null;
  function visible(element) {
    if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }
  function rectOf(element) {
    const r = element.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  async function fingerprint(task, cells) {
    const material = [task, ...cells.map((cell) => [...cell.querySelectorAll('img')].map((img) => img.currentSrc || img.src).join('|'))].join('\n');
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function observe() {
    if (!kind) return null;
    const common = { kind, name: window.name, fixture };
    if (kind === 'checkbox') {
      const anchor = document.getElementById('recaptcha-anchor');
      if (!visible(anchor)) return { ...common, status: 'waiting' };
      return { ...common, status: anchor.getAttribute('aria-checked') === 'true' ? 'accepted' : 'checkbox' };
    }
    const grid = document.querySelector('.rc-imageselect-target');
    const cells = [...document.querySelectorAll('.rc-imageselect-target td.rc-imageselect-tile')];
    const task = String(document.querySelector('.rc-imageselect-desc-wrapper')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 800);
    if (!visible(grid)) return { ...common, status: 'waiting' };
    const unsupported = ![9, 16].includes(cells.length) || !task
      || /new images|none left|keep selecting/i.test(task)
      || Boolean(document.querySelector('.rc-imageselect-dynamic-selected'))
      || cells.some((cell) => !visible(cell) || !cell.querySelectorAll('img').length || cell.classList.contains('rc-imageselect-tileselected'));
    if (unsupported) return { ...common, status: 'unsupported', reason: 'dynamic_or_modified_grid' };
    return { ...common, status: 'image', task, tileCount: cells.length, gridRect: rectOf(grid), challengeId: await fingerprint(task, cells) };
  }
  function arm(token, deadline) {
    if (revoked.has(token) || !token || Date.now() >= deadline) throw new Error('CAPTCHA authorization expired.');
    authorization = { token, deadline };
  }
  function revoke(token) {
    // Tombstones also reject an arm request that arrives after cancellation.
    revoked.add(token);
    if (authorization?.token === token) authorization = null;
  }
  function assertArmed(token) {
    if (!authorization || authorization.token !== token || revoked.has(token) || Date.now() >= authorization.deadline) throw new Error('CAPTCHA authorization revoked.');
  }
  async function act(token, action) {
    assertArmed(token);
    const before = await observe();
    assertArmed(token);
    if (action.type === 'checkbox' && before?.status === 'checkbox') {
      document.getElementById('recaptcha-anchor').click();
      return { clicked: true };
    }
    if (action.type !== 'tiles' || before?.status !== 'image' || action.challengeId !== before.challengeId) throw new Error('The CAPTCHA challenge changed.');
    const decision = engine.validateDecision(action.decision, before.tileCount);
    if (decision.action !== 'select') throw new Error('The model requested a handoff.');
    const cells = [...document.querySelectorAll('.rc-imageselect-target td.rc-imageselect-tile')];
    const verify = document.getElementById('recaptcha-verify-button');
    if (!visible(verify) || !/^(verify|skip)$/i.test(verify.textContent.trim())) throw new Error('The CAPTCHA Verify control is unavailable.');
    for (const tile of decision.tiles) {
      assertArmed(token);
      if (await fingerprint(before.task, cells) !== before.challengeId) throw new Error('The CAPTCHA image changed during selection.');
      assertArmed(token);
      if (!visible(cells[tile - 1])) throw new Error('A CAPTCHA tile is hidden.');
      cells[tile - 1].click();
    }
    assertArmed(token);
    if (await fingerprint(before.task, cells) !== before.challengeId) throw new Error('The CAPTCHA image changed before verification.');
    assertArmed(token);
    verify.click();
    return { clicked: true, selectedCount: decision.tiles.length };
  }
  root.NavaCaptchaFrame = { observe, arm, revoke, act };
})(globalThis);
