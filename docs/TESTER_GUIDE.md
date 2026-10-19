# Try and review the browser extension

The extension helps prepare benefits applications from a client record: it fills answers, asks about missing information, and moves through supported pages. It can keep several applications in separate tabs. A person still reviews, certifies, and submits.

**The main test is a real benefits website with fictional information.** We want to know whether the extension can get the right answers all the way to final review without someone repairing the form, navigating for it, or clearing CAPTCHA. Local sample forms are useful for checking installation and reproducing a bug; they do not establish that the product works on a government site.

- **Design review (Jillian):** follow setup and try WIC. Note what is confusing, where you need help, and whether you trust the result.
- **Engineering review:** repeat the real-site route with each available approach, check every answer, and investigate failures. Use the [engineering review plan](PRODUCTION_GAPS.md) for priorities.

See [current test results](TEST_RESULTS.md) for what each approach has actually demonstrated on real sites.

## 1. Install it

You need desktop Chrome 138 or newer and a folder containing this repository. The extension is loaded manually; there is no Chrome Web Store install yet.

<a id="ask-an-ai-agent-to-set-it-up"></a>

**Have an AI agent help:** copy the request below into your coding agent. It should do the terminal setup, then guide you through the Chrome clicks.

```text
Help me install https://github.com/navapbc/benefit-form-assistant-chrome-extension
for testing. Read README.md and docs/TESTER_GUIDE.md first. Clone a clean copy,
record its commit and version, and check the prerequisites. Do not overwrite an
existing checkout or change code. Help me load the repository root as an unpacked
Chrome extension. Use a fresh test profile so old shared-API settings cannot
silently change the runtime. Try Gemini Nano if available; otherwise help me
connect my already authorized Codex or Claude CLI using the documented local
companion. Keep provider credentials out of Chrome. Explain which runtime is
actually ready. Use only fictional records. Help me start the real Riverside WIC
route and record what happens, stopping before certification or submission.
```

