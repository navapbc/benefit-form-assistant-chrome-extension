# Public release scope

The public Nava release starts from the already-public prototype at `0a015b446a709095c9f0ebac9638f483cc67f8a1`. The private evaluation release is retained separately. Its commits are not ancestors of this release and are not pushed to the public fork.

Newly published content is limited to the extension interface changes, version metadata, guides, three SVG charts, a simulated home-screen image, the runnable frozen planning harness, and reviewed numeric result tables. The demonstration video and fictional fixtures were already public in the prototype.

The new result tables contain an explicit whitelist: configuration/case names, repeat numbers, quality counts and denominators, durations, usage counts, assistance counts, hypothetical API-price scenarios, unknown-cost markers, and reviewed outcome labels. They include all 30 controlled attempts, including failed planning scores. They exclude source records, participant/workflow identifiers, raw model requests/responses, per-provider receipts, and applicant screenshots. The frozen WIC inventory contains labels and options only; no entered field values are included. Harness records are deliberately fictional, with reserved example contact data and an invalid zero Social Security Number.

The full HTML evidence report, October live audits, provider role-call receipts, and four unused source snapshots from a separate private API repository remain private/local. They are not present in this new public commit or its added history. Fresh local inference output goes into ignored `evaluation/local-results/`; review it before sharing.

Older synthetic, value-free September audit files inherited from the already-public prototype remain as historical observations. Their correctness boundaries are explained in the current writeup. This release does not claim that raw live-site artifacts are safe for public disclosure merely because a token-pattern scan passes.
