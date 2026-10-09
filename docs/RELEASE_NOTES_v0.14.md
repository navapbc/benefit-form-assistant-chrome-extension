# v0.14.0 · October 8, 2026

The extension adds an experimental native reCAPTCHA executor. One opt-in can be made before the application run; it covers the checkbox and up to three static image rounds without a separate prompt for each action. Pause, navigation, client changes and expiry revoke the bound attempt. The assistant still never activates application Submit.

All form runtimes share a deterministic checkbox executor. Static image input is supported through Nano, paired Codex CLI, and an optional Eve 0.71.2 / GPT-6.1 Sol Low companion. Jev and Claude have no image adapter in this release, but can use a separate image runtime. Unsupported/dynamic challenges, refusals and provider rejection hand off.

The native frame adapter passed four checks on both deterministic browser-fixture repeats (5.4 / 6.4 ms, zero model calls). The actual Codex/Eve image adapters each returned the exact tile set twice on the same saved grid. At the October 8 release, installed Chrome and live-provider acceptance remained unverified; providers may reject synthetic DOM events. Historical live successes continue to be labeled as external Codex relay results.

**Verification:** 194 tests passed, JavaScript/manifest checks passed, four authenticated endpoint rejection checks passed, and both new charts were visually inspected in Chrome. Cost calculations were independently checked. The public ledger includes every retained success/failure and explicit unknown speed/cost values. Initial MIME-validation failures are preserved separately from corrected calls. Extension permissions are unchanged.

[Setup and current limits](CAPTCHA_ACTUATOR.md) · [Every run’s speed and cost](CAPTCHA_RUN_METRICS.md) · [Tester guide](TESTER_GUIDE.md) · [Companion setup](../model-bridge/README.md#native-captcha-images--v014).

To update Chrome, load this version’s folder containing `manifest.json` using Developer mode → Load unpacked, disable the older duplicate extension, refresh the synthetic application tab, and reopen the side panel. Reloading intentionally clears the client/model session; reload the fictional record before testing. Start with the local fixture and review every field before any live use.

**October 9 evidence update:** three installed native attempts yielded two accepted WIC checkboxes after viewport preparation, with zero image calls. No correct application completion or native live image solving is claimed. [Fresh results, exact errors, tokens and speed/cost](CAPTCHA_OCT9.md).
