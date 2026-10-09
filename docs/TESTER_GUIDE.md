# Tester guide · v0.14.0

Use fictional records. The goal is to find confusing interactions, incorrect or incomplete answers, and recovery failures. A fast fill or green verification mark alone is not a quality pass.

## Repeatable tasks

1. Follow the README installation steps and open the local six-page fixture. Record Chrome version, operating system, extension version, model provider, and any explicitly configured underlying model/reasoning. If identity is not reported, write **unknown**.
2. Start a fresh application with the fictional sample. Run twice from step 1. Time the entire journey separately from the exported model duration. Compare each displayed value against the supplied record; include empty required answers and incomplete addresses.
3. Check that missing decisions become questions. Supply only answers from the fictional record. Log any answer, navigation, reset, or repair you provide as assistance.
4. Pause, reopen the dashboard, and verify/resume. Try a closed application tab. Record whether the client must be reloaded and whether progress is preserved.
5. Expand and collapse the data safeguards and model/plan details. Navigate these controls with Tab and Enter. Check the panel at a narrow width; errors, questions, and review actions should stay visible.
6. Verify the assistant stops before certification, signature, and Submit. Do not submit a real government application.

Optional live tests: repeat Riverside WIC, then IHSS or BenefitsCal with approved synthetic records. Record the exact entry route and every checkpoint. Record CAPTCHA execution as native extension, external relay or human assistance. They are distinct outcomes. OTP completion remains human assistance. Stop if an account or official submission is required.

## Known limits to look for

- WIC's composite home address can omit city/state/ZIP even when the street mapping is approved.
- Nano can be very slow and can return malformed or truncated JSON. Runtime details and model settings are expandable.
- BenefitsCal address validation, route changes, and resume behavior need more complete testing.
- IHSS required decisions have been silently omitted in earlier live runs.
- The 30-attempt controlled pilot tests field planning, not full website journeys. Eve’s form-planning tests use a separate harness; its optional v0.14 integration classifies CAPTCHA images. Jev is selectable for form planning, with installed Chrome behavior still unverified. The separate six-request Jev API pilot passed four scored plans and missed a required IHSS question twice.
- Other database names in the catalog require server adapters. They are not working production integrations.

## Record each attempt

Copy this into your findings document or a new issue. Do not include real client values, screenshots with personal data, API keys, or pairing tokens.

```text
Site / fixture and starting URL:
Extension / Chrome / OS:
Runtime, underlying model, reasoning (or unknown):
Attempt number and start/end times:
Cold or warm model start:
Expected answers / correct / wrong / missing / inapplicable:
Review-ready without help?:
Assistance (each answer, navigation, reset, repair, CAPTCHA):
Checkpoint or failure, and reproduction steps:
Model time / journey time / prompts / usage units:
Observed charge / unknown costs:
Activity-log attachment (reviewed for sensitive data):
Product feedback: what was confusing or useful?
```

Keep failed attempts. Do not replace them with a later successful retry. Readback success means a write persisted; correctness requires checking its meaning and completeness.

For Jev, follow [the protected companion setup](../model-bridge/README.md#jev-in-the-chrome-extension--v013). Record `jev-1.13.0`, reasoning **not configurable**, and confidence **0.90**. Keep missing billed cost unknown. A low-confidence question counts as a quality limitation even when it safely prevents a wrong fill.

## Native CAPTCHA checks · experimental

Start with `/demo/captcha-fixture.html` on the local server and run its deterministic self-test from a reset fixture. Expect four checks to pass and Submit to remain disabled. This uses no AI or real CAPTCHA service.

For an installed application run, open the application card’s **CAPTCHA automation** disclosure and opt in to one bounded attempt before **Fill through application**. An existing CAPTCHA checkpoint also has **Authorize and try CAPTCHA**. Follow-ups within that attempt need no further authorization. Select the image runtime under **Model runtime → CAPTCHA images**. Jev and Claude need a separate image classifier; optional Eve setup is in the [companion guide](../model-bridge/README.md#native-captcha-images--v014).

Record the requested model/effort, exact visible challenge type, native vs relay executor, total attempt time, model-call time, token/context usage, every rejected answer/refusal/timeout, API-price estimate and unknown billed/operating cost. A click is not a pass: require visible checked acceptance and a verified application rescan. Pause while an image model is running and verify that its late answer produces no further tile/Verify clicks. Verify that navigation cancels the bound page attempt and that Submit is untouched.

October 9 installed testing recorded two accepted native WIC checkboxes in three attempts, after viewport assistance and with zero image calls. Live native image solving remains untested; synthetic DOM events may be rejected. Unsupported or dynamic grids must hand off instead of reporting completion. [Fresh results and exact errors](CAPTCHA_OCT9.md) · [Every retained run’s speed/cost](CAPTCHA_RUN_METRICS.md) · [Current actuator evidence](CAPTCHA_ACTUATOR.md).
