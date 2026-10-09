# Installed v0.14 WIC batch

This protocol checks the extension actually loaded in desktop Chrome. It measures source agreement, time to the first terminal checkpoint, and native CAPTCHA acceptance separately. The [error catalog](../../docs/BENCHMARK_ERRORS.md) gives field-level failures and reproduction steps.

## Fixed conditions

- Source commit `fe2bd4e6e3425ba5510f998f47f5c40129861dd4`, v0.14.0 UI features observed in the installed side panel.
- Chrome 154.0.8037.98, macOS 15.6, Codex CLI 0.162.0-alpha.2; one unlocked device and shared browser profile. Runtime initialization/import/pairing are outside timed form execution.
- Fresh [Riverside WIC page](https://www.ruhealth.org/appointments/apply-4-wic-form) per full-form repeat. One fully fictional, complete source record; source SHA-256 is retained in the result. No production applicant data and no submission.
- Sequential order, targeting two repeats for each installed form provider: Nano, Jev 1.13.0 at confidence 0.90, and Codex CLI default. The interim ledger has four executed runs; pending repeats are not counted. No runtime fallback or operator answer repairs. Eve is an image adapter here, not an installed form provider. Claude CLI is unavailable on this host.
- A loopback observer forwards the unchanged v0.14 companion contract and records value-free usage/timing plus locally retained decisions. Its small forwarding overhead is included in the form wall clock. Provider secrets and pairing tokens are excluded from the public artifacts.

## Outcomes and denominators

**Correct completion** requires all 17 applicable semantic answers correct, no false gaps or manual answer/navigation repair, visible CAPTCHA acceptance, and extension final review. WIC has one page and its Submit button exists before filling; a visible Submit button is not evidence of completion.

The 17 answers are full name, date of birth, complete home address, mobile, permission for texts, email, language, Medi-Cal coverage, five eligibility/category flags, three appointment flags and clinic. Street, unit, city, state and ZIP must all be present in Home Address. Optional mailing address and case number are correctly blank when not applicable and are scored separately. Correct false/default checkboxes count toward source agreement; 17 answers do not mean 17 writes or 17 autonomous model decisions.

Each repeat preserves correct / incorrect / missing answers, HTML validity, false gaps, mechanical verified writes, terminal reason, prompt count, timestamps, usage and unknown metrics. Questions caused by conservative deferral count as workflow failures even when no wrong value is written. Keep time to a failed checkpoint in the table; do not substitute it for time to successful completion.

**CAPTCHA outcomes** retain reached, attempted, accepted, failed, inconclusive and not attempted separately. A shared deterministic executor handles checkboxes with zero model calls. Record checkbox-only acceptance separately from image sessions, exact requested image model/effort, submitted rounds, refusals, provider rejection, unsupported layouts and actuator failures. A model is only credited with image solving when it actually classified an encountered grid and the live session visibly accepted it. Saved-grid classification remains a separate experiment.

The staged native CAPTCHA matrix is Nano, Jev without an image adapter, Eve/Sol Low, and CLI Sol/Luna at Low/Extra High, up to two repeats each. Image selections do not change v14's form-planner identity. Runtime settings are recorded before the attempt. A form that stops at missing-answer questions is retained as a form failure; any later CAPTCHA-only probe or repaired workflow must be labeled separately. Planned or approval-pending actions are not executed test runs.

## Timing and usage

Start the timer immediately before **Continue** launches analysis. Use exported event timestamps for scan, fill/readback and the first terminal checkpoint. Separate:

1. Form wall time to terminal checkpoint, including engine rescans.
2. Fill-to-readback interval and planning scan count.
3. Sum of model call durations, which can exceed wall time because mapper and gap analyst run concurrently.
4. CAPTCHA actuator interval, subsequent rescans and final-review interval.
5. Operator inspection, configuration and permission waiting, which are not model runtime.

Sum each scan's fresh usage once. Do not add dashboard cumulative usage to the event total. Nano context units stay separate from API input/output tokens. A `null` metric means unavailable, not zero. Pricing is in [the October 9 snapshot](pricing-2026-10-09.json). For Jev, input tokens × $0.042 / 1,000,000; output is free. Codex form calls in v14 omit explicit model/reasoning flags, so their model-price scenario remains unknown. Explicit image calls can use the appropriate published rate and measured cache counters. Actual billed, subscription allocation and total operating costs are not inferred.

## Preserve and summarize a repeat

Export **activity log** through the installed side panel after each terminal state; keep raw exports local. Record the pre-click start time, runtime settings, observed field errors and assistance in an observations file. Retain companion receipts locally and review a public whitelist of counts/configurations/deferrals; do not publish raw prompts, participant records, authentication headers, image pixels or browser screenshots with unrelated tabs.

`summarize.mjs` recomputes timings/usage from those local exports and writes the reviewed public ledger. Pass the local evidence directory explicitly. Field scores are adjudicated from visible DOM/AX readback and the fictional source, not inferred from an engine's “verified” counter. Inspection may mask contact values in browser DOM output; the native accessibility value can support a separately documented comparison.

```sh
node evaluation/installed-v014/summarize.mjs /absolute/path/to/local/evidence
```

The small sample, single fictional record, shared Chrome history, different challenge types and sequential run order preclude a fair general model ranking or reliability estimate.
