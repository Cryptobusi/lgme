import { allowlistFrom, emailReadiness } from '../../js/email-check-core.mjs';
import { confirmCode } from '../lib/email-flow.mjs';
import { json, readBody, readEnv } from '../lib/http.mjs';
import { upstashStore } from '../lib/upstash.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, enabled: false, waiting: 'built, waiting on email provider key', missing: ready.missing });
  const body = await readBody(req);
  const result = await confirmCode(upstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN), {
    email: body.email,
    code: body.code,
    now: Date.now(),
    pepper: env.EMAIL_CODE_PEPPER,
    allowlist: allowlistFrom(env.CAMPUS_EMAIL_DOMAINS)
  });
  return json(res, result.status, {
    ok: result.ok,
    error: result.error || '',
    member: result.member || '',
    campusVerified: result.campusVerified === true
  });
}
