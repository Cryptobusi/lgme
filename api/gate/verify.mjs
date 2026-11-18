import { clientIp, emailReadiness } from '../../js/email-check-core.mjs';
import { applyGateCors, verifyGate } from '../../js/gate-core.mjs';
import { headerMap, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

export default async function handler(req, res) {
  if (applyGateCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, error: 'Email is not connected.' });
  const body = await readBody(req);
  if (!body) return json(res, 400, { ok: false, error: 'Send JSON.' });
  const headers = headerMap(req);
  const redis = redisRest(env);
  const result = await verifyGate(upstashStore(redis.url, redis.token), {
    email: body.email,
    code: body.code,
    pepper: env.EMAIL_CODE_PEPPER,
    ip: clientIp(headers)
  }, { env, headers });
  return json(res, result.status || (result.ok ? 200 : 400), { ok: result.ok === true, error: result.error || '', token: result.token || '' });
}
