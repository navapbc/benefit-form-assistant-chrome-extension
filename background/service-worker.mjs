// Service worker body: owns the assistant coordinator core (one serialized chain over the coordinator, session, queue, and lease stores) and wires the client-session, application-run, and connector-client modules to Chrome's listeners. background.js starts it; tests start it with a fake captcha service.
import * as connectorEngine from '../shared/connector-engine.mjs';
import * as workQueueEngine from '../shared/work-queue-engine.mjs';
import * as programCatalog from '../shared/program-catalog.mjs';
import * as recertificationEngine from '../shared/recertification-engine.mjs';
import * as demoConnectorData from '../shared/demo-connector-data.mjs';
import * as coordinatorRules from './coordinator-rules.mjs';
import * as clientSession from './client-session.mjs';
import * as applicationRuns from './application-runs.mjs';
import * as connectorClient from './connector-client.mjs';
import { createCaptchaService as defaultCreateCaptchaService } from './captcha-service.mjs';

/** Registers every Chrome listener synchronously; nothing here may await before it returns. `chrome` is injectable so tests can run isolated workers. */
export function startServiceWorker({ createCaptchaService = defaultCreateCaptchaService, chrome = globalThis.chrome } = {}) {
  const CONNECTOR_STORAGE_KEY = 'nava:connector';
  const QUEUE_STORAGE_KEY = 'nava:work-queue';
  const LEASE_STORAGE_KEY = 'nava:application-leases';
  const SESSION_STORAGE_KEY = 'nava:session';
  const COORDINATOR_STORAGE_KEY = 'nava:assistant-coordinator';
  const APPLICATION_COMMAND_TYPES = new Set(['NAVA_SCAN', 'NAVA_FILL', 'NAVA_NAVIGATION_STATUS', 'NAVA_ADVANCE']);
  const WRITE_COMMAND_TYPES = new Set(['NAVA_FILL', 'NAVA_ADVANCE']);
  const ACTIVE_LEASE_MS = 2 * 60 * 1000;
  const COMMAND_LEASE_MS = 10 * 60 * 1000;
  const activeCommandTargets = new Map();
  const captchaService = createCaptchaService(chrome);
  let coordinatorChain = Promise.resolve();
  const {
    activeLease,
    assertCoordinatorEpoch,
    assertParticipantSession,
    assertApplicationGeneration,
    assertApplicationRevision,
    coordinationError,
    invalidateApplicationRun,
    normalizeCoordinator,
    revokedApplication,
    validCoordinatorId,
  } = coordinatorRules;

  // ---------------------------------------------------------------------------
  // Coordinator core: one serialized chain over the coordinator, session, queue, and lease stores, plus the
  // in-flight tab commands that a revocation must cancel.
  // ---------------------------------------------------------------------------

  function coordinate(operation) {
    const next = coordinatorChain.catch(() => {}).then(operation);
    coordinatorChain = next;
    return next;
  }

  async function coordinatorState() {
    const result = await chrome.storage.local.get(COORDINATOR_STORAGE_KEY);
    const coordinator = normalizeCoordinator(result[COORDINATOR_STORAGE_KEY]);
    if (!result[COORDINATOR_STORAGE_KEY]) {
      await chrome.storage.local.set({ [COORDINATOR_STORAGE_KEY]: coordinator });
    }
    return coordinator;
  }

  // The four stores a coordinated write reads together, with their empty defaults.
  async function readCoordinatedState() {
    const [coordinator, sessionResult, queueResult, leaseResult] = await Promise.all([
      coordinatorState(),
      chrome.storage.session.get(SESSION_STORAGE_KEY),
      chrome.storage.local.get(QUEUE_STORAGE_KEY),
      chrome.storage.local.get(LEASE_STORAGE_KEY),
    ]);
    return {
      coordinator,
      session: sessionResult[SESSION_STORAGE_KEY] || {},
      queue: queueResult[QUEUE_STORAGE_KEY] || { applications: [], audit: [] },
      leases: { ...(leaseResult[LEASE_STORAGE_KEY] || {}) },
    };
  }

  // Runs one operation on the coordinator chain and answers asynchronously; failures use the coordination error shape.
  function respondCoordinated(operation, sendResponse, errorExtras) {
    coordinate(operation)
      .then(sendResponse)
      .catch((error) => sendResponse(coordinationError(error, errorExtras)));
    return true;
  }

  async function shortenCommandLease(applicationId, holder) {
    const result = await chrome.storage.local.get(LEASE_STORAGE_KEY);
    const leases = { ...(result[LEASE_STORAGE_KEY] || {}) };
    const lease = leases[applicationId];
    if (!activeLease(lease) || lease.holder !== holder) return;
    leases[applicationId] = {
      ...lease,
      expiresAt: new Date(Date.now() + ACTIVE_LEASE_MS).toISOString(),
    };
    await chrome.storage.local.set({ [LEASE_STORAGE_KEY]: leases });
  }

  function registerCommandTarget(applicationId, target) {
    const commands = activeCommandTargets.get(applicationId) || new Map();
    const commandId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    commands.set(commandId, target);
    activeCommandTargets.set(applicationId, commands);
    return () => {
      const active = activeCommandTargets.get(applicationId);
      active?.delete(commandId);
      if (!active?.size) activeCommandTargets.delete(applicationId);
    };
  }

  function cancelApplicationTargets(applicationIds, sessionApplications = []) {
    captchaService.cancelApplications(applicationIds);
    const ids = new Set(applicationIds);
    const targets = new Map();
    (sessionApplications || [])
      .filter((application) => ids.has(application.id) && Number.isInteger(application.tabId))
      .forEach((application) => targets.set(`${application.tabId}:`, { tabId: application.tabId }));
    ids.forEach((id) => {
      activeCommandTargets.get(id)?.forEach((target) => {
        targets.set(`${target.tabId}:${target.documentId || ''}`, target);
      });
    });
    targets.forEach((target) => {
      const options = target.documentId ? { documentId: target.documentId } : undefined;
      void Promise.resolve()
        .then(() => chrome.tabs.sendMessage(target.tabId, { type: 'NAVA_CANCEL' }, options))
        .catch(() => {});
    });
  }

  async function revokeApplications({ applicationIds, status, checkpointKind, checkpointLabel }) {
    const ids = [...new Set((applicationIds || []).map(validCoordinatorId))];
    const updatedAt = new Date().toISOString();
    const { coordinator, session, queue, leases } = await readCoordinatedState();
    ids.forEach((id) => {
      invalidateApplicationRun(coordinator, id);
      delete leases[id];
    });
    cancelApplicationTargets(ids, session.apps || []);
    coordinator.stateRevision += 1;
    coordinator.updatedAt = updatedAt;
    const options = { status, checkpointKind, checkpointLabel, updatedAt };
    const revoke = (application) => ids.includes(application.id) ? revokedApplication(application, options) : application;
    const nextSession = {
      ...session,
      apps: (session.apps || []).map(revoke),
    };
    const nextQueue = workQueueEngine.buildQueue(
      (queue.applications || []).map(revoke),
      queue.audit || [],
    );
    await Promise.all([
      chrome.storage.local.set({
        [COORDINATOR_STORAGE_KEY]: coordinator,
        [LEASE_STORAGE_KEY]: leases,
        [QUEUE_STORAGE_KEY]: nextQueue,
      }),
      chrome.storage.session.set({ [SESSION_STORAGE_KEY]: nextSession }),
    ]);
    return { coordinator, session: nextSession, queue: nextQueue };
  }

  // ---------------------------------------------------------------------------
  // Service-worker modules: each one receives the coordinator core and the shared engines from here, so every
  // coordinated operation runs on the one chain above.
  // ---------------------------------------------------------------------------

  const storageKeys = {
    CONNECTOR_STORAGE_KEY,
    QUEUE_STORAGE_KEY,
    LEASE_STORAGE_KEY,
    SESSION_STORAGE_KEY,
    COORDINATOR_STORAGE_KEY,
  };

  const { routeSessionMessage } = clientSession.create({
    chrome,
    rules: coordinatorRules,
    workQueueEngine,
    storageKeys,
    coordinatorState,
    readCoordinatedState,
    revokeApplications,
    cancelApplicationTargets,
    respondCoordinated,
  });

  const { closeApplicationTab, routeApplicationRunMessage } = applicationRuns.create({
    chrome,
    rules: coordinatorRules,
    workQueueEngine,
    storageKeys,
    APPLICATION_COMMAND_TYPES,
    WRITE_COMMAND_TYPES,
    COMMAND_LEASE_MS,
    coordinate,
    coordinatorState,
    revokeApplications,
    registerCommandTarget,
    shortenCommandLease,
    cancelApplicationTargets,
    respondCoordinated,
  });

  const { routeConnectorMessage } = connectorClient.create({
    chrome,
    rules: coordinatorRules,
    connectorEngine,
    programCatalog,
    recertificationEngine,
    demoConnectorData,
    storageKeys,
    coordinatorState,
    revokeApplications,
    respondCoordinated,
  });

  // ---------------------------------------------------------------------------
  // Service worker wiring: Chrome lifecycle, tab, and message listeners.
  // ---------------------------------------------------------------------------

  async function configureSidePanel() {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // CAPTCHA shares the coordinator identity and lease checks while its service owns bounded frame operations.
  function routeCaptchaMessage(message, sender, sendResponse) {
    if (message?.type !== 'NAVA_CAPTCHA_COMMAND') return undefined;
    const authorize = (request) => coordinate(async () => {
      const applicationId = validCoordinatorId(request.applicationId);
      const { coordinator, session, leases } = await readCoordinatedState();
      assertCoordinatorEpoch(request, coordinator);
      assertParticipantSession(request, coordinator);
      assertApplicationGeneration(request, coordinator, applicationId);
      assertApplicationRevision(request, coordinator, applicationId);
      const application = session.apps?.find((item) => item.id === applicationId);
      const lease = leases[applicationId];
      if (!application || application.checkpoint?.kind !== 'captcha'
        || application.tabId !== request.tabId || !activeLease(lease) || lease.holder !== request.holder) {
        throw new Error('CAPTCHA requires this application’s checkpoint and active write lease.');
      }
      const url = application.page?.url || application.url;
      if (!/^https?:/i.test(url)) throw new Error('Unsupported application URL.');
      leases[applicationId] = { ...lease, expiresAt: new Date(Date.now() + COMMAND_LEASE_MS).toISOString() };
      await chrome.storage.local.set({ [LEASE_STORAGE_KEY]: leases });
      return { applicationId, tabId: application.tabId, url };
    });
    captchaService.handle(message, sender, authorize)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch(() => sendResponse({ ok: false, error: 'CAPTCHA attempt stopped: authorization, page, challenge or capability changed. Complete it manually or try again from the current checkpoint.' }));
    return true;
  }

  // Only the assistant side panel may drive the coordinator, run, and connector routes. A content script in an
  // application page shares this extension's id but carries a tab, so it never qualifies.
  function isSidePanelSender(sender) {
    if (sender?.id !== chrome.runtime.id || sender.tab) return false;
    try {
      return new URL(sender.url).href.split(/[?#]/)[0] === `chrome-extension://${chrome.runtime.id}/sidepanel/index.html`;
    } catch {
      return false;
    }
  }

  // Each message type belongs to exactly one domain router. A type no router owns, or a sender that is not the side panel, gets no response.
  function routeMessage(message, sender, sendResponse) {
    const captcha = routeCaptchaMessage(message, sender, sendResponse);
    if (captcha !== undefined) return captcha;
    if (!isSidePanelSender(sender)) return false;
    return routeSessionMessage(message, sender, sendResponse)
      ?? routeApplicationRunMessage(message, sender, sendResponse)
      ?? routeConnectorMessage(message, sender, sendResponse)
      ?? false;
  }

  // Lifecycle failures have no caller to report to; log them so a missing side-panel button or a stale tab record is diagnosable.
  const logFailure = (what) => (error) => console.error(`${what} failed:`, error);

  chrome.runtime.onInstalled.addListener(() => {
    configureSidePanel().catch(logFailure('Configuring the side panel on install'));
  });

  chrome.runtime.onStartup.addListener(() => {
    configureSidePanel().catch(logFailure('Configuring the side panel on startup'));
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    coordinate(() => closeApplicationTab(tabId)).catch(logFailure('Recording a closed application tab'));
  });

  chrome.runtime.onMessage.addListener(routeMessage);
}
