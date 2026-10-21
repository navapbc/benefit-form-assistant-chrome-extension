# Eve / Jev alignment with navapbc/ai-chatbot

Date: 2026-10-21 · Status: proposal, nothing implemented

This compares how the original application (`navapbc/ai-chatbot`, **`develop` branch only**) uses Eve and Jev with what this extension does today, then proposes what to adopt. It is based on reading the files named below. I did not run the upstream app, and I did not read its stream adapter, live-view store, browser skill files, `evals/online/apply.ts`, or the remaining spec/plan documents.

## 1. What the original app does

### Jev (TypeSafe System One) — `lib/jev/*`, `agent/lib/jev.ts`, `evals/`

| Practice | Where | Why it matters |
|---|---|---|
| **Questions live in code, never composed at runtime.** Three question sets: `gap-triage`, `summary-check`, `field-value`. | `lib/jev/questions.ts` | Fixed wording can be reviewed, diffed and regression-scored. |
| **Annotate-only.** Jev adds a `jev` object (verdict, confidence, full probability distribution) to a row the agent already produced; it never drops or rewrites a row. | `lib/jev/enrich.ts` | No threshold is acted on until one is chosen from observed data. |
| **Total, never-throwing client.** `askJev` returns `{ok:true, answers, model, usage}` or `{ok:false, reason}`. 5 s per-attempt timeout, tool abort signal honored, concurrency capped at 6. | `lib/jev/client.ts`, `enrich.ts` | A form run never blocks on TypeSafe. |
| **Per-feature flag, fail closed.** `JEV_FEATURES=gap-triage,summary-check,…`; a missing `TYPESAFE_API_KEY` means off. A terraform default of `"all"` once turned every feature on in prod on promotion and was reset to `""`. | `client.ts`, change doc 2026-09-22 | Default-off is a tested lesson, not a style choice. |
| **Telemetry that gives you a denominator.** One span per call and per batch with `jev.enabled`, `skipReason` (`flag_off` / `no_participant`), `rows_attempted` vs `rows_annotated`, verdict, confidence, model. Labels and verdicts only; no record, entered value or candidates. | `lib/jev/telemetry.ts` | Before this, "flag off", "no record" and "rate limited" all looked like a row with no annotation. |
| **Offline eval of the questions themselves.** Hand-adjudicated cases (including three Jev currently gets wrong, kept on purpose), 3 repeats, scores for `verdict_correct`, `expected_verdict_probability` and noul direction. When disabled it emits **null scores, not zero**. Jev usage is priced at Jev's own rate. | `evals/jev-questions.eval.ts` | The eval measures the question wording, not the agent. |
| **Online cross-check judge** beside the Sonnet hallucination judge, behind its own flag. | `evals/online/scorers/hallucination-jev.ts` | The signal is where the two judges disagree. |
| **Wording changes break comparability** and are documented in the code. Adding "outside that record" to one question moved `source_accurate` from never above 0.76 to usable. | `questions.ts` comments | Version question text; do not compare distributions across wording changes. |
| **Candidates are produced in code; `none` is always offered.** The answer is a verbatim copy of an existing value. | `fieldValueQuestions`, `flatten.ts` | A model cannot choose a value that was not offered, so it cannot invent one. |

### Eve — `agent/*`, `lib/ai/eve/*`

