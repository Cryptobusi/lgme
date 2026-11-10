import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { allowRate, emptyGymKv, gymMutate } from '../../js/gym-kv.mjs';

const KEY = 'gym:progress';
const hits = new Map();

export default async function handler(req, res) {
  const env = readEnv();
  const state = gymChatReady(env);
  if (!state.enabled) {
    return json(res, 503, {
      ok: false,
      enabled: false,
      shared: false,
      hedera: false,
      missing: state.missing,
      message: 'Shared board starts when sync is on.'
    });
  }
  const redis = redisRest(env);
  const store = upstashStore(redis.url, redis.token);
  const prior = (await store.get(KEY)) || [];
  if (req.method === 'GET') {
    return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, cards: prior });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return json(res, 405, { ok: false, error: 'Use GET, POST, or DELETE.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, ip);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  const book = emptyGymKv();
  book.members = (await store.get('gym:members')) || {};
  book.progress = prior;
  if (body.payload) body.payload.op = req.method === 'DELETE' ? 'delete' : 'put';
  const result = await gymMutate(book, body);
  if (!result.ok) return json(res, result.status || 400, result);
  await store.set('gym:members', book.members);
  await store.set(KEY, book.progress);
  return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, cards: book.progress });
}
