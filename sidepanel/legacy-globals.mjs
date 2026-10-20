// Temporary bridge for the migration: republishes each converted module on globalThis for the side-panel scripts that are still classic. Deleted once sidepanel.js becomes a module and imports them directly.
import * as connectorEngine from '../shared/connector-engine.mjs';
import * as workQueueEngine from '../shared/work-queue-engine.mjs';
import * as programCatalog from '../shared/program-catalog.mjs';
import * as recertificationEngine from '../shared/recertification-engine.mjs';
import * as demoConnectorData from '../shared/demo-connector-data.mjs';
import * as plannerInventory from '../shared/planner-inventory.mjs';
import * as plannerRuntime from '../shared/planner-runtime.mjs';
import * as agenticPlanner from '../shared/agentic-planner.mjs';

Object.assign(globalThis, {
  NavaConnectorEngine: connectorEngine,
  NavaWorkQueueEngine: workQueueEngine,
  NavaProgramCatalog: programCatalog,
  NavaRecertificationEngine: recertificationEngine,
  NavaDemoConnectorData: demoConnectorData,
  NavaPlannerInventory: plannerInventory,
  NavaPlannerRuntime: plannerRuntime,
  NavaAgenticPlanner: agenticPlanner,
});
