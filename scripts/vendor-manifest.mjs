// The vendored third-party files: where each is copied from in node_modules, and the packages whose pinned versions THIRD_PARTY_NOTICES.md states.
export const VENDORED = [
  ['node_modules/pdfjs-dist/build/pdf.min.mjs', 'vendor/pdf.min.mjs'],
  ['node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'vendor/pdf.worker.min.mjs'],
  ['node_modules/pdfjs-dist/LICENSE', 'vendor/licenses/PDFJS-LICENSE.txt'],
  ['node_modules/fflate/umd/index.js', 'vendor/fflate.min.js'],
  ['node_modules/fflate/LICENSE', 'vendor/licenses/FFLATE-LICENSE.txt'],
  ['node_modules/tesseract.js/dist/tesseract.esm.min.js', 'vendor/tesseract/tesseract.esm.min.js'],
  ['node_modules/tesseract.js/dist/worker.min.js', 'vendor/tesseract/worker.min.js'],
  ['node_modules/tesseract.js/LICENSE.md', 'vendor/licenses/TESSERACT-JS-LICENSE.txt'],
  ['node_modules/tesseract.js-core/LICENSE', 'vendor/licenses/TESSERACT-CORE-LICENSE.txt'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'vendor/tesseract/core/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'vendor/tesseract/core/tesseract-core-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm', 'vendor/tesseract/core/tesseract-core-simd-lstm.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm', 'vendor/tesseract/core/tesseract-core-relaxedsimd-lstm.wasm'],
];

// The English model is not an npm package; its SHA-256 is pinned in THIRD_PARTY_NOTICES.md.
export const TRAINED_DATA = 'vendor/tesseract/lang-data/eng.traineddata.gz';

// Packages whose versions the notices file names, as "<name> <version>" in bold.
export const NOTICE_VERSIONS = { 'tesseract.js': 'Tesseract.js', 'tesseract.js-core': 'tesseract.js-core' };
