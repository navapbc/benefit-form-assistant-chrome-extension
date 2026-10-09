# CAPTCHA speed and cost for every retained run

**October 9 installed update:** four fresh WIC form runs have per-run checkpoint speed, source-agreement errors, token/context usage and cost basis in [the new installed batch](INSTALLED_V014_BATCH.md). Nano/Codex each reached CAPTCHA; Jev's two runs stopped at questions. **Zero new native CAPTCHA attempts** means these are not added as CAPTCHA successes or failures in the historical ledger below. [Current native coverage and pending matrix](INSTALLED_V014_BATCH.md#which-models-completed-captcha).

The ledger covers all 14 October 7 action trials, all 21 image trials, the October 5 historical trial, the batch of eight CLI startup failures, four October 8 product-adapter image calls, four MIME-validation failures, and two native browser fixture attempts. Failures and missing results stay in the denominator. **Unknown means unmeasured, not zero.**

Runtime elapsed time includes setup and the model request. Nano alone exposes a separate prompt-time measurement. Browser observation intervals include relay orchestration and waiting. End-to-end journey time was not measured, and these noncontiguous phases cannot be added into a complete application duration.

Costs use the [October 6 price snapshot](../evaluation/controlled-planning/pricing.json) for hypothetical CLI/Eve API scenarios and the [October 7 Jev rate snapshot](../evaluation/results/jev-summary.json). Ranges reflect two cache-pricing scenarios, not statistical confidence. Actual billed amount, subscription allocation, device, relay, review and total operating cost remain unknown for every run. CLI/Eve/Nano used no directly billed API key; Jev used an API key, so its actual direct charge is unknown. Nano has no token-priced API estimate.

Where cache counters were not recorded, the API scenario assumes zero cached input; the ledger flags this assumption. It is not an attested cache charge. Failed requests without usage retain an unknown model-price estimate.

[Machine-readable full ledger](../evaluation/results/captcha-run-metrics.json) · [Original actions](../evaluation/results/captcha-oct7-actions.json) · [Original image trials](../evaluation/results/captcha-oct7-images.json)

## Checkbox action selection and live relay outcome

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| codex-gpt-6.1-sol-low-r1 | inconclusive expired before observation | 5.667 s | Unknown | 178.652 s | $0.036594–$0.045690 | $0.000000 | Unknown |
| codex-gpt-6.1-sol-xhigh-r1 | checkbox accepted | 5.632 s | Unknown | 53.996 s | $0.037290–$0.046385 | $0.000000 | Unknown |
| codex-gpt-6-luna-low-r1 | checkbox accepted | 4.450 s | Unknown | 46.492 s | $0.001760–$0.002198 | $0.000000 | Unknown |
| codex-gpt-6-luna-xhigh-r1 | checkbox accepted | 3.791 s | Unknown | 7.577 s | $0.001776–$0.002213 | $0.000000 | Unknown |
| codex-gpt-6-luna-xhigh-r2 | checkbox accepted | 7.279 s | Unknown | 118.883 s | $0.001425–$0.001775 | $0.000000 | Unknown |
| codex-gpt-6-luna-low-r2 | checkbox accepted | 5.106 s | Unknown | 84.885 s | $0.000309–$0.000343 | $0.000000 | Unknown |
| codex-gpt-6.1-sol-xhigh-r2 | inconclusive image challenge expired | 5.466 s | Unknown | 4.055 s | $0.037054–$0.046150 | $0.000000 | Unknown |
| codex-gpt-6.1-sol-low-r2 | checkbox accepted | 7.695 s | Unknown | 5.543 s | $0.036598–$0.045695 | $0.000000 | Unknown |
| eve-gpt-6.1-sol-low-r1 | checkbox accepted | 3.018 s | Unknown | 3.657 s | $0.004188–$0.005175 | $0.000000 | Unknown |
| eve-gpt-6.1-sol-low-r2 | checkbox accepted | 2.135 s | Unknown | 6.162 s | $0.004188–$0.005175 | $0.000000 | Unknown |
| jev-1.13.0-r1 | checkbox accepted | 0.241 s | Unknown | 55.282 s | $0.000025 | Unknown | Unknown |
| jev-1.13.0-r2 | checkbox accepted | 0.124 s | Unknown | 5.212 s | $0.000025 | Unknown | Unknown |
| nano-r1 | checkbox accepted | 8.024 s | 3.613 s | 107.573 s | Unknown | $0.000000 | Unknown |
| nano-r2 | checkbox accepted | 2.200 s | 2.101 s | 6.470 s | Unknown | $0.000000 | Unknown |

