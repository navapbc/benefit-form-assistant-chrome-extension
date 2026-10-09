# CAPTCHA speed and cost for every retained run

The ledger covers all 14 October 7 action trials, all 21 image trials, the October 5 historical trial, the batch of eight CLI startup failures, four October 8 product-adapter image calls, four MIME-validation failures, two native browser fixture attempts, 36 fresh October 9 product classifications and three installed native attempts. Failures and missing results stay in the denominator. **Unknown means unmeasured, not zero.**

Runtime elapsed time includes setup and the model request. The older Nano image harness exposes separate prompt time; the new product adapter records whole-call duration. Browser observation intervals include relay orchestration and waiting. End-to-end journey time was not measured, and these noncontiguous phases cannot be added into a complete application duration.

Costs use the [October 6 price snapshot](../evaluation/controlled-planning/pricing.json) for hypothetical CLI/Eve API scenarios and the [October 7 Jev rate snapshot](../evaluation/results/jev-summary.json). Ranges reflect two cache-pricing scenarios, not statistical confidence. Actual billed amount, subscription allocation, device, relay, review and total operating cost remain unknown for every run. CLI/Eve/Nano used no directly billed API key; Jev used an API key, so its actual direct charge is unknown. **Nano API cost is $0**; device/operating cost is unmeasured. October 9 CLI/Eve classifications use the [October 9 price snapshot](../evaluation/installed-v014/pricing-2026-10-09.json). Native checkbox-only attempts also have $0 marginal API cost.

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
| nano-r1 | checkbox accepted | 8.024 s | 3.613 s | 107.573 s | $0.000000 | $0.000000 | Unknown |
| nano-r2 | checkbox accepted | 2.200 s | 2.101 s | 6.470 s | $0.000000 | $0.000000 | Unknown |

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
| nano-frozen-image-nano-image-r1 | incorrect set or refusal | 11.835 s | 11.815 s | Unknown | $0.000000 | $0.000000 | Unknown |
| nano-frozen-image-nano-image-r2 | incorrect set or refusal | 6.163 s | 6.156 s | Unknown | $0.000000 | $0.000000 | Unknown |
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
| v014-codex-gpt-6.1-sol-low-r1-validation | MIME validation rejected before inference | 0.003 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| v014-codex-gpt-6.1-sol-low-r2-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r1-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| v014-eve-gpt-6.1-sol-low-r2-validation | MIME validation rejected before inference | 0.001 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |

