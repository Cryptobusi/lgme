import { hashEmail, memberKey, normalizeEmail } from '../../js/email-check-core.mjs';
import { guardRequest, headerMap, json, readBody, readEnv } from '../lib/http.mjs';
import { check, fields } from '../../js/input-schema.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { coarseRegion, notifyNewMember } from '../../js/owner-alert.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, enabled: false, error: 'Use POST.' });
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  const email = check(body?.email, { ...fields.email, required: true }, 'email');
  if (!email.ok) return json(res, 400, { ok: false, enabled: false, error: email.error });
  const normal = normalizeEmail(body.email);
  const env = readEnv();
  const emailHash = await hashEmail(normal, env.EMAIL_CODE_PEPPER || 'device');
  let member = 'new';
  const redis = redisRest(env);
  if (redis.configured) {
    try {
      const store = upstashStore(redis.url, redis.token);
      const key = memberKey(emailHash);
      const existing = await store.get(key);
      member = existing ? 'existing' : 'new';
      if (!existing) {
        await store.set(key, { emailHash, verifiedAt: new Date().toISOString() }, 0);
        const headers = headerMap(req);
        await notifyNewMember(store, {
          email: normal,
          phone: body.phone || '',
          memberId: emailHash,
          ua: headers['user-agent'] || '',
          region: coarseRegion(headers),
          method: 'device',
          category: body.category || 'home',
          source: body.invite || '',
          passkey: Boolean(body.publicJwk),
          ip: String(headers['x-forwarded-for'] || 'local').split(',')[0].trim()
        }, { env }).catch(() => {});
      }
    } catch { /* the phone still signs in */ }
  }
  return json(res, 200, { ok: true, enabled: false, member, emailHash, campusVerified: false, clubVerified: false });
}
