# Nava Benefit Form Assistant Chrome Extension

An experimental Chrome extension that helps a caseworker prepare benefit forms, review missing answers, and verify the values it fills. **The caseworker reviews and submits. The extension never submits an application.**

Version **0.13.0** · Nava Labs tester release · October 7, 2026

## Test results

**Live application quality remains unfinished: 0/8 October 5 workflows reached unassisted final review.** The newer tests below measure field planning only, using frozen controls and fictional records. They do not show complete government applications.

| Tested configuration | WIC planning | IHSS subset | CalFresh subset | WIC median time | WIC model-price estimate¹ |
|---|---:|---:|---:|---:|---:|
| Codex CLI · GPT-6.1 Sol Low | 2/2 | 2/2 | 0/2 | 48.8 s | $0.1123–$0.1370 |
| Codex CLI · GPT-6.1 Sol Extra High | 2/2 | 2/2 | 1/2 | 72.5 s | $0.1231–$0.1478 |
| Codex CLI · GPT-6 Luna Low | 2/2 | 2/2 | 1/2 | 28.1 s | $0.0048–$0.0059 |
| Codex CLI · GPT-6 Luna Extra High | 2/2 | 2/2 | 1/2 | 41.6 s | $0.0058–$0.0070 |
| Eve 0.71.2 · GPT-6.1 Sol Low | 2/2 | 2/2 | 2/2 | 37.6 s | $0.0370–$0.0427 |
| Jev 1.13.0 · decision stage | 2/2 | 0/2 | 2/2 | 0.343 s | $0.000607 |

Passed / attempted, with two repeats per case. CLI/Eve use three planning role calls per attempt; Jev uses one choice-classification request. Prompts, task contracts and provider routes differ: this is a system comparison, not an isolated model or harness speed ratio. Requested CLI/Eve models are recorded; only Jev returned a provider-resolved model ID.

