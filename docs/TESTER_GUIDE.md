# Tester guide · v0.12.0

Use fictional records. The goal is to find confusing interactions, incorrect or incomplete answers, and recovery failures. A fast fill or green verification mark alone is not a quality pass.

## Repeatable tasks

1. Follow the README installation steps and open the local six-page fixture. Record Chrome version, operating system, extension version, model provider, and any explicitly configured underlying model/reasoning. If identity is not reported, write **unknown**.
2. Start a fresh application with the fictional sample. Run twice from step 1. Time the entire journey separately from the exported model duration. Compare each displayed value against the supplied record; include empty required answers and incomplete addresses.
3. Check that missing decisions become questions. Supply only answers from the fictional record. Log any answer, navigation, reset, or repair you provide as assistance.
4. Pause, reopen the dashboard, and verify/resume. Try a closed application tab. Record whether the client must be reloaded and whether progress is preserved.
5. Expand and collapse the data safeguards and model/plan details. Navigate these controls with Tab and Enter. Check the panel at a narrow width; errors, questions, and review actions should stay visible.
6. Verify the assistant stops before certification, signature, and Submit. Do not submit a real government application.

Optional live tests: repeat Riverside WIC, then IHSS or BenefitsCal with approved synthetic records. Record the exact entry route and every checkpoint. CAPTCHA/OTP completion is human assistance, not an autonomous model success. Stop if an account or official submission is required.

## Known limits to look for

- WIC's composite home address can omit city/state/ZIP even when the street mapping is approved.
- Nano can be very slow and can return malformed or truncated JSON. Runtime details and model settings are expandable.
- BenefitsCal address validation, route changes, and resume behavior need more complete testing.
- IHSS required decisions have been silently omitted in earlier live runs.
- The 30-attempt controlled pilot tests field planning, not full website journeys. Eve is not installed as the extension backbone; Jev is pending authenticated access.
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
