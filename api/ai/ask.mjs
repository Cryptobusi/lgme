import { generateText } from 'ai';
import { answerAsk, MAX_OUTPUT_TOKENS, memoryCounter, MODEL_ID } from '../../js/ai-ask.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

function counter(redis) {
  return upstashStore(redis.url, redis.token);
}

const localCounts = memoryCounter();

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, fallback: true, reason: 'Use POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const env = readEnv();
  const redis = redisRest(env);
  const store = redis.configured ? counter(redis) : localCounts;
  const result = await answerAsk({
    question: body?.question,
    page: body?.page,
    device: body?.device,
    store,
    complete: async ({ system, prompt }) => {
      const reply = await generateText({
        model: MODEL_ID,
        system,
        prompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS
      });
      return { text: reply.text };
    }
  });
  return json(res, result.status, result.body);
}
