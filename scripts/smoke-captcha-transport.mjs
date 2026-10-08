import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
const token = randomBytes(32).toString('base64url');
const environment = { ...process.env, NAVA_MODEL_BRIDGE_PORT: '4197', NAVA_MODEL_BRIDGE_TOKEN: token };
delete environment.TYPESAFE_API_KEY; delete environment.JEV_API_KEY;
const child = spawn(process.execPath, [new URL('../model-bridge/server.mjs', import.meta.url).pathname], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
const start = performance.now();
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Companion startup timed out.')), 10000);
    child.stdout.on('data', (chunk) => { if (String(chunk).includes('Listening:')) { clearTimeout(timer); resolve(); } });
    child.on('error', reject); child.on('exit', (code) => { if (code) reject(new Error('Companion startup failed.')); });
  });
  const checks = [];
  const send = (headers, payload) => fetch('http://127.0.0.1:4197/v1/captcha', { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) });
  let response = await send({}, {}); checks.push({ name: 'missing pairing token rejected', passed: response.status === 401 });
  response = await send({ Authorization: `Bearer ${token}`, Origin: 'https://untrusted.test' }, {}); checks.push({ name: 'webpage origin rejected', passed: response.status === 403 });
  response = await send({ Authorization: `Bearer ${token}`, Origin: `chrome-extension://${'a'.repeat(32)}` }, { provider: 'jev' }); checks.push({ name: 'unsupported image provider rejected', passed: response.status === 400 });
  response = await send({ Authorization: `Bearer ${token}` }, { provider: 'codex', participant: 'SYNTHETIC_DO_NOT_FORWARD' }); checks.push({ name: 'applicant-shaped payload rejected', passed: response.status === 400 });
  if (checks.some((check) => !check.passed)) throw new Error('CAPTCHA transport check failed.');
  process.stdout.write(JSON.stringify({ checks, durationMs: performance.now() - start, modelCalls: 0, directApiKeyChargeUsd: 0, totalOperatingCostUsd: null }) + '\n');
} finally { child.kill('SIGTERM'); await once(child, 'exit').catch(() => {}); }
