// Test helper: require() an ES module from a CommonJS test. Node 22.12+ can; older versions get a clear message.
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function loadEsm(relativePath) {
  try {
    return require(path.join(root, relativePath));
  } catch (error) {
    if (error?.code === 'ERR_REQUIRE_ESM') throw new Error(`Node 22.12 or newer is required to load ES modules from tests (${relativePath}).`);
    throw error;
  }
}

module.exports = { loadEsm };
