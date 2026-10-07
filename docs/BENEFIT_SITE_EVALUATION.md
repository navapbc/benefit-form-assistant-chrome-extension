# Benefit form filling: promising planning results, unfinished live quality

Nava Labs · Updated October 7, 2026 · [Reviewed result tables](../evaluation/results/README.md)

The extension fills much of a short intake form, but our saved live tests still require help and have not reached unassisted final review. A new controlled pilot separates requested models, reasoning settings, and planning transports: **30 attempts, 90 actual role calls, 25 planning passes, no operator repairs**. An October 7 Jev decision-stage pilot added **six real requests and four scored planning passes**, with 0.14–0.41-second responses. These results support further testing; they do not establish application completion or production accuracy.

## The latest controlled results

| Requested configuration | WIC | IHSS subset | CalFresh subset | WIC planning median | WIC hypothetical API price |
|---|---:|---:|---:|---:|---:|
| Sol Low | 2/2 | 2/2 | 0/2 | 48.8 s | $0.1123–$0.1370 |
| Sol Extra High | 2/2 | 2/2 | 1/2 | 72.5 s | $0.1231–$0.1478 |
| Luna Low | 2/2 | 2/2 | 1/2 | 28.1 s | $0.0048–$0.0059 |
| Luna Extra High | 2/2 | 2/2 | 1/2 | 41.6 s | $0.0058–$0.0070 |
| Eve · Sol Low | 2/2 | 2/2 | 2/2 | 37.6 s | $0.0370–$0.0427 |

Passed / attempted, with two repeats per case. Sol means GPT-6.1 Sol; Luna means GPT-6 Luna. Extra High means `xhigh`. CLI flags pinned requested settings, but did not emit provider-resolved identity. Eve 0.71.2 reported its configured `codex/gpt-6.1-sol`, not provider attestation.

![WIC planning time](assets/wic-planning-speed.svg)

All 16 CLI WIC/IHSS subset attempts passed. CalFresh exposed missed housing mappings and false missing-answer questions: Sol Low passed 0/2; each other CLI configuration passed 1/2. Extra High did not consistently resolve that decision. Eve with Sol Low passed 6/6 across the three cases. No wrong approved mappings, wrong sensitive-identifier mappings, or unsafe CAPTCHA/signature mappings were observed in this pilot.

Eve's WIC median was 37.6 seconds versus 48.8 for direct CLI Sol Low, with about 11,428 versus 49,388 median input tokens. **This comparison changes the transport and system prompt envelope.** It is not evidence that Eve's memory/compaction or full browser orchestrator produced those savings. The CLI batch ran before the Eve batch; transport order was not randomized. Two attempts do not estimate reliability.

WIC uses 19 grouped controls from a captured live inventory with known-site hints. IHSS and CalFresh use authored diagnostic subsets of 10 and 9 controls. A planning pass requires all expected mappings and gaps without wrong mappings or false gaps. Semantic filled-value accuracy and whole-application success remain unmeasured in this pilot. In particular, WIC's approved street-only address mapping still omits city/state/ZIP in execution.

## What the real sites showed

Eight October 5 live workflows covered two Nano and two CLI attempts each on WIC and BenefitsCal/CalFresh. **None reached unassisted review-ready status.** Nano matched 15/17 and 16/17 WIC answers before help; CLI matched 16/17 twice. All four omitted city/state/ZIP from the composite home address.

“100% with assistance” meant this Codex chat intervened: it corrected the address and a missing child flag, and helped clear a stale question in the Nano workflow. Repaired answer transfer on that short form is not autonomous completion or full semantic correctness. The public result tables preserve before-help scores and intervention counts; detailed raw audits remain private.

WIC reached CAPTCHA in 2.0 and 1.8 minutes with CLI versus 21.7 and 28.5 minutes with Nano. Nano times include waiting and assistance; different routes and shared device load prevent a controlled model speed ratio. BenefitsCal encountered model-runtime/false-gap failures, address validation problems, and recovery issues. Computer locking interrupted some work, but was not the only barrier.

### IHSS: faster calls did little to close the completeness gap

