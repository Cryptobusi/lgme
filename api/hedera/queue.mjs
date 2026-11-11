import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { allowRate } from '../../js/gym-kv.mjs';
import { verifyDevice } from '../../js/device-sign.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { queueHash, submitLeaves } from '../../js/hedera-submit.mjs';
import { VIEW_ONLY_MESSAGE, healthWrite } from '../../js/view-only-api.mjs';

const hits = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, `queue:${ip}`, Date.now(), 20);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const payload = body.payload || {};
  if (!healthWrite(payload.category)) return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
  const hash = String(payload.hash || '').toLowerCase();
  if (payload.action !== 'queue' || payload.handle !== body.handle || !/^[0-9a-f]{64}$/.test(hash)) {
    return json(res, 400, { ok: false, error: 'Send a hash only.' });
  }
  if (payload.legalName || payload.applicantName || payload.trackRecord) {
    return json(res, 400, { ok: false, error: 'A name stays on the phone.' });
  }
  const signed = await verifyDevice(body.publicJwk, payload, body.sig);
  if (!signed) return json(res, 401, { ok: false, error: 'The device signature was refused.' });
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : null;
  const queued = await queueHash(store, { hash, day: payload.day });
  if (!queued.ok) return json(res, 400, queued);
  try {
    const anchored = await submitLeaves(env, [hash], payload.day || '');
    return json(res, anchored.ok ? 200 : 202, { ...anchored, queued: true, hash });
  } catch {
    return json(res, 202, { ok: true, queued: true, anchored: false, hash, wording: 'Queued. The daily job writes the hash. Health data is not written.' });
  }
}
