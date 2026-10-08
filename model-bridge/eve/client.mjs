export async function classify(request, { environment = process.env, clientImpl } = {}) {
  let sdk;
  try { sdk = await import('eve/client'); } catch { throw new Error('Install the optional Eve image companion with npm --prefix model-bridge/eve install.'); }
  const host = String(environment.NAVA_CAPTCHA_EVE_URL || 'http://127.0.0.1:4194');
  const url = new URL(host);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Eve must use a loopback service.');
  const client = clientImpl || new sdk.Client({ host, redirect: 'error' });
  let session;
  try {
    const created = await client.sessions.create({ message: sdk.createTextWithFileContent({ bytes: request.imageBytes, filename: request.mediaType === 'image/jpeg' ? 'challenge.jpg' : 'challenge.png', mediaType: request.mediaType, text: request.prompt }),
      outputSchema: globalThis.NavaCaptchaEngine.SCHEMA, signal: AbortSignal.timeout(90_000) });
    session = created.session;
    const result = await created.response.result();
    if (!result.data) throw new Error('Eve returned no structured CAPTCHA answer.');
    const terminal = [...result.events].reverse().find((event) => ['session.completed', 'session.waiting', 'session.failed'].includes(event.type));
    const usage = terminal?.data?.usage;
    return { decision: result.data, usage: { inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, providerReportedCostUsd: null } };
  } catch { throw new Error('Eve did not return a valid CAPTCHA image result.'); }
  finally { if (session) await session.reset({ reason: 'Authorized image classification finished' }).catch(() => {}); }
}
