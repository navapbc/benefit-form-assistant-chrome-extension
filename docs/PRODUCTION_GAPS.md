# Testing and engineering review plan

Updated October 19, 2026 · consolidated tester build **v0.16.0**.

This build combines the legacy module/refactor work with the newer Jev, CAPTCHA, and shared-planner hardening work. Historical test evidence below keeps its original version labels.

This is the engineering handoff for testing the browser extension on the real Riverside pilot routes and deciding what to fix next. Start with the [tester guide](TESTER_GUIDE.md) for installation and a first WIC attempt. The plan covers Nano, Codex, Claude, Jev, and any separately configured API—not just Jev.

**The next quality gate is a correct real-site journey through final review without help.** We have already done substantial local and captured-form testing. Use those tests to reproduce failures and prevent regressions; use real WIC, IHSS, and BenefitsCal routes to judge whether the product works. Use fictional records and stop before certification or official submission.

## What the evidence says today

- **The consolidated v0.16 build has no retained complete installed live-site batch.** Earlier v0.15 also had no such batch. Its Jev recovery tests passed eight local WIC browser-fixture trials and ten of twelve captured-form planning cases. Both CalFresh diagnostic repeats still failed. Those are useful fix checks, not proof of a government application working.
- **The latest installed live WIC batch, October 9 on v0.14, correctly completed zero of four attempts** across Nano, Jev, and Codex. Address completeness, unnecessary questions, and conditional answers prevented a correct completion. Re-test those defects on the installed current version.
- **CAPTCHA can still block autonomy.** On October 9 the extension accepted two of three live WIC checkbox attempts after viewport help. No image challenge was solved in those native attempts; no correctly completed application followed. Earlier cross-runtime successes used a separate browser-control tool and cannot stand in for the extension doing it itself.
- **Coverage differs by approach.** Nano and Codex have live WIC/BenefitsCal evidence; IHSS includes historical partial-field runs. Jev has installed WIC and controlled tests. Eve has separate planning and CAPTCHA experiments. Claude is selectable, but a comparable retained live-site batch is missing. A missing result is **not tested**, not a failure or a pass.

Start with [the current cross-approach results](TEST_RESULTS.md). Detailed receipts: [installed live WIC runs](INSTALLED_V014_BATCH.md), [v0.15 fix checks](JEV_RECOVERY_V015.md), [live and controlled site findings](BENEFIT_SITE_EVALUATION.md), [CAPTCHA attempts](CAPTCHA_OCT9.md), [exact errors and run provenance](BENCHMARK_ERRORS.md).

## 1. Establish the real-site baseline

