# What you can try in the extension

This is a feature tour for design and engineering review of **v0.16.0**. Start with [installation and the real-site tester guide](TESTER_GUIDE.md), then use the sections below to explore the rest of the product. Use fictional records and documents. Stop before certification, signature, or official submission.

Core form-filling quality should be tested on **real WIC, IHSS, and BenefitsCal routes**. The fictional connector, renewal schedule, and local forms let you try features without a production integration; their results do not establish real-site quality. [Current results](TEST_RESULTS.md) · [Engineering priorities](PRODUCTION_GAPS.md).

## Choose how the AI runs

Open **Model runtime** on the home screen or dashboard.

| Approach | What it is for | How to try it |
|---|---|---|
| **Gemini Nano** | On-device planning with **$0 direct model API charge**. No subscription or provider key is required for this route; device costs and setup time still exist. | Select **Chrome on-device Gemini Nano → Enable agentic AI**. Compatible desktop Chrome hardware and an available model/download are required. Record unavailable devices as unavailable. |
| **Codex or Claude CLI** | Use an authenticated subscription CLI through a local companion instead of Nano. Usage consumes the subscription allowance; no direct API-key charge does not mean free service. | Sign in to the selected CLI, run `npm run model:bridge`, then choose the provider, localhost address, and printed pairing token. Keep the terminal open. [Setup](../model-bridge/README.md). |
| **Jev** | Experimental field-purpose decisions with local validation and recovery. | With Node 24 and authorized TypeSafe test access, run `npm run model:jev`; choose **Jev via local companion** and pair it. Provider credentials stay in the process, not Chrome. [Setup](../model-bridge/README.md#jev-in-the-chrome-extension--v013). |
| **Shared planner API** | Use a separately running Nava API to plan fields. | See [API and client links](#api-and-client-links) below. The server is not bundled here. |

**Eve** is a separate form-planning experiment, not a selectable form planner in this extension. It is also an optional CAPTCHA image runtime. Selecting Codex or Jev does not implicitly run Eve. Record the effective form runtime and any different image runtime for every test.

<a id="document-upload-and-review"></a>

## Load a record or document

| Feature | How to try it | What to check |
|---|---|---|
| **Participant directory search** | On the start screen, sign in (if you have the local test-account file described in `participant-api/README.md`, the account is shown there), then search by name or ID, for example `thomas` or `339619`. This is the only path that needs a sign-in. | Is the client identity clear before any application opens? Can the tester recognize and recover from the wrong record? |
| **Enter client details** | Choose **Enter client details**, then pick a sample client or type a client in. A full JSON record can be pasted under **Advanced**. | Are missing values left unknown? Can the tester understand what will be used without reading raw JSON? |
| **Document upload and local OCR** | Choose **Read a document**, select a fictional PDF, image, DOCX, TXT, CSV, TSV, or JSON file, then **Read document**. On **Choose what to add**, review and select fields before **Use selected details**. Later, **Add document** adds information to the current record. | Nothing should merge without review. OCR and conflicting values should need explicit selection; sensitive identifiers should be masked. Check missing labels, poor scans, rotation, and conflicting sources. |

Document parsing/OCR runs locally with bundled tools. Uploads are limited to **15 MB**; OCR is English and bounded by page/time/pixel budgets. It proposes labeled fields rather than interpreting every document. Handwriting, unsupported languages, and unclear values should be withheld. [Exact limits and review policy](OCR_SECURITY_AND_LIMITS.md).

<a id="organization-database-connector"></a>

## Connect a database through the self-service flow

The product includes provider selection, connection testing, labeled-field discovery, mapping review, record lookup, and source freshness/provenance. **The runnable service here is fictional and Apricot-shaped.** The other catalog entries need an authorized server adapter; selecting a vendor does not connect to its production system.

To try the full connection flow without a vendor account, run:

```bash
npm run connector:mock
```

1. On the extension home screen, choose **Data source: fictional demo → Connect** and select **Bonterra Apricot 360**.
2. Enter organization `Riverside Community Services`, service URL `http://127.0.0.1:4789`, connection ID `nava-demo`, and form/resource key `99`.
3. Choose **Test connection and load fields**. Review each source-to-destination mapping, then **Save read-only connection**.
4. Choose **Find by record ID**, enter `339619`, inspect the source labels and freshness, then **Use this reviewed record**.
5. Try **Manage data source** and **Disconnect and use demo data** when finished. Stop the mock terminal.

Design review should check whether “fictional demo” versus “adapter required” is understandable. Engineering review should check wrong mappings, stale/unknown freshness, lookup errors, revocation, and source changes. Chrome accepts a service URL and opaque connection ID, **not provider passwords or API keys**. No production Apricot adapter or SQL database is supplied. [Provider coverage](CONNECTOR_COVERAGE.md) · [Service contract](../connector-service/README.md).

## Prepare one application or several

After loading a record, **What should I help with?** offers the current tab and known application sites.

| Feature | How to try it | Current boundary |
|---|---|---|
| **Current-page filling** | Open a real target form, check **Analyze this form**, then choose **Continue**, which starts the run automatically. Use **Fill through application** only if it pauses and offers it. **This page only** limits the action to the current page. | Arbitrary sites are not all supported. Verify every answer; a read-back check is not semantic correctness. |
| **Known-site navigation** | Choose **WIC**, **IHSS**, or a BenefitsCal program and continue. The extension opens each application in its own tab and follows approved next steps. | Known routes are Riverside WIC, Riverside IHSS, and parts of BenefitsCal. Account gates, unsupported controls, and long flows can still block progress. |
| **Multi-application queue** | Choose WIC, IHSS, and one or more BenefitsCal programs. Watch each card on the dashboard; use **Go to application** to inspect its tab. | Up to three tab-bound runs; keep the side panel open. CalFresh, Medi-Cal, and CalWORKs share **one combined BenefitsCal application**, not three independent applications. One client identity is active in the Chrome session. |
| **Missing-answer questions** | Use an intentionally incomplete fictional record. At a question, choose **Answer and continue** or **This page only**. Leave unknowns blank. | The extension should ask about missing facts, not invent them or ask for answers already in the record. Any answer supplied during a complete-record test is assistance. |
| **Review and provenance** | At review, choose **Review details**; inspect filled values, empty fields, source labels, and page history. Use **Scan this page again** to recheck the current page. | “Verified” means a write persisted. It is not a score for distinct correct answers or a complete application. A person still reviews and submits. |

Test the real routes first individually, then together. Check that answers, progress, and stop reasons stay attached to the correct application. [Real-site test steps and result template](TESTER_GUIDE.md).

## Handle checkpoints, recovery, and handoff

| Feature | How to try it | What counts as success |
|---|---|---|
| **CAPTCHA attempt** | At a CAPTCHA checkpoint use **Authorize and try CAPTCHA**. If a stopped card offers **CAPTCHA automation → Allow one CAPTCHA attempt during this run**, enable it before resuming. The initial Continue starts automatically. Choose an image runtime under **Model runtime → CAPTCHA images** if needed. | Visible checkbox/challenge acceptance **and** form continuation without a person rescuing it. Record Yes/No and every intervention. Live native image solving is unverified. [CAPTCHA test](TESTER_GUIDE.md#4-captcha-did-it-get-through-without-a-person). |
| **Human checkpoints** | For an authorized manual CAPTCHA or one-time-code step, complete it and choose **I completed the CAPTCHA/one-time code — resume**. | Progress resumes in the correct tab. This is an assisted attempt, not autonomous completion. Unsupported challenges remain blockers. |
| **Pause and recovery** | Choose **Pause or hand off → Pause for later**, then **Verify and resume**. Also try closing a tab, reopening the panel, and restarting Chrome. | Clear state, preserved safe progress, no late writes after cancellation, and an explicit source reload when values have expired. |
| **Caseworker handoff** | Open **Pause or hand off**, enter a role/team label, select the reason, and **Create handoff**. Then try **Accept handoff**. | The reason and next action are clear. This coordinates one Chrome profile; it is not authenticated assignment to another person's device. Do not put client information in the assignee field. |
| **End session** | On the dashboard choose **End this session** before switching clients. | Previous client values and running work should not leak into the next client. Durable queue metadata is separate from session-only participant values. |

<a id="renewals-and-recertification"></a>

## Review upcoming renewals

Open **Renewals due** from the start screen or the dashboard. The default fictional mode supplies a demo caseload; a configured service can supply authoritative due dates.

1. Choose **Review and follow up** on a client. Inspect the urgency, due date, five information areas, and client-message draft.
2. Choose **Create outreach task**. In a test, inspect the draft; do not send it to a real client. **Mark client contacted** records a worker's action, not proof of delivery.
3. Review contact/address, household, income/employment, expenses, and documents. Set each area to current or confirmed and record the fictional client's authorization.
4. **Save recertification status**. **Prepare with AI** appears only when the data check is complete and authorization is affirmative; it loads the source record and starts the known application through review.

Try “declined” and “not answered” too: neither should start preparation. End an existing different-client session before preparing this client's renewal. Notes, outreach, and authorization are session-only. There is **no background scheduler or automatic SMS/email delivery** here, and real renewal-route completion still needs testing. [Workflow and production follow-ups](RECERTIFICATION_WORKFLOW.md).

<a id="shared-planner-api-and-participant-links"></a>

## API and client links

These are implemented extension entry points for a **[separate API product/service](https://github.com/gobrando/nava-form-filling-assistant-api)**. Cloning or loading this extension does not start that server. The API prototype's own participant page and application desk are separate product surfaces, not additional extension screens.

- **Shared planning:** on home, open **Shared planner API**, enter the authorized service URL and tenant key, then **Use the shared planner**. Use synthetic data and an authorized test service. This saved route can override non-Jev local planning; record it separately rather than calling it a Nano/Codex/Claude test.
- **Client questions link:** on **Answer the missing questions**, choose **Send these questions to the client**. It requires a configured API and a selected program. The extension creates a household reference, creates an application containing bounded questions, and requests a share URL, which it displays in the panel.
- **Review the entire lifecycle:** with a test service, verify who can open the link, expiry/revocation, question clarity, answer capture, and the return of answers to the caseworker workflow. The extension source alone does not establish that those server steps work. Its current link action creates/displays the URL; it does not send an email/SMS or demonstrate answer synchronization back into the form.

The link requests send question/program metadata and an opaque reference rather than participant record values. Hosted access, tenant isolation, retention, and operations must be verified in the API separately. The tenant token currently persists in local Chrome storage; it is distinct from the session-only companion token. Before using participant data, review the [API and production boundaries](PRODUCTION_GAPS.md). For a local-runtime comparison, leave the shared API unconfigured in a fresh profile.

## Inspect activity and usage

On an application card, expand **AI plan details** for planning calls, model time, available tokens/context units, and cost reporting. On the dashboard choose **Export activity log** for a value-free record of workflow events and usage.

Keep model-call time separate from full journey time, and estimated price separate from a billed charge. Nano's context units are not billable API tokens. Check the export for participant values and credentials before sharing. Keep failed attempts, timeouts, and assistance in the report; use the [tester record](TESTER_GUIDE.md#5-capture-a-useful-result).

## Suggested feature review split

| Area | Design review | Engineering review |
|---|---|---|
| First run and models | Can a new tester reach a ready runtime and understand local versus hosted processing? | Compatible device/download, CLI pairing, unavailable runtime, effective API precedence. |
| Documents and data source | Can someone inspect, correct, and trust imported values and source freshness? | Extraction abstention, conflicting values, schema/mapping changes, lookup failure, secret boundaries. |
| Real forms and several applications | Are progress, missing answers, CAPTCHA, and review understandable without supervision? | Correct complete routes, unassisted CAPTCHA/continuation, concurrent isolation, no silent missing answers. |
| Renewals and handoff | Are urgency, outreach, authorization, and the next worker's task clear? | Due-date contract, consent gates, session expiry, cancellation, single-profile limits. |
| API, links, and logs | Are service setup, question sharing, expiry, and usage labels understandable? | Tenant/access controls, link lifecycle and answer return, timeouts, token storage, value-free exports. |

Record a feature as **tried**, **blocked**, or **not tried**, then link its receipt. Availability in the interface is not a claim that the full integration or real-site journey has passed.
