# Reviewed evaluation results

These tables support the October 7 writeup without publishing applicant values or raw live-site artifacts.

- [Controlled attempt ledger](controlled-attempts.json): all 30 plans, requested model/effort/transport, latency, score, usage, and hypothetical API prices. Provider-resolved identity stays unknown. No operator repairs.
- [Controlled aggregates](controlled-summary.json): two repeats per case/configuration, min/median/max latency and quality counts. Planning passes are not complete applications.
- [Jev attempt ledger](jev-attempts.json): all six actual October 7 requests, provider-reported identity, latency, token usage, price estimates and three confidence-threshold replays per response. Four scored planning passes; two IHSS incomplete plans.
- [Jev aggregates and pricing](jev-summary.json): two repeats per case, latency ranges, exact cost calculation and unknown billed/operating cost. No Eve fallback or browser execution.
- [Jev first extension integration batch](jev-extension-planning-initial.json): six real calls, four planning passes; WIC missed Medi-Cal in both repeats. No installed Chrome DOM execution.
- [Jev current extension integration batch](jev-extension-planning.json): all six real calls, three planning passes at confidence 0.90, including the failed WIC/CalFresh plans. No DOM execution or operator repairs.
- [CAPTCHA summary](captcha-summary.json): GPT-6.1 Sol Extra High in this chat accepted one authorized WIC checkbox; zero image challenges and no extension CAPTCHA attempts.
- [CAPTCHA runtime readiness and Nano image calls](captcha-runtime-readiness.json): Nano text/image availability and both actual ordinary-image checks, 8.28 s and 2.76 s. These are not CAPTCHA attempts. The later WIC batch is reported separately below.
- [Live metrics](live-summary.json): eight October 5 attempts and three earlier observations, with assistance and score denominators. No attempt reached unassisted final review.
- [Nano playbook experiment](nano-playbook-summary.json): six local attempts. One guided result failed to parse; do not omit it or count it as a correctness pass.
- [Pricing snapshot](../controlled-planning/pricing.json): assumptions for scenarios, not invoices.
- [Frozen cases and runner](../controlled-planning/README.md): reproduce planning experiments using your own authorized access.

New raw audits, role calls, workflow IDs, participant records, applicant screenshots, and the full embedded HTML evidence report remain in the private/local evaluation package. Older synthetic, value-free artifacts inherited from the already-public prototype are separate September observations. No credential or private API source was imported. The public metrics are an explicit whitelist of scores, durations, usage counts, configuration names, and reviewed outcome labels.

- [October 7 CAPTCHA action/browser trials](captcha-oct7-actions.json): every one of 14 decisions and fresh browser attempts; shared relay, two inconclusive observations, no applicant submission.
- [October 7 CAPTCHA image trials](captcha-oct7-images.json): the frozen-image repeat comparison, live model answers, runtime failures and image hashes. Manual tile adjudication and site acceptance are separate.
- [October 7 CAPTCHA aggregates](captcha-oct7-summary.json): seven requested configurations, 12 accepted states, two completed image sessions and one rejected image answer.
