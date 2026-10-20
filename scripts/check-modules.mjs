// `npm run check:modules`: every static import in the ES-module sources resolves to a real file, the import graph has no cycles, nothing awaits at top level in the worker or panel graph, and no module reads a Nava* global. A bad specifier or a cycle blanks the whole side panel, which unit tests that import one module at a time would not notice.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const STATIC_IMPORT = /(?:^|;)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

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

/** Static imports reachable from `entries` that resolve outside the files and directories the release package ships (`shippedPaths`). */
export function findUnshippedImports(root, entries, shippedPaths) {
  const problems = [];
  const seen = new Set();
  const shipped = (path) => shippedPaths.some((entry) => path === entry || path.startsWith(`${entry}/`));
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const absolute = join(root, file);
    for (const specifier of specifiers(readFileSync(absolute, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const target = relative(root, resolve(dirname(absolute), specifier)).split('\\').join('/');
      if (!shipped(target) || target.startsWith('..')) problems.push(`${file} imports ${specifier}, which is outside the shipped directories`);
      else if (existsSync(join(root, target)) && /\.m?js$/.test(target)) visit(target);
    }
  };
  entries.forEach(visit);
  return problems;
}

function parseSource(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
}

/** Every file reachable from `entries` through static relative imports, in discovery order. */
function importClosure(root, entries) {
  const seen = [];
  const visit = (file) => {
    if (seen.includes(file)) return;
    seen.push(file);
    const absolute = join(root, file);
    for (const specifier of specifiers(readFileSync(absolute, 'utf8'))) {
      if (!specifier.startsWith('.')) continue;
      const target = relative(root, resolve(dirname(absolute), specifier));
      if (/\.m?js$/.test(target) && existsSync(join(root, target))) visit(target);
    }
  };
  entries.forEach(visit);
  return seen;
}

const lineOf = (sourceFile, node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

/** `await` (or `for await`) outside any function in the import closure of `entries`; it would delay listener registration after a worker wake. */
export function findTopLevelAwait(root, entries) {
  const problems = [];
  for (const file of importClosure(root, entries)) {
    const sourceFile = parseSource(file, readFileSync(join(root, file), 'utf8'));
    const visit = (node) => {
      if (ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node)) return;
      if (ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && node.awaitModifier)) problems.push(`${file}:${lineOf(sourceFile, node)} awaits at top level`);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return problems;
}

/** Reads of a `Nava*` global (globalThis.NavaX, root.NavaX, window.NavaX) at any depth in `files`; `allowed` lists page-side names a file may read (code it injects into a page). */
export function findNavaGlobalReads(root, files, allowed = {}) {
  const problems = [];
  for (const file of files) {
    const sourceFile = parseSource(file, readFileSync(join(root, file), 'utf8'));
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)
        && ['globalThis', 'root', 'window', 'self'].includes(node.expression.text) && /^Nava[A-Z]/.test(node.name.text)
        && !(allowed[file] || []).includes(node.name.text)) problems.push(`${file}:${lineOf(sourceFile, node)} reads the global ${node.name.text}`);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
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
  const problems = [
    ...findProblems(root, files),
    ...findTopLevelAwait(root, ['background.js', 'sidepanel/main.mjs']),
    // Page-side globals: code the CAPTCHA service injects into the application page reads the page's own copies.
    ...findNavaGlobalReads(root, files.filter((file) => file !== 'shared/engines.mjs'), { 'background/captcha-service.mjs': ['NavaCaptchaFrame', 'NavaCaptchaEngine'] }),
  ];
  if (problems.length) {
    console.error(problems.map((problem) => `- ${problem}`).join('\n'));
    process.exit(1);
  }
  console.log(`Module graph check passed: ${files.length} files, no unresolved imports, cycles, top-level await, or Nava global reads.`);
}
