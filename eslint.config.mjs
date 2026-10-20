// Lint rules: eslint:recommended over first-party source. Extension pages and page scripts are classic scripts that share globals; the service worker and tooling are modules or Node.
import js from '@eslint/js';
import globals from 'globals';

const extensionGlobals = { ...globals.browser, chrome: 'readonly' };

export default [
  {
    // evaluation/**/source holds frozen copies of earlier releases.
    ignores: ['node_modules/**', '**/node_modules/**', 'vendor/**', 'dist/**', 'work/**', 'evaluation/**/results/**', 'evaluation/**/source/**', 'evaluation/local-results/**', '.eve/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { sourceType: 'script', globals: { ...globals.node, ...extensionGlobals } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node, ...extensionGlobals } },
  },
  {
    files: ['background.js', 'background/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.serviceworker, ...globals.node, chrome: 'readonly' } },
  },
  {
    files: ['tests/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
