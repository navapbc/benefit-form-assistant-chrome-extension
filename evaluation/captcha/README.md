# CAPTCHA capability pilot

This experimental harness separates **model action selection**, **browser execution**, **checkbox acceptance**, and **image-challenge solving**. It does not add CAPTCHA automation to the released extension. The extension continues to pause for a person.

The input is a minimized, visibly observed Riverside WIC checkbox state. It excludes applicant answers, CAPTCHA response tokens, iframe query strings and browser-profile data. Each run needs a recorded action-time user confirmation. The only selectable browser action is the visible checkbox; Submit is excluded. A separate Codex browser relay can execute an approved decision and record the resulting visible state. The relay is an external harness dependency, not a capability supplied by Nano, Jev or a CLI classification call.

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

Do not invent confirmation timestamps or reuse old observations after the page changes. CLI models are explicitly requested as GPT-6.1 Sol and GPT-6 Luna, at Low and Extra High reasoning; resolved provider identity may not be emitted. Eve uses a separate CAPTCHA action-selection agent, pinned to Eve 0.71.2 and GPT-6.1 Sol Low. Its system envelope differs from the older form-planning pilot. In `evaluation/captcha/eve`, install the pinned dependencies and start `node node_modules/eve/bin/eve.js dev --host 127.0.0.1 --port 4194 --no-ui --no-default-extensions` before running its client.

```sh
node evaluation/captcha/run.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-cli-batch --providers codex --repeats 2
node evaluation/captcha/run.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-eve-batch --providers eve --repeats 2
node evaluation/captcha/run-jev.mjs --observation /absolute/path/observation.json --output-dir /absolute/path/fresh-jev-batch --repeats 2
```

Jev accepts a hidden interactive test key, or a process-only injected key. Never place a key in a command argument, repository file, screenshot, browser field or result ledger. The requested version is `jev-1.13.0`; its 0.90 confidence gate is not a reasoning setting. Token-rate estimates are separate from unknown billed cost.

For Nano, serve this folder on loopback, open `nano.html` in Chrome, paste the confirmed observation and choose **Run one Nano decision**. Each click starts a fresh local session. The page records malformed output and unavailable-runtime errors without silently retrying. It does not download a model automatically. Chrome’s exact managed Nano version and reasoning are not exposed here.

## Record browser outcomes

Before executing any decision, freshly verify that the authorized WIC checkbox remains visible and unchecked. Execute only the selected checkbox action. Record the runtime, model setting, decision, relay executor, browser-action duration, accepted state, challenge type, and any assistance. If a visual challenge appears, text-only decisions cannot solve its images; record that boundary and hand off or start a separately authorized multimodal test. Do not use hidden tokens, direct challenge APIs or site submission.

Several action-selection calls on one frozen observation are **planning repeats**, not repeated website completions. Browser trials need distinct fresh observations and their own execution records. A shared warm Chrome profile confounds acceptance; small samples are exploratory and cannot establish production reliability.

[Published results](../results/README.md) · [Chrome Prompt API](https://developer.chrome.com/docs/ai/prompt-api) · [TypeSafe API](https://docs.typesafe.ai/api) · [Codex structured evaluation example](https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex)
