# Benefit form evaluation harness

This package runs actual inference through a frozen copy of the extension's three-role planner and keeps scores separate from live browser completion. It is an initial controlled pilot, not the complete government-site evaluation.

## Run

Use Node 24 and the signed-in Codex CLI. No OpenAI API key is used or passed to the CLI.

```sh
node --test score.test.mjs jev-adapter.test.mjs
node run.mjs --output-dir ../local-results/new-cli-batch
```

The matrix is GPT-6.1 Sol / GPT-6 Luna × low / xhigh × three cases × two repeats = 24 plans, 72 role calls when none fails. Cases and source hashes are recorded. Both runners refuse to overwrite an existing results.json. Use --output-dir with a fresh batch directory. The CLI runner also accepts --models, --reasoning and --repeats. Supported reasoning settings are low, medium, high, xhigh and max; model prices are verified only for the two supplied models. Each file is one attempt, not a replaceable success slot.

The WIC controls were read from the live form previously and frozen. IHSS and CalFresh are authored diagnostic subsets using historical omissions, not replicas of their entire websites. No model receives the source values. Expected mappings and gaps are independently specified in cases.mjs. The scorer includes missing and wrong mappings, sensitive identifier errors and false/missed gaps. A planning pass leaves semantic value correctness and whole-application completion null.

## Eve

Eve 0.71.2 is installed only in eve/. Its supported chatgpt() transport resolves the existing local Codex sign-in; credentials are never copied into this package or printed. Start the loopback test server, then run the same roles via its Client SDK:

```sh
cd eve
npm ci --ignore-scripts
node node_modules/eve/bin/eve.js dev --host 127.0.0.1 --port 4188 --no-ui --no-default-extensions
# from the parent directory, after the Codex batch finishes:
node run-eve.mjs --output-dir ../local-results/new-eve-batch
```

This Eve pilot holds GPT-6.1 Sol low and the extension's role inputs/validator fixed. Eve's own system envelope and structured-output mechanics are different. It tests Eve as the planning transport, not its full multi-page browser orchestration, memory or compaction. The existing extension was not reloaded or pointed at this development server.

## Jev

jev-adapter.mjs uses the real TypeSafe endpoint and pins jev-1.13.0. It refuses to turn a missing key into a result. Supply TYPESAFE_API_KEY or JEV_API_KEY through a protected local environment, keep it out of tracked files, command arguments, logs and Chrome. Run requests only after configuring the test credential: node run-jev.mjs --output-dir ../local-results/new-jev-batch. The runner makes six decision-stage requests and analyzes each response at 0.8, 0.9 and 0.95; those replays do not multiply the inference count. This is not an Eve+Jev full journey. Every decision retains its confidence; non-finite confidence defers. Replaying thresholds is analysis of one response, not repeated inference.

The benchmark adapter is a separate implementation that includes questions in state, retains unknown usage as null, and validates finite confidence. Its results must not be attributed to the separate Nava API's unchanged deployed adapter. API source snapshots used during local review are not included in this public release; the runnable frozen extension planner, fictional fixture, scorer, and reviewed attempt metrics are included.

## Evidence and cost

The public [result tables](../results/README.md) include every measured controlled attempt and aggregate live metrics. Raw live-site audits, provider receipts, model output, workflow identifiers, and applicant screenshots are excluded from this public release and retained privately. New local runs write to ignored `../local-results/` folders; review their contents before sharing. Provider-resolved identity is null when the transport does not emit it. The CLI's input includes its own harness instructions: token differences between the CLI and Eve may reflect that envelope and are system-level results.

An initial transport smoke used incorrect golden radio group identifiers and is excluded from the pilot. The preflight now rejects unmatched golden identifiers before any call. Private smoke receipts are retained but not distributed here.

Direct API-key charges for the subscription path are zero. Subscription allocation, local compute and operating cost are unknown. Do not price these calls as API invoices, compare Nano context units to tokens, or label a missing usage counter zero.

protocol.json defines the larger controlled and live-site design, claim boundaries, source/assistance scoring and cost denominator. It does not report the planned trials as already executed.

## Recorded October 6 pilot

The recorded pilot has 24 CLI plans (19 planning passes) and 6 Eve plans (6 planning passes), totaling 90 actual role calls with no tools or operator repairs. Provider-resolved identity remains unavailable; Eve step events report the configured model. WIC planning passed even with the known street-only address mapping. Full semantic execution and real-site completion are unmeasured in this pilot.

Runner hardening after the pilot added overwrite protection, configurable repeats/efforts, request hashes for future calls, and draining of pending sibling calls on failures. Those extra per-request hashes are not retroactively claimed for the original receipts. The frozen planner and private measured receipts were not rewritten. Eve cached-read normalization was corrected for future bridge responses; report aggregation reads the preserved raw cacheReadTokens, so the correction did not change measured outcomes.

## Recorded October 7 Jev pilot

Six real `jev-1.13.0` requests returned the same provider-reported version. At every replay threshold (0.8, 0.9, 0.95), WIC passed 2/2, IHSS 0/2 and CalFresh 2/2. One other-person identifier decision was deferred in both IHSS repeats instead of becoming the required gap question. No fallback or browser execution ran. Median API latency was 0.158 seconds; recorded usage yields $0.002129652 at the published list price, not a verified invoice. Inspect [all attempts](../results/jev-attempts.json) and [aggregates/pricing](../results/jev-summary.json). This one-request classifier differs from the three-role CLI/Eve planner, so its latency is not an isolated harness comparison.

## Current extension planner with Jev

Start the v0.13 [protected companion](../../model-bridge/README.md#jev-in-the-chrome-extension--v013). In a second terminal, supply its local pairing token as `NAVA_MODEL_BRIDGE_TOKEN` through the process environment; this is **not** the TypeSafe key. Then run:

```sh
node run-jev-extension.mjs --output-dir ../local-results/jev-extension-new-batch
```

Use `NAVA_MODEL_BRIDGE_URL` if the companion uses a different loopback port. This runner calls the current `shared/agentic-planner.js`, not the frozen three-role planner or older classifier adapter. Six actual requests cover the same three fictional cases twice, at confidence 0.90. It preserves failures and cannot overwrite an existing batch. It measures transport and planning; it does not open Chrome, fill the DOM or click CAPTCHA. Local checks convert required deferrals into caseworker questions.
