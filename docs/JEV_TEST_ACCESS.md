# Protected Jev test access

**Status: six authenticated decision-stage requests completed October 7, 2026.** The provider returned `jev-1.13.0`. WIC and CalFresh passed both scored plans; IHSS missed one required question in both repeats. Median API response was 0.158 seconds. See [results and cost assumptions](../evaluation/results/jev-summary.json) and [the writeup](BENEFIT_SITE_EVALUATION.md). Version 0.13 now includes a selectable Jev runtime with a protected companion. Twelve additional actual extension-planner requests ran in two batches; the current batch passed 3/6. Installed Chrome DOM execution remains pending. See [companion instructions](../model-bridge/README.md#jev-in-the-chrome-extension--v013) and [current attempts](../evaluation/results/jev-extension-planning.json).

TypeSafe's [official quick start](https://docs.typesafe.ai/introduction/quickstart) documents a dashboard-issued API key and `POST https://api.typesafe.ai/v1/systemone` using Bearer authentication. Our prepared runner pins `jev-1.13.0` rather than the changing `jev-latest` alias.

## Provisioning route

An authorized test credential was supplied for Nava Labs agentic form-filling testing. It was injected through echo-disabled standard input into a short-lived local Node process, held in its environment during the batch, and removed afterward. It was not written to files, command arguments, public ledgers or Git. Access for this pilot does not establish a formal organization provisioning policy.

Preferred: an administrator provisions a test-only key with the narrowest available scope, a small agreed usage limit, and an expiry/rotation plan, then puts it in the approved secret manager. These are requested controls; the TypeSafe dashboard's available controls have not been verified. The benchmark process reads it as `TYPESAFE_API_KEY` or `JEV_API_KEY` from its environment. Keep the credential out of Chrome, tracked files, command arguments and logs.

Alternative: an approved server keeps the TypeSafe provider key and exposes an authenticated, restricted test endpoint for the frozen synthetic cases. The maintainer must supply the endpoint contract and its approved test-token mechanism; an arbitrary unauthenticated proxy is not an equivalent credential. The current runner calls TypeSafe directly and would need a reviewed endpoint adapter for this alternative. Do not point Chrome at the TypeSafe key.

## Rerun with authorized access

With the credential injected into a protected process environment, use Node 24:

```sh
cd evaluation/controlled-planning
node --test score.test.mjs jev-adapter.test.mjs
node run-jev.mjs --output-dir ../local-results/jev-new-batch
```

Six actual calls cover three cases twice. Each response is analyzed at confidence thresholds 0.8, 0.9, and 0.95; those are replays, not 18 inference calls. Store requested and reported identity, response usage, latency, failures, and current billing evidence. Missing usage or invoice information stays unknown. Missing credentials produce `not-run`, zero measured attempts, and an exit status of 2.

This tests Jev's decision stage only. It does not measure Eve fallback, integrated extension behavior, CAPTCHA, DOM execution, or whole-application completion. Those need separate trials.
