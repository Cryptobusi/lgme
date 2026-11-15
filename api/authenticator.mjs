import { clientIp, emailReadiness } from '../js/email-check-core.mjs';
import { beginEnrollment, confirmWithAuthenticator, finishEnrollment, issueNonce, resetAuthenticator, signInWithAuthenticator } from '../js/totp.mjs';
import { confirmCode } from './lib/email-flow.mjs';
import { guardRequest, headerMap, json, readBody, readEnv } from './lib/http.mjs';
import { redisRest } from '../js/redis-env.mjs';
import { upstashStore } from './lib/upstash.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = emailReadiness(env);
  if (!ready.enabled) return json(res, 503, { ok: false, error: 'Authenticator setup is not connected yet.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const redis = redisRest(env);
  const store = upstashStore(redis.url, redis.token);
  const spec = {
    email: body.email,
    code: body.code,
    pepper: env.EMAIL_CODE_PEPPER,
    publicJwk: body.publicJwk,
    sig: body.sig,
    nonce: body.nonce,
    ip: clientIp(headerMap(req)),
    now: Date.now()
  };
  const action = body.action;
  let result;
  if (action === 'enroll') result = await beginEnrollment(store, spec);
  else if (action === 'enroll-finish') result = await finishEnrollment(store, spec);
  else if (action === 'nonce') result = await issueNonce(store, spec);
  else if (action === 'signin') result = await signInWithAuthenticator(store, spec);
  else if (action === 'gate') result = await confirmWithAuthenticator(store, spec);
  else if (action === 'reset') result = await resetAuthenticator(store, spec, confirmCode);
  else result = { ok: false, status: 400, error: 'Unknown action.' };
  const payload = {
    ok: result.ok === true,
    error: result.error || '',
    fallback: result.fallback || '',
    enrolled: result.enrolled === true,
    reset: result.reset === true
  };
  if (action === 'enroll' && result.ok) {
    payload.secret = result.secret;
    payload.uri = result.uri;
  }
  if (action === 'nonce' && result.ok) payload.nonce = result.nonce;
  return json(res, result.status || 400, payload);
}
