// Where the participant directory lives, and the optional development test account shown on its sign-in screen.
//
// No directory address ships in the repository. Deploy `participant-api/` to your own project (see its README), then create
// the gitignored file `shared/directory-config.local.mjs` exporting `DIRECTORY_URL` (an https address, or an http loopback
// address for local development) and, optionally, `DEV_TEST_ACCOUNT = { email, password }`. Without it the participant
// directory screen says it is not set up.
//
// The local file is never committed or packaged (.gitignore, scripts/shipped-files.mjs), so the account password and your
// address stay out of a public repository. When a test account is present the sign-in screen shows it with a fill-in
// button; when it is absent nothing is shown.

/** The address the code provides by default: empty, so nothing points at anyone's infrastructure. */
export const DIRECTORY_URL = '';

/**
 * The directory address from the gitignored local file, or '' when there is none. Never throws.
 * @param {(specifier: string) => Promise<any>} [importer] loads the local file; replaced in tests.
 * @returns {Promise<string>}
 */
export async function loadDirectoryUrl(importer = (specifier) => import(/* a variable keeps this optional */ specifier)) {
  try {
    const { DIRECTORY_URL: local } = await importer('./directory-config.local.mjs');
    return typeof local === 'string' ? local.trim() : DIRECTORY_URL;
  } catch {
    return DIRECTORY_URL;
  }
}

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
