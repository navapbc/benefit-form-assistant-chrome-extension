// Service worker entry. The listeners must register synchronously at top level, so this file only imports and starts the worker body.
import { startServiceWorker } from './background/service-worker.mjs';

startServiceWorker();
