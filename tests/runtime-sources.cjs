// Runtime source resolver for source-level tests: reads each extension context's first-party code in the order Chrome loads it, so assertions follow code across module splits.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

/**
 * Side-panel scripts in load order, without shared engines or vendored code: the ES modules reachable from the
 * entry module (sidepanel/main.mjs, which comes last), then any classic scripts sidepanel/index.html still lists.
 */
function sidePanelScripts() {
  const html = read('sidepanel/index.html');
  const classic = [...html.matchAll(/<script\b(?![^>]*\btype="module")[^>]*\bsrc="([^"]+)"/g)]
    .map((match) => match[1].split(/[?#]/)[0])
    .filter((src) => !src.startsWith('../shared/') && !src.startsWith('../vendor/'))
    .map((src) => path.posix.join('sidepanel', src));
  const modules = [];
  const visit = (file) => {
    if (modules.includes(file)) return;
    const dir = path.posix.dirname(file);
    for (const match of read(file).matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)) {
      const target = path.posix.normalize(path.posix.join(dir, match[1]));
      if (target.startsWith('sidepanel/')) visit(target);
    }
    modules.push(file);
  };
  visit('sidepanel/main.mjs');
  return [...modules, ...classic];
}

function sidePanelSource() {
  return sidePanelScripts().map(read).join('\n');
}

/** background.js followed by every service-worker module under background/ that it reaches through static imports, in import order. */
function serviceWorkerSource() {
  const seen = [];
  const visit = (file) => {
    if (seen.includes(file)) return;
    seen.push(file);
    const dir = path.posix.dirname(file);
    for (const match of read(file).matchAll(/^\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]/gm)) {
      const target = path.posix.normalize(path.posix.join(dir, match[1]));
      if (target.startsWith('background/')) visit(target);
    }
  };
  visit('background.js');
  return seen.map(read).join('\n');
}

/** Manifest content scripts that live under content/, in manifest order. */
function pageAgentSource() {
  const manifest = JSON.parse(read('manifest.json'));
  return (manifest.content_scripts || [])
    .flatMap((entry) => entry.js || [])
    .filter((file) => file.startsWith('content/'))
    .map(read)
    .join('\n');
}

module.exports = { sidePanelScripts, sidePanelSource, serviceWorkerSource, pageAgentSource };
