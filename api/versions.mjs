import { versionRequest } from '../../js/version-flow.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

const memory = {
  bag: new Map(),
  async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; },
  async set(key, value) { this.bag.set(key, value); }
};

function admin(req, env) {
  const token = String(env.INTEREST_ADMIN || env.OWNER_INBOX_TOKEN || '');
  return Boolean(token) && String(req.headers?.['x-lgme-admin'] || '') === token;
}

export default async function handler(req, res) {
  const env = readEnv();
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : memory;
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET') {
    const result = await versionRequest({ method: 'GET', search: url.search, store, env, admin: admin(req, env) });
    return json(res, result.status, result.body);
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: 'Send JSON.' });
  const result = await versionRequest({ method: 'POST', body, store, env, admin: admin(req, env) });
  return json(res, result.status, result.body);
}