Install a clean current checkout, record the commit/version and effective runtime, and follow the [tester guide](TESTER_GUIDE.md#2-try-a-real-form-riverside-wic). Keep the first attempt and any assisted follow-up separately.

Start with Riverside WIC, then Riverside IHSS and BenefitsCal. CalFresh, Medi-Cal, and CalWORKs share the BenefitsCal application; record the selected programs, county, and exact route. Do not generalize a Riverside WIC result to another county's WIC form or a CalFresh diagnostic to all of BenefitsCal.

For each available form-filling approach, repeat the same complete-record scenario twice before comparing it. Also try an incomplete record to check whether the extension asks the right questions. This is an initial baseline, not enough trials to estimate reliability.

**A complete-record journey passes only when:**

- [ ] Every applicable answer is correct and all required answers are present.
- [ ] The extension navigates to final review without answer repairs, manual navigation, resets, or another browser-control tool.
- [ ] Any encountered CAPTCHA is accepted and the form continues without help after the initial test authorization.
- [ ] Certification, signature, and Submit remain untouched.
- [ ] The receipt records site, date, exact build, form/image runtimes, every intervention, and elapsed journey time.

If an account, one-time code, unsupported control, or submission boundary prevents completing the test, report the last verified step and the blocker. It does not count as a completed application. For an incomplete record, evaluate correct questions and safe resumption separately.

## 2. Fix the first blockers to autonomous progress

Use the live receipts to choose the next change. Avoid more aggregate scores that hide the failed question or page.

| Work | Observable completion |
|---|---|
| **Correct answers and complete pages** | Full addresses, conditional questions, housing/county transformations, required IHSS decisions, household repeaters, and uploads behave correctly on the tested real route. Unknown answers become useful questions. No silent omissions or irrelevant questions prevent progress. |
| **CAPTCHA and continuation** | Report a plain Yes/No for checkbox acceptance, image acceptance if encountered, and unassisted continuation. An accepted checkbox alone is insufficient. Native live-image solving remains an evidence gap; saved-image classification and external browser-relay trials are supporting diagnostics. |
| **One working application, then several** | First demonstrate each route alone. Then run WIC, IHSS, and one combined BenefitsCal application together without record/answer mixing, lost progress, duplicate writes, or a person rescuing each CAPTCHA. Record remaining human checkpoints explicitly. |
| **Recovery and cancellation** | Pause, panel close/reopen, tab loss/navigation, runtime failure, source replacement/expiry, and restart produce clear, recoverable states. A cancelled or revoked run never writes later. Verify two panels cannot take conflicting control. |
| **Visible effective runtime** | Before starting, testers can tell which form runtime and image runtime will actually run. A saved shared API must not silently invalidate a Nano/Codex/Claude comparison. Unavailable/expired credentials fail clearly without writes. |

CAPTCHA attempts are bounded and experimental. Unsupported or rejected challenges should remain visible blockers; do not relabel them as successful handoffs when reporting autonomy. The current product still reserves certification and submission for a person. Any broader submission automation would require a separate product decision and implementation.

## 3. Make the handoff understandable

Jillian's design pass should follow the same real-site task rather than a separate mock-only tour.

- Can a new tester install it, choose a working runtime, load the right fictional record, and start WIC?
- Is it clear what is running, which application needs attention, and what the person must do next?
- Are **written value verified**, **answer correct**, **needs help**, and **ready for human review** distinguishable?
- Do questions, errors, Pause, and review controls remain usable with the keyboard, a screen reader, and a narrow panel?
- Can the tester recover from a lost tab, a slow model, or a wrong source without starting over or using stale data?

Keep setup trouble, product usability, and answer correctness visible in the findings. A confusing setup is a product issue even when the code passes unit tests.

## 4. Resolve the deployment boundary before a participant-data pilot

Public-site testing with fictional records does not require a production database. A pilot with real participant data does require the following work.

- **Planner endpoint and token:** enforce the allowed HTTPS service boundary; define token scope, storage, expiry, rotation, revocation, and sign-out. Add bounded requests, cancellation, and safe errors.
- **Real connector and organization access:** implement the authorized provider adapter, read-only scopes, user/organization permissions, server-side secret custody, schema/freshness handling, and revocation. A database catalog entry is not a working integration.
- **Managed service and release:** choose the actual deployment owner/environment, identity and tenant isolation, retention/deletion, audit and incident response, budgets, approved application domains, distribution, upgrade, and rollback.
- **Participant links, if included:** prove correct-household access, expiry/revocation, authorized answer return, and deletion. The browser's ability to request a link does not prove the hosted lifecycle works.

[Hardening PR #2](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/2) is merged: it adds HTTPS/explicit-loopback validation, origin-bound token reuse, disconnect cleanup, 30-second request timeouts/cancellation, safe errors, and effective runtime labeling. These safeguards are retained in the consolidated modules. Approved-host policy, organization identity, token lifecycle, and hosted deployment still need decisions and evidence.

## Technical appendix

Use this when investigating a failure or planning an integration. It is not required reading for a first design test.

### Approaches and execution

| Approach | Current role |
|---|---|
| Nano, Codex CLI, Claude CLI | Selectable form planners using separate mapper, missing-answer, and reviewer calls. Nano runs in Chrome; CLIs run through a paired local Node companion. |
| Jev | Selectable `jev-1.13.0` choice classifier with confidence 0.90, local source/scope checks, one bounded retry, exact WIC rules, and verified reuse. No independent AI reviewer or configurable reasoning setting. |
| Eve | Separate form-planning harness; not selectable as the extension's form planner. Optional CAPTCHA image classifier through the companion. |
| Shared planner API | Optional `POST /v1/plan` service route. Saved API settings supersede non-Jev local planning. Hosting and the API implementation are outside this repo. |
| Page execution | The extension scans/fills the top document and follows approved navigation. The side panel must remain open. Up to three tab-bound runs are coordinated within one Chrome profile; this is not an unattended server job. |

Nano/Codex/Claude and Jev use different planning contracts, prompts, and recovery paths. Compare the whole product configuration on the same task; do not interpret a planning-call speed difference as a completed-application speed advantage. Record unknown model identity and missing costs as unknown.

### Data, storage, and credentials

There is **no SQL database or production Apricot adapter bundled here**. The runnable connector is an Apricot-shaped fixture with fictional records held in a local Node process on `127.0.0.1:4789`. Other catalog providers need backend adapters. Supabase, Neon, or GCP alone would not supply provider access or organization authorization.

- **Participant values and working answers:** `chrome.storage.session`; values must be reloaded after the browser session expires. Queue metadata, connector schema/mappings, and coordination state persist in `chrome.storage.local`.
- **Model planning:** source values are removed before bounded form descriptions, choices, domain, and source-purpose names reach the planner. Local checks validate returned mappings before resolving values and writing. Metadata still needs privacy review.
- **Local companion:** pairing tokens are session-only; provider credentials remain in the CLI/process. Keep the companion loopback-only. [Setup and boundaries](../model-bridge/README.md).
- **Shared planner:** its tenant bearer token is separate from the pairing token and currently persists locally as `navaApiToken`. URL validation requires HTTPS outside explicitly enabled loopback development; changing the API origin cannot silently reuse the old key, disconnect removes it, and planner/share calls are cancellable with a 30-second limit. Approved-host policy and full token lifecycle remain open. Use a fresh profile with the API unconfigured for local comparisons.
- **Connector:** read-only requests go from the browser to the configured organization service, which must implement provider access. Validation requires HTTPS outside loopback and rejects secrets; requests have a 12-second timeout. The mock does not implement a real provider connection.
- **Participant links:** requests to `/v1/households`, `/v1/applications`, and `/share` send program/question metadata and an opaque reference, rather than the participant record. Hosted permissions, return, expiry, and retention remain unverified here.
- **Documents:** bundled local parsing/OCR proposes bounded fields for human review; it is not general document understanding. [OCR limits](OCR_SECURITY_AND_LIMITS.md).
- **CAPTCHA:** human by default; an explicit bounded opt-in enables recognized native attempts. The image path may send a cropped challenge to its selected runtime. One-time codes remain human. Certification and submission remain human checkpoints.

Source: [page executor](../content/form-agent.js), [site rules](../shared/site-adapters.js), [planner/gateway](../shared/agentic-planner.mjs), [side panel](../sidepanel/main.mjs), [connector validation](../shared/connector-engine.mjs), [background coordination](../background.js), [queue recovery](WORK_QUEUE_SECURITY_AND_RECOVERY.md).

### Checks and evidence boundaries

The earlier October 19 source assessment reproduced `npm run check` and **210/210 tests** on the v0.15 baseline. The consolidated build now uses the pinned Node version and full checks in [CI](https://github.com/navapbc/benefit-form-assistant-chrome-extension/blob/main/.github/workflows/ci.yml), including the installed development dependencies and local extraction gate. CI does not run live provider inference, a real connector, hosted API/link, or a government application journey.

Engineering checks from the repository root:

```bash
npm run check
npm test
```

Use the [local fixture](TESTER_GUIDE.md#additional-engineering-checks) for a fast setup check or a focused regression. Use the retained [error catalog](BENCHMARK_ERRORS.md) to reproduce known defects. Keep real-site attempts as the primary evidence for product quality. Older [production](archive/PRODUCTION_READINESS.md) and [release](archive/RELEASE_VERIFICATION.md) reports describe earlier builds; their counts are historical.
