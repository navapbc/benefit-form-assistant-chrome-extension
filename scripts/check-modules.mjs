// `npm run check:modules`: every static import in the ES-module sources resolves to a real file, and the import graph has no cycles. A bad specifier or a cycle blanks the whole side panel, which unit tests that import one module at a time would not notice.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STATIC_IMPORT = /^\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

function specifiers(source) {
  return [...source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').matchAll(STATIC_IMPORT)].map((match) => match[1]);
}

/** Problems in the static import graph reachable from `files` (paths relative to `root`). */
export function findProblems(root, files) {
  const problems = [];
  const state = new Map();
  const visit = (file, stack) => {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'active') {
      problems.push(`import cycle: ${[...stack.slice(stack.indexOf(file)), file].join(' -> ')}`);
      return;
    }
    state.set(file, 'active');
    const absolute = join(root, file);
    for (const specifier of specifiers(readFileSync(absolute, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const target = relative(root, resolve(dirname(absolute), specifier));
      if (!existsSync(join(root, target))) problems.push(`${file} imports ${specifier}, which does not exist`);
      else if (/\.m?js$/.test(target)) visit(target, [...stack, file]);
    }
    state.set(file, 'done');
  };
  files.forEach((file) => visit(file, []));
  return problems;
}

function sourcesUnder(root, directory) {
  const absolute = join(root, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute).sort().flatMap((name) => {
    const path = join(directory, name);
    if (statSync(join(root, path)).isDirectory()) return sourcesUnder(root, path);
    return /\.mjs$/.test(name) || (directory.startsWith('background') && /\.js$/.test(name)) ? [path] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = ['background.js', ...['background', 'shared', 'sidepanel'].flatMap((directory) => sourcesUnder(root, directory))];
  const problems = findProblems(root, files);
  if (problems.length) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    process.exit(1);
  }
  console.log(`Module graph check passed: ${files.length} entry files, no unresolved imports or cycles.`);
}
