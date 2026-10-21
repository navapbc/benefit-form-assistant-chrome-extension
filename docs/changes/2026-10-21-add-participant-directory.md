# Add a participant directory on Neon

## Summary
Added a login-gated participant directory: a Neon Function and Postgres tables, plus side-panel sign-in and search that find a client by name or ID.

## Changes made
- Added `participant-api/` (Hono Function): sign-in broker (`/auth/sign-in`, `/auth/token`, `/auth/sign-out`), `GET /participants/{id}` and `POST /participants/search`. Schema in `participant-api/schema.sql`, notes in `participant-api/README.md`.
- Added `neon.ts` (Auth on, one function, 7-day expiry for non-default branches) and the `@neon/*`, `hono`, `jose` and `pg` dependencies.
- Sign-in guards (`participant-api/src/guards.ts`): non-GET requests need a listed origin (or none) and a JSON content type, and failed sign-ins are counted per hashed email and per client address in `auth_attempts` (5 and 30 per 15 minutes, then 429).
- Access control: JWT issuer and audience checks, a `directory_members` table keyed by the verified user, an `organization_id` filter on every query, closed sign-up, and a `participant_audit` table that records user, action and ID but no values.
- Added `shared/participant-directory.mjs` (client with refresh, one retry on 401, fixed error messages, tokens in `chrome.storage.session`), `shared/directory-config.mjs` (address, and a loader for the development test account from the gitignored `shared/directory-config.local.mjs`; release packages skip `*.local.mjs`), and `sidepanel/view-directory.mjs`.
- Added a simulated directory for the extension-free preview (`sidepanel/preview-directory.mjs`).
- Added a store behind the mock connector (`connector-service/store.mjs`, `schema.sql`, `migrate.mjs`) and preset scenarios in `shared/mock-scenarios.mjs`.
- Added tests for the client, handlers, views and both stores; wrote [the Eve and Jev plan](../JEV_EVE_ALIGNMENT_PLAN.md) with the spike results.

## What it improves or fixes
Before, a client could only come from pasted JSON, a document, or the fictional Apricot-shaped connector, and the repo had no database. Now a signed-in caseworker can search a database of participants. Typing details, sample clients and document upload still need no login.

Neon Auth rejects `chrome-extension://` origins, so the extension cannot sign in directly; the Function signs in server-side and returns a 15-minute token. A security review found that any signed-in user could read every participant; the membership and organization checks fix that.

The data is fictional (`synthetic` is enforced). The Function runs on the Neon `dev` branch; its 7-day expiry was removed afterwards with `neon branches set-expiration dev`.

## How to run / verify
```bash
npm test
node --env-file=.env.local -e "process.env.MOCK_TEST_DATABASE_URL=process.env.DATABASE_URL; require('child_process').spawnSync(process.execPath,['--test','tests/mock-connector-store.test.cjs'],{stdio:'inherit',env:process.env})"
```

Then load the repo folder in `chrome://extensions` (Load unpacked), open the side panel, and on the start screen choose **Fill these in** and **Sign in**. Search for `thomas` or `339619`. Setup steps are in `participant-api/README.md`.
