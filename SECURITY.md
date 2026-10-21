# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private reporting instead: on this repository, choose **Security → Report a vulnerability**. Include what you found, the steps to reproduce it, and the version (`manifest.json`) you tested.

We aim to acknowledge a report within five business days. This is a research prototype maintained by a small team, so we cannot promise a fix timeline, but we will tell you what we decide.

## Supported versions

Only the latest commit on `main` is supported.

## What this project is, and is not

This is an experimental extension, not a production benefit service. It is meant to be adapted by teams who run their own security and privacy review.

- **Use fictional records only** until you have completed that review. The participant directory's `participants` table enforces `synthetic = true` for this reason.
- **Never commit** credentials, tenant tokens, applicant records, raw site captures or generated evaluation output. `.env*` files, `shared/*.local.mjs` and `evaluation/local-results/` are gitignored; keep them that way.
- **Review what leaves the device** before connecting a model runtime or API. See [docs/MODEL_PROVIDERS.md](docs/MODEL_PROVIDERS.md) for the data flow of each option.

## Known limits

[docs/TODO.md](docs/TODO.md#security-and-privacy) and [docs/PRODUCTION_GAPS.md](docs/PRODUCTION_GAPS.md) list the security gaps we already know about, including plaintext storage of a shared-API token in `chrome.storage.local` and unencrypted durable queue metadata. You do not need to report those.

## Hardening checklist before real use

1. Delete the development test account and any fictional data from your Neon (or other) directory, and use your own project.
2. Narrow `host_permissions` and `optional_host_permissions` in `manifest.json` to the sites you support.
3. Pin your extension's ID with a manifest `key` and list only that origin in the participant API's `ALLOWED_ORIGINS`.
4. Run the participant API and model companion only over HTTPS or loopback, with your own secrets.
5. Decide retention, encryption at rest and access rules for any stored participant data, and complete your organization's privacy review.
