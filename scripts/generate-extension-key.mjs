// Generates a signing key for a stable Chrome extension ID.
//
// An unpacked extension's ID comes from its folder path, so every tester gets a different one. A `key` in manifest.json pins
// the ID, which lets the participant API list one `chrome-extension://<id>` origin in ALLOWED_ORIGINS.
//
// Usage: npm run extension:key [-- path/to/private-key.pem]
//
// Prints the manifest `key` and the resulting extension ID, and writes the private key (default ./extension-key.pem, which
// .gitignore covers). Keep the private key out of the repository. Each fork should generate its own key: do not reuse
// someone else's. The Chrome Web Store assigns its own ID and ignores a manifest `key` for published builds.
import { createHash, generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(process.argv[2] || 'extension-key.pem');
if (existsSync(target)) {
  process.stderr.write(`Refusing to overwrite ${target}. Pass a different path, or delete it first.\n`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
// Chrome derives the ID from the first 128 bits of the public key's SHA-256, written with the letters a to p.
const id = [...createHash('sha256').update(der).digest().subarray(0, 16)]
  .map((byte) => String.fromCharCode(97 + (byte >> 4)) + String.fromCharCode(97 + (byte & 15)))
  .join('');

writeFileSync(target, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
process.stdout.write(`Private key written to ${target} (keep it secret and out of git).\n\n`);
process.stdout.write(`Add this to manifest.json:\n  "key": "${der.toString('base64')}",\n\n`);
process.stdout.write(`Extension ID: ${id}\nAllowed origin for ALLOWED_ORIGINS: chrome-extension://${id}\n`);
