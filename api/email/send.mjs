import { emailReadiness, clientIp, allowlistFrom } from '../../js/email-check-core.mjs';
import { requestCode } from '../lib/email-flow.mjs';
import { guardRequest, headerMap, json, readBody, readEnv } from '../lib/http.mjs';
import { check, fields } from '../../js/input-schema.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

async function sendWithResend(env, email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Your lgme code',
      text: `Your lgme code is ${code}. It expires in 10 minutes. If you did not ask, ignore this message.`
    })
  });
  return { ok: response.ok };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, enabled: false, waiting: 'Email sign-in is coming. Nothing is sent until that step is connected.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const email = check(body.email, { ...fields.email, required: true }, 'email');
  if (!email.ok) return json(res, 400, { ok: false, error: email.error });
  if (Object.keys(body).some((key) => key !== 'email')) return json(res, 400, { ok: false, error: 'Unknown field.' });
  const redis = redisRest(env);
  const result = await requestCode(upstashStore(redis.url, redis.token), {
    email: body.email,
    now: Date.now(),
    ip: clientIp(headerMap(req)),
    pepper: env.EMAIL_CODE_PEPPER,
    allowlist: allowlistFrom(env.CAMPUS_EMAIL_DOMAINS),
    send: (email, code) => sendWithResend(env, email, code)
  });
  return json(res, result.status, { ok: result.ok, error: result.error || '', expiresIn: result.expiresIn || 0 });
}
