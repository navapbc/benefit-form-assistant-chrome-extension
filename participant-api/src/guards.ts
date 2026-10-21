// Request guards for the sign-in broker. Kept free of Hono, Neon and Node-only imports (and of non-erasable TypeScript)
// so the unit tests can load this file directly.
//
// Why they exist: the broker signs in to Neon Auth with the Function's own trusted origin and from the Function's own
// address, so Neon Auth's origin check and per-address limits cannot see the real caller. These checks restore both.
import { createHash } from 'node:crypto';

export const WINDOW_MINUTES = 15;
/** Sign-in attempts per (email, client address) pair in a window. Only that address is locked out of that account. */
export const EMAIL_IP_LIMIT = 5;
/** Sign-in attempts per client address in a window, across all emails. */
export const IP_LIMIT = 30;
/**
 * Sign-in attempts per email in a window, across all addresses. High on purpose: it only bounds an attack spread over many
 * addresses, and a low value would let a third party lock a known email out for everyone.
 */
export const EMAIL_LIMIT = 50;

/**
 * Refuses a state-changing request that a browser page could have sent cross-site: a browser always sends Origin, so any
 * Origin must be allow-listed, and the body must be declared JSON so a plain-text form post is not accepted. A request with
 * no Origin comes from a non-browser client and is left to the rate limit.
 */
export function checkBrowserRequest(request: { method: string; origin?: string; contentType?: string }, allowedOrigins: Set<string>): { status: 403 | 415; error: string } | null {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return null;
  if (request.origin !== undefined && !allowedOrigins.has(request.origin)) return { status: 403, error: 'Origin not allowed.' };
  if (!/^application\/json(?:;|$)/i.test(request.contentType ?? '')) return { status: 415, error: 'Send application/json.' };
  return null;
}

/** The client address as seen by the proxy in front of the Function: the last X-Forwarded-For entry, which the proxy adds. */
export function clientIp(forwardedFor: string | undefined): string {
  const last = String(forwardedFor ?? '').split(',').map((part) => part.trim()).filter(Boolean).pop();
  return last && last.length <= 64 ? last : 'unknown';
}

/** Keys the attempts are counted under. The email is hashed so the table holds no addresses. */
const emailHash = (email: string): string => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export const emailKey = (email: string): string => `email:${emailHash(email)}`;
export const ipKey = (ip: string): string => `ip:${ip}`;
export const pairKey = (email: string, ip: string): string => `pair:${emailHash(email)}:${ip}`;

type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };

/**
 * Attempt counters in Postgres, so they hold across the Function's isolates and restarts.
 *
 * `reserve` counts the attempt and reads the count in one statement, before the request goes to Neon Auth, so parallel
 * requests cannot all pass a check made before any of them is counted. A success gives the attempt back with `release` or
 * `clear`; a failure simply keeps it counted.
 */
export function createLimiter(db: Queryable, windowMinutes: number = WINDOW_MINUTES) {
  return {
    /** Counts one attempt on `key`. Returns 0 when it is within `limit`, otherwise the seconds until the window ends. */
    async reserve(key: string, limit: number): Promise<number> {
      const { rows } = await db.query(
        `insert into auth_attempts (key, failures, window_started) values ($1, 1, now())
         on conflict (key) do update set
           failures = case when auth_attempts.window_started > now() - make_interval(mins => $2) then auth_attempts.failures + 1 else 1 end,
           window_started = case when auth_attempts.window_started > now() - make_interval(mins => $2) then auth_attempts.window_started else now() end
         returning failures, ceil(extract(epoch from (window_started + make_interval(mins => $2) - now())))::int as seconds`,
        [key, windowMinutes],
      );
      return rows[0].failures > limit ? Math.max(1, rows[0].seconds) : 0;
    },
    /** Gives one counted attempt back (after a success), never below zero. */
    async release(key: string): Promise<void> {
      await db.query('update auth_attempts set failures = greatest(failures - 1, 0) where key = $1', [key]);
    },
    async clear(key: string): Promise<void> {
      await db.query('delete from auth_attempts where key = $1', [key]);
    },
  };
}
