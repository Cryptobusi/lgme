import { clientIp, emailReadiness } from '../../js/email-check-core.mjs';
import { applyGateCors, startGate } from '../../js/gate-core.mjs';
import { headerMap, json, readBody, readEnv } from '../lib/http.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { visitFrom } from '../../js/visit-alert.mjs';

async function sendWithResend(env, email, code) {
  const from = visitFrom(env);
  const fromDomain = from.split('@')[1]?.replace(/[>\s]/g, '') || 'missing';
  if (/resend\.dev$/i.test(fromDomain)) {
    console.error(JSON.stringify({ event: 'resend.send', status: 0, fromDomain, name: 'sandbox_rejected' }));
    return { ok: false };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your Hederica code',
      text: `Your Hederica code is ${code}. It expires in 10 minutes. If you did not ask, ignore this message.`
    })
  });
  let name = '';
  try {
    const body = await response.clone().json();
    name = String(body?.name || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  } catch { /* status is enough */ }
  if (!response.ok) console.error(JSON.stringify({ event: 'resend.send', status: response.status, fromDomain, name }));
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
