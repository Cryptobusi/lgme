import { readBody, json, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { gymChatReady } from '../../js/gym-sync.mjs';
import { publicIntake, sharePrivate } from '../../js/intake.mjs';

const KEY = 'gym:intake';

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
    if (!row) return json(res, 200, { ok: true, record: null });
    const shared = sharePrivate(row.private || {}, url.searchParams.get('viewer') || '');
    return json(res, 200, { ok: true, record: publicIntake(row.public || {}), private: shared.ok ? shared.private : null });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  const token = String(body.token || '');
  if (!/^[0-9a-f-]{16,80}$/i.test(token)) return json(res, 400, { ok: false, error: 'That intake link is not usable.' });
  const prior = saved[token] || { public: {}, private: {} };
  if (body.action === 'share') {
    prior.private = {
      applicantName: String(body.applicantName || ''),
      trackRecord: String(body.trackRecord || ''),
      sponsors: Array.isArray(body.sponsors) ? body.sponsors.slice(0, 2) : []
    };
    saved[token] = prior;
    await store.set(KEY, saved);
    return json(res, 200, { ok: true });
  }
  if (body.action === 'public') {
    prior.public = publicIntake(body.intake || {});
    saved[token] = prior;
    await store.set(KEY, saved);
    return json(res, 200, { ok: true, record: prior.public });
  }
  return json(res, 400, { ok: false, error: 'Use public or share.' });
}
