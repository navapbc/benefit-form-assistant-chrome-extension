import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commandForProvider, spawnCaptured, subscriptionOnlyEnvironment, parseCodexUsage } from './core.mjs';
import '../shared/captcha-engine.js';
const engine = globalThis.NavaCaptchaEngine;

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid JPEG challenge crop.');
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker.');
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if ([0xd8, 0xd9].includes(marker)) continue;
    if (marker === 0xda) break;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new Error('Invalid JPEG segment.');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    offset += length;
  }
  throw new Error('Unsupported JPEG challenge crop.');
}

export function validateCaptchaRequest(input = {}) {
  if (Object.keys(input).some((key) => !['provider', 'model', 'reasoning', 'task', 'tileCount', 'image'].includes(key))) throw new Error('Unexpected CAPTCHA request data.');
  if (!['codex', 'eve'].includes(input.provider)) throw new Error('This companion provider has no CAPTCHA image adapter.');
  const model = input.model || 'gpt-6.1-sol';
  const reasoning = input.reasoning || 'low';
  if (!/^[a-z0-9][a-z0-9.-]{0,99}$/.test(model) || !['low', 'xhigh'].includes(reasoning)) throw new Error('Invalid CAPTCHA model configuration.');
  if (input.provider === 'eve' && (model !== 'gpt-6.1-sol' || reasoning !== 'low')) throw new Error('The bundled Eve image agent uses GPT-6.1 Sol Low.');
  const prompt = engine.imageInstructions(input.task, input.tileCount);
  if (typeof input.image !== 'string' || input.image.length > 1_400_000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.image)) throw new Error('A bounded PNG or JPEG challenge crop is required.');
  const [header, encoded] = input.image.split(',');
  const mediaType = header.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
  const imageBytes = Buffer.from(encoded, 'base64');
  if (imageBytes.length > 1024 * 1024 || imageBytes.length < 24) throw new Error('Invalid challenge crop size.');
  let width, height;
  if (mediaType === 'image/png') {
    if (imageBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || imageBytes.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('Invalid PNG challenge crop.');
    width = imageBytes.readUInt32BE(16); height = imageBytes.readUInt32BE(20);
  } else ({ width, height } = jpegDimensions(imageBytes));
  if (width < 10 || height < 10 || width > 1600 || height > 1600) throw new Error('Invalid challenge crop dimensions.');
  return { provider: input.provider, model, reasoning, prompt, tileCount: input.tileCount, imageBytes, mediaType };
}
export function captchaInvocation(request, paths) {
  const command = commandForProvider({ provider: 'codex', model: request.model, systemPrompt: request.prompt, prompt: 'Return the JSON image classification only.' }, paths);
  command.args.splice(command.args.length - 1, 0, '--image', paths.imagePath, '-c', `model_reasoning_effort="${request.reasoning}"`);
  return command;
}
export async function runCaptchaRequest(input, options = {}) {
  const request = validateCaptchaRequest(input);
  const start = Date.now();
  if (request.provider === 'eve') {
    const { classify } = await import('./eve/client.mjs');
    const result = await classify(request, options);
    return { decision: engine.validateDecision(result.decision, request.tileCount), provider: 'eve', requestedModel: request.model, requestedReasoning: request.reasoning,
      modelIdentityBasis: 'Bundled agent configuration; provider-resolved identity unavailable', usage: { ...result.usage, durationMs: Date.now() - start } };
  }
  const tempDirectory = await mkdtemp(join(tmpdir(), 'nava-captcha-'));
  const paths = { tempDirectory, schemaPath: join(tempDirectory, 'schema.json'), outputPath: join(tempDirectory, 'answer.json'), imagePath: join(tempDirectory, request.mediaType === 'image/jpeg' ? 'challenge.jpg' : 'challenge.png') };
  try {
    await writeFile(paths.schemaPath, JSON.stringify(engine.SCHEMA), { mode: 0o600 });
    await writeFile(paths.imagePath, request.imageBytes, { mode: 0o600 });
    const invocation = captchaInvocation(request, paths);
    const output = await spawnCaptured(invocation.command, invocation.args, {
      input: invocation.input, cwd: tempDirectory, env: subscriptionOnlyEnvironment('codex', options.environment || process.env),
      timeoutMs: 90_000, ...(options.spawnImpl ? { spawnImpl: options.spawnImpl } : {}),
    });
    const decision = engine.validateDecision(JSON.parse(await readFile(paths.outputPath, 'utf8')), request.tileCount);
    return { decision, provider: 'codex', requestedModel: request.model, requestedReasoning: request.reasoning,
      modelIdentityBasis: 'CLI request flags; provider-resolved identity unavailable', usage: { ...parseCodexUsage(output.stdout), durationMs: Date.now() - start } };
  } catch {
    // Do not relay stderr, image bytes, pairing tokens or provider credential diagnostics.
    throw new Error('The CAPTCHA image model did not return a valid result. Check the signed-in CLI or complete this challenge manually.');
  } finally { await rm(tempDirectory, { recursive: true, force: true }); }
}
