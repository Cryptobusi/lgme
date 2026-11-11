import { allowlistFrom, emailReadiness } from '../../js/email-check-core.mjs';
import { confirmCode } from '../lib/email-flow.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { check, fields } from '../../js/input-schema.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, enabled: false, waiting: 'Email sign-in is coming. Nothing is sent until that step is connected.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const email = check(body.email, { ...fields.email, required: true }, 'email');
  const code = check(body.code, { ...fields.code, required: true }, 'code');
  if (!email.ok || !code.ok) return json(res, 400, { ok: false, error: (email.error || code.error) });
  const redis = redisRest(env);
  const result = await confirmCode(upstashStore(redis.url, redis.token), {
    email: body.email,
    code: body.code,
    now: Date.now(),
    pepper: env.EMAIL_CODE_PEPPER,
    allowlist: allowlistFrom(env.CAMPUS_EMAIL_DOMAINS),
    clubAllowlist: allowlistFrom(env.CLUB_EMAIL_DOMAINS),
    clubInvites: allowlistFrom(env.CLUB_INVITE_CODES),
    invite: body.invite,
    publicJwk: body.publicJwk
  });
  return json(res, result.status, {
    ok: result.ok,
    error: result.error || '',
    member: result.member || '',
    emailHash: result.emailHash || '',
    campusVerified: result.campusVerified === true,
    clubVerified: result.clubVerified === true
  });
}
