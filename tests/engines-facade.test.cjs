const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const CLASSIC = {
  formPurposes: ['shared/form-purposes.js', 'NavaFormPurposes'],
  participantRecord: ['shared/participant-record.js', 'NavaParticipantRecord'],
  fieldValues: ['shared/field-values.js', 'NavaFieldValues'],
  formEngine: ['shared/form-engine.js', 'NavaFormEngine'],
  siteAdapters: ['shared/site-adapters.js', 'NavaSiteAdapters'],
  captchaEngine: ['shared/captcha-engine.js', 'NavaCaptchaEngine'],
};

/** Runs the classic files in order inside a vm context, the way Chrome loads content scripts, and returns its globals. */
function classicGlobals() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const [file] of Object.values(CLASSIC)) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('the six classic shared files load as ES modules, as classic scripts, and through require, with the same API keys', async () => {
  const facade = await import(path.join(root, 'shared/engines.mjs'));
  const classic = classicGlobals();
  for (const [name, [file, global]] of Object.entries(CLASSIC)) {
    const keys = Object.keys(facade[name] || {}).sort();
    assert.ok(keys.length > 0, `${name} is exported by the facade`);
    assert.deepEqual(keys, Object.keys(require(path.join(root, file))).sort(), `${name} matches require()`);
    assert.deepEqual(keys, Object.keys(classic[global] || {}).sort(), `${name} matches the classic global`);
  }
});
