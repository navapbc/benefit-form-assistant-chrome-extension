# Benefit form filling: promising planning results, unfinished live quality

Nava Labs · Updated October 9, 2026 · [Reviewed result tables](../evaluation/results/README.md)

**New installed v0.14 WIC batch:** four actually executed form runs, no manual answer repair and 0/4 correct completions. Nano took 243.3 s to CAPTCHA with 16/17 correct answers. Jev took 8.39 / 8.45 s to blocking questions, with 15/17 each and $0.001547616 estimated API cost per repeat. Codex default took 116.5 s to CAPTCHA, with 16/17 plus an unnecessary conditional mailing-address fill. Its actual form model/reasoning is unspecified, so the model-price estimate remains unknown despite measured tokens. Native CAPTCHA attempts remain zero; the staged tests and remaining repeats are pending. [Full per-run timing, tokens, cost and exact errors](INSTALLED_V014_BATCH.md) · [Shareable error catalog](BENCHMARK_ERRORS.md).

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

## CAPTCHA action, image accuracy and live acceptance

The October 7 pilot ran two checkbox decisions and fresh WIC browser attempts for each of seven configurations: Nano, Jev, Eve/Sol Low and CLI Sol/Luna at Low/Extra High. **All 14 checkbox decisions were correct; 12/14 browser attempts reached an accepted state.** Two observations were inconclusive because capture was delayed or an image challenge expired during harness preparation. Those are harness failures, not incorrect model answers. Ten trials passed without images; two completed image sessions.

Luna Low's bridge answer was accepted on the first submission. Luna Extra High's 4×4 traffic-light answer was rejected, then its bicycle follow-up was accepted. No operator changed model-selected tiles. The relay had to use visible coordinates after semantic tile selectors failed. This is a dependency on Codex browser control, not native website operation by each tested runtime. All applicant fields were empty; Submit was untouched.

The same saved 3×3 traffic-light grid was classified twice per configuration. Manually reviewed tiles were 1, 8 and 9. Sol Low and Extra High each returned the exact set 2/2; Luna Low returned it 1/2 and missed a tile once; Luna Extra High returned it 1/2 and refused once. Nano selected all nine tiles twice (0/2 exact sets), taking 11.84 and 6.16 seconds. Eve's first six attachment trials timed out, including a request crossing a service restart. With the corrected image contract and explicitly exported in-memory attachment environment, a restarted service returned one correct tile set in 10.95 seconds; the second repeat returned no structured result in 3.10 seconds. Its reason was not captured, so it is not classified as a refusal or incorrect set. All eight attempts remain in the ledger. Jev's text/JSON route was not tested with pixels. **One unique grid cannot establish general accuracy or a production model ranking.** Different live grids, shared warm Chrome history and sequential testing confound acceptance rates.

The two Jev text decisions cost approximately $0.000050904 at the published input-token rate; billed cost is unknown. CLI/Eve used subscription access and Nano used local compute. Response time excludes browser relay work; total operating cost and cost per completed application remain unknown. Requested CLI/Eve identity is distinguished from provider-resolved Jev identity. Chrome exposes no exact Nano version or reasoning effort.

The staged WIC batch was confirmed at the visible checkpoint; no repeated permission questions interrupted its checkbox or follow-up trials. Version 0.14 now adds a separate native actuator with one opt-in authorization per bounded attempt, static grid input, indexed tile execution, visible acceptance checks and cancellation. Prior live trials still used the external Codex relay. Four browser-fixture checks passed, but installed/live-provider behavior remains unverified; synthetic DOM events may be rejected. The browser tool’s external policy is unchanged. [Native capability and limits](CAPTCHA_ACTUATOR.md).

[Home-page tables](../README.md#which-model-clicked-through-captcha) · [All action/browser trials](../evaluation/results/captcha-oct7-actions.json) · [All image attempts](../evaluation/results/captcha-oct7-images.json) · [Summary](../evaluation/results/captcha-oct7-summary.json)

The October 5 chat trial remains a separate historical observation: GPT-6.1 Sol Extra High accepted one checkbox without an image challenge. Earlier ordinary-shape Nano image calls establish input availability only. They are not included in this CAPTCHA accuracy denominator.

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

CAPTCHA speed and cost for every retained run, including failures: [complete metrics](CAPTCHA_RUN_METRICS.md). Unknown values are not zeros.

The October 8 native image-adapter smoke tests returned the exact set in 2/2 repeats for both Codex CLI and Eve, requested Sol Low, on one frozen image. Codex elapsed times were 10.260 / 6.877 seconds; Eve 5.160 / 3.305 seconds. [Current adapter speed/cost and limits](CAPTCHA_ACTUATOR.md#evidence-and-speedcost) distinguish these classification checks from earlier live relay acceptance and unverified native browser execution. Four initial MIME-validation failures, rejected before inference, remain in the complete ledger.
