# Version 0.15.0

Released: 2026-10-13

Version 0.15 adds bounded Jev recovery and fixes the WIC address and conditional-field errors observed in v0.14.

## Changes

- Composes the complete home or mailing address when a trusted site control expects a single address value.
- Leaves the WIC mailing-address control blank when home and mailing addresses match.
- Requires a Medi-Cal case number only when coverage is Yes.
- Retries only unresolved Jev classifications once, then stops if there is no safe progress.
- Reuses a mapping after rescan only when the DOM value matches the current source record; cache scope includes page, document and source identity.
- Keeps final-review and Submit controls out of ordinary form answers.
- Separates Jev, Jev retry, deterministic site-rule and verified-reuse counts in result metadata.
- Deduplicates readback provenance and removes stale questions after a verified rescan.

## Validation

- 210 automated tests pass.
- 10/12 controlled Jev cases pass, compared with 0/12 for the frozen v0.14 baseline and 7/12 for retry alone.
- 8/8 real-browser WIC fixture trials pass with zero incorrect answers or unexpected questions.
- Browser median: 8.994 seconds. Median estimated Jev cost: $0.000638 per trial.
- Remaining controlled failure: CalFresh housing-status transformation in both repeats; county confidence varied in one repeat.

See the [full Jev v0.15 evaluation](../JEV_RECOVERY_V015.md) for per-run timing, tokens, estimated cost, scope and error attribution.

## Testing boundary

The fresh browser batch used a local synthetic WIC DOM. It did not test the installed extension on the live government site, solve a CAPTCHA, or submit an application. Caseworkers must still review every answer and submit themselves.
