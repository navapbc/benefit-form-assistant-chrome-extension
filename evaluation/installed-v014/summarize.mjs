import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Public whitelist only. Raw exports, prompts, values and credentials stay local.
const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error('Pass the absolute local evidence directory.');
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const observations = JSON.parse(await readFile(join(evidenceDir, 'observations.json'), 'utf8'));
const adjudications = JSON.parse(await readFile(join(evidenceDir, 'adjudications.json'), 'utf8'));
const exports = await Promise.all((await readdir(evidenceDir)).filter(f => f.endsWith('.audit.json')).map(async f => JSON.parse(await readFile(join(evidenceDir, f), 'utf8'))));
const events = [...new Map(exports.flatMap(a => a.events).map(e => [e.id, e])).values()].sort((a, b) => a.at.localeCompare(b.at));
const receipts = (await readFile(join(evidenceDir, 'companion-receipts.ndjson'), 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
const runtime = { nano: 'chrome-gemini-nano', jev: 'jev-typesafe-local-companion', codex: 'codex-cli-subscription' };
const round = n => Math.round(n * 1e6) / 1e6;
const seconds = (a, b) => round((Date.parse(b) - Date.parse(a)) / 1000);
const sum = (rows, key) => rows.every(r => Number.isFinite(r[key])) ? rows.reduce((n, r) => n + r[key], 0) : null;
const detailKeys = ['fieldCount', 'gapCount', 'modelRuntime', 'modelPromptCount', 'modelDurationMs', 'modelInputTokens', 'modelOutputTokens', 'modelContextUsageUnits', 'verifiedCount', 'blockedCount', 'pageCount', 'checkpointKind', 'toStatus'];

const attempts = observations.runs.map((run, index) => {
  const nextStart = observations.runs[index + 1]?.startedAt || '9999';
  const firstScan = events.find(e => e.type === 'scan_completed' && e.at >= run.startedAt && e.at < nextStart && e.details.modelRuntime === runtime[run.formRuntime]);
  if (!firstScan) throw new Error(`No exported scan for ${run.id}; do not publish an unexecuted run.`);
  const appEvents = events.filter(e => e.applicationId === firstScan.applicationId);
  const terminal = appEvents.find(e => e.type === 'checkpoint_reached');
  if (!terminal) throw new Error(`No terminal checkpoint for ${run.id}.`);
  const primaryEvents = appEvents.filter(e => e.at <= terminal.at);
  const scans = primaryEvents.filter(e => e.type === 'scan_completed').map(e => e.details);
  const fillStart = primaryEvents.find(e => e.type === 'fill_started');
  const verified = primaryEvents.find(e => e.type === 'page_verified');
  const calls = receipts.filter(r => r.startedAt >= run.startedAt && r.endedAt <= terminal.at && ['decision-plan', 'role'].some(p => r.path.endsWith(p)));
  const score = adjudications[run.id];
  if (!score) throw new Error(`Missing visible readback adjudication for ${run.id}.`);
  const inputTokens = sum(scans, 'modelInputTokens');
  const outputTokens = sum(scans, 'modelOutputTokens');
  const apiEstimate = run.formRuntime === 'jev' ? round(inputTokens * 0.042 / 1e6) : null;
  const perCallInput = calls.reduce((n, r) => n + (r.usage?.inputTokens || 0), 0);
  const perCallOutput = calls.reduce((n, r) => n + (r.usage?.outputTokens || 0), 0);
  if (run.formRuntime !== 'nano' && (perCallInput !== inputTokens || perCallOutput !== outputTokens)) throw new Error(`Receipt/audit usage mismatch: ${run.id}`);
  const captchaEvents = appEvents.filter(e => e.type === 'captcha_attempt');
  if (captchaEvents.length) throw new Error('Live CAPTCHA events require separately reviewed acceptance/model observations before publication.');
  const deferredCalls = calls.filter(r => r.plan).map(r => ({
    startedAt: r.startedAt,
    apiSeconds: round(r.usage.durationMs / 1000),
    observerSeconds: round(r.observerWallMs / 1000),
    approvedMappings: r.metadata.approvedMappings,
    deferred: r.plan.rejected.map(d => {
      const control = r.controls.find(c => c.fieldKey === d.fieldKey);
      return { field: control?.question || control?.label || 'Unknown control', confidence: d.confidence, reason: 'Uncertain or locally unsupported classification' };
    })
  }));
  return {
    id: run.id, site: 'Riverside WIC', repeat: Number(run.id.match(/r(\d+)$/)[1]),
    formRuntime: runtime[run.formRuntime], requestedModel: run.requestedModel || null,
    providerReportedModel: run.formRuntime === 'jev' ? [...new Set(calls.map(r => r.metadata?.reportedModel))].join(',') : null,
    reasoningEffort: null, reasoningIdentity: run.formRuntime === 'jev' ? 'not configurable' : run.formRuntime === 'nano' ? 'Chrome managed; not exposed' : 'not specified by v0.14 form route; unknown',
    confidenceThreshold: run.confidence || null,
    startedAt: run.startedAt, firstTerminalAt: terminal.at,
    formWallSecondsToCheckpoint: seconds(run.startedAt, terminal.at),
    timeToCorrectCompletionSeconds: null,
    fillReadbackSeconds: fillStart && verified ? seconds(fillStart.at, verified.at) : null,
    planningScans: scans.length, modelCalls: sum(scans, 'modelPromptCount'), summedModelSeconds: round(sum(scans, 'modelDurationMs') / 1000),
    inputTokens, outputTokens, cachedInputTokens: null, reasoningTokens: null, contextUsageUnits: sum(scans, 'modelContextUsageUnits'),
    directApiKeyChargeUsd: run.formRuntime === 'jev' ? null : 0,
    estimatedApiCostUsd: apiEstimate, estimatedApiCostUsdExact: run.formRuntime === 'jev' ? inputTokens * 0.042 / 1e6 : null,
    conditionalApiScenarios: run.formRuntime === 'codex' ? {
      assumptions: 'Same recorded tokens, hypothetical named model, all input ordinary uncached, no context premium. Identity and actual cache use unknown; these are not the run\'s estimated bill.',
      'gpt-6.1-sol': round((inputTokens * 2 + outputTokens * 10) / 1e6),
      'gpt-6-luna': round((inputTokens * 0.1 + outputTokens * 0.5) / 1e6)
    } : null,
    billedCostUsd: null, operatingCostUsd: null,
    terminalCheckpoint: terminal.details.checkpointKind, semanticQuality: score,
    verifiedWriteCount: verified?.details.verifiedCount || 0, mechanicalBlockedWriteCount: verified?.details.blockedCount || 0,
    falseGaps: score.falseGaps.length, assistanceCount: run.interventions.length,
    finalReviewReached: false, correctCompletion: false,
    captcha: { reachedByWorkflow: terminal.details.checkpointKind === 'captcha', attempted: false, outcome: terminal.details.checkpointKind === 'captcha' ? 'not_attempted_pending_action_time_confirmation' : 'not_reached_form_questions',
      visibleAccepted: null, actuator: null, imageRuntimeActuallyCalled: null, imageModelActuallyCalled: null, reasoningActuallyUsed: null,
      rounds: 0, imageCalls: 0, rejectedAnswers: 0, wallSeconds: null, inputTokens: 0, outputTokens: 0, contextUsageUnits: null,
      directApiKeyChargeUsd: 0, estimatedApiCostUsd: null, billedCostUsd: null },
    modelCallReceipts: calls.map(r => ({startedAt:r.startedAt,endedAt:r.endedAt,role:r.role || 'decision_classifier',requestedModel:r.requestedModel || null,requestedReasoning:r.requestedReasoning,providerReportedModel:r.metadata?.reportedModel || null,
      runtimeSeconds:round(r.usage.durationMs/1000),observerSeconds:round(r.observerWallMs/1000),inputTokens:r.usage.inputTokens,outputTokens:r.usage.outputTokens,ok:r.ok})),
    deferredCalls,
    events: primaryEvents.map(e => ({type:e.type,at:e.at,details:Object.fromEntries(detailKeys.filter(k => k in e.details).map(k => [k,e.details[k]]))}))
  };
});

const result = {
  schema: 'nava.installed-extension-evaluation.v1', evaluatedAt: '2026-10-09', status: 'interim; live CAPTCHA batch and remaining repeats pending',
  scope: 'Four actually executed installed WIC form runs. No native CAPTCHA attempted, no final review and no submission. Planned configurations excluded from attempt denominator.',
  releaseSourceCommit: 'fe2bd4e6e3425ba5510f998f47f5c40129861dd4',
  installation: {versionUserReported:'0.14.0',versionSpecificUiObserved:true,installedManifestIndependentlyRead:false,sourceCommitOfInstalledFilesIndependentlyAttested:false},
  environment: {chrome:'154.0.8037.98',macos:'15.6',codexCli:'0.162.0-alpha.2',recordSha256:'0b7057d13c3e30ee3cdf69a213cf61746e803f410608b6fe833cfb1e63bbef21',runtimeInitialization:'outside form timer',order:'sequential; shared device/profile',companionObserver:'unchanged contract; forwarding overhead included'},
  coverage: {executedFormRuns:attempts.length,nativeCaptchaAttempts:0,nativeCaptchaAccepted:0,nativeCaptchaFailures:0,nativeCaptchaInconclusive:0,nativeCaptchaPending:attempts.filter(a=>a.captcha.reachedByWorkflow).length,unassistedCorrectCompletions:0,
    runtimeUnavailable:[{provider:'claude-cli',reason:'CLI not installed; no model call or browser run'}],
    unexecuted:['Nano form repeat 2','Codex default form repeat 2','staged native CAPTCHA matrix including Eve and explicit Codex image model/effort settings'],
    browserInterruption:{stage:'before Codex repeat 2',formStarted:false,reason:'foreground browser changed to another user activity; native UI actions paused'},
    noNativeCaptchaModelLeaderboard:true},
  pricingSnapshot:'../installed-v014/pricing-2026-10-09.json',
  definitions: {semanticAnswers:17,notApplicableControls:2,sourceAgreementIncludesCorrectDefaults:true,verifiedWriteCountIsNotSemanticAccuracy:true,modelDurationIsSumOfPossiblyConcurrentCalls:true,unknownIsNull:true,permissionAndInspectionWaitExcludedFromFormCheckpointWall:true,apiScenariosNotBilledCost:true},
  attempts
};
await writeFile(join(repo, 'evaluation/results/installed-v014-oct9.json'), JSON.stringify(result, null, 2) + '\n');
const columns = ['run_id','site','form_runtime','requested_model','provider_reported_model','reasoning_identity','repeat','form_wall_seconds_to_checkpoint','time_to_correct_completion_seconds','correct_answers','incorrect_answers','missing_answers','expected_answers','not_applicable_correct','not_applicable_expected','false_gaps','model_calls','summed_model_seconds','fill_readback_seconds','input_tokens','output_tokens','nano_context_units','direct_api_key_charge_usd','estimated_api_cost_usd','billed_cost_usd','operating_cost_usd','terminal_checkpoint','correct_completion','captcha_attempted','captcha_outcome','captcha_accepted','captcha_seconds','captcha_image_calls','error_ids'];
const csvRows = attempts.map(a => [a.id,a.site,a.formRuntime,a.requestedModel,a.providerReportedModel,a.reasoningIdentity,a.repeat,a.formWallSecondsToCheckpoint,a.timeToCorrectCompletionSeconds,a.semanticQuality.correct,a.semanticQuality.incorrect,a.semanticQuality.missing,a.semanticQuality.expected,a.semanticQuality.notApplicableCorrect,a.semanticQuality.notApplicableExpected,a.falseGaps,a.modelCalls,a.summedModelSeconds,a.fillReadbackSeconds,a.inputTokens,a.outputTokens,a.contextUsageUnits,a.directApiKeyChargeUsd,a.estimatedApiCostUsdExact,a.billedCostUsd,a.operatingCostUsd,a.terminalCheckpoint,a.correctCompletion,a.captcha.attempted,a.captcha.outcome,a.captcha.visibleAccepted,a.captcha.wallSeconds,a.captcha.imageCalls,[...new Set([...a.semanticQuality.incorrectAnswers,...a.semanticQuality.missingAnswers,...a.semanticQuality.falseGaps,...a.semanticQuality.notApplicableErrors].map(e=>e.errorId))].join(';')]);
const csvCell = value => value == null ? '' : /[",\r\n]/.test(String(value)) ? '"' + String(value).replaceAll('"','""') + '"' : String(value);
await writeFile(join(repo,'evaluation/results/installed-v014-oct9.csv'), [columns,...csvRows].map(r=>r.map(csvCell).join(',')).join('\n')+'\n');
console.log(JSON.stringify(attempts.map(a=>({id:a.id,wallSeconds:a.formWallSecondsToCheckpoint,quality:a.semanticQuality.correct+'/'+a.semanticQuality.expected,calls:a.modelCalls,inputTokens:a.inputTokens,outputTokens:a.outputTokens,contextUnits:a.contextUsageUnits,apiEstimate:a.estimatedApiCostUsdExact,captcha:a.captcha.outcome})),null,2));
