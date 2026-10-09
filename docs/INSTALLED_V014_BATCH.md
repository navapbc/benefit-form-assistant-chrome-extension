# Installed v0.14 WIC results · October 9

**Four fresh form runs are saved; none correctly completed the application.** Nano and Codex reached CAPTCHA with an incomplete home address. Jev filled most values quickly, then blocked on unnecessary questions in both repeats. A separately recorded follow-up now has three native attempts, two accepted checkbox states and zero live image calls. One workflow reached final review with viewport assistance, but still had semantic errors. [Fresh CAPTCHA report and all 36 image classifications](CAPTCHA_OCT9.md).

These runs exercised the installed extension on fresh Riverside WIC pages with one complete fictional record, zero operator answer repairs and an unlocked computer. Version-specific v14 controls were observed; the user reported loading v0.14. The installed manifest/source files were not independently attested. Release source commit: `fe2bd4e6e3425ba5510f998f47f5c40129861dd4`. Chrome 154.0.8037.98, macOS 15.6, Codex CLI 0.162.0-alpha.2. [Protocol and metric definitions](../evaluation/installed-v014/README.md).

## Speed, quality and workflow outcome

| Actual installed run | Time to first stopped checkpoint | Minutes:seconds (rounded) | Correct / 17 | Incorrect / missing | False questions | Workflow outcome |
|---|---:|---:|---:|---:|---:|---|
| Nano repeat 1 · Chrome-managed model/effort | 243.297 s | **4:03** | 16/17 | 1 / 0 | 0 | CAPTCHA reached; home address incomplete |
| Jev 1.13.0 repeat 1 · confidence 0.90 | 8.390 s | **0:08** | 15/17 | 1 / 1 | 3 | Caseworker questions; Medi-Cal unanswered |
| Jev 1.13.0 repeat 2 · confidence 0.90 | 8.450 s | **0:08** | 15/17 | 1 / 1 | 3 | Same blocking questions |
| Codex CLI default repeat 1 · model/effort unspecified | 116.511 s | **1:57** | 16/17 | 1 / 0 | 0 | CAPTCHA reached; home address incomplete; unnecessary mailing fill |

76 seconds converts to **1:16**. The installed WIC default-CLI run here took 116.511 seconds; do not substitute a controlled planner-subset duration or attribute its unspecified model to Sol. Jev is promising for speed and low API-price estimates, but these two repeats do not establish it as the best complete-form system: it filled fewer correct answers and required unnecessary questions in both runs.

**Correct completion: 0/4.** Each source supplies all applicable answers. The 17-answer score includes correct false/default flags. Two conditional controls are scored separately: mailing address and Medi-Cal case number should remain blank. Nano/Jev left both correctly blank; Codex filled the conditional mailing address unnecessarily, so its conditional-control score is **1/2**. A 16/17 main score alone hides this additional error.

WIC is a single-page form and Submit exists before any work. Reaching that button or CAPTCHA is not reaching a correctly completed submission-ready state. Time to correct completion is **unknown/unachieved**, not 8 seconds for Jev or 116 seconds for Codex. No application was submitted or certified.

## Usage and cost for every executed run

| Run | Scans / prompts | Sum of model-call durations¹ | Fill → readback | Input / output tokens | Nano context units | Direct API-key charges | Published-rate estimate² |
|---|---:|---:|---:|---:|---:|---:|---:|
| Nano 1 | 3 / 9 | 334.835 s | 8.232 s | Not exposed | 23,718 | **$0 API cost** | No API-token billing; device/operating cost unmeasured |
| Jev 1 | 2 / 2 | 0.501 s | 7.649 s | 36,848 / 15,762 | N/A | Billed amount unknown | $0.001547616 |
| Jev 2 | 2 / 2 | 0.519 s | 7.643 s | 36,848 / 15,763 | N/A | Billed amount unknown | $0.001547616 |
| Codex default 1 | 3 / 9 | 125.335 s | 8.811 s | 178,677 / 3,638 | N/A | $0, subscription transport | Unknown actual model/cache basis³ |

¹ Mapper and gap analyst calls run concurrently. Their summed durations can exceed whole-engine wall time; do not add this column to the checkpoint duration. Audit durations are rounded to milliseconds; the individual companion receipts retain higher precision for Jev. Initial model download, source import, configuration, operator inspection and permission waiting are outside the checkpoint timer. The observer's small forwarding overhead is included.

