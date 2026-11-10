import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { acceptsCovenant, signSponsor } from '../../js/covenant.mjs';

const KEY = 'gym:covenant';

export default async function handler(req, res) {
  const state = gymChatReady(readEnv());
  if (!state.enabled) {
    return json(res, 503, { ok: false, enabled: false, shared: false, message: 'Sponsor confirmation stays on this phone until sync is on.' });
  }
  const redis = redisRest(readEnv());
  const store = upstashStore(redis.url, redis.token);
  const saved = (await store.get(KEY)) || {};
  if (req.method === 'GET') {
    const url = new URL(req.url, 'https://lgme.app');
    const token = String(url.searchParams.get('token') || '');
    return json(res, 200, { ok: true, enabled: true, shared: true, record: saved[token] || null });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  if (body.action === 'request') {
    const built = acceptsCovenant(body);
    if (!built.ok) return json(res, 400, built);
    const prior = saved[built.record.token];
    saved[built.record.token] = { ...built.record, sponsors: prior?.sponsors || [] };
    await store.set(KEY, saved);
    return json(res, 200, { ok: true, record: saved[built.record.token] });
  }
  if (body.action === 'sign') {
    const token = String(body.token || '');
    const current = saved[token];
    if (!current) return json(res, 404, { ok: false, error: 'That sponsor link is not here.' });
    const signed = signSponsor(current, body.sponsorHandle);
    if (!signed.ok) return json(res, 400, signed);
    saved[token] = signed.record;
    await store.set(KEY, saved);
    return json(res, 200, { ok: true, record: signed.record });
  }
  return json(res, 400, { ok: false, error: 'Use request or sign.' });
}
