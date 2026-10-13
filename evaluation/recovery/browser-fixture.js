// This test page deliberately applies the exact WIC adapter to copied WIC controls.
// Production host/path rules remain unchanged; this wrapper is never included in the extension package.
let messageHandler;
const originalAdapters = globalThis.NavaSiteAdapters;
globalThis.NavaSiteAdapters = { ...originalAdapters, fieldPolicy(host, path, field) {
  if (host === '127.0.0.1' && path === '/fixture') {
    if (field.id === 'case') return { ignore: true };
    return originalAdapters.fieldPolicy('www.ruhealth.org', '/appointments/apply-4-wic-form', field);
  }
  return originalAdapters.fieldPolicy(host, path, field);
} };
globalThis.chrome = { runtime: { onMessage: { addListener(listener) { messageHandler = listener; } } } };
const command = (type, props = {}) => new Promise(resolve => messageHandler({ type, ...props, routePolicy: { origins: [location.origin], exactPaths: [location.pathname] } }, {}, resolve));
const form = document.getElementById('application'), status = document.getElementById('status'), result = document.getElementById('result'), button = document.getElementById('run');
async function initialize() {
  const fields = await (await fetch('/controls')).json();
  const groups = new Map();
  for (const f of fields) {
    let parent = form;
    if (f.groupKey) {
      if (!groups.has(f.groupKey)) { const group = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = f.question; group.append(legend); form.append(group); groups.set(f.groupKey, group); }
      parent = groups.get(f.groupKey);
    }
    const label = document.createElement('label'); label.htmlFor = f.id; label.textContent = f.label;
    const element = document.createElement(f.tag === 'select' ? 'select' : 'input');
    element.id = f.id; element.name = f.name || f.id; element.required = Boolean(f.required);
    if (element.tagName === 'SELECT') for (const option of f.options) { const o = document.createElement('option'); o.value = option.value; o.textContent = option.label; element.append(o); }
    else { element.type = f.type; if (['radio','checkbox'].includes(f.type)) element.value = f.optionValue || f.label; }
    parent.append(label, element);
  }
  const submit = document.createElement('button'); submit.type = 'submit'; submit.disabled = true; submit.textContent = 'Submit disabled in test fixture'; form.append(submit);
  status.textContent = 'Ready · product page agent v7';
}
const post = async (path, body) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; };
button.addEventListener('click', async () => {
  button.disabled = true; form.reset(); const start = performance.now(), jobId = crypto.randomUUID(), caseId = document.getElementById('case').value;
  let verifiedWrites = 0, blockedCount = 0, last;
  try {
    for (const scan of [1,2]) {
      status.textContent = `Scan ${scan}: Jev planning and local recovery…`;
      const inventory = await command('NAVA_SCAN'); if (!inventory.ok) throw new Error(inventory.error);
      last = await post('/plan', { caseId, jobId, fields: inventory.fields });
      if (scan === 1 && last.analysis.assignments.length) {
        status.textContent = `Filling and independently verifying ${last.analysis.assignments.length} assignments…`;
        const filled = await command('NAVA_FILL', { assignments: last.analysis.assignments });
        if (!filled.ok) throw new Error(filled.error); verifiedWrites += filled.verifiedCount; blockedCount += filled.blockedCount;
      }
    }
    const readback = await command('NAVA_SCAN');
    const receipt = await post('/receipt', { caseId, jobId, fields: readback.fields, gaps: last.analysis.gaps,
      wallSeconds: (performance.now() - start) / 1000, verifiedWrites, blockedCount });
    status.textContent = receipt.safeCasePass ? 'PASS · expected answers and questions verified' : 'FAIL · inspect errors below';
    result.textContent = JSON.stringify({ id: receipt.id, correctAnswers: `${receipt.correctAnswers}/${receipt.expectedAnswers}`,
      seconds: Number(receipt.wallSeconds.toFixed(3)), questions: receipt.actualGaps, errors: receipt.errors,
      verifiedWrites: receipt.verifiedWrites, blockedWrites: receipt.blockedCount, usage: receipt.usage,
      scans: receipt.scans.map(s => ({ Jev: s.metadata.initialModelApprovedMappings, JevRetry: s.metadata.retryModelApprovedMappings,
        siteRules: s.metadata.trustedHintMappings, verifiedReuse: s.metadata.retainedVerifiedMappings, modelCalls: s.metadata.usage.prompts })) }, null, 2);
  } catch (error) { status.textContent = 'Fixture failed'; result.textContent = String(error.message); }
  finally { button.disabled = false; }
});
initialize().catch(error => { status.textContent = String(error.message); });