| Practice | Where |
|---|---|
| **Thin `instructions.md`; procedures in on-demand skills** (`benefits-application`, `browser-automation`); work delegated to subagents (`form_review`, `requirements_research`) whose `description` steers when not to call them. | `agent/` |
| **Hooks lift facts into durable session state.** `message.received` extracts the participant record and the caseworker's turns into `defineState` slots, so tools can read them and compaction cannot lose them. Subagents inherit no state and degrade to un-annotated output. | `agent/hooks/participant.ts`, `agent/lib/*-state.ts` |
| **Provenance enum on every filled field:** `record | caseworker | inferred | missing`. A review screen/`formSummary` is mandatory before submit; `check_submit_gate` never clicks submit. | `agent/tools/form_summary.ts`, skill |
| **Model choice is allowlist-validated.** A dev-only header is honored only on loopback, then validated against `MODEL_MAP`. Context window is declared explicitly. | `agent/channels/eve.ts`, `lib/ai/eve/model-map.ts` |
| **Instrumentation is its own file** with an explicit span-scope allowlist, kept in sync across both processes. | `agent/instrumentation.ts` |
| **Durable stream cursor.** Follow-up turns resume from `streamIndex`, because Eve replays from event 0. | `lib/ai/eve/session-continuity.ts` |
| **Spike findings worth knowing:** `withEve()` + `useEveAgent` would delete most of the adapter; browser refs do not survive an instance hop, which blocks a serverless browser tool as written. | `docs/eve-serverless-findings.md` |

## 2. What the extension does today

- **Jev** (`model-bridge/jev.mjs`): a *pre-fill classifier*. One `choice` question per field, 20 fields per request, serial; answers are mapped to a source purpose, then checked locally (0.90 confidence, person/source scope, site hints). Failure throws and the whole plan fails safe. Usage and estimated cost are recorded. Evidence lives in `evaluation/results/*.json`.
- **Eve** (`model-bridge/eve/`): a tool-less **CAPTCHA image classifier**, with the session reset after each use. It is not a form agent and is not evaluated as an installed form planner.
- **Privacy boundary:** participant values never reach any model. Jev sees field descriptions and source-purpose *names* only.

The extension already has strengths upstream lacks: a hard confidence gate, deterministic site rules, DOM readback, verified reuse, and value minimization. The upstream Jev calls send the **full participant record** as state. That is the main thing not to copy.

### How the pieces correspond

| Upstream (Eve agent) | Extension |
|---|---|
| `browser` tool | `content/*` scripts and the form engine |
| `gap_analysis` card | questions screen from `gaps` in the plan |
| `form_summary` card | `sidepanel/view-review.mjs` |
| `check_submit_gate` | `content/navigation-gate.js`, no-submit policy |
| participant hook + `defineState` | `shared/participant-record.js`, `chrome.storage.session` |
| skills / instructions | `shared/site-adapters.js`, playbooks |
| `MODEL_MAP` | `navaPlanModel` allowlist |
| Braintrust spans | sanitized activity log |

## 3. Proposal

Ordered by value for effort. Each item states what "done" means.

### Phase 0 — Decide the privacy rule (blocks two sub-items only)

Upstream's `summary-check` and `field-value` need record values. The extension's rule is that no value leaves the device. Two sub-items depend on the answer: the CalFresh `field-value` selection in Phase 4 (needs B) and the review-screen `summary-check` in Phase 5 (needs C). Everything else here is value-free. Pick one before building those two:

- **A. Stay value-free.** Only port features that work from field descriptions and source-purpose names. Phases 1–3, value-free gap triage in Phase 4, and the provenance enum in Phase 5 all qualify.
- **B. Derived facts.** Send non-identifying derived facts (for example `homeless: false`, `age_band: adult`) for specific fields, after a privacy review.
- **C. Hosted gateway.** Run value-bearing judgments only on the tenant-bound Nava gateway described in `MODEL_PROVIDERS.md`, not in the local companion.

Recommendation: A now and start Phases 1–3 and value-free gap triage; evaluate B on the CalFresh failure later.

### Phase M — Participant directory on Neon, behind a login (replaces the earlier mock-API idea)

Apricot and BenefitsCal connectors are out of scope. The extension needs one external source: a database of participants it can search. The decision is to use Neon for it, with the login applying **only** to that database.

**Two ways in, one record shape**

| Path | Login | Where the data comes from |
|---|---|---|
| Manual entry (field form or pasted JSON) | No | The caseworker |
| Quick-action test buttons | No | Scenario files bundled in the extension (`shared/mock-scenarios.mjs`), so they work offline |
| Document upload | No | Local parsing/OCR, as today |
| **Find a participant by ID or name** | **Yes** | Neon Postgres, through an authenticated API |

