# Participant directory API

A Neon Function (Hono) that lets a signed-in user find a participant by ID or name. The side panel's
**Find in the participant directory** screens call it; manual entry, test data and document upload do not.

```text
POST /auth/sign-in        { email, password }   -> { token, sessionToken }   public
POST /auth/token          { sessionToken }      -> { token }                 public (refresh)
POST /auth/sign-out       { sessionToken }                                   public
GET  /health                                                                  public
GET  /whoami                                                                  JWT
GET  /participants/{id}                                                       JWT + directory membership
POST /participants/search { name }                                            JWT + directory membership
```

## Why sign-in goes through the Function

Neon Auth only accepts `http(s)` origins, and Better Auth rejects a `chrome-extension://` origin on sign-in. The Function
signs in server-side with its own https origin and returns a 15-minute JWT plus the session token. The extension keeps both
in `chrome.storage.session` and never talks to Neon Auth directly.

## Access control

- Every route except `/auth/*` and `/health` verifies the JWT (issuer and audience) against Neon Auth's JWKS.
- The directory routes also require a row in `directory_members` for the verified user, and filter every query by that
  row's `organization_id`. No row returns 403.
- Sign-up is closed: `neon neon-auth config email-password update --disable-sign-up`. Create users with
  `neon neon-auth user create`, then add them to `directory_members`.
- Request bodies and participant values are never logged. `participant_audit` records user, action and participant ID.
- Every non-GET request must come from a listed extension origin (or carry no `Origin`, i.e. a non-browser client) and
  declare `application/json`; otherwise 403 or 415. `Origin: null` and other sites are refused.
- `/auth/sign-in` counts each attempt in the `auth_attempts` table **before** it reaches Neon Auth, in one atomic
  statement, so a burst of parallel requests cannot all slip past a check. Three counters, 15-minute window, then 429 with
  `Retry-After`: 5 per (email, client address) pair, 30 per address, and 50 per email across all addresses. The email is
  hashed, and it is counted whether or not the account exists. A success clears the pair and gives the other two their
  attempt back. The address is the last `X-Forwarded-For` entry, which the proxy adds; a client-supplied first entry is
  ignored. Limits and logic live in `participant-api/src/guards.ts`.
- A third party cannot lock someone out from their own address: the tight limit is per pair, so it only locks that address
  out of that account. Spread across addresses it takes 50 failures to lock an email for everyone. `/auth/token` has no limit
  (session tokens are high-entropy).

## Run it on a branch

```bash
neon checkout dev --create --env .env.local            # a throwaway branch (expires in 7 days by neon.ts policy)
# apply participant-api/schema.sql to the branch using DATABASE_URL_UNPOOLED
neon neon-auth domain add <the function's https URL>   # so the Function may present it as its origin to Neon Auth
ALLOWED_ORIGINS=chrome-extension://<extension-id> AUTH_ORIGIN=<the function's https URL> neon deploy --env .env.local
```

The panel does not ask for the address, and none ships in the repository. Put yours in the gitignored
`shared/directory-config.local.mjs` (below) as `DIRECTORY_URL`, and update it when the Function moves (a new branch has a
new URL). Without it the directory screen says it is not set up.

### Development test account (local file, not in git)

The repository is public, so the test account's email and password are **not committed**. To set the address, and see the account and a
**Fill these in** button on the sign-in card, create a gitignored file next to the config:

```js
// shared/directory-config.local.mjs  (matched by .gitignore; never packaged)
export const DIRECTORY_URL = 'https://your-function.example.com';
export const DEV_TEST_ACCOUNT = { email: 'you@example.com', password: 'the-password' };
```

Without that file the card shows no note. Ask a teammate for the current account, or create one on the branch
(`neon neon-auth user create`, then add the user to `directory_members`). Release packages skip every `*.local.mjs` file.

`ALLOWED_ORIGINS` is a comma-separated list of extension origins. An unpacked extension's ID comes from its folder path,
so every tester has a different one unless the manifest carries a fixed `key`. Add each ID, or fix the ID first.

Data in `participants` is fictional (`synthetic` is enforced by a check constraint). Real participant data needs a
security review first. A request made seconds after a deploy can still be served by the previous version.