¹ CLI/Eve prices are hypothetical API scenarios; those runs used subscription access. Jev prices use measured input tokens and [TypeSafe's published rate](https://docs.typesafe.ai/models); the six Jev calls total about **$0.00213 estimated**, with no invoice verified. Total operating cost and cost per completed application remain unknown.

![Jev quality and response time across three cases](docs/assets/jev-planning-results.svg)

The original classifier-only Jev pilot missed a required IHSS question after low-confidence deferral. Version 0.13 adds explicit missing-answer questions, a protected Jev companion and a selectable extension runtime. Its new transport/planner tests are below; installed Chrome execution is still pending.

### Gemini Nano and playbook results

**Live Nano WIC:** 15/17 and 16/17 answers matched before help. They reached 17/17 only after **2 and 3 operator answer interventions**, respectively. Journeys took 21.7 and 28.5 minutes, including waiting and help; both paused at CAPTCHA. Historical IHSS verified 32/44 visible controls, which measures persisted writes rather than answer correctness. Both CalFresh attempts encountered runtime/false-gap/recovery failures and have no complete quality score. Nano has no per-token API charge; device and operating costs were not measured.

The separate local WIC experiment ran the same frozen 17-answer task twice per variant:

| Configuration | AI calls per attempt | Repeat 1 | Repeat 2 | Local wall time, repeats 1 / 2 |
|---|---:|---|---|---:|
| Gemini Nano · original three-role planner | 3 | 16/17 | 16/17 | 69.2 s / 81.2 s |
| Deterministic JavaScript site playbook | 0 | 17/17 | 17/17 | 3.1 ms / 1.2 ms |
| Gemini Nano · compact guided playbook | 1 | 17/17 | **Invalid JSON; fill never started** | 8.7 s / 16.0 s |

These are local source-agreement scores after DOM readback, not complete government applications. The fast demo uses **JavaScript rules, not a shell script**. No evidence establishes that Foad's Scribe generated it. The guided variant changes call count, prompt size, output format and address composition together; it is not a prompt-only A/B test. One faster success and one parsing failure do not establish reliability. Chrome's exact Nano model version and reasoning setting were not exposed in the recorded runs. [All six playbook attempts](evaluation/results/nano-playbook-summary.json) · [All live metrics](evaluation/results/live-summary.json)

### Jev through the extension planner · October 7

| Prompt / integration batch | WIC | IHSS subset | CalFresh subset | Calls | DOM execution |
|---|---:|---:|---:|---:|---|
| First integration prompt | 0/2 | 2/2 | 2/2 | 6 | Not tested |
| Explicit field identifiers and hints · current v0.13 | 1/2 | 2/2 | 0/2 | 6 | Not tested |

Both batches used the actual extension planner, authenticated loopback companion and real `jev-1.13.0` API at confidence **0.90**. No operator repaired an answer. All attempts are retained, including the first batch. Jev exposes no configurable reasoning effort here; confidence is a decision threshold, not a reasoning setting. Required low-confidence classifications become caseworker questions. That repaired the silent IHSS omission, but the current batch deferred WIC clinic/text/Medi-Cal and CalFresh housing/county controls. No incorrect approved mappings were observed. Changing the prompt did not consistently improve quality.

The current batch's API durations were 0.133–0.268 seconds; planner wall time was 0.136–1.330 seconds, with startup health checking in the first attempt. The six calls cost **about $0.00228 at published input-token rates**, with billed cost unknown. These tests do not exercise live-site navigation, composite address accuracy, or final review. [First batch](evaluation/results/jev-extension-planning-initial.json) · [Current batch](evaluation/results/jev-extension-planning.json)

### Which model clicked through CAPTCHA?

| Model / reasoning | Test context | Attempts / accepted | Image challenges |
|---|---|---:|---:|
| **GPT-6.1 Sol · Extra High (`xhigh`)** | This Codex chat's browser control; explicit WIC permission | **1 / 1 checkbox accepted** | 0 encountered |
| Gemini Nano · version/effort not captured | Extension stopped at WIC checkpoint | 0 / not tested | Not tested |
| Historical Codex CLI · model/effort unknown | Extension stopped at WIC checkpoint | 0 / not tested | Not tested |
| GPT-6.1 Sol · Low / Extra High; GPT-6 Luna · Low / Extra High | Frozen CLI planning trials | 0 / not tested | Not tested |
| Eve · GPT-6.1 Sol Low | Frozen planning transport | 0 / not tested | Not tested |
| Jev 1.13.0 · no reasoning control; confidence 0.90 | Decision classifier and extension planner | 0 / not tested | Not tested |

The one accepted checkbox was a **separate browser-control test with this chat**, not Nano or the extension's CLI. It proves neither image-challenge solving nor repeat reliability. The extension pauses at CAPTCHA and has no challenge-solving tool. No application was submitted. [CAPTCHA evidence summary](evaluation/results/captcha-summary.json)

**October 7 capability check:** this Chrome runtime reports Nano text and image input as available. Two actual ordinary-image calls correctly identified a circle's color in **8.28 s and 2.76 s**. These were two colored shapes, not CAPTCHA images; they add **zero CAPTCHA successes**. Exact Nano version/reasoning and total operating cost remain unknown. [Both image-input receipts](evaluation/results/captcha-runtime-readiness.json)

The new [CAPTCHA comparison harness](evaluation/captcha/README.md) prepares Nano, Jev, Eve and explicit CLI model/reasoning configurations for action selection with a shared browser relay. It keeps action selection, checkbox acceptance and image-challenge solving separate. The live batch is pending action-time checkpoint confirmation; Jev's installed Chrome test is pending the manual extension update required by the browser-control URL restriction. Prepared code is not a measured model success.

[Read the findings and limitations](docs/BENEFIT_SITE_EVALUATION.md) · [Inspect all measured result tables](evaluation/results/README.md) · [Run the frozen benchmark](evaluation/controlled-planning/README.md)

<details>
<summary>More charts: WIC planning speed and historical IHSS completeness</summary>

![WIC CLI and Eve planning time](docs/assets/wic-planning-speed.svg)

![Historical IHSS visible-control coverage](docs/assets/ihss-visible-coverage.svg)

![Historical IHSS model time](docs/assets/ihss-model-time.svg)

The IHSS charts are one historical run per runtime. Readback coverage measures persisted writes, not correct answers or complete applications; the historical CLI model was not captured.

</details>

## What it does today

- Imports a client record from labeled JSON, a reviewed document, or a configured read-only organization connector. Bundled records are fictional.
- Uses a mapper, gap analyst, and reviewer to plan field assignments. Gemini Nano runs on the device; optional Codex and Claude CLIs use a paired local companion. Experimental Jev classifies field purposes through that companion, with local validation and explicit questions for uncertain answers.
- Fills approved values, reads them back, asks for missing answers, and follows approved Next/Continue steps. Known-site adapters cover Riverside WIC, Riverside IHSS, and parts of BenefitsCal.
- Tracks several applications, pauses and resumes checkpoints, and exports a value-free activity log.
- Shows a prototype recertification workspace for upcoming renewals, updates, and client authorization.

**What remains unfinished:** no saved live-site trial reached unassisted final review. Address completeness, missing decisions, and long BenefitsCal flows need work. CAPTCHA and one-time codes require human completion. The extension does not solve CAPTCHA. Eve was tested as a planning transport in a separate harness. Jev is now selectable in v0.13; its installed Chrome execution remains unverified.

Read [the current testing writeup](docs/BENEFIT_SITE_EVALUATION.md), or [the developer guide](DEVELOPER_GUIDE.md).

## Try it in 10 minutes

Use desktop Chrome 138+ and fictional data. No production database or paid API key is required for the local fixture. Gemini Nano still needs a supported device and an available Chrome built-in AI runtime; enabling it may download a model.

1. Download this repository with **Code → Download ZIP**, unzip it, or clone it. Select the folder containing `manifest.json` when installing.
2. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select that folder.
3. In a terminal inside the folder, run `python3 -m http.server 4173 --bind 127.0.0.1`.
4. Open `http://127.0.0.1:4173/demo/extensive-application.html?step=1&reset=1`.
5. Click the extension icon. Keep Gemini Nano under **Model runtime** and choose **Enable agentic AI**.
6. Choose **Paste client JSON → Use a fictional sample record → Continue**. Choose **Analyze this form**, then continue.
7. Review questions and every filled value. Verify the runner stops before certification and Submit. Export the activity log from the dashboard.

If the model is unavailable, the extension reports an error. For the subscription CLI or Jev alternatives, follow [the companion setup](model-bridge/README.md). To explore just the interface without installing or running AI, open `http://127.0.0.1:4173/sidepanel/index.html?preview=1&demo=1`; this preview simulates results and is not a model test.

## Testing this sprint

[The tester guide](docs/TESTER_GUIDE.md) gives repeatable tasks, expected behavior, known issues, and a findings template. Start with the local fixture; live government sites should use only approved synthetic test data and stop before any submission.

## Product demo

[Watch the recorded demo (MP4)](docs/assets/nava-form-filling-assistant-demo.mp4)

![Demo preview](docs/assets/nava-form-filling-demo.gif)

This recording shows an earlier local fixture build. It illustrates the workflow, not current model speed or successful completion of a government application.

## Development and evaluation

```sh
npm ci
npm run check
npm test
```

The runnable [controlled evaluation harness](evaluation/controlled-planning/README.md) and [reviewed result tables](evaluation/results/README.md) distinguish planning quality, DOM execution, and full journeys. [Protected Jev access](docs/JEV_TEST_ACCESS.md) documents the completed API pilot and protected rerun instructions.

This Nava organization repository preserves the history of [the original prototype](https://github.com/gobrando/nava-form-filling-assistant-chrome-extension), starting from `0a015b446a709095c9f0ebac9638f483cc67f8a1`. The public release branches from the already-public prototype; new raw live-site audits and private API source snapshots are excluded. This is a research prototype, not a production benefit service.
