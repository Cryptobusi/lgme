import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { publicProgressCard } from '../../js/gym-progress.mjs';

const KEY = 'gym:progress';

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
  const body = await readBody(req);
  const built = publicProgressCard(body);
  if (!built.ok) return json(res, 400, built);
  if (req.method === 'DELETE') {
    const next = prior.filter((card) => !(card.handle === built.card.handle && card.week === built.card.week && card.category === built.card.category));
    await store.set(KEY, next);
    return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, cards: next });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET, POST, or DELETE.' });
  const rest = prior.filter((card) => !(card.handle === built.card.handle && card.week === built.card.week && card.category === built.card.category));
  const next = [...rest, built.card].slice(-100);
  await store.set(KEY, next);
  return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, cards: next });
}
