# Form-filling results: real sites first

Reviewed October 19, 2026 from retained test records. **This is a clearer account of existing tests, not a new live-site test run.** The current v0.16 consolidated build still needs the installed real-site evaluation described below.

The product question is: **Can the extension prepare the correct application on the real website, get through the intervening steps, and reach final review without a person fixing answers or operating the page?** None of the retained complete-form attempts demonstrates that outcome yet. Application certification and submission remain human actions in the current product.

[Simple setup and real-site test plan](TESTER_GUIDE.md) · [Engineering review plan](PRODUCTION_GAPS.md)

## What the test labels mean

| Label | What actually ran | What it can tell us |
|---|---|---|
| **Live site** | The installed extension on an actual government website, with fictional applicant data. | Real page behavior, answer quality, navigation and where help was needed. |
| **Saved field-list test** | A model sees a saved list of form fields, or a small constructed set based on an earlier error. | Whether it chooses the expected mappings/questions. It does not test a whole website. |
| **Local practice-form test** | Product code fills a locally hosted copy/simulation of a form. | Whether a specific fix works in that controlled setup. It does not establish live-site reliability. |
| **Saved CAPTCHA image** | A model answers a previously captured image. | Whether it chose the expected tiles. No live checkbox, website acceptance or continuation is measured. |

A value remaining in a field is a **successful write**. It can still be an incomplete or wrong answer. A passing planning test is also different from a correctly filled form.

## Real Riverside WIC: latest installed-extension tests

