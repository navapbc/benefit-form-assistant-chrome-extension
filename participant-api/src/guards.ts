// Request guards for the sign-in broker. Kept free of Hono, Neon and Node-only imports (and of non-erasable TypeScript)
// so the unit tests can load this file directly.
//
// Why they exist: the broker signs in to Neon Auth with the Function's own trusted origin and from the Function's own
// address, so Neon Auth's origin check and per-address limits cannot see the real caller. These checks restore both.
import { createHash } from 'node:crypto';

export const WINDOW_MINUTES = 15;
/** Failed sign-ins per email (whether or not the account exists) before it is locked for the rest of the window. */
export const EMAIL_LIMIT = 5;
/** Failed sign-ins per client address before it is locked for the rest of the window. */
export const IP_LIMIT = 30;

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

/** Keys the failures are counted under. The email is hashed so the table holds no addresses. */
export const emailKey = (email: string): string => `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
export const ipKey = (ip: string): string => `ip:${ip}`;

type Queryable = { query(text: string, values?: unknown[]): Promise<{ rows: any[] }> };

/** Failed-attempt counters in Postgres, so they hold across the Function's isolates and restarts. */
export function createLimiter(db: Queryable, windowMinutes: number = WINDOW_MINUTES) {
  return {
    /** Seconds until `key` may try again, or 0 when it is under `limit`. */
    async lockedFor(key: string, limit: number): Promise<number> {
      const { rows } = await db.query(
        `select failures, ceil(extract(epoch from (window_started + make_interval(mins => $2) - now())))::int as seconds
           from auth_attempts where key = $1 and window_started > now() - make_interval(mins => $2)`,
        [key, windowMinutes],
      );
      return rows[0] && rows[0].failures >= limit ? Math.max(1, rows[0].seconds) : 0;
    },
    async recordFailure(key: string): Promise<void> {
      await db.query(
        `insert into auth_attempts (key, failures, window_started) values ($1, 1, now())
         on conflict (key) do update set
           failures = case when auth_attempts.window_started > now() - make_interval(mins => $2) then auth_attempts.failures + 1 else 1 end,
           window_started = case when auth_attempts.window_started > now() - make_interval(mins => $2) then auth_attempts.window_started else now() end`,
        [key, windowMinutes],
      );
    },
    async clear(key: string): Promise<void> {
      await db.query('delete from auth_attempts where key = $1', [key]);
    },
  };
}
