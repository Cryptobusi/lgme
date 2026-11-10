import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { acceptableInvite } from '../../js/device-sign.mjs';
import { allowRate, emptyGymKv, gymMutate } from '../../js/gym-kv.mjs';

const hits = new Map();

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
    if (!acceptableInvite(code, { example: true })) return json(res, 400, { ok: false, error: 'That invite code is not usable.' });
    const messages = (await store.get(`gym:chat:${code}`)) || [];
    return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, messages });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return json(res, 405, { ok: false, error: 'Use GET, POST, or DELETE.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, ip);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  const code = String(body.payload?.code || '').trim().toLowerCase();
  const book = emptyGymKv();
  book.members = (await store.get('gym:members')) || {};
  book.chats[code] = code ? ((await store.get(`gym:chat:${code}`)) || []) : [];
  if (body.payload) body.payload.op = req.method === 'DELETE' ? 'delete' : 'post';
  const result = await gymMutate(book, body);
  if (!result.ok) return json(res, result.status || 400, result);
  await store.set('gym:members', book.members);
  if (code) await store.set(`gym:chat:${code}`, book.chats[code] || []);
  return json(res, 200, { ok: true, enabled: true, shared: true, hedera: false, messages: book.chats[code] || [] });
}
