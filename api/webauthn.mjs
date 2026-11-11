import { passkeyRequest } from '../../js/webauthn-passkey.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

const memory = {
  bag: new Map(),
  async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; },
  async set(key, value) { this.bag.set(key, value); }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: 'Send JSON.' });
  const env = readEnv();
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : memory;
  const result = await passkeyRequest({ store, action: body.action, body, host: req.headers?.host });
  return json(res, result.status, result.body);
}