All four end as the same participant record in `chrome.storage.session`. Everything after that (minimized model calls, local validation, DOM readback) is unchanged. A database lookup is just another way to produce the record.

**Architecture**

```text
Side panel ─ no login ─▶ manual / test buttons / upload ─▶ participant record (session storage)
     │
     └─ sign in (Neon Auth, JWT) ─▶ Neon Function (API) ─▶ Postgres
                                       GET  /participants/{id}
                                       POST /participants/search   { "name": "..." }
```

- **API layer:** a Neon Function verifies the bearer JWT against Neon Auth's JWKS before doing any work. The Neon docs say the function URL is public, so it must authenticate every call itself. Neon recommends Functions over its PostgREST-style Data API for a new app, so I would not use the Data API.
- **Login:** Neon Auth (managed Better Auth), email and password to start, brokered by the Function because Neon Auth rejects extension origins (see the spike results). The panel keeps the 15-minute JWT and the session token in `chrome.storage.session`.
- **Nothing secret in the extension.** It holds only the Function URL and the user's short-lived token. `DATABASE_URL` stays server-side.
- **Search by name goes in a POST body, never a URL**, and the Function does not log bodies.
- **Audit table:** user id, action, participant id, time. No participant values.

**Tables (replacing the Apricot-shaped `mock_records` I added)**

| Table | Holds |
|---|---|
| `participants` | `record_id`, normalized `first_name` / `last_name` for search, `record jsonb` in the extension's record shape, `organization_id`, `synthetic boolean` |
| `participant_audit` | who looked up which participant and when |
| `neon_auth.*` | users and sessions, managed by Neon |

The `synthetic` flag and the fictional-only warning stay until Nava's security review approves real data.

**Spike results (2026-10-21, dev branch)**

A throwaway extension with a fixed ID, loaded into Chrome 155 with no host permissions, ran the whole flow against a deployed Function and a Neon Auth dev branch. The code is in `participant-api/` and `neon.ts`.

| Question | Result |
|---|---|
| Can the extension call Neon Auth directly? | **No.** Neon Auth's CORS preflight accepts the extension origin, but Better Auth then returns `INVALID_ORIGIN` on sign-in, and the trusted-domain list only accepts `http`/`https` origins (`neon neon-auth domain add chrome-extension://…` is refused). Confirmed from a real extension origin. |
| Workaround | **A sign-in broker inside the Function.** The extension posts email and password to the Function; the Function signs in server-side with its own trusted https origin, mints the JWT and returns `{ token, sessionToken }`. Refresh and sign-out go through the same Function. The extension therefore talks to one host only. |
| Function CORS from the extension origin | Works. An origin allowlist (`ALLOWED_ORIGINS`) returned CORS headers for the extension and a 403 preflight for another origin. Because the Function allows the extension origin, **no host permission was needed** in the test; the manifest's existing `optional_host_permissions` would also cover it. |
| JWT verification | Works with `jose` against Neon Auth's JWKS. Tokens live 900 seconds and carry `sub`, `email`, `role` and similar claims. Missing, tampered and garbage tokens get 401. |
| Token refresh | Works. The Function presents the session token to Neon Auth and returns a new JWT. The session cookie lasts 7 days. After sign-out, refresh returns 401. The extension cannot refresh by itself because it cannot set a `Cookie` header. |
| Participant lookup | By ID, by name (case-insensitive substring, limit 20), 404 for a missing ID, 400 for a too-short name. Each call wrote a `participant_audit` row (user, action, ID; no values). |
| Authorization beyond "signed in" | Added after an automated security review. The Function now checks the JWT audience and looks up the caller in `directory_members` (a table keyed by the verified subject). No row returns 403; every lookup and search is filtered by that organization. Tested: no membership gives 403, a member of another organization gets 404 and zero search results, and a member of `demo` gets the records. |
| Closed sign-up | `neon neon-auth config email-password update --disable-sign-up` works: sign-up returns `EMAIL_PASSWORD_SIGN_UP_DISABLED` and existing users still sign in. |