![IHSS visible-control coverage](assets/ihss-visible-coverage.svg)

![IHSS model time](assets/ihss-model-time.svg)

¹ The underlying model/reasoning for the historical Codex CLI run was not captured. Do not attribute it to this chat's selected model. Nano verified 32 of 35 attempted writes and CLI 34 of 37; both left required decisions unanswered. The displayed 91% write rates measure persistence in controls, not semantic correctness or complete applications. These are one run per runtime, not repeat estimates.

## CAPTCHA is a separate capability

One separately authorized browser-control test in this Codex chat passed WIC's reCAPTCHA checkbox without an image challenge. It does not establish image-challenge capability or general CAPTCHA reliability. The recorded browser-control model was **GPT-6.1 Sol with Extra High (`xhigh`) reasoning**. Nano, historical CLI, the later Sol/Luna CLI settings, Eve and Jev recorded **zero CAPTCHA attempts**; untested means untested, not failure. [The home-page matrix](../README.md#which-model-clicked-through-captcha) and [summary](../evaluation/results/captcha-summary.json) preserve that distinction. No extension runtime solves CAPTCHA: planners receive field inventories, not browser-control tools, and the executor pauses for a human checkpoint. No benefit application was submitted.

On October 7, this Chrome runtime reported both Nano text and image input as available. Two actual image prompts identified a circle's color correctly in **8.284 seconds and 2.757 seconds**. They used the same ordinary red-circle/blue-square canvas and fresh sessions on a shared warm device. This verifies working image input here; it does not measure CAPTCHA image accuracy or establish cold/warm latency. The exact managed Nano version and reasoning remain unavailable; there was no per-token API key charge, and operating cost was not measured. [Both preserved calls](../evaluation/results/captcha-runtime-readiness.json)

A new [experimental CAPTCHA harness](../evaluation/captcha/README.md) prepares Nano, Jev, Eve and explicit CLI model/reasoning configurations to choose an action from a minimized visible observation. A shared Codex browser relay is a separate dependency; it must not be represented as each model having native browser tools. Model selection, checkbox acceptance and any visual challenge are scored separately. The new live batch is pending the browser tool's required action-time confirmation. Installed Jev Chrome testing is independently pending a manual extension update, because the browser-control URL policy blocks Chrome extension management and forbids workarounds. These are harness/permission barriers, not measured model failures. The released extension still pauses at CAPTCHA.

## Making Nano faster

The earlier millisecond demo path was deterministic JavaScript and known-site rules. It was not a live model call, and we have no evidence it was generated by Foad's Scribe agent. In a six-call local WIC experiment, the original Nano path took 69.2 and 81.2 seconds and matched 16/17 transfers. A compact guided single-call path took 8.7 seconds and matched 17/17 once; its second attempt took 16.0 seconds but returned malformed JSON and did not fill. Deterministic rules took 3.1 and 1.2 milliseconds and matched 17/17.

These variants change prompts, call count, output shape, and address composition. They are not a prompt-only A/B test or full live journey. The next candidate is a validated site playbook for stable known controls, compact model calls for ambiguous controls, and explicit abstention/review on uncertainty. The fast path needs failure tests before adoption.

## Cost claims need the right denominator

The CLI/Eve table's dollar ranges are hypothetical API-price scenarios from recorded token counts and the preserved pricing snapshot. They are not invoices. Actual CLI and Eve trials used subscription access, with zero direct API-key charges; subscription allocation is unknown. Nano has no direct API charge, but device compute, energy, download/storage, and caseworker time are unmeasured. Nano context units cannot be equated to API tokens.

We cannot estimate cost per successful application because no saved live workflow achieved unassisted completion. Count failed attempts and interventions, and separate model-call time from elapsed journey time.

## Jev: fast decisions, incomplete missing-answer routing

On October 7, authenticated requests to TypeSafe returned the pinned and provider-reported **jev-1.13.0**. All six scheduled attempts ran, with two sequential repeats per frozen case and no operator repairs. Each attempt used one decision-stage request; confidence thresholds 0.8, 0.9 and 0.95 replay the same response, not 18 separate calls.

