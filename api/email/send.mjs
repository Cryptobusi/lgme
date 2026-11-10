import { emailReadiness, clientIp, allowlistFrom } from '../../js/email-check-core.mjs';
import { requestCode } from '../lib/email-flow.mjs';
import { headerMap, json, readBody, readEnv } from '../lib/http.mjs';
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
  if (!ready.enabled) return json(res, 503, { ok: false, enabled: false, waiting: 'built, waiting on email provider key', missing: ready.missing });
  const body = await readBody(req);
  const result = await requestCode(upstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN), {
    email: body.email,
    now: Date.now(),
    ip: clientIp(headerMap(req)),
    pepper: env.EMAIL_CODE_PEPPER,
    allowlist: allowlistFrom(env.CAMPUS_EMAIL_DOMAINS),
    send: (email, code) => sendWithResend(env, email, code)
  });
  return json(res, result.status, { ok: result.ok, error: result.error || '', expiresIn: result.expiresIn || 0 });
}
