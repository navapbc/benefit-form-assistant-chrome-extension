// Where the participant directory lives, and the optional development test account shown on its sign-in screen.
//
// The address is the Neon `dev` branch Function. It is development-only: point it at the real directory when there is one.
//
// The test account is NOT in the repository. The repo is public, so its email and password live in a gitignored file,
// `shared/directory-config.local.mjs`, which exports `DEV_TEST_ACCOUNT = { email, password }`. When that file is present the
// sign-in screen shows the account with a fill-in button; when it is absent nothing is shown. Release packages never include
// it (scripts/shipped-files.mjs). See participant-api/README.md for how to create it.

export const DIRECTORY_URL = 'https://br-restless-sea-b5je523a-participants.compute.c-7.us-east-2.aws.neon.tech';

/**
 * The local development test account, or null when there is none. Never throws: a missing file, a bad shape or an
 * unreadable value all mean "no note".
 * @param {(specifier: string) => Promise<any>} [importer] loads the local file; replaced in tests.
 * @returns {Promise<{ email: string, password: string } | null>}
 */
export async function loadDevTestAccount(importer = (specifier) => import(/* a variable keeps this optional */ specifier)) {
  try {
    const { DEV_TEST_ACCOUNT } = await importer('./directory-config.local.mjs');
    if (typeof DEV_TEST_ACCOUNT?.email !== 'string' || typeof DEV_TEST_ACCOUNT?.password !== 'string') return null;
    if (!DEV_TEST_ACCOUNT.email || !DEV_TEST_ACCOUNT.password) return null;
    return Object.freeze({ email: DEV_TEST_ACCOUNT.email, password: DEV_TEST_ACCOUNT.password });
  } catch {
    return null;
  }
}
