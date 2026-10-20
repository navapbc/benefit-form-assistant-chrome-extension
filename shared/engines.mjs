// The ES-module entry to the six shared files that stay classic scripts because the page agent loads them as content scripts. Importing them runs each one in manifest order and publishes its API on globalThis; the named exports re-expose those objects so modules never read a Nava* global themselves.
import './form-purposes.js';
import './participant-record.js';
import './field-values.js';
import './form-engine.js';
import './site-adapters.js';
import './captcha-engine.js';

export const formPurposes = globalThis.NavaFormPurposes;
export const participantRecord = globalThis.NavaParticipantRecord;
export const fieldValues = globalThis.NavaFieldValues;
export const formEngine = globalThis.NavaFormEngine;
export const siteAdapters = globalThis.NavaSiteAdapters;
export const captchaEngine = globalThis.NavaCaptchaEngine;
