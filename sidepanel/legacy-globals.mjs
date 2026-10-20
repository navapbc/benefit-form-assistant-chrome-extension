// Temporary bridge for the migration: republishes each converted module on globalThis for the side-panel scripts that are still classic. Deleted once sidepanel.js becomes a module and imports them directly.
import * as connectorEngine from '../shared/connector-engine.mjs';
import * as workQueueEngine from '../shared/work-queue-engine.mjs';
import * as programCatalog from '../shared/program-catalog.mjs';
import * as recertificationEngine from '../shared/recertification-engine.mjs';
import * as demoConnectorData from '../shared/demo-connector-data.mjs';
import * as plannerInventory from '../shared/planner-inventory.mjs';
import * as plannerRuntime from '../shared/planner-runtime.mjs';
import * as agenticPlanner from '../shared/agentic-planner.mjs';
import * as panelFormat from './panel-format.mjs';
import * as hostAccess from './host-access.mjs';
import * as ocrEngine from './ocr-engine.mjs';
import * as documentReaders from './document-readers.mjs';
import * as documentParser from './document-parser.mjs';
import * as applicationPolicy from './application-policy.mjs';
import * as scanAnalysis from './scan-analysis.mjs';
import * as extensionMessaging from './extension-messaging.mjs';
import * as pageScan from './page-scan.mjs';
import * as recertificationCaseload from './recertification-caseload.mjs';
import * as captchaModel from './captcha-model.mjs';
import * as applicationViews from './view-applications.mjs';
import * as connectorViews from './view-connector.mjs';
import * as intakeViews from './view-intake.mjs';
import * as recertificationViews from './view-recertification.mjs';
import * as reviewViews from './view-review.mjs';
import * as captchaRuns from './captcha-runs.mjs';
import * as applicationRunner from './application-runner.mjs';
import * as previewRuntime from './preview-runtime.mjs';
import * as runControl from './run-control.mjs';
import * as coordinatorMerge from './coordinator-merge.mjs';
import * as coordinatorSync from './coordinator-sync.mjs';
import * as coordinatorWrites from './coordinator-writes.mjs';
import * as agentRuntime from './agent-runtime.mjs';
import * as automaticRuns from './automatic-runs.mjs';
import * as agentActions from './actions-agent.mjs';
import * as recertificationActions from './actions-recertification.mjs';
import * as intakeActions from './actions-intake.mjs';
import * as connectorActions from './actions-connector.mjs';
import * as applicationActions from './actions-applications.mjs';
import * as uiDispatch from './ui-dispatch.mjs';

Object.assign(globalThis, {
  NavaConnectorEngine: connectorEngine,
  NavaWorkQueueEngine: workQueueEngine,
  NavaProgramCatalog: programCatalog,
  NavaRecertificationEngine: recertificationEngine,
  NavaDemoConnectorData: demoConnectorData,
  NavaPlannerInventory: plannerInventory,
  NavaPlannerRuntime: plannerRuntime,
  NavaAgenticPlanner: agenticPlanner,
  NavaPanelFormat: panelFormat,
  NavaHostAccess: hostAccess,
  NavaOcrEngine: ocrEngine,
  NavaDocumentReaders: documentReaders,
  NavaDocumentParser: documentParser,
  NavaApplicationPolicy: applicationPolicy,
  NavaScanAnalysis: scanAnalysis,
  NavaExtensionMessaging: extensionMessaging,
  NavaPageScan: pageScan,
  NavaRecertificationCaseload: recertificationCaseload,
  NavaCaptchaModel: captchaModel,
  NavaApplicationViews: applicationViews,
  NavaConnectorViews: connectorViews,
  NavaIntakeViews: intakeViews,
  NavaRecertificationViews: recertificationViews,
  NavaReviewViews: reviewViews,
  NavaCaptchaRuns: captchaRuns,
  NavaApplicationRunner: applicationRunner,
  NavaPreviewRuntime: previewRuntime,
  NavaRunControl: runControl,
  NavaCoordinatorMerge: coordinatorMerge,
  NavaCoordinatorSync: coordinatorSync,
  NavaCoordinatorWrites: coordinatorWrites,
  NavaAgentRuntime: agentRuntime,
  NavaAutomaticRuns: automaticRuns,
  NavaAgentActions: agentActions,
  NavaRecertificationActions: recertificationActions,
  NavaIntakeActions: intakeActions,
  NavaConnectorActions: connectorActions,
  NavaApplicationActions: applicationActions,
  NavaUiDispatch: uiDispatch,
});
