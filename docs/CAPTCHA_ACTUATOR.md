# Native CAPTCHA actuator · v0.14

The extension can now attempt supported reCAPTCHA controls without a Codex browser relay. One explicit opt-in covers one bounded attempt, including up to three static image rounds. A caseworker can enable it before starting an application run, or at an existing CAPTCHA checkpoint. It never activates application Submit.

This is an experimental implementation. Installed Chrome and live-provider acceptance have **not** been verified. Providers can reject synthetic DOM events even when the executor clicked the right elements. Earlier October 7 live successes used a separate external browser relay and remain labeled that way.

## Supported paths

Every form runtime shares a deterministic checkbox executor with zero model calls. Static 3×3/4×4 image challenges use a separate image classifier: Nano on-device, paired Codex CLI with an explicit requested model/reasoning, or optional Eve 0.71.2 with GPT-6.1 Sol Low. Jev and Claude have no image adapter in this release; an independent image runtime can be selected while retaining either form planner.

Dynamic replacement grids, audio, hCaptcha, Turnstile, translated/changed layouts, multiple widgets, invisible or clipped controls, existing tile selections, refusals, invalid output and exhausted retries stop for help. The executor supports English Verify/Skip controls and only recognized Google/reCAPTCHA HTTPS frame paths. It does not issue direct challenge requests, obtain CAPTCHA tokens or use third-party solver services.

## Architecture and authorization

- The side panel owns one run and the application write lease. Pre-run opt-in is memory-only and consumed at the first CAPTCHA attempt. Pause, client/session changes and leaving the assistant revoke it.
- The background service accepts commands only from this extension’s side panel. It rechecks the client session, generation, revision, lease, bound tab, main document and exact page location before each operation. Authorization expires after three minutes; the panel times out after 150 seconds.
- A narrow isolated-world frame adapter observes and clicks recognized checkbox/tile/Verify elements. Model output contains only `select`/`handoff` and bounded tile indexes. It cannot name selectors, run code, change form answers or submit an application.
- The background captures the active application tab transiently, checks the challenge/document/geometry again and crops only the grid before classification. The full screenshot stays in process memory and is not transmitted or logged. No screenshot is captured for a checkbox-only attempt.
- Nano receives the crop locally. Codex/Eve crops pass through the authenticated loopback companion. The CLI receives a temporary image and fixed schema in an ephemeral read-only session; temporary files are removed afterward. Eve uses an in-memory staging environment and no browser/host tools.
- Acceptance requires an observed visible checked state. A click request, model answer or disappeared iframe is never treated as proof of completion. The application is rescanned before the form runner resumes.

The product authorization is distinct from Codex’s external browser tool policy. That policy cannot be changed through this repository. The native product path does not invoke that browser tool.

## Evidence and speed/cost

The actual frame adapter passed four deterministic Chrome-fixture checks: checkbox acceptance, correct selected tiles plus Verify, revoked authorization rejection, and untouched Submit. The two attempts took **5.4 / 6.4 ms**, with zero model calls and $0 direct API-key charge. This tests mechanical execution on a simulation, not real CAPTCHA accuracy, screenshot/crop transport, or an installed application journey.

The actual product image adapters were also tested twice on the prior common traffic-light image:

| Image adapter · requested Sol Low | Exact sets | Runtime elapsed, repeats 1 / 2 | Hypothetical API-price scenario per call¹ |
|---|---:|---:|---:|
| Codex CLI | 2/2 | 10.260 s / 6.877 s | $0.039452–$0.049055 / $0.031930–$0.039780 |
| Eve 0.71.2 | 2/2 | 5.160 s / 3.305 s | $0.006074–$0.007528 / $0.006074–$0.007528 |

¹ Both routes used subscription access with $0 direct API-key charges. Billed amount, subscription allocation and total operating cost are unknown. Eve cache counters were not retained; that price scenario assumes no cached input. This repeats **one unique image**, uses different framework envelopes and sequential order, and performs no browser actions. It cannot establish general accuracy or a causal speed advantage.

Four initial calls were rejected before inference because the saved JPEG was mislabeled PNG. They are retained separately with elapsed times and zero model calls. The adapter now validates MIME signatures and dimensions for bounded PNG/JPEG inputs. [New adapter results](../evaluation/results/captcha-native-adapter-models.json) · [Validation failures](../evaluation/results/captcha-native-adapter-validation.json) · [All speed and cost metrics](CAPTCHA_RUN_METRICS.md).

## Reproduce

Run `npm test` and `npm run check`. Serve the repository on loopback and open `/demo/captcha-fixture.html`, then run its self-test once from a reset fixture. The simulation contains no anti-bot service or applicant data. [Image companion setup](../model-bridge/README.md#native-captcha-images--v014).

For actual image-adapter classification, supply the adjudicated public image and a fresh output directory:

```sh
node evaluation/captcha/run-native-image-adapters.mjs --image /absolute/path/public-challenge.jpg --output-dir /absolute/path/fresh-results
```

Run the optional product Eve agent first, or pass `--providers codex` to test only the CLI. Raw pixels remain local and ignored; publish only reviewed, value-free receipts. An installed/live-site trial must separately measure visible site acceptance, challenge type, every model call/error, total elapsed time, usage, billing route, interventions and whether Submit stayed untouched.