## Every October 7 image call, including timeouts and rejected answers

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| image-cli-authorized-codex-gpt-6.1-sol-xhigh-image-r1 | exact set correct | 13.946 s | Unknown | Unknown | $0.041536–$0.051145 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6.1-sol-low-image-r1 | exact set correct | 6.745 s | Unknown | Unknown | $0.032180–$0.040037 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6-luna-low-image-r1 | exact set correct | 4.589 s | Unknown | Unknown | $0.001871–$0.002335 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6-luna-xhigh-image-r1 | exact set correct | 7.688 s | Unknown | Unknown | $0.001727–$0.002103 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6-luna-xhigh-image-r2 | incorrect set or refusal | 6.006 s | Unknown | Unknown | $0.001926–$0.002390 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6-luna-low-image-r2 | incorrect set or refusal | 4.823 s | Unknown | Unknown | $0.001868–$0.002331 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6.1-sol-low-image-r2 | exact set correct | 5.207 s | Unknown | Unknown | $0.038956–$0.048565 | $0.000000 | Unknown |
| image-cli-authorized-codex-gpt-6.1-sol-xhigh-image-r2 | exact set correct | 18.316 s | Unknown | Unknown | $0.043086–$0.052695 | $0.000000 | Unknown |
| image-eve-eve-gpt-6.1-sol-low-image-r1 | error or missing result | 120.088 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-eve-gpt-6.1-sol-low-image-r2 | error or missing result | 120.051 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| live-luna-low-image-codex-gpt-6-luna-low-image-r1 | live accepted | 4.623 s | Unknown | Unknown | $0.001874–$0.002337 | $0.000000 | Unknown |
| live-luna-xhigh-image-codex-gpt-6-luna-xhigh-image-r1 | live rejected | 10.676 s | Unknown | Unknown | $0.001248–$0.001436 | $0.000000 | Unknown |
| live-luna-xhigh-followup-codex-gpt-6-luna-xhigh-image-r1 | live accepted | 7.566 s | Unknown | Unknown | $0.002043–$0.002506 | $0.000000 | Unknown |
| nano-frozen-image-nano-image-r1 | incorrect set or refusal | 11.835 s | 11.815 s | Unknown | Unknown | $0.000000 | Unknown |
| nano-frozen-image-nano-image-r2 | incorrect set or refusal | 6.163 s | 6.156 s | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-current-eve-gpt-6.1-sol-low-image-r1 | error or missing result | 120.057 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-current-eve-gpt-6.1-sol-low-image-r2 | error or missing result | 120.040 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-local-staging-image-eve-local-staging-r1 | error or missing result | 120.040 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-local-staging-image-eve-local-staging-r2 | error or missing result | 90.040 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-restarted-image-eve-restarted-r1 | exact set correct | 10.954 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| image-eve-restarted-image-eve-restarted-r2 | error or missing result | 3.105 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |

## October 8 product image adapters: classification only

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| v014-codex-gpt-6.1-sol-low-r1 | exact set correct | 10.260 s | Unknown | Unknown | $0.039452–$0.049055 | $0.000000 | Unknown |
| v014-codex-gpt-6.1-sol-low-r2 | exact set correct | 6.877 s | Unknown | Unknown | $0.031930–$0.039780 | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r1 | exact set correct | 5.160 s | Unknown | Unknown | $0.006074–$0.007528 | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r2 | exact set correct | 3.305 s | Unknown | Unknown | $0.006074–$0.007528 | $0.000000 | Unknown |

## October 8 MIME-validation failures before inference

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| v014-codex-gpt-6.1-sol-low-r1-validation | MIME validation rejected before inference | 0.003 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| v014-codex-gpt-6.1-sol-low-r2-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r1-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r2-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | Unknown | $0.000000 | Unknown |

## Earlier chat observation

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| historical-oct5-chat-checkbox | accepted | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |

## Startup failures before inference

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| infrastructure-image-cli (8 attempts) | CLI startup blocked by sandbox app-server initialization; authorized rerun preserved separately. | Unknown | Unknown | Unknown | Unknown | $0.000000 | Unknown |

## Native v0.14 actuator checks

Native adapter unit/integration tests and the deterministic browser fixture are separate from live CAPTCHA/model accuracy. Both browser-fixture repeats passed four checks in 5.4 / 6.4 ms with zero model calls and $0 direct API-key charge. The second repeat verified the final cancellation hardening. These exercise no real anti-bot service, screenshot/crop transport, or installed-extension application journey. Total operating cost is unknown. [Fixture receipts](../evaluation/results/captcha-native-fixture.json).