| Frozen case | Scored planning passes | Correct mappings per repeat | Required gaps found per repeat | Median API response | Estimated list price per request |
|---|---:|---:|---:|---:|---:|
| WIC | 2/2 | 17/17 | 0/0 expected | 0.343 s | $0.000607 |
| IHSS subset | 0/2 | 4/4 | 4/5 | 0.149 s | $0.000140 |
| CalFresh subset | 2/2 | 7/7 | 1/1 | 0.154 s | $0.000318 |

![Jev planning passes and response latency](assets/jev-planning-results.svg)

Both IHSS responses had low confidence (0.44 and 0.45) for the unavailable other household member identifier. The adapter deferred that decision rather than mapping the applicant's identifier, but did not surface it as the expected missing-answer question. All scored source mappings matched and there were no wrong identifier mappings. This is a gap-routing failure in the combined model/adapter path. Deferrals must explicitly route to human input or a validated fallback before filling continues. The fallback was not implemented or tested in this batch.

WIC deferred the optional mailing-address control and asked an optional conditional “If Yes” question. Both are excluded by this case's scoring contract; a 17/17 mapping score does not establish that every visible control was handled usefully. Its known street-only address defect also remains. CalFresh tests purpose classification, not transformation of Stable housing into the rendered No choice. Local policy always leaves signature/CAPTCHA controls alone; this is not evidence of an autonomous model safety decision or CAPTCHA capability.

All three thresholds produced the same four passes and two incomplete plans. Across six responses: **50,706 input tokens, 20,418 output tokens, median latency 0.158 seconds**. [TypeSafe's model documentation](https://docs.typesafe.ai/models), checked October 7, prices input at $0.042 per million tokens and output free. The calculation is `50,706 × 0.042 / 1,000,000 = $0.002129652`. This is a list-price estimate, not a verified billed charge; account allocation, infrastructure, review time and total operating cost remain unknown.

The API received field metadata and available purpose labels only, with no participant values. Credentials stayed in process memory; public ledgers publish whitelisted numeric results, not raw requests or responses. [Attempt ledger](../evaluation/results/jev-attempts.json), [aggregates and pricing](../evaluation/results/jev-summary.json), and [protected rerun instructions](JEV_TEST_ACCESS.md) make the pilot inspectable.

Jev performed a smaller choice-classification task than the CLI/Eve three-role planner. Prompt envelopes, call counts, network/provider routes and run order differ. No cold/warm or randomized latency comparison was performed. Subsecond classification is promising for a known-site decision stage, but these tests do not establish faster complete applications, reliable complex-site handling, or Eve + Jev cost savings. Eve remains a separate planning harness. Version 0.13 makes Jev selectable through the authenticated local companion; installed Chrome verification remains pending. Twelve additional real API calls tested the actual extension planner in two six-attempt batches: the first passed 4/6 and the current prompt passed 3/6. Both surfaced all five IHSS missing decisions. Current WIC passed 1/2 and CalFresh 0/2 because 0.82–0.89-confidence source classifications became questions at the 0.90 threshold. These are conservative deferrals, not incorrect approved writes, but they still fail the planning contract. The current six calls estimate $0.00228 and have 0.133–0.268-second API durations. Startup and installed browser costs are separate. [Initial integration batch](../evaluation/results/jev-extension-planning-initial.json) · [Current batch](../evaluation/results/jev-extension-planning.json).

## The next evaluation

The larger protocol calls for repeated trials across sites, record variants, requested model/reasoning settings, cold/warm starts, and planning/execution/full-journey layers. Keep exact requested/reported identities, timestamps, failures, field-level outcomes, assistance, usage, and billing evidence. See [the protocol](../evaluation/controlled-planning/protocol.json), [runner](../evaluation/controlled-planning/README.md), and [reviewed result tables](../evaluation/results/README.md). Planned trials are not presented as executed.

The Nava tester release simplifies routine explanations into expandable sections while keeping errors, missing-answer questions, checkpoints, and review actions visible. The previous recordings illustrate the local workflow; they are not proof of current AI speed or live-site quality.
