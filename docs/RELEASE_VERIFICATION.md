# Release verification · 0.12.0

October 6, 2026. Source history starts at `0a015b446a709095c9f0ebac9638f483cc67f8a1`. The original checkout's concurrent uncommitted model-performance edits were not copied into this release.

- JavaScript/manifest checks: passed (`npm run check`).
- Existing extension suite: 161 passed, zero failures (`npm test`, Node 24).
- Controlled evaluation scorer and Jev-policy checks: 11 passed, zero failures.
- Release README, writeup, tester/access guides: local links resolve. Copied evaluation files were checked for common API-token patterns; no matches were found.
- Interface preview: fictional JSON import, application selection, dashboard/review navigation, and keyboard expansion/collapse of safeguards checked at a 390 × 780 viewport. This mode simulates model and page operations.
- Version: manifest, package, and lockfile agree on 0.12.0. The extension's required scripts, OCR assets, fixture, and demo video are included.
- Public release: branches directly from the already-public prototype. New raw live-site audits, role-call receipts, workflow identifiers, applicant screenshots, the full embedded evidence report, and four separate private-API source snapshots are excluded. Public result tables use explicit field whitelists. Fresh inference output is ignored by Git. See [release scope](PUBLIC_RELEASE_SCOPE.md).

**Installed Chrome verification remains pending.** The opened Chrome side panel still displayed the older interface and footer, so the Nava release has not yet been verified as loaded. Browser control cannot open `chrome://extensions` in this session. Preview success and automated tests do not prove installed extension operation, Nano availability, or live government-site completion. Load the Nava package using the README and record an installed run.

**Jev verification remains pending.** The TypeSafe organization dashboard now shows an active test key, but its secret is not available to the benchmark process. The user must provision it through an approved protected local mechanism. Missing-key behavior is tested; no Jev performance score or cost has been recorded.

![Cleaned home screen · simulated preview](assets/nava-extension-clean-home.jpg)
