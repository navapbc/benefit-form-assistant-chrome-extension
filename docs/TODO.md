# Follow-up work

Things we decided to come back to. Add to the top of a section as you find more; move an item to [RECENT_CHANGES.md](RECENT_CHANGES.md) when it ships. Last updated October 21, 2026 (developer mode items added).

## Developer mode

Added October 21, 2026 with the Developer mode switch ([change doc](changes/2026-10-21-add-developer-mode.md)). The list of experimental features is in `shared/developer-mode.mjs`.

**Keep or remove review.** Each is hidden and refused when the switch is off. Decide whether to keep it (and promote it to core), keep it behind the switch, or remove it.

- [ ] CAPTCHA attempts and images
- [ ] Codex, Claude and Jev companion options
- [ ] Shared planner API settings
- [ ] Connector and mock service screens and routes
- [ ] Renewals and recertification
- [ ] Pause and handoff
- [ ] Concurrent applications
- [ ] The `client-link` questions link

**Hardening this branch deliberately left**

- [ ] The CAPTCHA route is answered before the side-panel sender check in `routeMessage`. The CAPTCHA service re-checks the sender itself, but the order should be reviewed.
- [ ] `/auth/token` has no rate limit.
- [ ] The shared-API token is stored in plain text in `chrome.storage.local`.
- [ ] A CAPTCHA `begin` already past the gate when the switch turns off could create a scope after `cancelAll` (very small window).
- [ ] The switch is not a security boundary against a determined user (they can write the storage value). Treat it as a default, not a control.

**Small deferred findings**

- [ ] `analyzeCurrentTab` and recertification add applications without the one-workflow cap.
- [ ] The handoff-pending card gives no hint to turn developer mode on.
- [ ] Render and bootstrap behavior is covered only by source-ordering tests because `sidepanel/main.mjs` has no test seam. Consider a pure `viewForRender` helper.
- [ ] The step (a) assertion of the runtime-reset test is weak.
- [ ] A few assertions in `tests/background-coordinator.test.cjs` are weak.
- [ ] The `ui-dispatch.mjs` import sits above the file's header comment.

## Open-source readiness

Added October 21, 2026 while preparing this repo as a reusable Nava open-source template ([PR 15](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/15)). Done: license, `SECURITY.md`, code of conduct, Dependabot, templates, no shipped directory address, `.env.example`, `npm run extension:key`, [ADDING_A_SITE.md](ADDING_A_SITE.md). Still open:

- [ ] **Legal sign-off on Apache-2.0** and the "Copyright 2026 Nava PBC" line in `LICENSE`.
- [ ] **Turn on GitHub private vulnerability reporting** for the repo; `SECURITY.md` sends reporters there. Add a `CODEOWNERS` file once the team handle is known.
- [ ] **Check branch protection on `main`** (required reviews and the "Validate extension" check). It cannot be seen from the repo.
- [ ] **Public-facing docs pass.** The README and `docs/` still read as an internal Nava prototype: team one-pagers, installed-test logs, and [the Jev/Eve plan](JEV_EVE_ALIGNMENT_PLAN.md), which discusses the private `navapbc/ai-chatbot` repo. Keep the Nava branding; decide which evidence and planning docs are public, and move the rest to `docs/archive/`. Links to the old `gobrando/...` repos should also go.
- [ ] **Add a secret scanner to CI** (for example gitleaks), alongside Dependabot.
- [ ] **A template site adapter and fixture.** [ADDING_A_SITE.md](ADDING_A_SITE.md) describes the steps; a minimal example adapter, playbook and `demo/fixtures` page would let a reuser copy instead of read.
- [ ] **Narrow the manifest by default.** `optional_host_permissions` allows `https://*/*`, and the fixed hosts are the California sites. Decide whether the template ships with only localhost and the demo fixtures.
- [ ] **Document the threat model** in one short page: what stays on the device, what leaves, and what is stored where. Pieces exist in [WORK_QUEUE_SECURITY_AND_RECOVERY.md](WORK_QUEUE_SECURITY_AND_RECOVERY.md) and [MODEL_PROVIDERS.md](MODEL_PROVIDERS.md).
- [ ] **Decide the experimental CAPTCHA feature's place in a public template** (abuse risk and Chrome Web Store policy).

## Participant directory (Neon)

Added October 21, 2026 with the participant directory (see [RECENT_CHANGES.md](RECENT_CHANGES.md) and [the plan](JEV_EVE_ALIGNMENT_PLAN.md)). The Function and Auth run on the Neon `dev` branch. Its 7-day expiry (2026-10-28) was removed on October 21, 2026, so it no longer deletes itself.

