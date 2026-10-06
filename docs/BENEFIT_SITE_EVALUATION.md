# Benefit form filling: promising planning results, unfinished live quality

Nava Labs · Updated October 6, 2026 · [Reviewed result tables](../evaluation/results/README.md)

The extension fills much of a short intake form, but our saved live tests still require help and have not reached unassisted final review. A new controlled pilot separates requested models, reasoning settings, and planning transports: **30 attempts, 90 actual role calls, 25 planning passes, no operator repairs**. These results support further testing; they do not establish application completion or production accuracy.

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

One separately authorized browser-control test in this Codex chat passed WIC's reCAPTCHA checkbox without an image challenge. It does not establish image-challenge capability or general CAPTCHA reliability. Neither extension model solves CAPTCHA: planners receive field inventories, not browser-control tools, and the executor pauses for a human checkpoint. No benefit application was submitted.

## Making Nano faster

The earlier millisecond demo path was deterministic JavaScript and known-site rules. It was not a live model call, and we have no evidence it was generated by Foad's Scribe agent. In a six-call local WIC experiment, the original Nano path took 69.2 and 81.2 seconds and matched 16/17 transfers. A compact guided single-call path took 8.7 seconds and matched 17/17 once; its second attempt took 16.0 seconds but returned malformed JSON and did not fill. Deterministic rules took 3.1 and 1.2 milliseconds and matched 17/17.

These variants change prompts, call count, output shape, and address composition. They are not a prompt-only A/B test or full live journey. The next candidate is a validated site playbook for stable known controls, compact model calls for ambiguous controls, and explicit abstention/review on uncertainty. The fast path needs failure tests before adoption.

## Cost claims need the right denominator

The table's dollar ranges are hypothetical API-price scenarios from recorded token counts and the preserved pricing snapshot. They are not invoices. Actual CLI and Eve trials used subscription access, with zero direct API-key charges; subscription allocation is unknown. Nano has no direct API charge, but device compute, energy, download/storage, and caseworker time are unmeasured. Nano context units cannot be equated to API tokens.

We cannot estimate cost per successful application because no saved live workflow achieved unassisted completion. Count failed attempts and interventions, and separate model-call time from elapsed journey time.

## Jev and the next evaluation

Jev has **zero measured attempts**. The real endpoint adapter, frozen cases, scorer, and confidence-threshold handling are ready; a protected TypeSafe credential or approved authenticated endpoint is still required. [Access and test instructions](JEV_TEST_ACCESS.md) explain the boundary. Team-reported Eve + Jev savings concern a different system and are not our extension results.

The larger protocol calls for repeated trials across sites, record variants, requested model/reasoning settings, cold/warm starts, and planning/execution/full-journey layers. Keep exact requested/reported identities, timestamps, failures, field-level outcomes, assistance, usage, and billing evidence. See [the protocol](../evaluation/controlled-planning/protocol.json), [runner](../evaluation/controlled-planning/README.md), and [reviewed result tables](../evaluation/results/README.md). Planned trials are not presented as executed.

The Nava tester release simplifies routine explanations into expandable sections while keeping errors, missing-answer questions, checkpoints, and review actions visible. The previous recordings illustrate the local workflow; they are not proof of current AI speed or live-site quality.