Site: [Riverside Apply 4 WIC](https://www.ruhealth.org/appointments/apply-4-wic-form). Date: **October 9**. Build recorded as **v0.14**; version-specific UI was observed, but the installed source commit was not independently captured. Four fresh form attempts; no operator answer repairs in the initial runs.

| Form planner | Attempts | Correct answers before stopping | Correct, unassisted final review? | Observed problem |
|---|---:|---|---|---|
| Gemini Nano | 1 | 16/17 | **No** | Home Address omitted city/state/ZIP; paused at CAPTCHA. |
| Codex CLI, default model not recorded | 1 | 16/17, plus an unnecessary conditional mailing-address answer | **No** | Same incomplete home address; paused at CAPTCHA. |
| Jev 1.13.0 | 2 | 15/17 in both | **No** | Incomplete address, unanswered Medi-Cal choice and unnecessary questions; stopped before CAPTCHA. |
| Claude CLI | 0 | Not tested | **Not established** | CLI unavailable in that evaluation. Selectable in the product, but no comparable live result retained. |
| Eve | 0 | Not tested as an installed form planner | **Not established** | Its saved-field planning tests and image integration are separate. |
| Shared planner API | 0 comparable retained trials | Not measured | **Not established** | Needs its own configured-service test. |

**Overall: 0/4 correct completions.** Later CAPTCHA attempts and continuations are reported below rather than added to the original stopped-run timings. The Codex form run did not retain the underlying model/reasoning setting; the Sol/Luna comparison later on this page is a different experiment.

[Readable October 9 form report](INSTALLED_V014_BATCH.md) · [All four receipts](../evaluation/results/installed-v014-oct9.json) · [Field-level errors](BENCHMARK_ERRORS.md)

## Other real-site evidence

These are historical observations, not new v0.15 results or comparable success-rate estimates.

| Actual site | Approach and date | What happened | Ready for correct final review without help? |
|---|---|---|---|
| Riverside WIC | Nano, October 5, two attempts | 15/17 and 16/17 correct before help; 2 and 3 answer interventions respectively; both paused at CAPTCHA. | **No** |
| Riverside WIC | Codex CLI, October 5, two attempts | 16/17 each; incomplete home address; both paused at CAPTCHA. | **No** |
| [Riverside IHSS](https://riversideihss.org/IntakeApp) | Nano, September 25, one attempt | 32 of 35 attempted writes persisted, among 44 visible controls. Required decisions remained unanswered. This was not an answer-correctness score. | **No** |
| Riverside IHSS | Codex CLI, September 25, one attempt | 34 of 37 attempted writes persisted, among 44 visible controls; required decisions remained unanswered. Underlying model/effort not recorded. | **No** |
| [BenefitsCal](https://benefitscal.com/ApplyForBenefits/begin/ABOVR?lang=en), CalFresh route | Nano, October 5, two attempts | Runtime error/login gate in one; repeated false missing-answer questions and rejected recovery in the other. No complete answer score. | **No** |
| BenefitsCal, CalFresh route | Codex CLI, October 5, two attempts | Address/navigation stall in one; county dialog reached after help, then resume rejected in the other. No complete answer score. | **No** |
| BenefitsCal | Codex CLI, September 25, one attempt | Reached the name-information route but stopped at a navigation checkpoint before filling. | **No** |

The September 25 BenefitsCal receipt identifies `/ApplyForBenefits/ABLPR`; the exact October 5 per-attempt URLs are not in the public ledger. The product catalog currently starts at `/ApplyForBenefits/begin/ABOVR?lang=en`. Do not treat those as the same measured page. CalFresh, Medi-Cal and CalWORKs share the BenefitsCal application; we do not have a separate complete success result for each program.

Sources: [October 5 live attempts](../evaluation/results/live-summary.json), [September 25 installed benchmark](../evaluation/model-benchmark/runs.json), [benchmark explanation](../evaluation/model-benchmark/README.md). Exact per-attempt URLs are not present in every public receipt; the site names and catalog links identify the intended routes without inventing missing provenance.

## CAPTCHA: can it check the box and keep going?

**The installed extension has checked a live WIC CAPTCHA box. Correct, uninterrupted form preparation after it has not been demonstrated.**

### Installed extension on real Riverside WIC — October 9

| Attempt | Checkbox accepted? | Did it need help? | What happened afterward? |
|---|---|---|---|
| Page originally filled with Nano, first attempt | **No** | Widget was offscreen/hidden; no click completed. | Stopped. |
| Same page, after positioning it for the extension | **Yes** | A person scrolled/focused the widget. | Codex CLI default continued, then stalled before final review with answer errors. |
| Page originally filled with Codex | **Yes** | A person scrolled/focused the widget. | Codex CLI default continued to final review with an incomplete address and an unnecessary mailing answer. |

**Checkbox accepted: yes, 2/3. Correct final review without help: no. Live image challenge passed by the extension: not tested.** Nothing was submitted.

The extension's own browser code clicked the checkbox. No AI image model was called in these three attempts. Nano/Sol were configured as possible image fallbacks but were never needed, so these are not separate model image-solving wins. The model and reasoning used for the later CLI continuations were not recorded. Jev's two form runs never reached CAPTCHA; Claude and Eve have no comparable installed-extension checkbox trial.

[Native attempts and continuation receipts](../evaluation/results/captcha-native-oct9.json) · [Detailed October 9 report](CAPTCHA_OCT9.md#installed-native-attempts-and-form-continuation)

### Earlier runtime comparison on real WIC — October 7

Every click below was performed by a **separate Codex browser-control tool**, outside the installed extension. This shows what each requested configuration did with that helper; it does not prove the extension can do it unattended. The form was empty and correct form continuation was not measured.

| Requested approach | Checkbox accepted? | If pictures appeared, did it pass? |
|---|---|---|
| Gemini Nano | **Yes, 2/2** | Not tested; no pictures appeared. |
| Jev 1.13.0 | **Yes, 2/2** | Not tested; no pictures appeared. |
| Eve + GPT-6.1 Sol, Low | **Yes, 2/2** | Not tested; no pictures appeared. |
| Codex CLI + GPT-6.1 Sol, Low | **Yes, 1/2**; other observation expired | Not tested; no completed image session. |
| Codex CLI + GPT-6.1 Sol, Extra High | **Yes, 1/2**; other challenge expired | **No completed session**; image challenge expired. |
| Codex CLI + GPT-6 Luna, Low | **Yes, 2/2** | **Yes**, one image session accepted on the first answer, with the external browser helper. |
| Codex CLI + GPT-6 Luna, Extra High | **Yes, 2/2** | **Yes**, one session accepted after its first answer was rejected and a follow-up answered, with the external helper. |
| Claude CLI | **Not tested** | **Not tested** |

Total: **12 accepted states in 14 attempts**; two observations expired. Different challenge types, one browser profile and sequential order prevent a fair model ranking. Requested model flags were retained. CLI/Eve provider-resolved identity was unavailable; Jev returned `jev-1.13.0`, and Nano’s exact model version was not exposed. [All attempts](../evaluation/results/captcha-oct7-actions.json) · [Summary](../evaluation/results/captcha-oct7-summary.json).

A separate October 5 chat/browser trial accepted one checkbox without pictures. It is historical external-tool evidence, not an installed-extension result. [Receipt](../evaluation/results/captcha-summary.json).

### Saved-image tests are supporting evidence only

October 9 tested three saved WIC CAPTCHA grids twice per configuration. Expected tile sets matched in 4/6 Sol Low calls, 4/6 Sol Extra High, 2/6 Luna Low, 1/6 Luna Extra High, 3/6 Eve/Sol Low and 0/6 Nano. Handoffs remain in those denominators. **No answers from that batch were clicked on a live challenge.** Jev and Claude have no image adapter in this release.

[Image results and failures](CAPTCHA_OCT9.md) · [All 36 image calls](../evaluation/results/captcha-three-crops-oct9.json) · [Technical implementation and opt-in controls](CAPTCHA_ACTUATOR.md) · [Per-attempt timing/cost](CAPTCHA_RUN_METRICS.md)

## Supporting planning and local-form experiments

These help choose fixes and approaches for the next live run. They are **not** successful applications or additional live-site results.

### Codex, Eve and Jev: choosing fields from saved lists

The October 6 Codex/Eve comparison used a saved WIC field list and small constructed IHSS/CalFresh diagnostic sets. Each cell is plans passed / attempted; **nothing was filled on a live site**. A pass means the expected mappings and missing-answer questions, not a verified complete address or application.

| Requested planning configuration | Saved WIC fields | IHSS diagnostic fields | CalFresh diagnostic fields |
|---|---:|---:|---:|
| Codex CLI · GPT-6.1 Sol Low | 2/2 | 2/2 | 0/2 |
| Codex CLI · GPT-6.1 Sol Extra High | 2/2 | 2/2 | 1/2 |
| Codex CLI · GPT-6 Luna Low | 2/2 | 2/2 | 1/2 |
| Codex CLI · GPT-6 Luna Extra High | 2/2 | 2/2 | 1/2 |
| Eve 0.71.2 · GPT-6.1 Sol Low | 2/2 | 2/2 | 2/2 |
| Jev 1.13.0 · October 7 decision-stage test | 2/2 | 0/2 | 2/2 |

Jev performed a smaller classification task than the three-role Codex/Eve planner, and its IHSS test missed a required question. The table is not a ranking of intrinsic model quality. Claude was not executed in this comparison. [Codex/Eve results](../evaluation/results/controlled-summary.json) · [Jev results](../evaluation/results/jev-summary.json) · [Methods and timings](../evaluation/controlled-planning/README.md).

### What changed in Jev v0.15?

The recorded controlled attempts are dated October 9. They compare three implementations using real Jev calls on saved field lists and simulated writes:

| Implementation, in plain language | WIC cases passed | IHSS cases passed | CalFresh cases passed | Total |
|---|---:|---:|---:|---:|
| Older planner, replayed unchanged (v0.14 baseline) | 0/8 | 0/2 | 0/2 | 0/12 |
| Add a retry for uncertain decisions | 5/8 | 2/2 | 0/2 | 7/12 |
| Retry plus WIC-specific rules and reuse of already-verified mappings (v0.15 default) | 8/8 | 2/2 | 0/2 | 10/12 |

Both CalFresh cases still failed the housing-answer transformation; one also had a county-confidence variation. The improvement belongs to the combined model, rules and recovery code. [Exact comparison and errors](JEV_RECOVERY_V015.md) · [Dated receipts](../evaluation/results/jev-recovery-v015.json).

On **October 13**, the updated scanner/filler and Jev planner ran against a **local WIC copy in a browser**. All **8/8 cases behaved as expected**: four complete fictional records reached review, and four incomplete records paused on the expected missing facts. No answer repair was needed. No installed-extension attestation, live government page or CAPTCHA was tested. This is not eight completed applications. [Browser receipts](../evaluation/results/jev-recovery-browser-v015.json).

### Nano and JavaScript playbooks on a local WIC task

| Approach | Result in two local attempts |
|---|---|
| Original Nano planner | 16/17 answers matched in both. |
| JavaScript site-specific rules, no model calls | 17/17 in both. |
| Compact Nano call guided by a playbook | 17/17 once; invalid model output stopped the other before filling. |

These used the same local task, not the live government journey. The playbook is not another selectable runtime. [All six attempts](../evaluation/results/nano-playbook-summary.json).

## What would change the conclusion?

Run the current installed build on the real WIC, IHSS and BenefitsCal routes, then run two applications together. Record each approach separately. Check every applicable answer, unwanted conditional answers, genuine missing facts, navigation, CAPTCHA acceptance and all human help. Retain failed attempts and show “not tested” for configurations that did not run.

For the autonomy goal, a run that needs a person to scroll a challenge into view, repair an answer or restart navigation is **assisted**, even if it eventually reaches review. Final legal certification/submission is a separate human step. Use the [tester record](TESTER_GUIDE.md#record-each-attempt).

Speed and cost matter after the outcome is clear. Existing timing/token/cost details remain in the source reports; times to a stopped checkpoint are not completion times, subscription access is not free, and published-rate estimates are not invoices. No current result establishes cost per correctly completed application.
