# Working on the extension

Use **navapbc/benefit-form-assistant-chrome-extension** as the canonical repository. Start new work from its current `main`. The original personal repository is a historical mirror; do not develop the two copies independently.

## Before changing code

```sh
git switch main
git pull --ff-only
# Select the Node version in .nvmrc, for example: nvm use
npm ci --include=dev
npm run lint
npm run typecheck
npm run check
npm run check:package
npm run check:modules
npm run check:vendor
npm test
npm run eval:extraction
git switch -c fix/short-description
```

Keep each branch focused. Open a pull request against canonical `main`; explain the user-visible change, remaining limits, and relevant validation. Preserve failed test receipts. Do not mix model/API credentials, applicant records, raw site captures, or generated evaluation output into a commit.

## Checks before merging

GitHub's **Validate extension** job runs on pull requests and main pushes. It installs locked dependencies and runs these checks, all of which you can run locally with the same `npm run` names:

| Check | What it catches |
|---|---|
| `lint` | ESLint (`eslint:recommended`): undefined names, unused variables, useless escapes. |
| `typecheck` | TypeScript over the JavaScript, as a ratchet. `types/baseline.json` is empty, so any new type error fails. After fixing errors elsewhere, run `npm run typecheck -- --update`. |
| `check` | Syntax of every first-party script and a valid `manifest.json`. |
| `check:package` | The same version in `manifest.json`, `package.json`, and the lockfile; every file the manifest and side panel reference exists; icons are PNGs of their stated size. |
| `check:modules` | Every static import in the ES-module sources resolves, the import graph has no cycles, nothing awaits at top level in the worker or side-panel graph, and no module reads a `Nava*` global. A bad specifier would blank the whole side panel. |
| `check:vendor` | Every file under `vendor/` matches its locked npm package, the English OCR model matches its pinned SHA-256, and `THIRD_PARTY_NOTICES.md` names the installed versions. After a dependency bump, run `npm run ocr:assets` and update the notices. |
| `test` | The unit and integration suite. |
| `eval:extraction` | The synthetic document-extraction gate. |

The handoff documentation also has a local-file/anchor check (`npm run check:docs`). These checks use fictional data and do not call a model provider, submit applications, or establish live-site quality.

When resolving a conflict, test the combined result. The side panel and service worker are ES modules: add a module by importing it (from `sidepanel/main.mjs` or `background/service-worker.mjs`); there is no script tag or load order to keep in sync. Only the page agent (the manifest's content scripts) and the six shared files it needs (`form-purposes`, `participant-record`, `field-values`, `form-engine`, `site-adapters`, `captcha-engine`) are classic scripts, because Manifest V3 content scripts cannot be modules without a bundler. Their order matters and lives in `manifest.json`, whose list dynamic page injection also reads; ES modules reach them through `shared/engines.mjs`. Runtime selection, pairing, CAPTCHA, cancellation, queues, and source-value isolation have cross-module behavior tests.

Merge only the checked head. Use a merge commit for integration work that must preserve both histories; use a normal focused PR for follow-up fixes. Delete a remote feature branch after confirming its work is merged or deliberately superseded. Do not delete an unmerged branch merely because it is behind main.

## Tester handoff

After changing extension behavior, update `manifest.json`, `package.json`, and the root entries in `package-lock.json` together; `npm run check:package` fails if they differ. Record the source commit and tester version in the handoff. Reload the unpacked extension and refresh open form tabs; an existing Chrome install does not update just because GitHub changed.

Use the [tester guide](docs/TESTER_GUIDE.md) on the actual WIC, IHSS and BenefitsCal routes, plus feature checks from the [feature guide](docs/FEATURE_GUIDE.md). Publish live-site outcomes separately from unit tests, local practice forms and saved-field planning. A passing CI run is not an installed-browser or production certification.

`npm run package` writes `dist/nava-form-filling-assistant-<version>.zip` containing only the runtime files (not docs, tests, evaluation, or demo pages); `npm run icons` re-renders the icons from `icons/source/nava-logo.svg`. Host access is limited to the pilot sites and loopback; the extension asks for any other site when someone first uses it there.

There is no hosted deployment or Chrome Web Store release in this repository's CI. The extension is distributed as source for unpacked loading; its optional API service has its own repository and deployment lifecycle.
