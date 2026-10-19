# v0.16 tester handoff — October 19, 2026

The Nava and original personal extension repositories had diverged. This build consolidates their work into the canonical Nava repository while preserving both histories.

## Included

- Responsibility-based background, page, planner and side-panel modules from the original repo.
- Queue resume-hash, identifying-value redaction, handoff stability and cancelled-run state fixes.
- Current Jev confidence/source checks, bounded retry, WIC rules and verified-mapping reuse.
- Native opt-in CAPTCHA and optional image-runtime wiring, with scoped authorization and cancellation.
- Shared-planner HTTPS/explicit-loopback validation, origin-bound key reuse, disconnect cleanup, bounded requests and effective runtime labeling.
- A simpler README, complete feature tour, real-site testing guide, engineering review plan, and results separated by approach/site/test type.
- Pinned Node, locked installation and GitHub CI for syntax, tests, documentation links and document-extraction quality.

## Validation

The combined code passed **447/447 tests**, syntax checks for **149 first-party scripts** and the manifest, and the six-fixture extraction quality gate on Node 24.20.0. The documentation adds one checked helper script and link checks. Independent review covered runtime boundaries, module wiring and preservation of the original named test cases. A 600-scenario comparison retained the canonical field-analysis behavior.

See the GitHub checks on [the integration PR](https://github.com/navapbc/benefit-form-assistant-chrome-extension/pull/4) and the latest main-branch CI for the published result.

## Before testing

Reload the unpacked extension, refresh form tabs, and confirm **0.16.0**. Use a fresh profile for a known local-runtime baseline. Existing Chrome installs do not update when GitHub changes.

This release does not add new live-site or native-image CAPTCHA evidence. It is not a production deployment. Use the [real-site test guide](TESTER_GUIDE.md) for WIC, IHSS and BenefitsCal, and the [feature tour](FEATURE_GUIDE.md) for the other workflows. Historical v0.14/v0.15 scores retain their original meaning. Final certification and submission remain human actions.

The separate API/server product is documented as an optional integration; its branches, deployment and evidence are managed in its own repository.
