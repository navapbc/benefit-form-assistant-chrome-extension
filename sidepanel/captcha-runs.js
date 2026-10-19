// Bounded native CAPTCHA attempts. Commands revalidate the run, lease, document, token, and current page; submission remains untouched.
(function installCaptchaRuns(root) {
  'use strict';

  function create(deps) {
    const {
      state, previewMode, captchaEngine, captchaModel, assertApplicationRun,
      goToApplication, assertApprovedApplicationLocation, assertSameDocumentLocation,
      probeTabDocument, sendRuntime, setApplicationProgress, recordAudit,
      persist, resumeHumanCheckpoint, setCheckpoint,
    } = deps;

    async function tryCaptcha(application, { runToken } = {}) {
      if (previewMode) throw new Error('CAPTCHA actuation requires the installed extension; preview results are simulated.');
      assertApplicationRun(application, runToken);
      await goToApplication(application);
      const tab = await chrome.tabs.get(application.tabId);
      assertApprovedApplicationLocation(application, tab.url);
      assertSameDocumentLocation(application.page?.url || application.url, tab.url);
      const probe = await probeTabDocument(tab.id);
      const abort = new AbortController();
      runToken.captchaAbort = abort;
      const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(150_000)]);
      let authorization = null;
      let result = null;
      const started = performance.now();
      const keepAlive = setInterval(() => {
        try { assertApplicationRun(application, runToken); }
        catch { abort.abort(); return; }
        // MV3 must stay awake while a slow image classifier is running.
        void command('observe').catch(() => abort.abort());
      }, 15_000);
      const command = async (verb, extras = {}) => {
        assertApplicationRun(application, runToken);
        signal.throwIfAborted();
        const response = await sendRuntime({ type: 'NAVA_CAPTCHA_COMMAND', verb, ...extras, token: authorization?.token,
          applicationId: application.id, tabId: application.tabId, documentId: probe.documentId,
          sessionEpoch: state.sessionEpoch, participantSessionId: state.participantSessionId,
          applicationGeneration: Number(application.controlGeneration || 0), applicationRevision: Number(application.controlRevision || 0), holder: state.workerId });
        if (!response?.ok) throw new Error(response?.error || 'The CAPTCHA command failed.');
        return response;
      };
      state.view = 'dashboard';
      setApplicationProgress(application, 'Trying CAPTCHA with the extension. Keep the application tab active; Pause cancels.');
      try {
        authorization = await command('begin');
        result = await captchaEngine.run({
          assertActive: async () => { assertApplicationRun(application, runToken); signal.throwIfAborted(); await command('observe'); },
          observe: () => command('observe'), checkbox: () => command('checkbox'),
          capture: (view) => command('capture', { challengeId: view.challengeId }),
          classify: (captured) => captchaModel.classify(captured, state.agentProvider, { signal }),
          tiles: (view) => command('tiles', { challengeId: view.challengeId, decision: view.decision }),
          wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        });
      } catch (error) {
        assertApplicationRun(application, runToken);
        result = { status: 'handoff', reason: 'attempt_stopped', rounds: 0, decisions: [] };
        application.error = error.message;
      } finally {
        clearInterval(keepAlive);
        if (authorization) await sendRuntime({ type: 'NAVA_CAPTCHA_COMMAND', verb: 'end', token: authorization.token }).catch(() => {});
        runToken.captchaAbort = null;
      }
      assertApplicationRun(application, runToken);
      application.captchaResult = { ...result, durationMs: performance.now() - started, actuator: 'extension-dom-v0.14', billedCostUsd: null };
      const summedMetric = (key) => result.decisions.every((decision) => Number.isFinite(decision[key]))
        ? result.decisions.reduce((sum, decision) => sum + decision[key], 0) : null;
      const imageRuntime = captchaModel.configFor(state.agentProvider).provider;
      recordAudit('captcha_attempt', application, {
        checkpointKind: 'captcha', captchaOutcome: result.status, captchaRounds: result.rounds,
        captchaDurationMs: Math.round(application.captchaResult.durationMs), captchaModelCalls: summedMetric('inferenceCalls'),
        modelDurationMs: Math.round(result.decisions.reduce((sum, decision) => sum + (decision.durationMs || 0), 0)),
        captchaImageRuntime: imageRuntime,
        captchaUsageStatus: !result.decisions.length ? 'not_applicable' : summedMetric('inputTokens') === null ? 'partial' : 'complete',
        captchaBilledCost: 'unknown', modelInputTokens: summedMetric('inputTokens'), modelOutputTokens: summedMetric('outputTokens'),
        modelContextUsageUnits: summedMetric('contextUsageUnits'),
        modelApiCostMicros: summedMetric('directApiKeyChargeUsd') === null ? null : Math.round(summedMetric('directApiKeyChargeUsd') * 1e6),
      });
      await persist({ applicationIds: [application.id] });
      if (result.status === 'accepted') return resumeHumanCheckpoint(application, { runToken });
      application.autoRun = false;
      application.runStopReason = `CAPTCHA needs help (${result.reason.replaceAll('_', ' ')}). No completion was recorded.`;
      setCheckpoint(application, 'captcha', 'CAPTCHA still requires help', 'needs_attention');
      await persist({ applicationIds: [application.id] });
      return application;
    }

    return { tryCaptcha };
  }

  const api = { create };
  root.NavaCaptchaRuns = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
