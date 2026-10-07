# Nava Benefit Form Assistant Chrome Extension

An experimental Chrome extension that helps a caseworker prepare benefit forms, review missing answers, and verify the values it fills. **The caseworker reviews and submits. The extension never submits an application.**

Version **0.12.0** · Nava Labs tester release · October 7, 2026

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

Jev's IHSS failures were low-confidence deferrals of an unavailable other-person identifier, rather than an unsafe identifier substitution. The current adapter did not turn that deferral into a required missing-answer question. WIC's perfect **planning** score still permits the known incomplete street-only address and excludes two optional controls. Higher confidence thresholds left all six scored outcomes unchanged.

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
- Uses a mapper, gap analyst, and reviewer to plan field assignments. Gemini Nano runs on the device; optional Codex and Claude CLIs use a paired local companion.
- Fills approved values, reads them back, asks for missing answers, and follows approved Next/Continue steps. Known-site adapters cover Riverside WIC, Riverside IHSS, and parts of BenefitsCal.
- Tracks several applications, pauses and resumes checkpoints, and exports a value-free activity log.
- Shows a prototype recertification workspace for upcoming renewals, updates, and client authorization.

**What remains unfinished:** no saved live-site trial reached unassisted final review. Address completeness, missing decisions, and long BenefitsCal flows need work. CAPTCHA and one-time codes require human completion. The extension does not solve CAPTCHA. Eve was tested as a planning transport in a separate harness; Eve and Jev are not selectable extension runtimes in this release. Jev has six measured decision-stage requests; integrated browser execution remains untested.

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

If the model is unavailable, the extension reports an error. For the subscription CLI alternative, follow [the companion setup](model-bridge/README.md). To explore just the interface without installing or running AI, open `http://127.0.0.1:4173/sidepanel/index.html?preview=1&demo=1`; this preview simulates results and is not a model test.

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
