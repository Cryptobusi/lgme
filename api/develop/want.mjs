import { acceptHelpWant, listHelpWants } from '../../js/develop-want.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
const memory = {
  bag: new Map(),
  async get(key) { return this.bag.has(key) ? this.bag.get(key) : null; },
  async set(key, value) { this.bag.set(key, value); }
};

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim() || 'local';
}

function admin(req, env) {
  const token = String(env.INTEREST_ADMIN || env.OWNER_INBOX_TOKEN || '');
  return Boolean(token) && String(req.headers?.['x-lgme-admin'] || '') === token;
}

export default async function handler(req, res) {
  const env = readEnv();
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : memory;
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.searchParams.get('board') === '1') {
    const notices = await listHelpWants(store);
    return json(res, 200, {
      ok: true,
      items: notices.map((notice) => ({ category: 'Health', label: 'In development', target: notice.category, title: notice.title }))
    });
  }
  if (req.method === 'GET') {
    if (!admin(req, env)) return json(res, 401, { ok: false, error: 'The owner inbox needs the admin token.' });
    const notices = await listHelpWants(store);
    return json(res, 200, { ok: true, count: notices.length, notices });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  if (!body || typeof body !== 'object') return json(res, 400, { ok: false, error: 'Send JSON.' });
  const result = await acceptHelpWant(store, body, { ip: clientIp(req), env });
  if (!result.ok) return json(res, result.status || 400, { ok: false, error: result.error });
  return json(res, 200, {
    ok: true,
    duplicate: result.duplicate === true,
    notified: result.notified === true,
    item: { kind: 'IwanIT', category: 'Health', target: result.item.category, label: 'In development', title: result.item.title, at: result.item.at },
    notice: result.notice
  });
}
