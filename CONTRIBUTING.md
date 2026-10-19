# Working on the extension

Use **navapbc/benefit-form-assistant-chrome-extension** as the canonical repository. Start new work from its current `main`. The original personal repository is a historical mirror; do not develop the two copies independently.

## Before changing code

```sh
git switch main
git pull --ff-only
# Select the Node version in .nvmrc, for example: nvm use
npm ci --include=dev
npm run check
npm test
npm run eval:extraction
git switch -c fix/short-description
```

Keep each branch focused. Open a pull request against canonical `main`; explain the user-visible change, remaining limits, and relevant validation. Preserve failed test receipts. Do not mix model/API credentials, applicant records, raw site captures, or generated evaluation output into a commit.

## Checks before merging

GitHub's **Validate extension** job runs on pull requests and main pushes. It installs locked dependencies and runs source/manifest checks, the unit/integration suite, and the synthetic document-extraction gate. The handoff documentation also has a local-file/anchor check. These checks use fictional data and do not call a model provider, submit applications, or establish live-site quality.

When resolving a conflict, test the combined result. In particular, keep the module load order consistent in `manifest.json`, `background.js`, `sidepanel/index.html`, dynamic page injection, and test fixtures. Runtime selection, pairing, CAPTCHA, cancellation, queues, and source-value isolation have cross-module behavior tests.

Merge only the checked head. Use a merge commit for integration work that must preserve both histories; use a normal focused PR for follow-up fixes. Delete a remote feature branch after confirming its work is merged or deliberately superseded. Do not delete an unmerged branch merely because it is behind main.

## Tester handoff

After changing extension behavior, update `manifest.json`, `package.json`, and the root entries in `package-lock.json` together. Record the source commit and tester version in the handoff. Reload the unpacked extension and refresh open form tabs; an existing Chrome install does not update just because GitHub changed.

Use the [tester guide](docs/TESTER_GUIDE.md) on the actual WIC, IHSS and BenefitsCal routes, plus feature checks from the [feature guide](docs/FEATURE_GUIDE.md). Publish live-site outcomes separately from unit tests, local practice forms and saved-field planning. A passing CI run is not an installed-browser or production certification.

There is no hosted deployment or Chrome Web Store release in this repository's CI. The extension is distributed as source for unpacked loading; its optional API service has its own repository and deployment lifecycle.
