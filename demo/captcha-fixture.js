document.querySelector('#reset').onclick = () => location.reload();
document.querySelector('#test').onclick = async () => {
  const started = performance.now();
  const token = crypto.randomUUID();
  const checkbox = document.querySelector('#checkbox').contentWindow.NavaCaptchaFrame;
  const image = document.querySelector('#grid').contentWindow.NavaCaptchaFrame;
  const receipt = { scope: 'Deterministic local native-adapter fixture; no live CAPTCHA or model inference', tests: [], modelCalls: 0, directApiKeyChargeUsd: 0, totalOperatingCostUsd: null };
  try {
    checkbox.arm(token, Date.now() + 10000); await checkbox.act(token, { type: 'checkbox' });
    receipt.tests.push({ name: 'Checkbox click and visible acceptance', passed: (await checkbox.observe()).status === 'accepted' });
    const observed = await image.observe(); image.arm(token, Date.now() + 10000);
    await image.act(token, { type: 'tiles', challengeId: observed.challengeId, decision: { action: 'select', tiles: [1, 8, 9] } });
    receipt.tests.push({ name: 'Static tile clicks and Verify', passed: document.querySelector('#grid').contentDocument.querySelector('#feedback').textContent === 'Fixture selection accepted' });
    image.revoke(token); let stopped = false;
    try { await image.act(token, { type: 'tiles', challengeId: observed.challengeId, decision: { action: 'select', tiles: [2] } }); } catch { stopped = true; }
    receipt.tests.push({ name: 'Canceled authorization blocks another action', passed: stopped });
    receipt.tests.push({ name: 'Application Submit stayed disabled and untouched', passed: document.querySelector('#submit').disabled });
    document.querySelector('#status').textContent = receipt.tests.every((test) => test.passed) ? '4 of 4 fixture checks passed' : 'Fixture check failed';
  } catch (error) { receipt.error = error.message; document.querySelector('#status').textContent = 'Fixture stopped'; }
  finally { checkbox?.revoke(token); image?.revoke(token); }
  receipt.durationMs = performance.now() - started;
  document.querySelector('#receipt').textContent = JSON.stringify(receipt, null, 2);
};
