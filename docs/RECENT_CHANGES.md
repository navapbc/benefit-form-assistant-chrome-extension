# Recent engineering changes

High-level notes on what changed in the extension's code and tooling, newest first. For tester-facing release notes see [RELEASE_NOTES_v0.16.md](RELEASE_NOTES_v0.16.md); for what is still to do see [TODO.md](TODO.md). The extension's version is still 0.16.0; these changes did not alter form-filling behavior.

## October 20, 2026

**In progress: ES modules** (branch `refactor/es-modules`). Replacing the side panel's 40 hand-ordered script tags and the service worker's global lookups with real `import`s, with no build step. The page agent stays classic for now. Plan: [the migration plan](superpowers/plans/2026-10-20-es-modules-migration.md).

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

- **No bundler yet.** The ES-module migration is no-build so testers can keep loading the repo folder. A bundler, TypeScript source, and a `dist/` layout are tracked in [TODO.md](TODO.md#build-and-layout).
- **Archive, don't delete.** Superseded results and notes stay in the repo for traceability; the [docs index](README.md) separates current from historical.
