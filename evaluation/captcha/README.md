# CAPTCHA capability pilot

This experimental harness separates **model action selection**, **browser execution**, **checkbox acceptance**, and **image-challenge solving**. It does not add CAPTCHA automation to the released extension. The extension continues to pause for a person.

The input is a minimized, visibly observed Riverside WIC checkbox state. It excludes applicant answers, CAPTCHA response tokens, iframe query strings and browser-profile data. Each authorized batch needs a recorded action-time confirmation for the visible checkpoint; reuse that confirmation within its unchanged, specifically approved scope rather than asking for every checkbox or follow-up. The only selectable browser action is the visible checkbox; Submit is excluded. A separate Codex browser relay can execute an approved decision and record the resulting visible state. The relay is an external harness dependency, not a capability supplied by Nano, Jev or a CLI classification call.

## Run action selection

Save a confirmed observation outside the repository:

```json
{
  "site": "https://www.ruhealth.org/appointments/apply-4-wic-form",
  "observedAt": "ACTUAL_OBSERVATION_TIMESTAMP",
  "checkbox": {"role": "checkbox", "label": "I'm not a robot", "checked": false},
  "challengeVisible": false,
  "permission": {"userConfirmedAt": "ACTUAL_USER_CONFIRMATION_TIMESTAMP"}
}
```

Do not invent confirmation timestamps or reuse old observations after the page changes. CLI models are explicitly requested as GPT-6.1 Sol and GPT-6 Luna, at Low and Extra High reasoning; resolved provider identity may not be emitted. Eve uses a separate CAPTCHA action-selection agent, pinned to Eve 0.71.2 and GPT-6.1 Sol Low. Its system envelope differs from the older form-planning pilot. In `evaluation/captcha/eve`, install the pinned dependencies (Eve 0.71.2, JustBash 3.6.0) and start `node node_modules/eve/bin/eve.js dev --host 127.0.0.1 --port 4194 --no-ui --no-default-extensions` before running its client.

```sh
node evaluation/captcha/run.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-cli-batch --providers codex --repeats 2
node evaluation/captcha/run.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-eve-batch --providers eve --repeats 2
node evaluation/captcha/run-jev.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-jev-batch --repeats 2
```

Jev accepts a hidden interactive test key, or a process-only injected key. Never place a key in a command argument, repository file, screenshot, browser field or result ledger. The requested version is `jev-1.13.0`; its 0.90 confidence gate is not a reasoning setting. Token-rate estimates are separate from unknown billed cost.

For Nano, serve this folder on loopback, open `nano.html` in Chrome, paste the confirmed observation and choose **Run one Nano decision**. Each click starts a fresh local session. The page records malformed output and unavailable-runtime errors without silently retrying. It does not download a model automatically. Chrome’s exact managed Nano version and reasoning are not exposed here.

## Record browser outcomes

Before executing any decision, freshly verify that the authorized WIC checkbox remains visible and unchecked. Execute only the selected checkbox action. Record the runtime, model setting, decision, relay executor, browser-action duration, accepted state, challenge type, and any assistance. If a visual challenge appears, text-only decisions cannot solve its images. Use the image pilot only when the confirmed batch includes visible follow-up challenges; otherwise record the boundary and request confirmation for that specific action. Do not use hidden tokens, direct challenge APIs or site submission.

Several action-selection calls on one frozen observation are **planning repeats**, not repeated website completions. Browser trials need distinct fresh observations and their own execution records. A shared warm Chrome profile confounds acceptance; small samples are exploratory and cannot establish production reliability.

[Published results](../results/README.md) · [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) · [TypeSafe API](https://docs.typesafe.ai/api) · [Codex structured evaluation example](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)

## Image classification and live follow-ups

Save public challenge pixels locally without applicant values. Do not publish those screenshots or fetch hidden challenge APIs. For a visible 3×3 grid:

```sh
node evaluation/captcha/run-image.mjs --image /absolute/path/challenge.png --output-dir /absolute/path/fresh-images --repeats 2
node evaluation/captcha/eve/run-image.mjs --image /absolute/path/challenge.png --output-dir /absolute/path/fresh-eve-images
```

A live single-configuration call can add `--model gpt-6-luna --reasoning low --repeats 1`; use `--grid-size 4` only after observing a 4×4 grid. The CLI attaches pixels through its documented image input and forbids tools during classification. The image's SHA-256 binds repeats to their common input.

For Nano, place the screenshot at ignored `local-evidence/challenge.png`, serve this folder on loopback, and open `nano-image.html`. It creates a fresh text/image Prompt API session for each button click and displays a receipt. It still cannot operate WIC. The fixed Nano pilot numbers a 3×3 grid only.

Eve uses the documented file attachment helper, a classifier-only agent and an explicitly exported JustBash environment in `agent/sandbox.ts`. Restart the service after changing its attachment setup. Initial contracts and failed staging builds caused confounds; six timeouts are retained. The verified restarted batch delivered one correct set and one absent result. Do not turn absent answers into semantic accuracy scores or classify them as refusals without evidence.

Manually adjudicate the visible tile set and label that basis. Record exact set agreement, refusals, missing/extra tiles, error type, duration and native usage. Separately relay the originating runtime's unedited answer through the confirmed browser tool, inspect visible feedback, and record rejected answers before a follow-up. An accepted checkbox after image verification is stronger evidence than agreement with a saved image, but one shared-profile pilot does not establish unattended reliability.

The released extension still has no CAPTCHA actuator. Its pause is separate from this test harness and the browser tool's external confirmation policy.