## October 9 product adapters across three saved grids

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| oct9-crops-traffic-lights-codex-gpt-6.1-sol-low-r1 | exact set | 8.035 s | Unknown | Unknown | $0.036930–$0.045995 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6.1-sol-xhigh-r1 | exact set | 18.629 s | Unknown | Unknown | $0.033604–$0.041025 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6-luna-low-r1 | wrong set | 4.791 s | Unknown | Unknown | $0.001426–$0.001780 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6-luna-xhigh-r1 | wrong set | 9.835 s | Unknown | Unknown | $0.001699–$0.002053 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-eve-gpt-6.1-sol-low-r1 | model handoff | 9.900 s | Unknown | Unknown | $0.005488–$0.006513 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-eve-gpt-6.1-sol-low-r2 | model handoff | 8.018 s | Unknown | Unknown | $0.005808–$0.006833 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6-luna-xhigh-r2 | wrong set | 8.437 s | Unknown | Unknown | $0.001955–$0.002391 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6-luna-low-r2 | wrong set | 5.040 s | Unknown | Unknown | $0.001756–$0.002192 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6.1-sol-xhigh-r2 | exact set | 12.564 s | Unknown | Unknown | $0.038476–$0.047543 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-codex-gpt-6.1-sol-low-r2 | exact set | 8.643 s | Unknown | Unknown | $0.037246–$0.046312 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6.1-sol-low-r1 | exact set | 6.453 s | Unknown | Unknown | $0.036864–$0.045930 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6.1-sol-xhigh-r1 | exact set | 9.325 s | Unknown | Unknown | $0.031338–$0.038760 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6-luna-low-r1 | wrong set | 4.365 s | Unknown | Unknown | $0.001782–$0.002217 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6-luna-xhigh-r1 | model handoff | 4.985 s | Unknown | Unknown | $0.001793–$0.002229 | $0.000000 | Unknown |
| oct9-crops-bridges-eve-gpt-6.1-sol-low-r1 | exact set | 4.674 s | Unknown | Unknown | $0.004666–$0.005690 | $0.000000 | Unknown |
| oct9-crops-bridges-eve-gpt-6.1-sol-low-r2 | exact set | 5.982 s | Unknown | Unknown | $0.004626–$0.005650 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6-luna-xhigh-r2 | model handoff | 5.137 s | Unknown | Unknown | $0.000438–$0.000496 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6-luna-low-r2 | wrong set | 4.996 s | Unknown | Unknown | $0.001755–$0.002191 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6.1-sol-xhigh-r2 | exact set | 8.807 s | Unknown | Unknown | $0.014134–$0.016992 | $0.000000 | Unknown |
| oct9-crops-bridges-codex-gpt-6.1-sol-low-r2 | exact set | 6.597 s | Unknown | Unknown | $0.036818–$0.045882 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6.1-sol-low-r1 | wrong set | 10.634 s | Unknown | Unknown | $0.005788–$0.006534 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6.1-sol-xhigh-r1 | model handoff | 30.102 s | Unknown | Unknown | $0.042298–$0.051362 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6-luna-low-r1 | exact set | 3.688 s | Unknown | Unknown | $0.000765–$0.000926 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6-luna-xhigh-r1 | model handoff | 10.095 s | Unknown | Unknown | $0.001777–$0.002213 | $0.000000 | Unknown |
| oct9-crops-bicycles-eve-gpt-6.1-sol-low-r1 | wrong set | 7.362 s | Unknown | Unknown | $0.005586–$0.006610 | $0.000000 | Unknown |
| oct9-crops-bicycles-eve-gpt-6.1-sol-low-r2 | exact set | 4.389 s | Unknown | Unknown | $0.004656–$0.005680 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6-luna-xhigh-r2 | exact set | 4.845 s | Unknown | Unknown | $0.001490–$0.001844 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6-luna-low-r2 | exact set | 4.860 s | Unknown | Unknown | $0.001756–$0.002192 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6.1-sol-xhigh-r2 | model handoff | 27.086 s | Unknown | Unknown | $0.032692–$0.040113 | $0.000000 | Unknown |
| oct9-crops-bicycles-codex-gpt-6.1-sol-low-r2 | wrong set | 10.616 s | Unknown | Unknown | $0.007478–$0.008692 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-nano-r1 | wrong set | 21.626 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-crops-traffic-lights-nano-r2 | wrong set | 2.296 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-crops-bridges-nano-r1 | wrong set | 2.496 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-crops-bridges-nano-r2 | wrong set | 2.601 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-crops-bicycles-nano-r1 | model handoff | 2.072 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-crops-bicycles-nano-r2 | wrong set | 2.273 s | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |

## October 9 installed native checkbox attempts (no image model called)

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| oct9-native-nano-r1 | handoff: widget hidden or unsupported | 0.031 s | 0.000 s | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-native-nano-r2 | accepted: visible checkbox accepted | 2.494 s | 0.000 s | Unknown | $0.000000 | $0.000000 | Unknown |
| oct9-native-codex-sol-low-r1 | accepted: visible checkbox accepted | 1.882 s | 0.000 s | Unknown | $0.000000 | $0.000000 | Unknown |

## Earlier chat observation

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| historical-oct5-chat-checkbox | accepted | Unknown | Unknown | Unknown | Unknown | Unknown | Unknown |

## Startup failures before inference

| Trial | Outcome | Runtime elapsed | Pure inference | Browser observation interval | API-price estimate/scenario | Direct API-key charge | Billed cost |
|---|---|---:|---:|---:|---:|---:|---:|
| infrastructure-image-cli (8 attempts) | CLI startup blocked by sandbox app-server initialization; authorized rerun preserved separately. | Unknown | Unknown | Unknown | $0.000000 | $0.000000 | Unknown |

## Native v0.14 actuator checks

Native adapter unit/integration tests and the deterministic browser fixture are separate from live CAPTCHA/model accuracy. Both browser-fixture repeats passed four checks in 5.4 / 6.4 ms with zero model calls and $0 direct API-key charge. The second repeat verified the final cancellation hardening. These exercise no real anti-bot service, screenshot/crop transport, or installed-extension application journey. Total operating cost is unknown. [Fixture receipts](../evaluation/results/captcha-native-fixture.json).