² Jev input × $0.042 / 1,000,000, output free: `36,848 × 0.042 / 1,000,000 = $0.001547616` per repeat. Both repeats total **$0.003095232 estimated**, with no invoice checked. [TypeSafe's model documentation](https://docs.typesafe.ai/models), rechecked October 9. Nano context units are not billable provider tokens. Device, energy, subscription allocation, infrastructure and caseworker costs remain unknown for every run.

³ v14's form-provider save path sets Codex model to blank and `/v1/role` passes no reasoning choice. The companion ignores user config and invokes the CLI without explicit model/effort flags. Neither this chat's selected model nor the CAPTCHA image settings attest the form model. API pricing is therefore unknown for this actual run. For a **hypothetical all-uncached token replay**, the same counts would price at **$0.393734 if Sol** or **$0.0196867 if Luna**. These conditional scenarios are not its estimated bill and are not used to rank cost. Current primary rate sources: [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna). Cache and reasoning counters were not retained by this form contract; reasoning tokens must not be added again to output usage. [Pricing snapshot](../evaluation/installed-v014/pricing-2026-10-09.json).

## What failed, precisely

**F01 · all four runs:** Home Address contains street and unit only. City, state and ZIP from the source are missing. Nano's required-control HTML validation still passes and its activity log reports no blocked writes or address gap. The shared adapter/engine composes street and unit for this single box; it does not compose the full address. This is a shared transformation defect, not proof that only Nano reasoned poorly.

**F02/F03 · both Jev runs:** the final pre-fill scan defers the supplied Medi-Cal classification at **0.87 / 0.89 confidence**, below the configured 0.90 threshold. No coverage option is filled. It also asks for a different mailing address and a Medi-Cal case number despite the source making those fields not applicable. The side panel visibly asks all three questions and stops after filling ten verified writes. Deferral is conservative, but the complete source still does not produce an unassisted workflow. First scans approved coverage; the second scan changed that decision before filling. Per-scan confidences and usage are in the ledger.

**F08 · Codex repeat 1:** Mailing address (if different from home address) is filled with street and unit even though the source's mailing and home addresses match. The expected conditional behavior is blank. This is an additional applicability error outside the 17-answer denominator. It is distinct from the incomplete Home Address.

All source-matched identity/contact answers were checked before any repair. No incorrect identifier substitution, certification or application submission was observed in these four WIC runs. That scope does not establish broader identifier or submission safety.

[Shareable error catalog with reproduction steps and historical cases](BENCHMARK_ERRORS.md) · [Per-run JSON, stage timestamps, usage and deferred classifications](../evaluation/results/installed-v014-oct9.json) · [CSV for benchmarking](../evaluation/results/installed-v014-oct9.csv).

## Which models completed CAPTCHA?

**The follow-up accepted two native checkboxes in three attempts; no live image classifier was called.** The original four form receipts retain their first stopped checkpoints unchanged. Separate [native receipts](../evaluation/results/captcha-native-oct9.json) record the later attempts and continuation, so the original Nano/Codex durations are not presented as time to completion.

| Installed native attempt | Image fallback configured, not called | Engine time | Visible outcome | Post-acceptance form workflow |
|---|---|---:|---|---|
| `oct9-native-nano-r1` | Nano | 0.031 s | Handoff: widget offscreen | Not started |
| `oct9-native-nano-r2` | Nano | 2.494 s | Checkbox accepted after viewport assistance | CLI default, not Nano: stalled at `navigation_unknown` after 75.357 s; 6 calls, 115,804 input / 2,635 output tokens |
| `oct9-native-codex-sol-low-r1` | CLI Sol Low | 1.882 s | Checkbox accepted after viewport assistance | CLI default: reached final review after 39.105 s; 3 calls, 59,597 input / 1,296 output tokens; still incorrect |

All three native attempts made **zero image calls and cost $0 marginal API**. The two continuations used the global CLI default without model/effort flags: $0 direct API-key transport charges, with model-price estimate and billed/operating cost unknown. The original Nano page's continuation is therefore not a Nano-only success. Both retained an incomplete home address and an unnecessary conditional mailing fill; neither correctly completed the application. The review badge's 50 verified entries repeat prior readbacks, not 50 distinct correct answers (F09).

The computer stayed unlocked during these attempts. One approved batch covered the checkbox and follow-ups; the extension used its own per-attempt authorization. Manual viewport preparation is counted for both accepted attempts. No application was submitted. Later inspection found an unchecked/recreated widget after the review delay; expiry versus recreation was not isolated.

**Fresh image classification was executed separately:** six calls each for Nano, CLI Sol/Luna Low/Extra High and Eve/Sol Low on three saved grids. Sol Low and Extra High each matched 4/6 exact sets; Eve 3/6, Luna Low 2/6, Luna Extra High 1/6, Nano 0/6. Jev has no image adapter; image accuracy is untested. [Every returned/missed/extra tile, requested configuration, duration, usage and cost](CAPTCHA_OCT9.md).

Earlier live WIC image acceptance used a shared external browser relay. Luna Low completed one image session on its first answer; Luna Extra High completed one after a rejected answer and accepted follow-up. Those historical sessions are distinct from the new native checkbox tests and saved-image comparison. [Earlier model/effort results](../README.md#which-model-clicked-through-captcha) · [Every CAPTCHA run's speed/cost](CAPTCHA_RUN_METRICS.md).

Nano/Codex full-form repeat 2 and fresh native image sessions remain unexecuted, rather than measured failures. Jev has two full-form repeats, both stopped at questions. There is no native live-image model leaderboard yet.

## What the Jev result measures

The provider returned **`jev-1.13.0`** in these receipts. It classifies field purposes; JavaScript validation/filling controls the application. Confidence is fixed at 0.90 and uncertain decisions become questions. There is **no Eve/Sonnet coordinator or generative fallback** in this extension route. Separate Eve tests used Sol Low and must not be combined with these Jev results as though a hybrid agent was executed.

A hybrid that uses Jev for bounded decisions and a generative agent for interpretation, recovery and navigation is a different system. Its prompts, context, accepted confidence, tools, site/record, assistance and completion rubric need to be matched before comparing quality. Higher quality from another Jev-assisted system would not establish a different underlying Jev intelligence. This batch establishes our version; it does not attest another deployment’s Jev version or reproduce its reported success.

## Can a better harness keep Jev moving?

**Yes, targeted recovery could remove these unnecessary stops; a blind retry loop is not yet a demonstrated fix.** The runner already has a loop with up to three same-page fill passes ([runner](../sidepanel/sidepanel.js#L2947), [pass limit](../sidepanel/sidepanel.js#L48)). It returns for unresolved/blocked fields before reaching another pass. Both Jev executions hit that path after the second scan, so adding a loop around the same classifier would repeat a decision that can vary: Medi-Cal was approved in the first scan and deferred at 0.87 / 0.89 in the later scan.

The [Jev request](../model-bridge/jev.mjs#L29) sends field descriptions and available source purposes, with participant values kept local. The classifier therefore cannot inspect the actual No coverage answer or compare home/mailing values. Its adapter turns low-confidence classifications into gaps, and the [local planner](../shared/agentic-planner.js#L605) can turn an optional hinted control into a question even when a model chooses leave. The [analysis merge](../sidepanel/sidepanel.js#L2453) appends remaining model gaps. These code paths support a harness/applicability explanation for the false questions; a controlled fix still needs testing.

A proposed recovery path should:

1. Resolve conditional applicability locally from the reviewed source and versioned site rules: coverage No means no case number; matching home/mailing means no separate mailing answer.
2. Preserve a prior approved purpose and verified readback only while the source revision, person, field identity, options and document remain unchanged. Do not silently reuse a stale mapping after a changed question.
3. Retry only the remaining unresolved applicable controls with their exact site hints and local validation. Stop after a bounded number of attempts or when no new correct field is verified; retain every attempt's timing, usage and outcome.
4. Compose and verify the full home address, then continue to CAPTCHA and final review while retaining the existing stop before Submit.

This is a proposed experiment, **not a tested Jev improvement**. Compare current v0.14 and recovery variants on the same complete records, genuinely missing-answer cases, Medi-Cal Yes/No, and same/different mailing addresses. Measure correct completion, false questions, extra writes, interventions, seconds and tokens/cost together. A correct 17/17 answer score also needs both not-applicable controls correct; merely reaching the end is insufficient.

## Limits and next verification

This is an interim, sequential batch on one fictional record and one shared device/profile. Nano/Codex each have one repeat; Jev has two. There is no randomized model speed comparison, complete application cost, general CAPTCHA reliability estimate or fresh harder-site result. The three-grid image comparison and two native checkbox acceptances do not establish those outcomes. Faster planning is useful, but fixing address composition and unnecessary questions is necessary before any of these can demonstrate correct full-form preparation.

Raw source records, workflow IDs, exported audits, prompts, participant screenshots and credentials remain local. The public results whitelist configuration, stage times, scores, counts, token usage and reviewed error descriptions.
