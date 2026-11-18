import { clientIp, emailReadiness } from '../../js/email-check-core.mjs';
import { applyGateCors, startGate } from '../../js/gate-core.mjs';
import { headerMap, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';

async function sendWithResend(env, email, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: email,
      subject: 'Your Hederica code',
      text: `Your Hederica code is ${code}. It expires in 10 minutes. If you did not ask, ignore this message.`
    })
  });
  return { ok: response.ok };
}

export default async function handler(req, res) {
  if (applyGateCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, enabled: false, error: 'Email is not connected.' });
  const body = await readBody(req);
  if (!body) return json(res, 400, { ok: false, error: 'Send JSON.' });
  const redis = redisRest(env);
  const result = await startGate(upstashStore(redis.url, redis.token), {
    email: body.email,
    site: body.site,
    now: Date.now(),
    ip: clientIp(headerMap(req)),
    pepper: env.EMAIL_CODE_PEPPER,
    send: (email, code) => sendWithResend(env, email, code)
  });
  return json(res, result.status || 400, { ok: result.ok === true, error: result.error || '' });
}
