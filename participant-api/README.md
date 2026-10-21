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
- The sign-in route has no rate limit yet. Add one before real use.

## Run it on a branch

```bash
neon checkout dev --create --env .env.local            # a throwaway branch (expires in 7 days by neon.ts policy)
# apply participant-api/schema.sql to the branch using DATABASE_URL_UNPOOLED
neon neon-auth domain add <the function's https URL>   # so the Function may present it as its origin to Neon Auth
ALLOWED_ORIGINS=chrome-extension://<extension-id> AUTH_ORIGIN=<the function's https URL> neon deploy --env .env.local
```

The panel does not ask for the address: it is `DIRECTORY_URL` in `shared/directory-config.mjs`. Update it when the Function
moves (a new branch has a new URL).

### Development test account (local file, not in git)

The repository is public, so the test account's email and password are **not committed**. To see the account and a
**Fill these in** button on the sign-in card, create a gitignored file next to the config:

```js
// shared/directory-config.local.mjs  (matched by .gitignore; never packaged)
export const DEV_TEST_ACCOUNT = { email: 'you@example.com', password: 'the-password' };
```

Without that file the card shows no note. Ask a teammate for the current account, or create one on the branch
(`neon neon-auth user create`, then add the user to `directory_members`). Release packages skip every `*.local.mjs` file.

`ALLOWED_ORIGINS` is a comma-separated list of extension origins. An unpacked extension's ID comes from its folder path,
so every tester has a different one unless the manifest carries a fixed `key`. Add each ID, or fix the ID first.

Data in `participants` is fictional (`synthetic` is enforced by a check constraint). Real participant data needs a
security review first. A request made seconds after a deploy can still be served by the previous version.
