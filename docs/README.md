# Documentation index

Start with the first group. Everything else is reference or an evidence record for a specific build or date. Older results keep their original version labels, so check the date and version before treating one as current.

## What changed and what is next

- [Recent engineering changes](RECENT_CHANGES.md): high-level notes, newest first.
- [Follow-up work](TODO.md): decisions deferred on purpose, such as adding a bundler.

## Use and test the extension

- [Feature guide](FEATURE_GUIDE.md): what you can try, with setup steps and limits for each feature.
- [Tester guide](TESTER_GUIDE.md): install, run a real WIC attempt, and report what happened.
- [Release notes v0.16](RELEASE_NOTES_v0.16.md): the current tester build.
- [Engineering review plan and production gaps](PRODUCTION_GAPS.md): what to verify and fix first.

## Current results

- [Form-filling results by site and approach](TEST_RESULTS.md): the cross-approach summary.
- [Benefit-site evaluation](BENEFIT_SITE_EVALUATION.md): live and controlled findings.
- [Benchmark errors](BENCHMARK_ERRORS.md): exact errors and run provenance.
- [Installed v0.14 WIC batch](INSTALLED_V014_BATCH.md): the latest installed live WIC runs.
- [Jev recovery, v0.15](JEV_RECOVERY_V015.md): fix checks for the planner.

## CAPTCHA

- [Native CAPTCHA actuator](CAPTCHA_ACTUATOR.md): how the bounded attempt works.
- [Fresh CAPTCHA tests, October 9](CAPTCHA_OCT9.md): the live attempts.
- [CAPTCHA run metrics](CAPTCHA_RUN_METRICS.md): speed and cost for every retained run.

## How it works and where it runs

- [Implementation notes](IMPLEMENTATION_NOTES.md): the mapping from the source protocol to the extension.
- [Model providers and usage accounting](MODEL_PROVIDERS.md): runtimes and data flow.
- [Protected Jev test access](JEV_TEST_ACCESS.md): how the Jev planner was reached for testing.
- [Self-service connector coverage](CONNECTOR_COVERAGE.md) and [recertification workflow](RECERTIFICATION_WORKFLOW.md).
- [OCR security, review policy, and limits](OCR_SECURITY_AND_LIMITS.md) and [work-queue security and recovery](WORK_QUEUE_SECURITY_AND_RECOVERY.md).

## Planning and release records

- [Roadmap](ROADMAP.md), [cost model](COST_MODEL.md), and [team update](TEAM_UPDATE_ONE_PAGER.md).
- [Public release scope](PUBLIC_RELEASE_SCOPE.md): what the public release includes and excludes.

## Historical snapshots (older builds)

- Release notes [v0.14](archive/RELEASE_NOTES_v0.14.md) and [v0.15](archive/RELEASE_NOTES_v0.15.md), in `docs/archive/`.
- [Production-readiness evidence](PRODUCTION_READINESS.md), dated 2026-09-25.
- [Release verification](RELEASE_VERIFICATION.md), for 0.13.0.
- [Test report](TEST_REPORT.md), dated 2026-10-13.

For developers, see the [developer guide](../DEVELOPER_GUIDE.md) and [contribution workflow](../CONTRIBUTING.md). The [evaluation result tables](../evaluation/results/README.md) hold the raw numbers.
