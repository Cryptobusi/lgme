import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { publicIntake } from '../../js/intake.mjs';
import { allowRate, emptyGymKv, gymMutate } from '../../js/gym-kv.mjs';

const KEY = 'gym:intake';
const hits = new Map();

export default async function handler(req, res) {
  const state = gymChatReady(readEnv());
  if (!state.enabled) {
    return json(res, 503, { ok: false, enabled: false, shared: false, message: 'The intake stays on this phone until sync is on.' });
  }
  const redis = redisRest(readEnv());
  const store = upstashStore(redis.url, redis.token);
  const saved = (await store.get(KEY)) || {};
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://lgme.app');
    const token = String(url.searchParams.get('token') || '');
    const row = saved[token];
    return json(res, 200, { ok: true, record: row ? publicIntake(row.public || {}) : null, private: null });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, ip);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  const book = emptyGymKv();
  book.members = (await store.get('gym:members')) || {};
  book.intakes = saved;
  const result = await gymMutate(book, body);
  if (!result.ok) return json(res, result.status || 400, result);
  await store.set('gym:members', book.members);
  await store.set(KEY, book.intakes);
  return json(res, 200, result);
}
