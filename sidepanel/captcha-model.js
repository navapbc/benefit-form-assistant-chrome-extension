(function installCaptchaModel(root) {
  'use strict';
  const engine = root.NavaCaptchaEngine;
  function configFor(provider = {}) {
    const selected = provider.captcha?.provider || 'same';
    const kind = selected === 'same' ? (provider.kind === 'chrome-local' ? 'nano' : provider.provider) : selected;
    return { provider: kind, endpoint: provider.endpoint, token: provider.token,
      model: kind === 'eve' ? 'gpt-6.1-sol' : provider.captcha?.model || 'gpt-6.1-sol',
      reasoning: kind === 'eve' ? 'low' : provider.captcha?.reasoning || 'low' };
  }
  function companionUrl(endpoint) {
    const url = new URL(endpoint || 'http://127.0.0.1:4174');
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('The CAPTCHA companion must use a loopback URL.');
    return new URL('/v1/captcha', url).href;
  }
  async function classify(captured, provider, { signal } = {}) {
    const config = configFor(provider);
    const start = performance.now();
    const prompt = engine.imageInstructions(captured.task, captured.tileCount);
    let session = null;
    let image = null;
    if (config.provider === 'nano') {
      try {
        const settings = { expectedInputs: [{ type: 'text', languages: ['en'] }, { type: 'image' }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
        if (!root.LanguageModel || await root.LanguageModel.availability(settings) !== 'available') throw new Error('Nano image input is unavailable on this device.');
        signal?.throwIfAborted();
        session = await root.LanguageModel.create(settings);
        image = new Image(); image.src = captured.image; await image.decode();
        const before = session.contextUsage;
        const decision = engine.validateDecision(JSON.parse(await session.prompt([{ role: 'user', content: [{ type: 'text', value: prompt }, { type: 'image', value: image }] }],
          { responseConstraint: engine.SCHEMA, signal })), captured.tileCount);
        return { decision, metrics: { provider: 'nano', requestedModel: 'Chrome-managed Gemini Nano', requestedReasoning: null, durationMs: performance.now() - start,
          contextUsageUnits: session.contextUsage - before, inferenceCalls: 1, directApiKeyChargeUsd: 0, inputTokens: null, outputTokens: null, providerReportedCostUsd: null } };
      } finally { if (session) session.destroy(); if (image) image.src = ''; }
    }
    if (!['codex', 'eve'].includes(config.provider)) return { decision: { action: 'handoff', tiles: [] }, metrics: { provider: config.provider || 'unknown', durationMs: 0, inferenceCalls: 0, directApiKeyChargeUsd: 0, capability: 'image_input_unsupported' } };
    if (!config.token) throw new Error('Pair a local companion in Model runtime to classify CAPTCHA images.');
    const response = await fetch(companionUrl(config.endpoint), { method: 'POST', redirect: 'error', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
      body: JSON.stringify({ provider: config.provider, model: config.model, reasoning: config.reasoning, task: captured.task, tileCount: captured.tileCount, image: captured.image }), signal });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'The CAPTCHA image model failed.');
    return { decision: engine.validateDecision(result.decision, captured.tileCount), metrics: { provider: result.provider, requestedModel: result.requestedModel,
      requestedReasoning: result.requestedReasoning, inferenceCalls: 1, directApiKeyChargeUsd: 0, ...result.usage, durationMs: performance.now() - start } };
  }
  const api = { configFor, companionUrl, classify };
  root.NavaCaptchaModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