**Manual setup:** clone or download the [repository](https://github.com/navapbc/benefit-form-assistant-chrome-extension). If using Git:

```bash
git clone https://github.com/navapbc/benefit-form-assistant-chrome-extension.git
cd benefit-form-assistant-chrome-extension
git rev-parse HEAD
```

1. In a fresh Chrome test profile, open `chrome://extensions`.
2. Turn on **Developer mode**, choose **Load unpacked**, and select the repository's top-level folder, containing `manifest.json`.
3. Confirm the installed version is **0.16.0**. If updating an existing install, click **Reload**, then refresh open application pages.
4. Pin the extension if helpful. Open an ordinary website and click the extension icon to open its side panel. Keep the panel open during a run.
5. Under **Model runtime**, leave **Chrome on-device Gemini Nano** selected and choose **Enable agentic AI**. Wait for it to report ready. A model download may be needed; Chrome 138 alone does not guarantee compatible hardware or an available model.

<details>
<summary>If Nano is unavailable: connect Codex or Claude</summary>

Use **Codex subscription via local CLI** or **Claude subscription via local CLI**. Sign in to the selected CLI (`codex login` or `claude auth login`), then run this from the repository in a terminal with Node/npm installed:

```bash
npm run model:bridge
```

Keep that terminal open. In **Model runtime**, select the matching provider, enter `http://127.0.0.1:4174` and the printed **pairing token**, then choose **Use this model runtime**. The token pairs Chrome with this local process; it is not a provider API key. [Full companion instructions](../model-bridge/README.md).

</details>

No database connection is needed for these tests. Leave **Shared planner API** unconfigured. A previously saved API can override Nano/Codex/Claude planning, so a fresh test profile is the simplest baseline.

## 2. Try a real form: Riverside WIC

1. Open the [Riverside WIC application](https://www.ruhealth.org/appointments/apply-4-wic-form) and the extension side panel.
2. Choose **Paste client JSON → Use a fictional sample record → Continue**. Keep that record as the answer key; review it before filling.
3. On the application-selection screen, check **Analyze this form**, then choose **Continue**. **This starts the run automatically.** Alternatively, select **WIC** under known application sites; **Continue** opens that route in a new tab and starts it.
4. Watch the form and panel. Record the first attempt before helping it. If the run stops and the card offers **Fill through application**, use that to continue after reviewing the stop; there is no separate Fill click required for the initial start.
5. Check each answer against the sample, including the full address, conditional questions, and unanswered required fields. If it asks something the record already answers, log that too.
6. Record where it stops. If you help, record exactly what you did. You can continue an assisted attempt to learn more, but it no longer counts as an unassisted pass.
7. Stop before certification, signature, attestation, or **Submit**. Do not send a fictional application to the agency. Export the activity log from the dashboard and complete the short record below.

A green “verified” badge only means a write was read back. It does not prove the answer is correct, that every question is answered, or that the whole application is ready.

## 3. Expand to the Riverside pilot routes

Use the same fictional record and record a separate attempt for each site and runtime.

| Route | What to test |
|---|---|
| [Riverside WIC](https://www.ruhealth.org/appointments/apply-4-wic-form) | Complete address, conditional answers, missing-answer questions, CAPTCHA, and reaching review. Start here. |
| [Riverside IHSS](https://riversideihss.org/IntakeApp) | Required decisions and other household members, not just fields that are easy to fill. Record the exact page reached. |
| [BenefitsCal](https://benefitscal.com/ApplyForBenefits/begin/ABOVR?lang=en) | CalFresh, Medi-Cal, and CalWORKs share one application. Record the selected programs and county, address validation, repeated household sections, navigation, and save/resume. A CalFresh subset is not a complete BenefitsCal test. |

If login, a one-time code, or an action that would create or submit an official record blocks further testing, record that boundary. Use an authorized test account or sandbox if one is available; do not treat an inaccessible part of the journey as passed.

### Which approaches should we compare?

| Approach | How it is available here |
|---|---|
| **Gemini Nano** | Selectable in Chrome; model runs on the device. |
| **Codex CLI** | Selectable through the local companion and an authenticated subscription CLI. Record the model/reasoning if known. |
| **Claude CLI** | Selectable through the same companion and an authenticated Claude CLI. Retained live-site comparison evidence is incomplete. |
| **Jev** | Selectable experimental decision model. Requires Node 24 and an authorized TypeSafe test credential in the companion, not Chrome. [Protected setup](../model-bridge/README.md#jev-in-the-chrome-extension--v013). |
| **Eve** | Separate historical form-planning harness, not a selectable form-filling runtime in this extension. It can be configured separately for CAPTCHA images. Do not label a Codex or Jev extension run “Eve.” |
| **Shared planner API** | Optional hosted planning route; needs a separately running, authorized service. It is not supplied by cloning this repo. Record it as its own configuration if used. |

Start with the approaches the tester can actually run. Mark unavailable or untested combinations explicitly rather than assigning a score.

## 4. CAPTCHA: did it get through without a person?

The product goal requires the form to keep moving without someone sitting beside it. CAPTCHA is therefore a required engineering test, not an optional detail in the result.

At a CAPTCHA stop, choose **Authorize and try CAPTCHA** for the bounded attempt. When an application is stopped and its card offers **CAPTCHA automation · experimental → Allow one CAPTCHA attempt during this run**, you can enable that before resuming with **Fill through application**. The first **Continue** starts automatically, so a pre-run card is not guaranteed. The initial opt-in is setup; scrolling the widget into view, clicking it, selecting tiles, or rescuing the attempt afterward is assistance.

For each encountered challenge, answer:

- **Checkbox accepted without help?** Yes / No / Not encountered.
- **If images appeared, challenge accepted without help?** Yes / No / No images appeared.
- **Form continued afterward without help?** Yes / No.
- **Correct final review reached without help?** Yes / No.

Do not count a click, a model's suggested tiles, or a screenshot exercise as a live pass. Require the visible accepted state and subsequent form progress. If a different tool or a person clicks, say so.

For image challenges, choose **Model runtime → CAPTCHA images**. Nano, Codex, and optional Eve have image routes; Jev and Claude require a separate image runtime. [Setup and supported challenge limits](../model-bridge/README.md#native-captcha-images--v014). Current evidence includes accepted live checkbox clicks **with viewport assistance**, but does not establish native live-image solving or a correct autonomous full application. [Retained CAPTCHA results](CAPTCHA_OCT9.md).

<a id="record-each-attempt"></a>

## 5. Capture a useful result

Keep failures and retries as separate attempts. Use this for design feedback or engineering reproduction; no real participant values, tokens, or credentials belong in attachments.

```text
Date / tester:
Site, starting URL, county, selected programs:
Extension version + commit / Chrome / OS:
Form runtime + model/reasoning (or unknown):
CAPTCHA image runtime, if different:
Fictional record/scenario:
Reached final review with every answer correct and no help? Yes / No
Correct / wrong / missing / inapplicable answers:
CAPTCHA checkbox accepted without help? Yes / No / Not encountered
CAPTCHA images accepted without help? Yes / No / No images appeared
Continued after CAPTCHA without help? Yes / No / Not encountered
Every intervention (answers, scrolling, clicks, navigation, resets, other tools):
First failure or stop + steps to reproduce:
Elapsed journey time / model time if available:
Activity log / reviewed screenshot:
What was confusing, useful, or hard to trust?
```

For an intentionally incomplete record, success means asking the right question and preserving progress, not silently guessing. Report that separately from an unassisted complete-record journey.

### Additional engineering checks

After the first live attempt, test **Pause**, **Verify and resume**, a closed application tab, panel close/reopen, and Chrome restart. Check that cancelled work does not later write into the page. Once single routes work, run WIC, IHSS, and one BenefitsCal application together; check that each keeps the correct record, answers, status, and CAPTCHA state.

For a quick installation check only, serve the repo with `python3 -m http.server 4173 --bind 127.0.0.1` and open `http://127.0.0.1:4173/demo/extensive-application.html?step=1&reset=1`. Use the same sample-record flow. The regular-page UI preview simulates results and does not test the installed extension or an AI runtime.
