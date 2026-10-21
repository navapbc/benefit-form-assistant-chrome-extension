# Recent engineering changes

High-level notes on what changed in the extension's code and tooling, newest first. For tester-facing release notes see [RELEASE_NOTES_v0.16.md](RELEASE_NOTES_v0.16.md); for what is still to do see [TODO.md](TODO.md). The extension's version is still 0.16.0; these changes did not alter form-filling behavior.

## October 21, 2026 (later): participant directory and a new start screen

**Participant directory on Neon** ([change doc](changes/2026-10-21-add-participant-directory.md))
- A Neon Function (`participant-api/`) lets a signed-in user find a participant by ID or name. Sign-in goes through the Function because Neon Auth rejects `chrome-extension://` origins. JWTs are checked for issuer and audience, and every query is filtered by the caller's organization through `directory_members`. Sign-up is closed.
- The side panel gets sign-in and search (`shared/participant-directory.mjs`, `sidepanel/view-directory.mjs`). Tokens stay in `chrome.storage.session`. The address lives in `shared/directory-config.mjs`; the development test account is read from a gitignored `shared/directory-config.local.mjs`, so no credentials are committed to the public repo.
- The sign-in route refuses foreign origins and non-JSON bodies and rate-limits failures per email and per client address (a security-review finding).
- Only this path needs a login. Typing details, sample clients and document upload do not.
- The Function runs on the Neon `dev` branch. Its 7-day expiry was removed, so it stays until deleted (see [TODO.md](TODO.md#participant-directory-neon)).

**Start screen reworked** ([change doc](changes/2026-10-21-rework-start-screen.md))
- The first screen is "Find your client": sign in, then search by name or ID. Other ways to start are Enter client details (four sample clients, a typed form, and a pasted record under Advanced) and Upload a document.
- A welcome page shows once per browser session with how it works and the safeguards. It replaces the collapsed "Data and review safeguards" note.
- Removed the header ×, the record-ID and paste-JSON buttons, and the shared planner API settings (commented out). "Recertification status" is now "Renewals due".

**Mock connector** ([change doc](changes/2026-10-21-restrict-mock-writes.md))
- The mock service stores records and preset scenarios in memory or Neon Postgres, has mock-only write routes, and refuses writes from `Origin: null`, unlisted origins and non-JSON bodies.

**Analysis**
- [JEV_EVE_ALIGNMENT_PLAN.md](JEV_EVE_ALIGNMENT_PLAN.md) compares how `navapbc/ai-chatbot` (develop branch) uses Eve and Jev with this extension, with phased proposals and the Neon spike results.

## October 21, 2026

**Small cleanups**
- The extension icons are now the Nava logo, rendered from `icons/source/nava-logo.svg` by `npm run icons`.
- The release package includes `demo/fixtures` (fictional sample documents), so the side panel's preview mode works from a packaged build; a test checks that anything the panel fetches at run time is shipped.
- `PRODUCTION_READINESS`, `RELEASE_VERIFICATION`, and `TEST_REPORT` moved to `docs/archive/`; they are kept on purpose for a production-gap review (see [TODO.md](TODO.md#docs)).

## October 20, 2026

**Module guards hardened.** `check:modules` now parses the code (TypeScript's parser) instead of scanning lines: it finds top-level `await` anywhere in the worker and side-panel import closure, and a `Nava*` global read at any depth. `findUnshippedImports` checks the exact shipped file list, `startServiceWorker` takes the `chrome` object it uses (so worker tests no longer share a global), and stale names in comments and docs are fixed.

**ES modules** (merged in PR 10). The side panel's 40 hand-ordered script tags and the service worker's `globalThis.Nava*` lookups are now real `import`s with no build step: `sidepanel/main.mjs` is the composition root, `background/service-worker.mjs` holds the worker body, and `background.js` only starts it. The page agent and the six shared files it needs stay classic scripts, reached from modules through `shared/engines.mjs`. New guards: `npm run check:modules` (resolvable imports, no cycles), an entry test that imports the real side-panel graph, a test pinning synchronous listener registration, and `check:package` now rejects an import the zip would leave out. Plan: [the migration plan](superpowers/plans/2026-10-20-es-modules-migration.md).

**[PR 9](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/9): cleanup**
- Moved the v0.14 and v0.15 release notes to `docs/archive/`.
- The service worker now logs failures from side-panel setup and closed-tab handling instead of swallowing them.

**[PR 7](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/7): quality gates and cleanup**
- ESLint runs in CI.
- A TypeScript check runs in CI as a ratchet; it went from 162 errors to zero, and any new error now fails.
- `npm run check:vendor` fails if a vendored library, the OCR model, or the notices drift from the locked packages.
- Only the side panel can use the coordinator, run, and connector messages.
- The page agent's injection list now comes from the manifest instead of a copy.
- Removed unused card helpers, stale script cache-busters, and escaped one unescaped attribute (with a hostile-input test).
- Added a documentation index and updated the contributor docs for the new checks.

**[PR 6](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/6): permissions, icons, and packaging**
- Built-in site access is limited to the Riverside WIC, IHSS, and BenefitsCal sites plus loopback. Other sites are requested when first used.
- Removed the unused `activeTab` permission.
- Added icons (placeholder design).
- `npm run check:package` keeps versions in sync across the manifest, `package.json`, and the lockfile, and checks that referenced files exist.
- `npm run package` builds a runtime-only release zip.

## Decisions recorded

- **Participant data comes from a database behind a login, not from Apricot or BenefitsCal.** Manual entry, test data and document upload need no login; only the directory does (October 21, 2026).
- **Sign-in is brokered by the Neon Function.** Neon Auth accepts only `http(s)` origins, so the extension never calls it directly (spike results in [the plan](JEV_EVE_ALIGNMENT_PLAN.md)).
- **No bundler yet.** The ES-module migration is no-build so testers can keep loading the repo folder. A bundler, TypeScript source, and a `dist/` layout are tracked in [TODO.md](TODO.md#build-and-layout).
- **Archive, don't delete.** Superseded results and notes stay in the repo for traceability; the [docs index](README.md) separates current from historical.
