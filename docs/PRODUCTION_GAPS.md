# Extension gaps and engineering handoff

Assessed October 19, 2026 against `main` commit
`d89d2aefb90a770357148f750d3e80c28aeef11b` (v0.15.0).

This source and existing-evidence assessment supports testing, design, and
production hardening. It does not certify a deployment or replace an installed
browser test. The immediate target should be a repeatable synthetic-data
demonstration through review, with explicit limitations. Production use needs
the additional integration and approval gates below.

## Start here

1. Run the local setup below and retain two installed fixture attempts.
2. Record correctness, missing answers, assistance, and recovery using the
   [tester template](TESTER_GUIDE.md#record-each-attempt).
3. Agree on one supported application route, runtime, and source before expanding
   scope. Riverside-specific rules do not establish another jurisdiction's support.
4. Address the gateway configuration boundary and select a managed integration
   design before using organization credentials or real participant data.

## What runs where today

There is **no SQL database or production Apricot adapter in this repository**.
The mock connector holds fictional records in JavaScript objects in a local
Node process. A database service alone would not supply organization
authentication, provider access, or a production connector.

| Component | Current implementation | Boundary / missing piece |
|---|---|---|
| Chrome side panel | Intake, review, planning, questions, and up to three tab-bound runs in `sidepanel/sidepanel.js` | Keep the side panel open during a run. No unattended server job. |
| Page executor | `content/form-agent.js`, `shared/form-engine.js`, exact rules in `shared/site-adapters.js` | Top-document scan; unsupported frames, widgets, and entity scopes need help. Readback proves persistence, not semantic correctness. |
| Background worker | `background.js` brokers connector requests, session claims, application leases, and queue persistence | Same Chrome profile coordination; not authenticated cross-device assignment. |
| Participant data | `chrome.storage.session` holds the client record and working answers | Restart/reload requires reloading the authorized source record. No server participant database is bundled. |
| Durable state | `chrome.storage.local` holds sanitized queue metadata, connector descriptor/schema/mappings, and coordination state | It also holds the optional **planner tenant token**; see the distinct gateway boundary below. |
| Connector | Read-only credentialed `GET` to a configured service; fictional mock binds to `127.0.0.1:4789` | Only an Apricot-shaped fixture is runnable. Other catalog providers need authorized backend adapters. |
| Documents | Bundled PDF.js, Tesseract, and fflate run locally; proposals require review | Bounded files/pages and English OCR, not general document understanding. |
| Local models | Nano in Chrome; paired Codex/Claude/Jev through loopback Node companion | CLI accounts or a TypeSafe test credential are development prerequisites, not an organization model deployment. |
| Optional shared planner | Redacted inventory goes to `POST /v1/plan` | API implementation, hosting, tenant controls, and operational evidence are outside this repo. Saved API settings supersede non-Jev local planning. |
| Optional participant link | `mintClientLink()` calls `/v1/households`, `/v1/applications`, and the application's `/share` endpoint | Sends program/question metadata and an opaque reference rather than the record. Access, expiry, answer return, and retention need full API validation. |
| Recertification | Caseload lookup, readiness checklist, outreach drafts, session-only authorization | No automatic email/SMS, server scheduler, or durable authorization service. |

### Data and credential flow

- Connector: browser → configured organization service → provider adapter. The
  last step is **not implemented** by the mock. Provider secrets belong in the
  service. Connector sanitization rejects secrets and requires HTTPS outside
  loopback; requests have a 12-second timeout.
- Planner: source values are removed before bounded field descriptions, options,
  domain, and source-purpose names reach the model. Returned mappings are checked
  locally before values are resolved and written. Form metadata still deserves
  privacy review.
- Nano/Codex/Claude use mapper, gap-analyst, and independent-review roles. Jev
  uses confidence 0.90, source/scope checks, one bounded retry, exact WIC rules,
  and verified reuse; it has **no independent AI reviewer**.
- Companion pairing tokens are session-only. Provider credentials stay in the
  CLI/process. The API tenant bearer token is separate and currently persists
  under `navaApiToken` in local storage.
- CAPTCHA is human by default. Explicit opt-in enables an experimental bounded
  native attempt; its image path may send a cropped challenge to the selected
  image runtime. This is not reliable live-image-solving evidence. OTP remains
  human-only.
- Certification, signature, attestation, and final submission remain human.
  Tests must stop before any official submission.

Sources: [connector requests](../background.js),
[connector validation](../shared/connector-engine.js),
[planner/gateway](../shared/agentic-planner.js),
[setup/link actions](../sidepanel/sidepanel.js),
[model boundaries](MODEL_PROVIDERS.md),
[queue privacy](WORK_QUEUE_SECURITY_AND_RECOVERY.md).

## Evidence and unresolved questions

| Evidence | Observed result | Remaining question |
|---|---|---|
| v0.15 controlled Jev recovery | 10/12 safe frozen-inventory cases; both CalFresh diagnostic repeats fail | Housing transformation and county confidence remain unresolved; not a complete CalFresh journey. |
| v0.15 WIC browser fixture | 8/8 safe synthetic trials; complete records reach review, incomplete records ask expected questions | Scanner/filler plus real Jev on local DOM, **not installed extension or live government site**. No CAPTCHA appeared. |
| Earlier installed v0.14 WIC | 0/4 correct completions across Nano/Jev/Codex | Re-run installed v0.15 after reload to verify address/conditional fixes and retained safeguards. |
| Automated baseline, October 19 | `npm run check` passed; `npm test` passed 210/210 on Node 20.19.6 | Does not establish runtime availability, browser permissions, live correctness, or production isolation. |
| API unit coverage | Mocked redacted request and rejection of unsupported mappings | No deployed API, login, tenant isolation, participant-link lifecycle, or billed cost verified here. |

Receipts: [v0.15 recovery](JEV_RECOVERY_V015.md),
[installed v0.14](INSTALLED_V014_BATCH.md),
[error reproduction catalog](BENCHMARK_ERRORS.md).
Older [production evidence](PRODUCTION_READINESS.md) and
[release verification](RELEASE_VERIFICATION.md) describe earlier versions;
their test counts and some CAPTCHA statements are historical.

## Prioritized hardening work

These are proposed completion gates, not completed work. Track ownership in the
project tracker. Order reflects dependencies.

| Priority / work | Concrete gap | Observable completion |
|---|---|---|
| **First: installed baseline** | Latest installed batch is v0.14; v0.15 success is fixture evidence. | Fresh profile loads exact version. Two complete and two incomplete synthetic fixture attempts retain receipts. Check every answer's meaning, expected missing questions, and untouched certification/Submit. Then exercise the selected sanctioned site route, keeping failed attempts. |
| **First: API endpoint/token boundary** | `save-planner` accepts `new URL(base).origin` without HTTPS/approved-host enforcement; `gatewayConfig()` trusts it. Tenant token persists locally. Gateway/share fetches have no explicit timeout. | Reject non-HTTPS external and unapproved origins; explicit loopback development mode only. Define token scope, expiry, rotation/revocation, sign-out/removal, and storage choice. Add timeout/cancellation and safe errors. Verify using fake tokens and controlled endpoints. |
| **First: explicit runtime selection** | Saved API settings supersede non-Jev choices; Jev branches separately. Developer accounts are not a managed model deployment. | Show effective runtime, endpoint class, model/unknown identity before running. Switching/disconnecting deliberately changes precedence. Expired/unavailable credentials fail visibly without writes. Record one approved demo configuration and fallback. |
| **Before participant data: real connector** | Catalog entries and mock do not establish provider access; production service is absent. | Approved sandbox adapter implements health/schema/record lookup (caseload if needed), organization/user and connection authorization, read-only scopes, server secret custody, extension CORS, revocation, mapping/schema/freshness/pagination/rate-limit handling. Validate with synthetic records. |
| **Before participant data: managed service design** | No chosen Nava environment, organization login, cross-device backend, or runbook is supplied. | Record deployment owner, approved hosting/data location, identity/isolation, secrets, retention/deletion, audit fields, backups if needed, incident response, and spend/request limits. Demonstrate denied cross-tenant access and revocation. Select a database for a defined persistence need. |
| **Before pilot: permissions/release** | Manifest injects on all HTTP/HTTPS hosts; unpacked loading/reload is current distribution. | Define approved application/connector domains and least-privilege permissions, including redirects. Verify reproducible package, extension ID/version, upgrade recovery, distribution, rollback, and browser policy on test devices. |
| **Before pilot: lifecycle/concurrency** | Panel must stay open; handoff is one-profile only; existing docs leave two-panel Chrome validation pending. | Verify panel close/reopen, tab loss/navigation, reload/restart, source expiry/replacement, and two-panel contention. No stale write after revocation. Label local ownership; scope cross-device work separately if required. |
| **Before site claims: route/answer coverage** | Riverside-specific adapters; incomplete evidence for CalFresh semantics, household repeaters, uploads, address validation, and save/return. | Maintain route/scenario support matrix. Count correct/wrong/missing/inapplicable answers and interventions. Unsupported fields give useful handoff. Scanning/readback alone does not establish application support. |
| **Before participant links: API lifecycle** | Browser can create/share questions; hosted access, expiry/revocation, response sync, retention are unverified here. | Synthetic-household checks prove organization access, least-privilege link scope, expiry/revocation, authorized answer return, no cross-household access, and deletion. Document what is transmitted/stored. |
| **Before broader release: accessibility/design** | Intake, runtime details, questions, queue, handoff, recertification accumulated; tests do not establish task usability. | Keyboard/screen-reader and narrow-panel walkthroughs cover source review, wrong-client prevention, runtime, progress, missing answers, pause/resume, and final review with representative staff. |
| **Before scaling: operations/costs** | Estimates exclude infrastructure, plan allocation, support, failed retries, and successful-application cost. | Retain cold/warm journey time, retries, assistance, usage, known charges/unknown costs per attempt. Configure budgets, rate limits, and value/credential-free debug export. |

GCP can be an integration target if approved for this product; the repo does not
demonstrate a deployed GCP service. Supabase or Neon could address a future
persistence need, but neither supplies the connector/gateway/identity work.
This handoff makes no hosting/database choice or production rollout.

## Practical local tester setup

Use fictional records and the canonical Nava repo. The basic fixture needs no
production database, paid provider API key, or shared API.

Prerequisites: Git, Python 3, desktop Chrome 138+ (manifest minimum), and Node/npm
for checks, mock connector, or companion. Use Node 24 for the documented Jev
path. Nano needs supported Chrome Prompt API hardware and a model download;
the Chrome version alone does not guarantee availability.

```bash
git clone https://github.com/navapbc/benefit-form-assistant-chrome-extension.git
cd benefit-form-assistant-chrome-extension
git rev-parse HEAD
node --version
npm run check
npm test
python3 -m http.server 4173 --bind 127.0.0.1
```

`npm ci` supplies extraction-evaluation dependencies. Loading the extension and
serving its vendored assets do not require regenerating OCR assets.

1. In `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
   and select the cloned folder. Confirm **0.15.0**. Refresh forms already open
   before installing/reloading.
2. Open `http://127.0.0.1:4173/demo/extensive-application.html?step=1&reset=1`
   and click the extension icon. Select Nano and **Enable agentic AI**; if
   unavailable, use the paired CLI option below. Keep the panel open.
3. Choose **Paste client JSON → Use a fictional sample record → Continue**,
   then **Analyze this form**. Review source values and continue through review.
   Inspect every answer/question and the certification/Submit boundary.
4. Export a reviewed activity log, fill in the tester record, repeat from reset,
   and test recovery. A regular-page preview simulates operations and does not
   count as an installed test.

Use a fresh Chrome profile if prior testing saved a shared API endpoint/token:
those settings can take precedence over the local baseline. Never put provider
API credentials in Chrome.

### Optional paired CLI

Sign in through the intended subscription CLI (`codex login` or
`claude auth login`). In another terminal in the repository:

```bash
npm run model:bridge
```

Choose that runtime, use `http://127.0.0.1:4174`, and paste the printed **local
pairing token**. Keep the terminal open; omit tokens from findings/screenshots.
For Jev, follow the [protected setup](../model-bridge/README.md#jev-in-the-chrome-extension--v013).

### Optional fictional connector

In another terminal in the repository:

```bash
npm run connector:mock
```

Choose **Connect an organization database** → **Bonterra Apricot 360**:

```text
Organization: Riverside Community Services
Service URL: http://127.0.0.1:4789
Connection ID: nava-demo
Form / resource key: 99
Fictional record ID: 339619
```

Test the connection, review labeled mappings, retrieve the record, and confirm
the preview. The mock needs no Apricot account and must remain local. End the
client session and stop the server/connector/companion terminals when finished.

## Design review tasks

- Clarify the primary route: load source → choose application → answer gaps →
  inspect progress → review. Separate configuration from daily tasks while
  showing the effective runtime and source.
- Distinguish **value verified**, **answer correct**, **needs a person**, and
  **ready for final human review**. A persisted write is not an application score.
- Test first-run download/connection, wrong-client and freshness cues,
  conflicting document values, empty/long question sets, errors, lost tabs,
  narrow panels, keyboard focus, and screen reader output.
- Keep pause and final human-action controls visible. Label recertification,
  links, handoff, and CAPTCHA according to their tested scope.

## Assessment verification

- Inspected canonical v0.15 source, manifest, setup guides, retained receipts.
- Reproduced `npm run check` and **210/210 tests**, Node 20.19.6.
- Extraction evaluation was not reproduced: clean checkout lacked dev dependency
  `@napi-rs/canvas`. Existing extraction scores are historical, not a new run.
- This documentation assessment did not exercise installed Chrome, provider
  inference, a production connector, shared API/link, live application, or real
  participant data.
