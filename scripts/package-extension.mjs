// Release packaging: `npm run check:package` verifies version sync and manifest references; `npm run package` also writes dist/<name>-<version>.zip with only the runtime files.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHIPPED = ['manifest.json', 'background.js', 'background', 'content', 'shared', 'sidepanel', 'vendor', 'icons'];
const EXCLUDED_NAMES = new Set(['.DS_Store']);
const read = (file) => readFileSync(join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const problems = [];

function shippedFiles(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).sort().flatMap((name) => (EXCLUDED_NAMES.has(name) ? [] : shippedFiles(join(path, name))));
}

function requireFile(file, source) {
  if (!existsSync(join(root, file))) problems.push(`${source} references missing file ${file}`);
}

// One version everywhere a release is identified.
const packageJson = JSON.parse(read('package.json'));
if (packageJson.version !== manifest.version) {
  problems.push(`package.json version ${packageJson.version} does not match manifest.json version ${manifest.version}`);
}
const lock = JSON.parse(read('package-lock.json'));
for (const version of [lock.version, lock.packages?.['']?.version]) {
  if (version !== undefined && version !== manifest.version) problems.push(`package-lock.json version ${version} does not match manifest.json version ${manifest.version}`);
}
if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) problems.push(`manifest.json version ${manifest.version} is not a Chrome-valid version`);

// Every file the manifest names must exist, and every icon size must be a PNG of that size.
requireFile(manifest.background?.service_worker, 'background.service_worker');
requireFile(manifest.side_panel?.default_path, 'side_panel.default_path');
for (const script of manifest.content_scripts || []) (script.js || []).forEach((file) => requireFile(file, 'content_scripts'));
for (const [size, file] of [...Object.entries(manifest.icons || {}), ...Object.entries(manifest.action?.default_icon || {})]) {
  requireFile(file, `icons[${size}]`);
  if (!existsSync(join(root, file))) continue;
  const png = readFileSync(join(root, file));
  if (png.readUInt32BE(16) !== Number(size) || png.readUInt32BE(20) !== Number(size)) problems.push(`${file} is ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, not ${size}x${size}`);
}
if (!manifest.icons?.['128']) problems.push('manifest.json needs a 128px icon for the Chrome Web Store');

// Every script the side panel page loads must exist.
const panel = read(manifest.side_panel.default_path);
for (const [, src] of panel.matchAll(/<script[^>]+src="([^"?#]+)/g)) requireFile(relative(root, resolve(root, dirname(manifest.side_panel.default_path), src)), manifest.side_panel.default_path);

if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}

const files = SHIPPED.flatMap(shippedFiles);
if (!process.argv.includes('--build')) {
  console.log(`Package check passed: version ${manifest.version}, ${files.length} runtime files.`);
} else {
  const entries = Object.fromEntries(files.map((file) => [file.split('\\').join('/'), readFileSync(join(root, file))]));
  const name = `nava-form-filling-assistant-${manifest.version}.zip`;
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', name), zipSync(entries, { level: 9, mtime: new Date('2000-01-01T00:00:00Z') }));
  console.log(`Wrote dist/${name} (${files.length} files).`);
}
