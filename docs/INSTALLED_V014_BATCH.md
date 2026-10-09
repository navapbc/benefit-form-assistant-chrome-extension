# Installed v0.14 WIC results · October 9

**Four fresh form runs are saved; none correctly completed the application.** Nano and Codex reached CAPTCHA with an incomplete home address. Jev filled most values quickly, then blocked on unnecessary questions in both repeats. Native CAPTCHA execution is still pending: no native attempt or acceptance is claimed in this batch.

These runs exercised the installed extension on fresh Riverside WIC pages with one complete fictional record, zero operator answer repairs and an unlocked computer. Version-specific v14 controls were observed; the user reported loading v0.14. The installed manifest/source files were not independently attested. Release source commit: `fe2bd4e6e3425ba5510f998f47f5c40129861dd4`. Chrome 154.0.8037.98, macOS 15.6, Codex CLI 0.162.0-alpha.2. [Protocol and metric definitions](../evaluation/installed-v014/README.md).

## Speed, quality and workflow outcome

| Actual installed run | Time to first stopped checkpoint | Correct / 17 | Incorrect / missing | False questions | Workflow outcome |
|---|---:|---:|---:|---:|---|
| Nano repeat 1 · Chrome-managed model/effort | 243.297 s | 16/17 | 1 / 0 | 0 | CAPTCHA reached; home address incomplete |
| Jev 1.13.0 repeat 1 · confidence 0.90 | 8.390 s | 15/17 | 1 / 1 | 3 | Caseworker questions; Medi-Cal unanswered |
| Jev 1.13.0 repeat 2 · confidence 0.90 | 8.450 s | 15/17 | 1 / 1 | 3 | Same blocking questions |
| Codex CLI default repeat 1 · model/effort unspecified | 116.511 s | 16/17 | 1 / 0 | 0 | CAPTCHA reached; home address incomplete; unnecessary mailing fill |

**Correct completion: 0/4.** Each source supplies all applicable answers. The 17-answer score includes correct false/default flags. Two conditional controls are scored separately: mailing address and Medi-Cal case number should remain blank. Nano/Jev left both correctly blank; Codex filled the conditional mailing address unnecessarily, so its conditional-control score is **1/2**. A 16/17 main score alone hides this additional error.

WIC is a single-page form and Submit exists before any work. Reaching that button or CAPTCHA is not reaching a correctly completed submission-ready state. Time to correct completion is **unknown/unachieved**, not 8 seconds for Jev or 116 seconds for Codex. No application was submitted or certified.

## Usage and cost for every executed run

| Run | Scans / prompts | Sum of model-call durations¹ | Fill → readback | Input / output tokens | Nano context units | Direct API-key charges | Published-rate estimate² |
|---|---:|---:|---:|---:|---:|---:|---:|
| Nano 1 | 3 / 9 | 334.835 s | 8.232 s | Not exposed | 23,718 | $0 | No API-token billing; operating cost unknown |
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

| Current v14 installed form configuration | CAPTCHA reached by workflow | Native attempts | Visible native acceptance | Images actually classified |
|---|---:|---:|---|---:|
| Nano · one form run | 1 | 0 | Not attempted; staged | 0 |
| Jev 1.13.0 · two form runs | 0 | 0 | Not reached; form questions | 0 |
| Codex default · one form run | 1 | 0 | Not attempted; staged | 0 |
| Eve / explicit Sol-Luna image settings | No new run executed | 0 | Not tested in this batch | 0 |

There is **no native live model leaderboard yet**. Native fixture execution and saved-grid classification are separate evidence. Earlier live WIC acceptance used a shared Codex browser relay: Nano, Jev and Eve each 2/2 checkbox acceptances; Sol Low/Extra High each 1/2 confirmed and one inconclusive; Luna Low/Extra High each 2/2 accepted, with one completed image session each. Only those two Luna sessions encountered and completed images; Extra High required a rejected first answer and an accepted follow-up. [Earlier model/effort results and exact scope](../README.md#which-model-clicked-through-captcha) · [Every historical CAPTCHA run's speed/cost](CAPTCHA_RUN_METRICS.md).

The first Nano CAPTCHA checkpoint is staged and its action-time batch confirmation is pending. Native side-panel work then paused when Chrome changed to another user activity, **before** the second Codex repeat began. This is an environment interruption, not a failed model attempt. Nano/Codex repeat 2 and the staged CAPTCHA matrix remain unexecuted; they are excluded from the four-run denominator. The browser tool requires action-time confirmation for CAPTCHA completion; this tooling requirement is separate from the extension's own one-attempt authorization.

The planned image matrix uses Nano, Jev without an image adapter, Eve/Sol Low, and explicit Codex Sol/Luna Low/Extra High. A successful checkbox-only attempt will be credited to the shared native actuator with zero image calls; image capability will only be credited to a runtime actually called on an encountered grid. Every attempted CAPTCHA will retain its duration, usage, cost basis, outcome and rejection/handoff details, including failures.

## Limits and next verification

This is an interim, sequential batch on one fictional record and one shared device/profile. Nano/Codex each have one repeat; Jev has two. There is no randomized model speed comparison, complete application cost, native CAPTCHA accuracy estimate or fresh harder-site result. Faster planning is useful, but fixing address composition and unnecessary questions is necessary before any of these can demonstrate correct full-form preparation.

Raw source records, workflow IDs, exported audits, prompts, participant screenshots and credentials remain local. The public results whitelist configuration, stage times, scores, counts, token usage and reviewed error descriptions.
