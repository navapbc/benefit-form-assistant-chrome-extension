// Interactive launcher: the TypeSafe key never enters Chrome or shell history.
import readline from 'node:readline';
import { Writable } from 'node:stream';
if (!process.env.TYPESAFE_API_KEY && !process.env.JEV_API_KEY) {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal or provision the key through the process environment.');
  const silentOutput = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const input = readline.createInterface({ input: process.stdin, output: silentOutput, terminal: true });
  process.stdout.write('TypeSafe test key (hidden): ');
  const key = await new Promise((resolve) => input.question('', resolve));
  input.close(); process.stdout.write('\n');
  if (!/^apikey_[A-Za-z0-9_]+$/.test(key.trim())) throw new Error('Invalid credential format.');
  process.env.TYPESAFE_API_KEY = key.trim();
}
await import('./server.mjs');
