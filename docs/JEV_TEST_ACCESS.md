# Protected Jev test access

**Status: no authenticated Jev inference has run in this evaluation.** The adapter and confidence-policy checks pass locally; they do not establish Jev quality, speed, or cost.

TypeSafe's [official quick start](https://docs.typesafe.ai/introduction/quickstart) documents a dashboard-issued API key and `POST https://api.typesafe.ai/v1/systemone` using Bearer authentication. Our prepared runner pins `jev-1.13.0` rather than the changing `jev-latest` alias.

## Provisioning route

The TypeSafe organization dashboard is now accessible and shows an active key for browser-extension testing. Its secret has not been supplied to the benchmark process. Organization access was requested for Nava Labs agentic form-filling testing. No credential has been posted in Slack or copied into this repository. The team messages describe Eve + Jev results, but do not identify how that earlier test credential was provisioned.

Preferred: an administrator provisions a test-only key with the narrowest available scope, a small agreed usage limit, and an expiry/rotation plan, then puts it in the approved secret manager. These are requested controls; the TypeSafe dashboard's available controls have not been verified. The benchmark process reads it as `TYPESAFE_API_KEY` or `JEV_API_KEY` from its environment. Do not paste it into chat, Chrome, a tracked file, or a command that prints it.

Alternative: an approved server keeps the TypeSafe provider key and exposes an authenticated, restricted test endpoint for the frozen synthetic cases. The maintainer must supply the endpoint contract and its approved test-token mechanism; an arbitrary unauthenticated proxy is not an equivalent credential. The current runner calls TypeSafe directly and would need a reviewed endpoint adapter for this alternative. Do not point Chrome at the TypeSafe key.

## Run after access is available

With the credential injected into a protected process environment, use Node 24:

```sh
cd evaluation/controlled-planning
node --test score.test.mjs jev-adapter.test.mjs
node run-jev.mjs --output-dir ../local-results/jev-new-batch
```

Six actual calls cover three cases twice. Each response is analyzed at confidence thresholds 0.8, 0.9, and 0.95; those are replays, not 18 inference calls. Store requested and reported identity, response usage, latency, failures, and current billing evidence. Missing usage or invoice information stays unknown. Missing credentials produce `not-run`, zero measured attempts, and an exit status of 2.

This tests Jev's decision stage only. It does not measure Eve fallback, integrated extension behavior, CAPTCHA, DOM execution, or whole-application completion. Those need separate trials.
