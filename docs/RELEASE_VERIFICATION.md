# Release verification · 0.13.0

Updated October 7, 2026. Source history starts at `0a015b446a709095c9f0ebac9638f483cc67f8a1`. The original checkout's concurrent uncommitted model-performance edits were not copied into this release.

- JavaScript/manifest checks: passed (`npm run check`).
- Existing extension suite: 167 passed, zero failures (`npm test`, Node 24).
- Controlled evaluation scorer and Jev-policy checks: 11 passed, zero failures.
- Release README, writeup, tester/access guides: local links resolve. Copied evaluation files were checked for common API-token patterns; no matches were found.
- Interface preview: fictional JSON import, application selection, dashboard/review navigation, and keyboard expansion/collapse of safeguards checked at a 390 × 780 viewport. This mode simulates model and page operations.
- Version: manifest, package, and lockfile agree on 0.13.0. The extension's required scripts, OCR assets, fixture, and demo video are included.
- Public release: branches directly from the already-public prototype. New raw live-site audits, role-call receipts, workflow identifiers, applicant screenshots, the full embedded evidence report, and four separate private-API source snapshots are excluded. Public result tables use explicit field whitelists. Fresh inference output is ignored by Git. See [release scope](PUBLIC_RELEASE_SCOPE.md).

**Installed Chrome verification remains pending.** The opened Chrome side panel still displayed the older interface and footer, so the Nava release has not yet been verified as loaded. Browser control cannot open `chrome://extensions` in this session. Preview success and automated tests do not prove installed extension operation, Nano availability, or live government-site completion. Load the Nava package using the README and record an installed run.

**Jev API verification completed October 7.** Six authenticated requests returned `jev-1.13.0`, four scored planning passes, no HTTP failures and no operator repairs. Both IHSS plans missed a required question after low-confidence deferral. All confidence-threshold replays are retained; billed charges and browser execution remain unmeasured. Public ledgers contain an explicit metric whitelist, and no credential or raw provider response. The API pilot does not verify an installed Jev extension backbone.

**Repository home page:** the renamed public repository now presents the measured quality/speed/cost scorecard, Jev bars, expandable WIC/IHSS charts, and direct links to detailed findings and complete attempt tables.

![Cleaned home screen · simulated preview](assets/nava-extension-clean-home.jpg)

**Jev extension integration:** v0.13 includes a selectable local-companion runtime and hidden-input launcher. Twelve additional authenticated requests exercised the actual extension planner: initial batch 4/6 passes, current prompt 3/6. Both batches are retained. Required deferrals now surface as questions; installed Chrome remains pending.

**Home-page coverage:** Nano live scores before assistance, all six playbook experiments including invalid JSON, and the model/reasoning CAPTCHA matrix are now visible directly under Test results.
