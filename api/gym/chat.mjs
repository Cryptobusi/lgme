import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady, publicChatMessage } from '../../js/gym-sync.mjs';

export default async function handler(req, res) {
  const state = gymChatReady(readEnv());
  if (!state.enabled) {
    return json(res, 503, {
      ok: false,
      enabled: false,
      shared: false,
      hedera: false,
      missing: state.missing,
      message: 'Chat stays on this phone. It is not shared with other phones yet.'
    });
  }
  const redis = redisRest(readEnv());
  const store = upstashStore(redis.url, redis.token);
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://lgme.app');
    const code = String(url.searchParams.get('code') || '').trim().toLowerCase();
    if (!code) {
      return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, message: 'Chat can sync between phones.' });
    }
    if (!/^[a-z0-9-]{4,24}$/.test(code)) return json(res, 400, { ok: false, error: 'That invite code is not usable.' });
    const messages = (await store.get(`gym:chat:${code}`)) || [];
    return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, messages });
  }
  if (req.method === 'DELETE') {
    const body = await readBody(req);
    const code = String(body.code || '').trim().toLowerCase();
    if (!/^[a-z0-9-]{4,24}$/.test(code)) return json(res, 400, { ok: false, error: 'That invite code is not usable.' });
    const prior = (await store.get(`gym:chat:${code}`)) || [];
    const next = prior.filter((message) => !(message.handle === body.handle && message.text === body.text));
    await store.set(`gym:chat:${code}`, next);
    return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, messages: next });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET, POST, or DELETE.' });
  const body = await readBody(req);
  const built = publicChatMessage(body);
  if (!built.ok) return json(res, 400, built);
  const key = `gym:chat:${built.message.code}`;
  const prior = (await store.get(key)) || [];
  const next = [...prior, { ...built.message, at: built.message.at || new Date().toISOString() }].slice(-50);
  await store.set(key, next);
  return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, messages: next });
}