**Not verified:** a real 15-minute expiry wait with a sleeping service worker (only the refresh mechanism was exercised), brute-force limits on the broker's sign-in route, Neon's own rate limits, how invited users get their first password, and anything about real participant data.

**Things the spike showed**

- The password passes through the Function. That is our own infrastructure, but the Function must never log bodies, and `/auth/sign-in` needs rate limiting before real use.
- Store `sessionToken` in `chrome.storage.session` only. It is a 7-day credential.
- A request made seconds after a deploy can still hit the previous version.
- `neon checkout dev --create` points `.env.local` at the dev branch, which expired in 7 days by default; that expiry was removed on 2026-10-21. The Apricot-shaped mock tables exist on `production` only if you run `npm run connector:migrate` there; they were copied to `dev` at branch time.

**What this retires.** Neon-side, the Apricot-shaped mock store and `connector-service/` become unnecessary once the Function exists. Extension-side, the provider catalog, schema/mapping review and the Apricot connector settings can be replaced by a simple "Find a participant" screen. The recertification caseload currently reads from the connector, so decide whether it reads from this database too.

**Authorization beyond "signed in".** Enforced in the spike through `directory_members` and `organization_id` filters. Who gets added to `directory_members`, and whether an admin screen or a SQL step does it, is still open.

**Done:** a signed-out user can use manual entry, test buttons and upload; a signed-in user can find a participant by ID or by name, and the lookup appears in `participant_audit`. The Function is a spike on a dev branch (`participant-api/`). The side-panel screens are built: a **Find in the participant directory** choice, a sign-in form (the directory address comes from `shared/directory-config.mjs`, with a development test account shown on the screen when a gitignored local file provides it), and a finder with name/ID search and a result list (`shared/participant-directory.mjs`, `sidepanel/view-directory.mjs`, handlers in `sidepanel/actions-intake.mjs`), with a simulated directory in the extension-free preview. Driven in a real Chrome extension against the live Function, sign-in, wrong-password handling, name search, no-match and unknown-ID messages, session storage placement and sign-out all worked. Opening a found participant (committing it to the coordinator) could not be driven there: the service worker only accepts the real side panel, not a tab, so that last step is covered by unit tests only.

### Phase 1 — Harden the Jev client (small)

1. Return an outcome type (`ok` / `reason`) from the companion instead of throwing, with the same reasons recorded per batch. Keep fail-safe behavior: failed batch means no writes.
2. Wire the panel's **Pause** to the request's abort signal. Revisit the 20 s per-attempt timeout, but do not copy upstream's 5 s: upstream sends one row per request, while the extension sends up to 20 fields (about 14K input tokens for a WIC page). Choose the value from recorded latencies, or shrink the batch first.
3. Make batches concurrent with a cap instead of serial.
4. Add per-feature flags (`JEV_FEATURES`) in the companion, default off, key-missing means off. Today there is one switch.

Done: unit tests in `tests/model-bridge.test.cjs` and `tests/jev-runtime.test.cjs` cover each outcome; a run with no key shows "off", not an error.

### Phase 2 — Telemetry with a denominator (small)

Add `enabled`, `skipReason` (`flag_off | no_source | api_failed | deferred_by_threshold`), `rowsAttempted`, `rowsDecided`, model, and the **full probability distribution** per field to the sanitized activity log and the evaluation receipts. Today `model-bridge/jev.mjs` reads only `choice` and `confidence`, and no retained receipt contains `probabilities`, so a better threshold cannot be chosen from the data. The upstream SDK result exposes `probabilities`; confirm the raw `/v1/systemone` response does too before relying on it. Keep the existing rule: labels and numbers only, never values.

Optional: companion-side OpenTelemetry to Braintrust. The extension cannot export spans itself.

Done: a failed or skipped Jev run is distinguishable from a clean run in the log, without reading plan output.

### Phase 3 — Offline eval of the question wording (medium, highest evidence value)

