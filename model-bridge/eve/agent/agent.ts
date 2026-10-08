import { defineAgent } from 'eve';
import { chatgpt } from 'eve/models/openai';
export default defineAgent({ model: chatgpt('gpt-6.1-sol'), reasoning: 'low', modelContextWindowTokens: 200000,
  limits: { maxInputTokensPerSession: 100000, maxOutputTokensPerSession: 10000, sessionTimeoutMs: 90000 } });