- [ ] **Move to a deliberate home for the directory.** The `dev` branch no longer expires (`neon branches set-expiration dev`), but it is still a dev branch holding the Function, Auth users and fictional data, and Nava testers' gitignored `shared/directory-config.local.mjs` sets `DIRECTORY_URL` to it (no address ships in the repository). When the directory is shared beyond testing, pick a lasting branch or project, redeploy `participant-api/`, update the URL and `ALLOWED_ORIGINS`, and re-create the users and `directory_members` rows. Branches made later still get the 7-day expiry from `neon.ts`.
- [ ] **Delete the development test account on the Neon branch before real use.** Its email and password are not in the repository (the repo is public): they sit in the gitignored `shared/directory-config.local.mjs`, which the sign-in card reads. Testers need that file from a teammate. Before real data, delete the account and its `directory_members` row in Neon.
- [ ] **Real participant data needs a review first.** The `participants` table enforces `synthetic = true`. Before that changes: security and privacy review, data-processing terms, region, encryption, retention, and who may read which organization's records.
- [ ] **Pin the extension ID for your fork.** `npm run extension:key` generates a key and prints the manifest `key` line and ID; add the `key` to `manifest.json` and the origin to `ALLOWED_ORIGINS` (see `participant-api/README.md`). The key is deliberately not committed, so each fork creates its own.
- [ ] **User provisioning.** Sign-up is closed. Decide how users are invited and set a first password, and whether adding someone to `directory_members` is an admin screen or a SQL step.
- [ ] **Tune and monitor the sign-in limits.** `/auth/sign-in` refuses foreign origins and non-JSON bodies, and counts attempts atomically before calling Neon Auth: 5 per (email, address), 30 per address, 50 per email, 15 minutes (see `participant-api/src/guards.ts`). Open: an attacker using 2 or more addresses can still lock a known email for everyone after 50 failures; a shared office address shares one address counter; `/auth/token` has no limit; old `auth_attempts` rows are never purged; nothing alerts on repeated lockouts; there is no progressive delay or CAPTCHA.
- [ ] **Verify what the spike did not.** A real 15-minute token expiry with a sleeping service worker, and opening a found participant in the real side panel. Chrome's DevTools protocol cannot open the side panel, and the service worker rejects tab senders, so this is covered by unit tests only (fold into the real-Chrome end-to-end item above).
- [ ] **Decide whether the recertification caseload reads from this database.** It still reads from the old connector.
- [ ] **Save typed or pasted clients to the database.** The mock service has write routes and a `mock_datasets` table, but the panel has no "Save" button yet.
- [ ] **Clean up the production branch.** `npm run connector:migrate` created `mock_records` and `mock_datasets` on `production` during setup. `.env.local` currently points at the `dev` branch.
- [ ] **Jev and Eve alignment.** Phases 1 to 6 of [the plan](JEV_EVE_ALIGNMENT_PLAN.md): client hardening, telemetry with a denominator, an offline eval of the question wording, value-free gap triage, a provenance enum, and Eve layout. Phase 0 (what may leave the device) is decided only for the directory.

## Start screen and wording

- [ ] **Rewrite the remaining screens' language.** The start, welcome, details and search screens were rewritten for caseworkers. The program choice, dashboard, review, questions, handoff and renewals screens still use the older, more technical wording.
- [ ] **Past applications.** "Renewals due" shows upcoming renewals only. A list of past applications does not exist; decide whether to build one.
- [ ] **Retire the Apricot and BenefitsCal connector.** Apricot and BenefitsCal connections are no longer planned. The record-ID and "Manage data source" screens, the provider catalog, `connector-service/`, the Apricot-shaped mock tables and demo data are now unreachable from the start screen. Remove them together, keeping what the preview and recertification still use until that is decided.
- [ ] **Try the welcome page in a real side panel.** Its once-per-browser-session behavior uses `chrome.storage.session`; it was checked in code, tests and preview only.
- [ ] **Shared planner API settings are commented out** in `sidepanel/view-intake.mjs` (the handlers are still registered). Delete them or restore them once the Nava API question is settled.

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

## Docs

- [ ] **Review the archived evidence docs for production gaps.** [PRODUCTION_READINESS](archive/PRODUCTION_READINESS.md), [RELEASE_VERIFICATION](archive/RELEASE_VERIFICATION.md), and [TEST_REPORT](archive/TEST_REPORT.md) were moved to `docs/archive/` but kept on purpose, so the team can read them for requirements we have missed. Add anything real to the lists above, then archive-and-retire what is fully covered.

## Production validation (from the archived readiness doc)

Carried over from "Production validation still required" in [PRODUCTION_READINESS](archive/PRODUCTION_READINESS.md); none of it is done. **Update, October 21, 2026:** Apricot and BenefitsCal connections are no longer planned. Participant data will come from a database (Neon) behind a login; see [Participant directory](#participant-directory-neon). The first and third items below are kept for traceability.

- [ ] A client-approved Apricot sandbox or test tenant, with synthetic records that match production schemas, field IDs, access controls, freshness, pagination, rate limits, and schema drift.
- [ ] A sanctioned BenefitsCal or agency-owned non-production application run through every supported household composition and checkpoint, without creating a real submission.
- [ ] Authenticated organization connections, server-side secret custody, tenant isolation, revocation, audit and retention controls, and mapping re-review when a schema changes.
- [ ] Household-member repeaters, document uploads, address validation, dynamic conditional questions, account creation and login, save-and-return, renewals, case identifiers, and accessibility with assistive technology.
- [ ] Privacy, security, legal, accessibility, incident-response, and human-factors reviews.