Port `evals/jev-questions.eval.ts` to `scripts/` (for example `npm run eval:jev-questions`), reusing the frozen inventories in `evaluation/`.

- Hand-adjudicate expected purposes from the synthetic source, **not** from what Jev returned.
- Keep known failures in the set on purpose: CalFresh "Stable housing → No" and the unstable county classification are already documented in `JEV_RECOVERY_V015.md`.
- 3 repeats; report `expected_choice_probability` alongside correctness, so a 0.58 near-miss and a 0.95 confident miss are not both just "0".
- Return null, not zero, when the key or flag is absent.
- Put a content hash of the question text in each receipt so results from different wordings are never compared.

Done: rewording an instruction shows which fields moved.

### Phase 4 — Gap triage and sensitivity, value-free (medium)

Port the `gap-triage` idea using only what the extension can share: *"the agent wants to ask about `field_being_requested`; do any of `availableSources` answer it?"* with a verdict of `genuinely_missing | present_in_sources | derivable`, plus a `noul` for sensitivity (SSN, immigration, disability, medical). This targets false questions. The 70 → 1 drop in `JEV_RECOVERY_V015.md` was measured with site-adapter rules on, but the shipped panel passes `siteAdapters: null` (see `TODO.md`), so the panel probably still produces more false questions than that figure suggests. Measure before/after in the panel's real configuration, and settle open question 2 first. The sensitivity noul is added **alongside** the `finalControl` regex, which stays a hard rule for CAPTCHA, signature, submit, certification, one-time-code, password, login and payment controls; a probability must never replace it. Run it annotate-only first; do not change which questions appear until Phase 3 data supports a threshold.

For the CalFresh transformation failure, evaluate a `field-value` style selection among the form's own options using a derived fact (Phase 0, option B). Do not build it before the privacy decision.

Done: false-question rate and sensitive-field routing measured before and after, on the eval from Phase 3.

### Phase 5 — Provenance and review (medium)

Adopt the `record | caseworker | inferred | missing` provenance enum on every filled field in the plan and review view, and keep review mandatory before final submission (already true). A Jev `summary-check` on the review screen needs record values, so it is **Phase 0 option C only**. The extension's DOM readback already proves the page holds the value we intended; `summary-check` would add whether that value was right, which is a different and valuable question.

### Phase 6 — Eve practices in `model-bridge/eve/` (only if Eve grows beyond CAPTCHA)

If Eve takes on a form-review or gap-analysis role, follow the upstream layout: thin `instructions.md`, a `skills/` directory for procedures, a subagent with a steering `description`, `defineTool` with zod input, an `instrumentation.ts` with an explicit scope allowlist, an allowlisted model map and explicit context window, and a hook that lifts session facts into `defineState`. Keep today's bounded `limits`, loopback-only transport and per-session reset. Do **not** port Kernel browser control, Vertex routing, `withEve`/Next mounting or the stream adapter; the extension acts in the caseworker's own tab.

The Eve agent exists in two copies that have already diverged (`evaluation/captcha/eve/agent/` and `model-bridge/eve/agent/`; for example `sessionTimeoutMs` is 120000 in one and 90000 in the other). Settle on one before extending it.

## 4. Not worth copying

- Sending the full participant record to Jev or to Braintrust traces (upstream records full message history by design).
- Vertex/OpenAI direct routing, Kernel.sh, Cloud Run/terraform wiring, Postgres session mapping.
- Upstream's annotate-only stance for the *planner*: the extension must keep its confidence gate because it writes to forms. Annotate-only fits new advisory judgments (Phases 4–5), not the core classifier.

## 5. Open questions

1. Which Phase 0 option does the team accept? It decides only the CalFresh `field-value` selection (Phase 4) and the `summary-check` (Phase 5).
2. Should the panel apply site-adapter rules in the planner? It is already an open item in `TODO.md` and affects what Phase 3 measures.
3. Who owns the TypeSafe key and Braintrust project for evaluation runs?
4. Phase M: who creates and invites users, and does the recertification caseload also read from the participant database? (Neon is decided; the project is owned by Kaylyn.)
