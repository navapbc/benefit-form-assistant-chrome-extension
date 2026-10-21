// Participant directory API (spike). Every route except /health requires a Neon Auth bearer JWT.
// Logs never include request bodies or participant values.
import { Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Pool } from 'pg';
import { attachDatabasePool, waitUntil } from '@neon/functions';
import { EMAIL_IP_LIMIT, EMAIL_LIMIT, IP_LIMIT, checkBrowserRequest, clientIp, createLimiter, emailKey, ipKey, pairKey } from './guards.ts';

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean));

// Neon Auth only accepts http(s) origins, so a browser extension cannot call it directly: Better Auth rejects a
// chrome-extension:// Origin on sign-in. The Function signs in server-side, sending its own https origin
// (registered with `neon neon-auth domain add`), and hands the extension a short-lived JWT plus the session token.
const authBase = process.env.NEON_AUTH_BASE_URL!;
const authOrigin = process.env.AUTH_ORIGIN!;
const SESSION_COOKIE = '__Secure-neon-auth.session_token';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);
const limiter = createLimiter(pool);

type Env = { Variables: { userId: string; exp: number; orgId: string } };
const app = new Hono<Env>();

// CORS: only listed origins get headers; a disallowed origin gets none, so the browser blocks the response.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin');
  const allowed = origin && allowedOrigins.has(origin);
  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Max-Age', '600');
    c.header('Vary', 'Origin');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, allowed ? 204 : 403);
  // A browser page must come from a listed origin and send JSON; see guards.ts.
  const refused = checkBrowserRequest({ method: c.req.method, origin, contentType: c.req.header('content-type') }, allowedOrigins);
  if (refused) return c.json({ ok: false, error: refused.error }, refused.status);
  await next();
});

app.get('/health', (c) => c.json({ ok: true }));

const mintToken = async (sessionToken: string): Promise<string | null> => {
  const res = await fetch(`${authBase}/token`, { headers: { cookie: `${SESSION_COOKIE}=${sessionToken}` } });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { token?: string } | null;
  return body?.token ?? null;
};

app.post('/auth/sign-in', async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }));
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return c.json({ ok: false, error: 'Email and password are required.' }, 400);
  // Each attempt is counted atomically before it reaches Neon Auth, most specific counter first. The (email, address)
  // pair is what locks a guesser out of one account; the address and email totals bound attacks spread across many emails
  // or many addresses. An email alone is never a tight lock, so a third party cannot lock someone else out.
  const ip = clientIp(c.req.header('x-forwarded-for'));
  const keys = [[pairKey(email, ip), EMAIL_IP_LIMIT], [ipKey(ip), IP_LIMIT], [emailKey(email), EMAIL_LIMIT]] as const;
  for (const [key, limit] of keys) {
    const wait = await limiter.reserve(key, limit);
    if (wait) {
      c.header('Retry-After', String(wait));
      return c.json({ ok: false, error: 'Too many sign-in attempts. Try again later.' }, 429);
    }
  }
  const fail = () => c.json({ ok: false, error: 'Sign-in failed.' }, 401);
  const res = await fetch(`${authBase}/sign-in/email`, { method: 'POST', headers: { 'content-type': 'application/json', origin: authOrigin }, body: JSON.stringify({ email, password }) });
  if (!res.ok) return fail();
  const cookie = res.headers.getSetCookie().find((h) => h.startsWith(`${SESSION_COOKIE}=`));
  const sessionToken = cookie?.slice(SESSION_COOKIE.length + 1).split(';')[0];
  const token = sessionToken ? await mintToken(sessionToken) : null;
  if (!sessionToken || !token) return fail();
  // A success is not a failed guess: clear the pair and give the address and email totals their attempt back.
  await Promise.all([limiter.clear(keys[0][0]), limiter.release(keys[1][0]), limiter.release(keys[2][0])]);
  return c.json({ ok: true, token, sessionToken });
});

// Token refresh: the extension cannot set a Cookie header, so the Function presents the session token for it.
app.post('/auth/token', async (c) => {
  const { sessionToken } = await c.req.json<{ sessionToken?: string }>().catch(() => ({} as { sessionToken?: string }));
  const token = typeof sessionToken === 'string' && sessionToken ? await mintToken(sessionToken) : null;
  return token ? c.json({ ok: true, token }) : c.json({ ok: false, error: 'Session expired.' }, 401);
});

app.post('/auth/sign-out', async (c) => {
  const { sessionToken } = await c.req.json<{ sessionToken?: string }>().catch(() => ({} as { sessionToken?: string }));
  if (typeof sessionToken === 'string' && sessionToken) {
    await fetch(`${authBase}/sign-out`, { method: 'POST', headers: { 'content-type': 'application/json', origin: authOrigin, cookie: `${SESSION_COOKIE}=${sessionToken}` }, body: '{}' }).catch(() => {});
  }
  return c.json({ ok: true });
});

app.use('*', async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return c.json({ ok: false, error: 'Unauthorized' }, 401);
  try {
    // The audience is the Neon Auth origin, the same value as the issuer.
    const { payload } = await jwtVerify(header.slice(7), jwks, { issuer, audience: issuer });
    if (!payload.sub) throw new Error('no subject');
    c.set('userId', payload.sub);
    c.set('exp', payload.exp ?? 0);
  } catch {
    return c.json({ ok: false, error: 'Unauthorized' }, 401);
  }
  // Signed in is not enough: the caller must belong to an organization. The JWT carries no custom claims, so
  // membership comes from a server-side table keyed by the verified subject. Every directory query is scoped to it.
  const { rows } = await pool.query('select organization_id from directory_members where user_id = $1', [c.get('userId')]);
  if (!rows[0]) return c.json({ ok: false, error: 'Forbidden' }, 403);
  c.set('orgId', rows[0].organization_id);
  await next();
});

app.get('/whoami', (c) => c.json({ ok: true, userId: c.get('userId'), expiresInSeconds: c.get('exp') - Math.floor(Date.now() / 1000) }));

const audit = (userId: string, action: string, participantId: string | null) =>
  waitUntil(pool.query('insert into participant_audit (user_id, action, participant_id) values ($1, $2, $3)', [userId, action, participantId]).catch(() => {}));

app.get('/participants/:id', async (c) => {
  const id = c.req.param('id');
  const { rows } = await pool.query('select record_id, record from participants where record_id = $1 and organization_id = $2', [id, c.get('orgId')]);
  audit(c.get('userId'), 'get', id);
  return rows[0] ? c.json({ ok: true, participant: rows[0].record }) : c.json({ ok: false, error: 'Not found' }, 404);
});

app.post('/participants/search', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({} as { name?: string }));
  const name = String(body.name ?? '').trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return c.json({ ok: false, error: 'Provide a name of 2–80 characters.' }, 400);
  const like = `%${name.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const { rows } = await pool.query(
    "select record_id, first_name, last_name from participants where lower(first_name || ' ' || last_name) like $1 and organization_id = $2 order by last_name, first_name limit 20",
    [like, c.get('orgId')],
  );
  audit(c.get('userId'), 'search', null);
  return c.json({ ok: true, matches: rows.map((r) => ({ recordId: r.record_id, firstName: r.first_name, lastName: r.last_name })) });
});

export default app;
