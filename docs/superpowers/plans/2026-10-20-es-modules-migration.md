# ES-Module Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the side panel's 40 hand-ordered `<script>` tags and the service worker's `globalThis.Nava*` side-effect imports with real ES module imports, without adding a build step.

**Architecture:** Migrate leaf-first, one slice per commit, with the tree green after each. A migrated file is renamed `.js` to `.mjs`, exports its API by name, and imports what it needs. While the unmigrated composition root (`sidepanel/sidepanel.js`) still reads globals, a temporary shim module republishes each migrated module on `globalThis`; the final slice deletes the shims. The page agent (content scripts) and the six shared files it needs stay classic, because Manifest V3 content scripts cannot be modules without a bundler. ES modules import those six through one facade, `shared/engines.mjs`.

**Tech Stack:** Native ES modules in Chrome 138+ (`<script type="module">`, static `import`), Node 24 `require()` of ES modules for the existing CommonJS tests, TypeScript `checkJs`, ESLint.

**Spec:** None separate. The requirements are this Goal and the Global Constraints below; this plan came from the cleanup analysis ("replace the global-namespace scripts with ES modules").

## Decision (made October 20, 2026)

No bundler now. A bundler would let the page agent be modules too, but it adds a build step, and "Load unpacked from the repo folder" would then need a built output folder. This plan avoids that and leaves the page agent classic. Adding a bundler later is tracked in [docs/TODO.md](../../TODO.md#build-and-layout); Tasks 2 to 7 carry over unchanged.

## Global Constraints

- No build step, bundler, or transpiler. The repo folder must still load unpacked in Chrome 138+.
- Extension CSP stays `script-src 'self' 'wasm-unsafe-eval'`; no inline scripts, no `eval`.
- `manifest.json` `content_scripts[0].js` stays the single list the dynamic injector reads, and those files stay classic scripts.
- The service worker keeps `"type": "module"`, registers every listener synchronously at top level, and has no top-level `await`.
- Vendored files under `vendor/` are untouched. `vendor/fflate.min.js` stays a classic `<script>`; `pdf.min.mjs` and Tesseract keep their dynamic `import()`.
- Behavior does not change. Every slice keeps `npm run lint`, `typecheck` (0 errors), `check`, `check:package`, `check:vendor`, and `npm test` green.
- One slice per commit; each commit message says which files moved.

## Review Focus

1. **A blank side panel from one bad import.** A wrong specifier, a missing file, or an import cycle makes the whole page fail to load, and unit tests that import modules one at a time would not notice. Task 1 adds `check:modules` (every import specifier resolves; no cycles) and Task 7 adds a test that imports the real entry graph.
2. **Reading a global at import time.** Modules that do `const x = globalThis.NavaX` at the top level now run when imported, not when all scripts have loaded. Expect: a module only reads globals from an import it declares.
3. **Top-level `await` in the service worker.** It would delay listener registration and drop the first message after a wake. Expect: a test fails if `background.js` or anything it imports contains top-level `await`.
4. **The six classic shared files must still work three ways:** as classic content scripts, imported as ES modules, and `require`d by the Node tests and tools. Expect: one test loads each file all three ways and compares the API keys.
5. **Packaged build missing a module.** The zip ships whole directories, but a renamed file missed by a path list would still fail only in the package. Expect: `check:package` verifies every static import in the side panel and service worker resolves inside the shipped files.

---

## File Structure

| Path | Responsibility |
|---|---|
| `shared/engines.mjs` (new) | The only ES-module entry to the six classic shared files: side-effect imports, then named re-exports read from `globalThis`. |
| `sidepanel/main.mjs` (new) | Side panel entry: imports, temporary global shims, then starts the panel. Replaces most of `index.html`'s tags. |
| `sidepanel/legacy-globals.mjs` (new, deleted in Task 7) | Republishes migrated modules as `globalThis.NavaX` for the still-classic root. |
| `scripts/check-modules.mjs` (new) | Verifies import specifiers resolve and the graph has no cycles. |
| `tests/helpers/esm.cjs` (new) | `loadEsm(path)`: `require()` an ES module with a clear error if the Node version cannot. |
| `shared/*.js`, `sidepanel/*.js`, `background/*.js` | Renamed `.mjs`, named exports, explicit imports (all except the six classic shared files and `content/*`). |

The six classic files are `form-purposes`, `participant-record`, `field-values`, `form-engine`, `site-adapters`, `captcha-engine`.

---

### Task 1: Foundation, tooling, and the facade

**Files:**
- Create: `shared/engines.mjs`, `scripts/check-modules.mjs`, `tests/helpers/esm.cjs`, `tests/engines-facade.test.cjs`
- Modify: `eslint.config.mjs`, `tsconfig.json`, `package.json`, `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `shared/engines.mjs` exports `formPurposes`, `participantRecord`, `fieldValues`, `formEngine`, `siteAdapters`, `captchaEngine` (each the object the matching classic file assigns to `globalThis.NavaFormPurposes` and so on). `tests/helpers/esm.cjs` exports `loadEsm(relativePath: string): object`. `npm run check:modules` exits non-zero on an unresolved import or a cycle.

- [ ] **Step 1: Write the failing test** `tests/engines-facade.test.cjs` named `the six classic shared files load as ES modules, as classic scripts, and through require, with the same API keys`. Assertions: for each file, `Object.keys` of the `shared/engines.mjs` export equals the keys of `require()` of the file and of the value a `vm` classic run assigns to its global.
- [ ] **Step 2: Run it** (`node --test tests/engines-facade.test.cjs`); expected FAIL, `engines.mjs` missing.
- [ ] **Step 3: Implement `shared/engines.mjs`** with one side-effect `import` per classic file, then `export const formEngine = globalThis.NavaFormEngine` and so on. Implement `loadEsm` as `require(path.join(root, relativePath))`, throwing `Node 22.12 or newer is required to load ES modules from tests` if `require` rejects an ES module.
- [ ] **Step 4: Implement `scripts/check-modules.mjs`:** parse static `import`/`export ... from` specifiers in `shared/**/*.mjs`, `sidepanel/**/*.mjs`, `background*.{js,mjs}`; fail on a missing target or a cycle (depth-first search). Add `"check:modules": "node scripts/check-modules.mjs"` and a CI step after `check:package`.
- [ ] **Step 5: Extend tooling:** add `sidepanel/**/*.mjs`, `shared/**/*.mjs`, `background/**/*.mjs` to `tsconfig.json` `include`; add an `.mjs` + `sourceType: 'module'` override for them in `eslint.config.mjs`.
- [ ] **Step 6: Run** `npm run lint && npm run typecheck && npm run check:modules && npm test`; expected all pass.
- [ ] **Step 7: Commit** `refactor: add the ES-module facade, module-graph check, and test helper`.

### Task 2: Shared engines used only by the side panel and service worker

**Files:** rename to `.mjs` and convert: `shared/connector-engine`, `work-queue-engine`, `program-catalog`, `recertification-engine`, `demo-connector-data`, `planner-inventory`, `planner-runtime`, `agentic-planner`. Modify: `background.js`, `sidepanel/main.mjs`, `sidepanel/legacy-globals.mjs`, `sidepanel/index.html`, matching tests.

**Interfaces:**
- Consumes: `shared/engines.mjs` (Task 1).
- Produces: each file exports the same keys its old `module.exports` had (named exports, no default). `legacy-globals.mjs` assigns `globalThis.NavaConnectorEngine` etc. for each.

- [ ] **Step 1: Write the failing test** `the migrated shared engines export the same keys as before`: snapshot the key lists from `main` (record them in the test as literals) and assert `loadEsm('shared/<file>.mjs')` has them. One test per file in its existing test file, changing `require('../shared/x.js')` to `loadEsm('shared/x.mjs')`.
- [ ] **Step 2: Run the suite;** expected FAIL on the renamed paths.
- [ ] **Step 3: Convert each file:** `git mv x.js x.mjs`; drop the IIFE and `root.NavaX =` / `module.exports` footer; replace `root.NavaOther || require(...)` with `import { ... } from './other.mjs'` (or `./engines.mjs` for the six classic files). Keep function bodies identical.
- [ ] **Step 4: Wire consumers:** `background.js` imports the four engines directly (delete their side-effect imports and the `globalThis.*` reads); `main.mjs` imports the side-panel ones and `legacy-globals.mjs` republishes them; remove their `<script>` tags from `index.html` and add `<script type="module" src="main.mjs">` once, after the remaining classic tags.
- [ ] **Step 5: Run** the full check set; expected pass. **Step 6: Commit** `refactor: convert the shared engines to ES modules`.

### Task 3: Service worker modules and background tests

**Files:** `background/{coordinator-rules,client-session,application-runs,connector-client}.js` to `.mjs`; `background/captcha-service.mjs` (already ESM, switch to direct imports); `background.js`; `tests/background-coordinator.test.cjs`, `tests/coordinator-rules.test.cjs`, `tests/captcha-service.test.cjs`, `tests/runtime-sources.cjs`.

**Interfaces:**
- Produces: each factory module exports `create` (unchanged signature); `coordinator-rules.mjs` exports the rule functions by name. `background.js` imports them and calls `create` directly.

- [ ] **Step 1: Rewrite the harness** in `background-coordinator.test.cjs`: set `globalThis.chrome` to the fake before `await import(pathToFileURL(background.js) + '?run=' + n)`, so each test gets a fresh module state; keep every assertion as is.
- [ ] **Step 2: Add the failing test** `the service worker has no top-level await and registers every listener synchronously` (parse `background.js` and its imports for top-level `await`; assert the fake `chrome` saw `onMessage`, `onInstalled`, `onStartup`, `tabs.onRemoved` registered before the first microtask).
- [ ] **Step 3: Convert the four modules and update `runtime-sources.cjs`'s `serviceWorkerSource()`** to follow `.mjs` imports.
- [ ] **Step 4: Run** the full check set; expected pass. **Step 5: Commit** `refactor: convert the service-worker modules to ES modules`.

### Task 4: Side-panel leaf modules

**Files:** `sidepanel/{panel-format,application-policy,extension-messaging,host-access,scan-analysis,ocr-engine,document-readers,document-parser,page-scan,recertification-caseload,captcha-model}.js` to `.mjs`; their tests; `main.mjs`, `legacy-globals.mjs`, `index.html`.

**Interfaces:**
- Produces: each exports its existing API by name. `ocr-engine.mjs` and `document-readers.mjs` keep their dynamic `import(assetUrl(...))` of vendored files and the `chrome.runtime.getURL` resolution.

- [ ] **Step 1: Update each test** to `loadEsm('sidepanel/<name>.mjs')` (failing first, as in Task 2 Step 1).
- [ ] **Step 2: Convert** the files in dependency order (formatting, policy, messaging, host-access first). The `root` IIFE parameter goes away; code that used `root.chrome` uses `globalThis.chrome`.
- [ ] **Step 3: Move their tags** into `main.mjs` imports and `legacy-globals.mjs` shims; `vendor/fflate.min.js` stays a classic tag.
- [ ] **Step 4: Run** the full check set; expected pass. **Step 5: Commit** `refactor: convert the side-panel leaf modules to ES modules`.

### Task 5: Side-panel views

**Files:** `sidepanel/view-{applications,connector,intake,recertification,review}.js` to `.mjs`; `tests/panel-views.test.cjs`; `main.mjs`, `legacy-globals.mjs`, `index.html`.

**Interfaces:** each exports `create(deps)` unchanged.

- [ ] **Step 1:** `panel-views.test.cjs` loads the views through `loadEsm`; the hostile-input test must still pass unchanged.
- [ ] **Step 2: Convert, wire, run, commit** `refactor: convert the side-panel views to ES modules`.

### Task 6: Side-panel actions, runtime, and orchestration modules

**Files:** `sidepanel/{actions-agent,actions-applications,actions-connector,actions-intake,actions-recertification,agent-runtime,application-runner,automatic-runs,captcha-runs,coordinator-merge,coordinator-sync,coordinator-writes,preview-runtime,run-control,ui-dispatch}.js` to `.mjs`; `tests/sidepanel-{actions,modules,orchestration}.test.cjs`, `tests/application-runner.test.cjs`, `tests/captcha-runs.test.cjs`, `tests/preview-runtime.test.cjs`, `tests/runtime-sources.cjs`.

- [ ] **Step 1:** The three `sidepanel-*` tests extract function bodies from the concatenated source (`sidePanelSource()`); update `runtime-sources.cjs` to concatenate `main.mjs`'s import closure instead of `index.html`'s tags, and confirm the same assertions find the same code.
- [ ] **Step 2: Convert in groups** (runtime, then actions, then `ui-dispatch`), running the suite after each group.
- [ ] **Step 3: Commit** `refactor: convert the side-panel actions and runtime to ES modules`.

### Task 7: The composition root and removing the shims

**Files:** `sidepanel/sidepanel.js` to merge into `sidepanel/main.mjs`; delete `sidepanel/legacy-globals.mjs`; `sidepanel/index.html`; `tests/engines-entry.test.cjs` (new).

**Interfaces:** `index.html` loads `vendor/fflate.min.js` classically, then one `<script type="module" src="main.mjs">`.

- [ ] **Step 1: Write the failing test** `the side panel entry graph imports cleanly and starts`: with a minimal `document`/`chrome` stub, `await import()` `sidepanel/main.mjs` and assert the app root is rendered once and no `globalThis.Nava*` namespace is read by any module (grep the closure for `globalThis.Nava` outside `shared/engines.mjs`).
- [ ] **Step 2: Replace each `globalThis.NavaX` read** in the root with a named import; delete the shims and the remaining script tags; run `check:modules` (no cycles).
- [ ] **Step 3: Run** the full check set. **Step 4: Manual check in Chrome** (cannot be automated here): reload the extension, open the side panel, load the demo record, scan the extensive-application demo, and confirm no console errors in the panel or service worker. **Step 5: Commit** `refactor: make the side panel a single ES module entry`.

### Task 8: Demo pages, evaluation, and Node tools

**Files:** `demo/parser-test.html`, `demo/captcha-fixture.html`, `demo/captcha-fixture-frame.html` and their scripts; `evaluation/controlled-planning/run-jev-extension.mjs`, `evaluation/recovery/{run.mjs,browser-server.mjs}`, `model-bridge/{captcha,jev}.mjs`, `connector-service/mock-server.mjs`, `scripts/{run-extraction-eval,smoke-subscription-planner}.mjs`.

- [ ] **Step 1:** Run each consumer first and record which break (`npm run eval:extraction`, `npm run model:smoke -- --help` where applicable, open the demos).
- [ ] **Step 2: Fix them:** Node `.mjs` consumers `import` the new `.mjs` files directly; the demo pages use `<script type="module">`. Frozen copies under `evaluation/**/source/` are not touched.
- [ ] **Step 3: Commit** `refactor: update demos, evaluation, and tools for ES modules`.

### Task 9: Cleanup, docs, and guards

**Files:** `scripts/package-extension.mjs`, `CONTRIBUTING.md`, `DEVELOPER_GUIDE.md`, `docs/README.md`.

- [ ] **Step 1: Extend `check:package`** to fail if any static import in the side panel or service worker closure points outside the shipped directories (Review Focus 5); add a negative test.
- [ ] **Step 2: Update the docs** that describe script load order (`CONTRIBUTING.md` "module load order" paragraph, `DEVELOPER_GUIDE.md`) to say: ES imports for the side panel and service worker; classic only for the page agent and its six shared files.
- [ ] **Step 3: Final run** of `lint`, `typecheck`, `check`, `check:package`, `check:modules`, `check:vendor`, `check:docs`, `test`, and `npm run package`; load the unzipped package unpacked in Chrome and repeat Task 7 Step 4.
- [ ] **Step 4: Commit** `docs: describe the ES-module layout and extend the package check`.

---

## Self-Review

- **Spec coverage:** side-panel tags (Tasks 2 to 7), service-worker globals (Task 3), no build step (Global Constraints, decision above), the page agent staying classic (Architecture, Task 1 facade), tests (every task), tooling (Task 1), demos and tools (Task 8), docs and packaging (Task 9).
- **Type consistency:** the facade names (`formEngine` and so on) are defined in Task 1 and used only as such; `loadEsm` is defined in Task 1 and used in Tasks 2, 4, 5, 6.
- **Known gaps:** I checked that Node 24 can `require()` an ES module and that a classic IIFE file can be side-effect imported by a module (both confirmed in this environment). I did not check that every one of the 33 `require`-ing tests relies only on named exports, so Task 2 Step 1 snapshots keys first to find any that depend on `module.exports` being a single function or class.
- **Size:** this touches about 60 files, with one commit per task group. Each is a reviewable PR on its own; I suggest one PR per task rather than one for the whole branch.
