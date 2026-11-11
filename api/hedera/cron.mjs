import { createHash } from 'node:crypto';
import { json, readEnv } from '../lib/http.mjs';
import { cronAllowed } from '../../js/hedera-topic.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { markAnchored, pendingHashes, submitLeaves } from '../../js/hedera-submit.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET.' });
  const env = readEnv();
  if (!cronAllowed(req.headers || {}, env)) return json(res, 401, { ok: false, error: 'This anchor is not open to the public.' });
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : null;
  const day = new Date().toISOString().slice(0, 10);
  let rows = await pendingHashes(store);
  if (!rows.length) {
    rows = [{ hash: createHash('sha256').update(`lgme-daily:${day}`).digest('hex'), day }];
  }
  const anchored = await submitLeaves(env, rows.map((row) => row.hash), day, { store });
  if (!anchored.ok) return json(res, 503, anchored);
  await markAnchored(store, rows.map((row) => row.hash));
  return json(res, 200, anchored);
}
