"""Build the reviewed error occurrence ledger from public receipts (no raw client data)."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / 'evaluation/results'
rows = []


def add(file, pointer, errors, observation, stage, model=None, effort=None,
        runtime=None, date=None, scope=None, reported=None, identity_basis=None):
    path = RESULTS / file
    contents = path.read_text()
    document = json.loads(contents)
    record = document
    for key in pointer.strip('/').split('/'):
        record = record[int(key)] if isinstance(record, list) else record[key]
    metadata = record.get('metadata', {})
    model = model or record.get('requestedModel') or record.get('model') or metadata.get('requestedModel')
    effort = effort or record.get('requestedReasoning') or record.get('reasoningEffort') or record.get('reasoning') or metadata.get('reasoningEffort')
    reported = reported or record.get('providerReportedModel') or record.get('reportedModel') or record.get('providerResolvedModel') or metadata.get('reportedModel')
    runtime = runtime or record.get('formRuntime') or record.get('backbone') or record.get('provider') or record.get('runtime') or metadata.get('runtime')
    started = record.get('startedAt')
    usage = record.get('usage', metadata.get('usage', {})) or {}
    seconds = record.get('formWallSecondsToCheckpoint', record.get('wallSeconds', record.get('journeySeconds')))
    if seconds is None:
        ms = record.get('wallMs', record.get('wallMilliseconds', record.get('durationMs')))
        seconds = ms / 1000 if ms is not None else None
    native_id = record.get('trialId') or record.get('id') or record.get('originNativeRunId')
    # The source filename is part of the key: original validation and corrected calls reused IDs.
    lookup_id = file.removesuffix('.json') + ':' + (native_id or pointer.strip('/').replace('/', '.')) + ':' + ','.join(errors)
    prefix = ' ' * (2 * len(pointer.strip('/').split('/')))
    needle = prefix + json.dumps(record, indent=2, ensure_ascii=False).replace('\n', '\n' + prefix)
    offset = contents.find(needle)
    if offset < 0:
        # Non-ASCII escapes can differ between public source files; pointers remain authoritative.
        needle = prefix + json.dumps(record, indent=2).replace('\n', '\n' + prefix)
        offset = contents.find(needle)
    if offset < 0 and not pointer.split('/')[-1].isdigit():
        # Nested objects start on the same line as their property name.
        key = json.dumps(pointer.split('/')[-1])
        for ascii_mode in [False, True]:
            needle = prefix + key + ': ' + json.dumps(record, indent=2, ensure_ascii=ascii_mode).replace('\n', '\n' + prefix)
            offset = contents.find(needle)
            if offset >= 0: break
    line = contents[:offset].count('\n') + 1 if offset >= 0 else None
    direct = record.get('directApiKeyChargeUsd', record.get('apiChargeUsd'))
    if model == 'Gemini Nano (Chrome managed)':
        direct = 0
    estimate = record.get('marginalApiCostUsd', record.get('estimatedApiCostUsdExact', record.get('estimatedListPriceUsd', usage.get('estimatedApiCostUsd'))))
    scenario_low = record.get('apiScenarioLowUsd')
    scenario_high = record.get('apiScenarioHighUsd')
    if native_id and 'postAcceptanceFormContinuation' not in pointer:
        metrics_file = RESULTS / 'captcha-run-metrics.json'
        if metrics_file.exists():
            matching = next((r for r in json.loads(metrics_file.read_text())['rows'] if r['id'] == native_id), None)
            if matching and matching['metrics']['apiPriceEstimateLowerUsd'] is not None:
                scenario_low = matching['metrics']['apiPriceEstimateLowerUsd']
                scenario_high = matching['metrics']['apiPriceEstimateUpperUsd']
    rows.append({
        'lookupId': lookup_id, 'lookupIdIsDerived': True, 'nativeRunId': native_id,
        'errorIds': errors, 'sourceFile': file, 'sourcePointer': pointer,
        'sourceLine': line, 'sourceSha256': hashlib.sha256(contents.encode()).hexdigest(),
        'recordedAt': started or date, 'dateBasis': 'receipt timestamp' if started else ('batch documentation' if date else 'not recorded in public receipt'),
        'repeat': record.get('repeat', record.get('trial')), 'site': record.get('site', 'Riverside WIC CAPTCHA' if errors[0].startswith('C') else 'WIC'),
        'testScope': scope or record.get('scope') or record.get('fixtureKind') or (document.get('scope') if isinstance(document, dict) else None),
        'runtime': runtime, 'requestedModel': model, 'reportedModel': reported,
        'reasoningEffort': effort, 'confidenceThreshold': record.get('confidenceThreshold', metadata.get('confidenceThreshold', document.get('confidenceThreshold') if isinstance(document, dict) else None)),
        'modelIdentityBasis': identity_basis or record.get('modelIdentityBasis') or ('requested configuration; reported identity unavailable' if reported is None else 'receipt reported identity'),
        'failureStage': stage, 'reviewedObservation': observation,
        'elapsedSeconds': seconds, 'elapsedScope': 'post-acceptance form continuation' if 'postAcceptanceFormContinuation' in pointer else 'native actuator engine; no inference' if file == 'captcha-native-oct9.json' else 'first stopped form checkpoint' if 'formWallSecondsToCheckpoint' in record else ('live journey including help/waits' if 'journeySeconds' in record else 'planning/classification attempt; not complete application'),
        'inputTokens': record.get('inputTokens', usage.get('inputTokens')),
        'outputTokens': record.get('outputTokens', usage.get('outputTokens')),
        'contextUsageUnits': record.get('contextUsageUnits', record.get('contextUnits', usage.get('contextUsageUnits'))),
        'directApiKeyChargeUsd': direct, 'publishedRateEstimateUsd': estimate,
        'apiScenarioLowUsd': scenario_low, 'apiScenarioHighUsd': scenario_high,
        'billedCostUsd': None, 'operatingCostUsd': None,
    })


# Installed form readback: explicit semantic adjudication, unlike planning-only scores.
installed = json.loads((RESULTS / 'installed-v014-oct9.json').read_text())
for i, r in enumerate(installed['attempts']):
    errors = ['F01'] + (['F02', 'F03'] if i in [1, 2] else ['F08'] if i == 3 else [])
    quality = r['semanticQuality']
    observation = '; '.join(x['field'] + ': ' + x.get('observed', x.get('reason', ''))
                            for key in ['incorrectAnswers', 'missingAnswers', 'falseGaps', 'notApplicableErrors']
                            for x in quality[key])
    add('installed-v014-oct9.json', f'/attempts/{i}', errors, observation,
        'installed form planning / conditional applicability / shared address composition',
        model='Gemini Nano (Chrome managed)' if i == 0 else None,
        identity_basis='managed version/effort not exposed' if i == 0 else 'API response names Jev; confidence 0.90, no reasoning control' if i in [1, 2] else 'CLI invoked without model/effort flags; neither requested nor reported identity recorded',
        scope='Installed v0.14 UI, live single-page WIC form, zero answer/navigation repairs; release source not independently attested')
    if i in [0, 3]:
        add('installed-v014-oct9.json', f'/attempts/{i}', ['C07'], 'CAPTCHA reached; native actuator not attempted at the time this form receipt was saved. Coverage gap, not a model failure.',
            'coverage gap', model='Gemini Nano (Chrome managed)' if i == 0 else None,
            scope='Historical first form checkpoint snapshot; subsequent CAPTCHA receipts are separate')

# October 5 records retain aggregate outcome labels; they do not identify every failed field.
live = json.loads((RESULTS / 'live-summary.json').read_text())
for i, r in enumerate(live['october5Attempts']):
    if i in [2, 3, 4, 7]: errors = ['F07']
    elif i == 0: errors = ['F02']
    elif i == 1: errors = ['F01', 'F02']
    else: errors = ['F01']
    add('live-summary.json', f'/october5Attempts/{i}', errors,
        r['outcomeLabel'] + ('; exact supplied answers needing repair not retained publicly' if i in [0, 1] else '') + ('; failing control/raw exception not retained publicly' if i in [2, 3, 4, 7] else ''),
        'mixed live navigation / planning / recovery; root cause not isolated' if 'F07' in errors else 'assisted live source agreement / address readback',
        model='Gemini Nano (Chrome managed)' if r['runtime'] == 'Gemini Nano' else None,
        date='2026-10-05', scope='Live journey; interruptions and operator help included; no unassisted final review',
        identity_basis='Nano exact managed version/effort not exposed' if r['runtime'] == 'Gemini Nano' else 'historical CLI model and effort were not captured')

# Original classifier and actual extension-planner integrations must not be conflated.
for i in [1, 4]:
    add('jev-attempts.json', f'/{i}', ['F05'], 'Other household member identifier deferred; 4/5 expected missing-answer questions surfaced. No wrong-person identifier mapping. Threshold replays are the same response.',
        'initial classifier / adapter gap routing', scope='Original Jev classifier harness, authored IHSS subset; no browser execution')
for i in [0, 3]:
    add('jev-attempts.json', f'/{i}', ['F03'], 'Optional mailing control deferred and conditional case-number question unscored; 17/17 scored mappings. This receipt does not establish a live blocking question.',
        'optional conditional deferral (related observation)', scope='Original classifier harness, frozen WIC inventory; not installed DOM execution')
for i in [0, 1]:
    add('jev-extension-planning-initial.json', f'/attempts/{i}', ['F02'], 'Supplied Medi-Cal mapping deferred; 16/17 mappings and one false gap (wic:medical).',
        'first integration prompt / confidence threshold', scope='v0.13 extension planner via authenticated companion, frozen WIC inventory; no browser DOM execution')
add('jev-extension-planning.json', '/attempts/1', ['F02'], '14/17 mappings: clinic and texts confidence 0.89, Medi-Cal 0.86, below 0.90; three false missing-answer questions.',
    'revised integration prompt / confidence threshold')
for i in [4, 5]:
    note = 'homeless at 0.84' if i == 4 else 'homeless at 0.82 and county at 0.88'
    add('jev-extension-planning.json', f'/attempts/{i}', ['F04'], 'Supplied mapping deferred: ' + note + '; below the configured 0.90 threshold.',
        'revised integration prompt / confidence threshold')

controlled = json.loads((RESULTS / 'controlled-attempts.json').read_text())
for i, r in enumerate(controlled['attempts']):
    if r['score']['planningPass']: continue
    score = r['score']
    add('controlled-attempts.json', f'/attempts/{i}', ['F04'],
        f"{score['mappingCorrect']}/{score['mappingExpected']} mappings, {score['falseGaps']} false gap(s), {score['gapFound']}/{score['gapExpected']} genuine gaps found; exact missed field not retained in this public score receipt.",
        'frozen three-role planning; no live navigation', date='2026-10-06')
add('nano-playbook-summary.json', '/attempts/5', ['F06'], 'Compact guided playbook repeat 2 returned invalid JSON; fill never started. No semantic score. Raw reply/parser exception not retained publicly.',
    'structured-output parsing', model='Gemini Nano (Chrome managed)', runtime='Chrome Prompt API / compact guided JavaScript playbook',
    scope='Local frozen WIC controls; one call, no live navigation or CAPTCHA', identity_basis='Chrome exact model version and reasoning not exposed')

# Captured image trials use trialId (batch + id); id alone is not unique here.
images = json.loads((RESULTS / 'captcha-oct7-images.json').read_text())
for i in [13, 14]:
    add('captcha-oct7-images.json', f'/trials/{i}', ['C01'], 'Returned tiles 1–9; reviewed expected tiles 1, 8, 9. Wrong set on one unique saved image; not submitted to the live site.', 'saved-image classification')
add('captcha-oct7-images.json', '/trials/4', ['C02'], 'Explicit refusal; empty tile set. Other repeat matched the reviewed set.', 'model refusal')
add('captcha-oct7-images.json', '/trials/5', ['C02'], 'Returned 8, 9; reviewed expected 1, 8, 9. Missed tile 1. Other repeat matched.', 'saved-image classification')
add('captcha-oct7-images.json', '/trials/11', ['C03'], 'Live traffic-light answer rejected: Please try again. Follow-up bicycle answer accepted under separate trialId /trials/12; two answers in one completed session.',
    'live provider rejection', scope='Live WIC image answer, externally clicked through Codex chat browser relay; no operator tile correction')
for i in [0, 6]:
    actions = json.loads((RESULTS / 'captcha-oct7-actions.json').read_text())
    add('captcha-oct7-actions.json', f'/trials/{i}', ['C04'], actions['trials'][i]['browserExecution']['status'] + '; correct checkbox decision, acceptance inconclusive because of relay/capture delay or expiration.', 'external relay / observation')
for i in [8, 9, 15, 16, 17, 18, 20]:
    add('captcha-oct7-images.json', f'/trials/{i}', ['C05'], images['trials'][i]['error'] + '; no structured answer/usage; not recorded as a model refusal.', 'attachment / transport timeout' if i != 20 else 'missing structured output; cause unknown')
validation = json.loads((RESULTS / 'captcha-native-adapter-validation.json').read_text())
for i, r in enumerate(validation['trials']):
    add('captcha-native-adapter-validation.json', f'/trials/{i}', ['C06'], r['diagnosis'] + ' Zero model calls; corrected repeats in captcha-native-adapter-models.json are distinct receipts despite reused IDs.', 'request validation before inference')

matrix_file = RESULTS / 'captcha-three-crops-oct9.json'
if matrix_file.exists():
    matrix = json.loads(matrix_file.read_text())
    for i, r in enumerate(matrix['trials']):
        if r['outcome'] == 'wrong_set':
            observation = f"{r['fixtureId']}: expected {r['adjudicatedTiles']}, returned {r['answer']['tiles']}; missed {r['missedTiles']}, extra {r['extraTiles']}. Saved-grid classification; no live rejection."
            add(matrix_file.name, f'/trials/{i}', ['C08'], observation, 'product image classification')
        elif r['outcome'] == 'model_handoff':
            add(matrix_file.name, f'/trials/{i}', ['C09'], r['fixtureId'] + ': returned action=handoff and no tiles. Motive not retained by product schema; cannot identify refusal vs uncertainty.', 'model-returned handoff, not transport error')
        elif r['outcome'] == 'adapter_error':
            add(matrix_file.name, f'/trials/{i}', ['C09'], r['fixtureId'] + ': ' + r['error'], 'adapter error; inference count not established')
native_file = RESULTS / 'captcha-native-oct9.json'
if native_file.exists():
    native = json.loads(native_file.read_text())
    add(native_file.name, '/trials/0', ['C10'], 'Native attempt returned widget_hidden_or_unsupported while CAPTCHA was offscreen; zero model calls. A viewport-prepared repeat accepted the checkbox in 2.494 s.', 'native visibility precondition before inference',
        model='No model called', effort='not applicable', scope=native['scope'])
    add(native_file.name, '/trials/1/postAcceptanceFormContinuation', ['C11'], 'Checkbox accepted in 2.494 s. CLI-default continuation made six calls, filled one conditional mailing field, then stopped at navigation_unknown after 75.357 s. No final review; no Submit. Original form was Nano, continuation model/effort unknown.',
        'post-acceptance form navigation', model='Unknown CLI-default continuation model', effort='unknown', runtime='codex-cli-subscription after native acceptance')
    add(native_file.name, '/trials/2/postAcceptanceFormContinuation', ['F09'], 'CLI-default continuation reached final review; UI says 50 VERIFIED and repeats field rows, although there are 19 visible controls / 17 applicable semantic answers. Source agreement remains 16/17, with an additional conditional mailing error.',
        'review presentation / cumulative readback count', model='Unknown CLI-default continuation model', effort='unknown', runtime='codex-cli-subscription after native acceptance')

out = {
    'schema': 'nava.reviewed-error-occurrences.v1',
    'purpose': 'Identify each cited occurrence; lookup IDs are derived source locators, not newly invented measured trial IDs.',
    'definitions': {'unknownIsNull': True, 'modelConfigurationDoesNotProveCause': True,
                    'requestedIsNotProviderAttestation': True, 'confidenceIsNotReasoning': True,
                    'coverageGapsAreNotFailedAttempts': True, 'elapsedIsNotTimeToCorrectCompletion': True},
    'occurrences': rows,
}
(RESULTS / 'benchmark-error-occurrences.json').write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')


def cell(text):
    return str(text).replace('|', '\\|').replace('\n', ' ')


def model_cell(r):
    model = r['requestedModel'] or '**Unknown model**'
    effort = r['reasoningEffort']
    jev_setting = 'not configurable; confidence 0.90' if r['confidenceThreshold'] == 0.9 else 'not configurable; confidence replay 0.80/0.90/0.95'
    reasoning = {'low': 'Low', 'xhigh': 'Extra High'}.get(effort, effort) if effort else (jev_setting if r['requestedModel'] == 'jev-1.13.0' else '**effort unknown**')
    reported = r['reportedModel']
    report = ', '.join(reported) if isinstance(reported, list) else reported or 'not recorded'
    return f"{model} · {reasoning}<br>Runtime: {r['runtime']}<br>Reported identity: {report}"


table_parts = ['## Exact run provenance\n',
    'Each row below links to the **specific source record**, with a JSON pointer and source hash retained in the [machine-readable occurrence ledger](../evaluation/results/benchmark-error-occurrences.json). `lookupId` is a derived locator, not a newly collected trial ID. Repeat numbers restart in each batch. Dates are UTC receipt timestamps where available; October 5/6 dates come from batch documentation. The local playbook date was not recorded publicly.\n',
    '**Read configuration separately from cause:** a run using Sol can fail in shared JavaScript before inference. “Codex” and “Eve” name runtimes; Sol/Luna name requested models. Jev\'s 0.90 confidence threshold is not a reasoning effort. No identified configuration below is explicitly GPT-4; unknown historical/default CLI identity cannot be retroactively labeled GPT-4 or Sol. Eve\'s reported `codex/gpt-6.1-sol` is framework metadata, not an independent provider attestation.\n']
for error in ['F01','F02','F03','F04','F05','F06','F07','F08','F09','C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11']:
    table_parts.append(f'### {error} · observed runs\n')
    table_parts.append('| Run / date / test scope | Requested model, effort and runtime | Observation | Time / API cost basis |\n|---|---|---|---|')
    for r in rows:
        if error not in r['errorIds']: continue
        anchor = '#L' + str(r['sourceLine']) if r['sourceLine'] else ''
        link = f"[{r['nativeRunId'] or r['sourcePointer']}](../evaluation/results/{r['sourceFile']}{anchor})"
        date = r['recordedAt'] or 'date not recorded'
        source = f"{link}<br>{r['sourceFile']} `{r['sourcePointer']}`<br>{date} · repeat {r['repeat']}<br>{r['site']}; {r['testScope']}"
        time = f"{r['elapsedSeconds']:.3f} s" if r['elapsedSeconds'] is not None else 'time unknown'
        if r['requestedModel'] == 'No model called': cost = '**$0 API cost**; no inference; operating cost unmeasured'
        elif r['requestedModel'] == 'Gemini Nano (Chrome managed)': cost = '**$0 API cost**; device/operating cost unmeasured'
        elif r['publishedRateEstimateUsd'] is not None: cost = f"${r['publishedRateEstimateUsd']:.9f} published-rate estimate; billed unknown"
        elif r['apiScenarioLowUsd'] is not None: cost = f"$0 direct API-key charge; API scenario ${r['apiScenarioLowUsd']:.6f}–${r['apiScenarioHighUsd']:.6f}; billed unknown"
        elif r['directApiKeyChargeUsd'] == 0: cost = '$0 direct API-key charge; API replay price unavailable here; billed/operating unknown'
        else: cost = 'API/billed cost not recorded here; consult source metrics'
        table_parts.append('| ' + ' | '.join(map(cell, [source, model_cell(r), r['reviewedObservation'] + '<br>Stage: ' + r['failureStage'], time + '<br>' + cost + '<br>' + r['elapsedScope']])) + ' |')
    table_parts.append('')
target = ROOT / 'docs/BENCHMARK_ERRORS.md'
old = target.read_text()
old = old.split('## Exact run provenance')[0].rstrip() + '\n\n'
target.write_text((old + '\n'.join(table_parts)).rstrip() + '\n')
print(f'Wrote {len(rows)} source-linked occurrences.')
