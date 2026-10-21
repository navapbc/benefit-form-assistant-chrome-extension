# Adding your own site or program

The extension ships configured for the California sites it was tested on (Riverside WIC, Riverside IHSS and BenefitsCal). To point it at a different benefit application, change the files below. Each is small and independent, so you can start with the first two and add the rest as you learn what the site needs.

## 1. Allow the site in the manifest (required)

In `manifest.json`, add the site's origin to **both** lists:

- `host_permissions`, so the side panel can read and fill the page.
- `content_scripts[0].matches`, so the page agent is injected.

Narrow patterns are better than broad ones: `https://apply.example.gov/*`, not `https://*/*`. The manifest also lists `optional_host_permissions` (`http://*/*`, `https://*/*`) so Chrome can prompt the user for a site you did not list. Delete that block if your deployment should only ever touch the sites you name.

Remove the sites you do not use. Every host you keep is access you have to justify in a privacy review or a Chrome Web Store listing.

## 2. Register the program (required for multi-application runs)

`shared/program-catalog.mjs` lists the programs a caseworker can select. Add an entry:

```js
{
  id: 'example-snap',            // unique, stable
  name: 'SNAP',                  // shown in the panel
  provider: 'Example County',
  workflowId: 'example-county',  // programs on one site's single application share a workflowId
  url: 'https://apply.example.gov/start',
  allowedOrigins: ['https://apply.example.gov'],
  allowedPathPrefixes: ['/start'],
}
```

`allowedOrigins` and `allowedPathPrefixes` bound where a run may navigate. Keep them as tight as the application allows.

## 3. Add a site playbook (recommended)

Without one the page agent reports the site as "cold" and works from a fresh field scan, so this step is optional but improves reliability.

`content/navigation-gate.js` holds `PLAYBOOKS`, keyed by hostname. An entry names the site, lists `probes` (selectors that identify the application page), and says whether the agent may press obvious continue buttons (`autoAdvance`, with `safeAdvanceSelectors` or `safeAdvanceRules` limiting which). Start with `autoAdvance: false` and widen it only after you have watched real runs. The gate always stops for CAPTCHAs, one-time codes, certification, signature and final submission; do not weaken that.

## 4. Add field rules (optional)

`shared/site-adapters.js` maps a site's field IDs to the extension's field purposes (`fullName`, `dateOfBirth`, `addressLine1`, and so on, defined in `shared/form-purposes.js`). The generic planner can infer many fields without it, so write rules only where inference gets a field wrong or must be forced to a question. Add a policy function like `wicPolicy` and route to it from `fieldPolicy(hostname, pathname, field)`.

Be aware that the side panel currently passes `siteAdapters: null` to the planner (`sidepanel/page-scan.mjs`), so these rules are used by the evaluation harness but not by the panel's planner. See the open item in [TODO.md](TODO.md#security-and-privacy) before relying on them.

## 5. Test it

- Use fictional records only. Never test with a real applicant's data, and never submit a real application.
- Add a local fixture page under `demo/fixtures/` for regression checks, and add tests under `tests/`. A fixture passing is not evidence the live site works.
- Run `npm run lint`, `npm run check`, `npm test`, then load the folder unpacked and watch a real run end to end. [TESTER_GUIDE.md](TESTER_GUIDE.md) describes what to record.

## Known limits that affect a new site

- Forms inside iframes are not covered (`all_frames` is `false`).
- Document uploads, repeating household-member sections, account creation and save-and-return are not general features.
- The Participant directory and any data connector are separate from this step; see [participant-api/README.md](../participant-api/README.md).
