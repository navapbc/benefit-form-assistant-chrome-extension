# Follow-up work

Things we decided to come back to. Add to the top of a section as you find more; move an item to [RECENT_CHANGES.md](RECENT_CHANGES.md) when it ships. Last updated October 20, 2026.

## Build and layout

- [ ] **Add a bundler (esbuild, or an extension framework such as WXT).** Deliberately deferred: the ES-module migration keeps "Load unpacked from the repo folder" working with no build step. Come back to this when preparing for the Chrome Web Store or a managed pilot rollout. What it buys:
  - The page agent (content scripts) becomes modules too, as one bundle. Today it and six shared files (`form-purposes`, `participant-record`, `field-values`, `form-engine`, `site-adapters`, `captcha-engine`) stay classic and ES modules import them through `shared/engines.mjs`; with a bundler that facade and the classic wrappers go away.
  - One content-script bundle and one side-panel bundle: faster startup, minification, tree-shaking, source maps.
  - Real TypeScript source, and libraries imported from `npm` at pinned versions so most of `vendor/` goes away.
  - A reproducible `dist/` that is exactly what the store receives, plus per-environment builds (pilot and production endpoints) and bundle-size budgets in CI.
  - Costs to plan for: testers must load `dist/` instead of the repo root (update the tester guide), a stale build becomes a way to test old code, the toolchain needs version pins, and reviewers need readable source or source maps because the store allows minification but not obfuscation.
  - The manifest's `content_scripts[0].js` is already the single list the injector reads, so pointing it at one bundle needs no injector change.
- [ ] **Separate what ships from the tooling.** `evaluation/`, `model-bridge/`, `connector-service/`, `demo/`, and `docs/` sit beside the extension. `npm run package` already defines what ships; a folder layout (for example `extension/` plus `tools/`) would show it. Do this together with the bundler, since both create the `dist/` boundary. It moves paths that docs, CI, and every tester's unpacked install point at.
- [ ] **Repo weight.** Some `evaluation/results/*.json` files are thousands of lines, and the OCR assets and demo video are about 25 MB. Consider Git LFS, or generating results on demand.

## Code quality

- [ ] **Stricter typing.** The type check passes at zero errors with loose settings. Turning on `noImplicitAny` needs annotations across many functions; do it per directory with the existing ratchet.
- [ ] **Service-worker in-memory state.** `activeCommandTargets` and the CAPTCHA scopes live in memory. A worker restart still cancels by persisted tab ID and the CAPTCHA scopes fail closed, so this is low risk; persist them if document-level cancellation must survive a restart.
- [ ] **`.then()` chains.** About 15 remain, mostly the serialized-queue pattern. Left on purpose.
- [ ] **Placeholder icons.** `icons/` is a generated placeholder; replace it with a designed icon before a store submission.

## Security and privacy

- [ ] **Decide whether the side panel's Jev planner should apply site-adapter rules.** The panel has never loaded them in the planner, so declined WIC and IHSS fields become questions. The ES-module migration briefly changed that by accident (the planner then auto-approved those fields from site rules); it is restored by passing `siteAdapters: null` from `sidepanel/page-scan.mjs`. The evaluation harness still runs with adapters on, so it measures behavior the panel does not ship. Decide deliberately, then make the panel and the harness agree.

- [ ] **Shared-API tenant key storage.** `navaApiToken` is stored in `chrome.storage.local` in plain text. Decide: move to session storage (re-enter each browser session), or accept it for the pilot and record that. Tied to the token scope, expiry, and rotation decisions in [PRODUCTION_GAPS.md](PRODUCTION_GAPS.md).
- [ ] **Durable queue metadata is not encrypted** (documented in [WORK_QUEUE_SECURITY_AND_RECOVERY.md](WORK_QUEUE_SECURITY_AND_RECOVERY.md)). Revisit before any real-participant pilot.
- [ ] **Optional-host permission prompt only works from a user gesture.** A run that reaches an unapproved site on its own stops with an "Allow access" error. Consider asking up front when an application is added.

## Testing and release

- [ ] **Live-site baseline on the current build.** There is no retained complete live batch for v0.15 or v0.16 (see [PRODUCTION_GAPS.md](PRODUCTION_GAPS.md)). This is the main quality gate.
- [ ] **A real-Chrome end-to-end test in CI** (Playwright or Puppeteer loading the unpacked extension against the demo fixtures). Today only Node tests run.
- [ ] **Chrome Web Store readiness:** privacy policy, a plain-English justification for each permission and host permission, screenshots, and a decision on the experimental CAPTCHA feature's policy exposure.
- [ ] **Forms inside iframes.** The page agent has `all_frames: false`, so iframe forms are not covered.
- [ ] **Preview mode in a packaged build.** The side panel's preview fetches `../demo/fixtures/…`, which the release zip omits.
- [ ] **Chrome check after the ES-module migration.** The preview page and the parser demo were checked in the in-app browser (no console errors), but the unpacked extension was not: reload it, open the side panel, scan the extensive demo, and check both the side panel and service-worker consoles.

## Docs

- [ ] **Archive more historical docs.** `PRODUCTION_READINESS`, `RELEASE_VERIFICATION`, and `TEST_REPORT` are still linked as evidence from `PRODUCTION_GAPS.md` and the developer guide, so they stayed in `docs/`. Move them to `docs/archive/` when those links are updated.
