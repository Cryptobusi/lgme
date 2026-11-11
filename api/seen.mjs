import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

const memory = { bag: new Map(), async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; }, async set(key, value) { this.bag.set(key, value); } };

function userOf(value) {
  return String(value || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);
}

export default async function handler(req, res) {
  const env = readEnv();
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : memory;
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET') {
    const user = userOf(url.searchParams.get('user'));
    const seen = user ? ((await store.get(`seen:${user}`)) || {}) : {};
    return json(res, 200, { ok: true, seen });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const user = userOf(body?.user);
  const key = String(body?.key || '').replace(/[^a-z0-9:-]/g, '').slice(0, 80);
  if (!user || !key) return json(res, 400, { ok: false, error: 'Name the viewer and the button.' });
  const seen = (await store.get(`seen:${user}`)) || {};
  seen[key] = new Date().toISOString();
  await store.set(`seen:${user}`, seen);
  return json(res, 200, { ok: true, seen });
}
