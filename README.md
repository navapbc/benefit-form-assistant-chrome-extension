# Nava Form-Filling Assistant

An experimental Chrome extension for preparing benefit applications from one client record. It fills forms, asks for missing information, and helps a caseworker review the answers across several applications.

**Start here:** [Set it up](#try-it-in-10-minutes) · [Feature guide](docs/FEATURE_GUIDE.md) · [Try it on real sites](docs/TESTER_GUIDE.md) · [Test results](docs/TEST_RESULTS.md) · [Engineering review plan](docs/PRODUCTION_GAPS.md)

Current tester build: **[v0.16.0](docs/RELEASE_NOTES_v0.16.md)**, October 19, 2026. This combines the extension work from both repositories; historical test results retain their original build labels.

This is a working prototype with unresolved live-site failures. **The current extension leaves certification, signatures, and final submission to a person.** Reliable preparation of multiple real forms without repeated human help is the testing goal; it has not been demonstrated yet.

## Try it in 10 minutes

Allow extra time if Chrome needs to download its on-device model. You need desktop **Chrome 138 or newer**; Nano also needs a compatible device. The extension does not need a production database to try it.

1. Download this repo with **Code → Download ZIP** and unzip it, or clone it. Find the folder containing `manifest.json`.
2. Open `chrome://extensions`, turn on **Developer mode**, select **Load unpacked**, and choose that folder. Confirm version **0.16.0**. Refresh any form tabs already open.
3. Open the [real Riverside WIC form](https://www.ruhealth.org/appointments/apply-4-wic-form) and click the extension icon. Keep the side panel open during the run.
4. Open **Model runtime**. For the simplest setup, select **Chrome on-device Gemini Nano**, save with **Use this model runtime**, and choose **Enable agentic AI** when shown. If Nano is unavailable, use the [Codex or Claude companion setup](model-bridge/README.md).
5. Choose **Paste client JSON → Use a fictional sample record → Continue**. Review the source record. On the application-selection screen, check **Analyze this form** for the open page.
6. Choose **Continue** to start: **the run begins automatically**. Watch the form and panel; check the complete address, conditional questions, and program choices. If it pauses and offers **Fill through application**, use that to continue after reviewing the stop. Stop before certification or submission.
7. Record whether it reached final review correctly, where it stopped, and every time you had to help. Choose **Export activity log** from the dashboard.

**Want an AI agent to handle installation?** Give it the [copyable setup request](docs/TESTER_GUIDE.md#ask-an-ai-agent-to-set-it-up). The [tester guide](docs/TESTER_GUIDE.md) also covers IHSS, BenefitsCal, multiple applications, and how to report a failure.

Use fictional test records on the real forms; do not file a test application. The bundled sample may not answer every program's questions—record those genuine missing answers rather than inventing them. A local practice form is available as a setup check, but passing it is not evidence that a real site works.

## What is included?

| Feature | What you can do | How to try it |
|---|---|---|
| **Local AI with Gemini Nano** | Plan form answers on the device, with **$0 model API charge**. Compatible hardware/downloads and device costs still apply. | Select Nano in **Model runtime**, then enable it. |
| **Codex, Claude and Jev options** | Compare alternative form planners through a paired local companion. | [Choose an approach](#choose-a-form-filling-approach). |
| **Document uploader** | Extract proposed fields from documents/images, inspect their sources, and review conflicts before import. | Choose **Read a document**; [supported files and steps](docs/FEATURE_GUIDE.md#document-upload-and-review). |
| **Self-service connector setup** | Select a data provider, test a configured service, review field mappings, and retrieve a record. | Use **Data source → Connect**; [try the fictional connector](docs/FEATURE_GUIDE.md#organization-database-connector). A real provider needs its own authorized backend adapter. |
| **Several applications from one record** | Fill WIC, IHSS and BenefitsCal, with separate tabs/progress and up to three concurrent runs. | Select programs on the application screen; CalFresh/Medi-Cal/CalWORKs share one BenefitsCal application. |
| **Questions, review and evidence** | Answer missing facts, inspect written values and source evidence, and export an activity log. | Open the application's questions/review actions; a verified write still needs an answer-correctness check. |
| **Pause, resume and handoff** | Pause a run, record why it needs help, and assign/accept a handoff within the browser profile. | Use **Pause or hand off** on an application card. |
| **Renewals / recertification** | Review a caseload's upcoming renewals, data readiness, outreach drafts and client authorization. | Open **Recertification status**; [try the workflow](docs/FEATURE_GUIDE.md#renewals-and-recertification). Requires caseload data; outreach is not automatically sent. |
| **CAPTCHA attempts** | Opt into a bounded attempt at a supported challenge and see whether it actually continues. | [Current evidence and limits](#can-it-get-past-captcha-without-a-person). |
| **Optional shared API and participant questions** | Send redacted planning requests to a configured service and request a client-question link. | [API relationship and setup](docs/FEATURE_GUIDE.md#shared-planner-api-and-participant-links). The server and participant page live separately. |

[Feature guide: setup, test steps and limits for each feature](docs/FEATURE_GUIDE.md). It also identifies what needs design review and engineering hardening.

## Choose a form-filling approach

| Approach | How to use it | What it is for |
|---|---|---|
| **Gemini Nano** | Select it in the extension; Chrome supplies the model on supported devices. | On-device form planning. No separate model API key. |
| **Codex CLI** | Sign in to Codex, run the local companion, then pair it in **Model runtime**. | Form planning using the signed-in Codex account. |
| **Claude CLI** | Sign in to Claude Code, run the same companion, then pair it. | Form planning using the signed-in Claude account. |
| **Jev** | Run the companion with authorized TypeSafe access, then select Jev. | Experimental field-purpose classification with local rules and validation. |
| **Eve** | Separate evaluation setup; optional CAPTCHA-image integration. | Tested as a planning harness. It is **not a selectable form planner** in this extension. |
| **Shared planner API** | Requires a separately provided service and tenant configuration. | Integration path; no hosted service or production connector is bundled here. |

[Companion setup](model-bridge/README.md) · [Runtime and data-flow details](docs/MODEL_PROVIDERS.md). Subscription calls consume the signed-in plan's allowance. When a shared API is configured, it takes precedence over Nano/Codex/Claude; use a fresh test profile to avoid testing an unintended configuration.

## How well does it work on real sites?

**No retained test has demonstrated a correct, unassisted journey through a complete real application to final review.** The most recent installed-extension form tests were on the real Riverside WIC site on October 9, using v0.14 and fictional records:

| Approach | Correct answers | Correct and ready for final review without help? | What stopped it? |
|---|---:|---|---|
| Gemini Nano | 16/17 in one run | **No** | Incomplete home address; stopped at CAPTCHA. |
| Codex CLI | 16/17 in one run, plus an unnecessary mailing-address fill | **No** | Address/conditional-answer errors; stopped at CAPTCHA. |
| Jev | 15/17 in each of two runs | **No** | Incomplete address, unanswered Medi-Cal choice, and unnecessary questions. |
| Claude CLI | No comparable installed live-site result retained | **Not established** | Needs a real-site test. |
| Eve | No comparable installed-extension result retained | **Not established** | Separate planning experiments do not establish installed form performance. |

Historical IHSS and BenefitsCal attempts also left incomplete answers or stopped early. **Neither v0.15 nor this consolidated v0.16 build has a retained complete installed/live-site retest.** Its newer 8/8 WIC result came from a local copy of the form; it is useful regression evidence, not a live-site success rate.

[Results by site, approach, date, and test type](docs/TEST_RESULTS.md) include the IHSS/BenefitsCal history, separate planning comparisons across Codex/Eve/Jev, and Nano's local playbook experiments. Failed and assisted attempts stay visible. Timings to a failure are not successful-application speeds.

## Can it get past CAPTCHA without a person?

**Not reliably demonstrated.** In the latest installed-extension WIC test, the checkbox was accepted in **2 of 3 attempts**, both after a person positioned the page. No image challenge was solved in those attempts. One later continuation reached final review with wrong answers; the other stalled.

The extension uses the same checkbox-clicking code regardless of the selected form planner; those two successes did not compare models. Earlier tests that used a separate browser-control tool and tests that only answered saved CAPTCHA images are listed separately in the [plain-language CAPTCHA results](docs/TEST_RESULTS.md#captcha-can-it-check-the-box-and-keep-going).

For this sprint, record simple outcomes on the real site: **checkbox accepted: yes/no; image challenge appeared: yes/no; passed it: yes/no; continued without help: yes/no; application correct at final review: yes/no.** A challenge that was not encountered is “not tested.”

## What should we test next?

**Real sites first:** WIC, IHSS, then BenefitsCal, followed by two applications running together. Check the full answers and all assistance, not just whether values appeared in fields. Use a short local check only to diagnose setup problems.

- [Testing guide](docs/TESTER_GUIDE.md): simple setup, real-site tasks, design questions, and a results template.
- [Engineering review plan and production gaps](docs/PRODUCTION_GAPS.md): what to verify, what to fix first, and remaining integration work.
- [Documentation index](docs/README.md): every guide, result, and historical record, grouped by purpose.
- [Detailed evidence index](evaluation/results/README.md): dated reports and machine-readable receipts.

## Demo and development

[Watch the recorded demo](docs/assets/nava-form-filling-assistant-demo.mp4) · [Developer guide](DEVELOPER_GUIDE.md) · [Contribution and release workflow](CONTRIBUTING.md)

The demo shows an earlier local practice build. It illustrates the workflow and does not establish current real-site accuracy.

```sh
npm ci
npm run check
npm test
```

This Nava repository preserves the history of [the original prototype](https://github.com/gobrando/nava-form-filling-assistant-chrome-extension). It is a research prototype, not a production benefit service. No production Apricot adapter or participant database is included.
