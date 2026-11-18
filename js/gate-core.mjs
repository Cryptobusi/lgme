import { normalizeEmail } from './email-check-core.mjs';
import { confirmCode, requestCode } from '../api/lib/email-flow.mjs';
import { coarseRegion, notifyNewMember, parseDevice } from './owner-alert.mjs';

export const GATE_ORIGINS = Object.freeze(['https://hederica.com', 'https://www.hederica.com']);
export const GATE_SITE = 'hederica';
const DAY_MS = 24 * 60 * 60 * 1000;

export function gateCors(origin) {
  if (!origin) return { ok: true, echo: '' };
  return GATE_ORIGINS.includes(origin) ? { ok: true, echo: origin } : { ok: false };
}

export function applyGateCors(req, res) {
  const origin = req.headers?.origin || '';
  const cors = gateCors(origin);
  if (cors.echo) {
    res.setHeader('access-control-allow-origin', cors.echo);
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = cors.ok ? 204 : 403;
    res.end();
    return true;
  }
  if (!cors.ok) {
    res.statusCode = 403;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'That origin is not allowed.' }));
    return true;
  }
  return false;
}

function prefixed(store) {
  return {
    get: (key) => store.get(`gate:${key}`),
    set: (key, value, ttl) => store.set(`gate:${key}`, value, ttl),
    del: (key) => store.del(`gate:${key}`)
  };
}

export async function startGate(store, spec) {
  if (spec.site !== GATE_SITE) return { ok: false, status: 400, error: 'This gate is for hederica.' };
  const email = normalizeEmail(spec.email);
  if (!email) return { ok: false, status: 400, error: 'Enter a valid email.' };
  return requestCode(prefixed(store), {
    email,
    now: spec.now,
    ip: spec.ip || 'local',
    pepper: spec.pepper,
    code: spec.code,
    allowlist: [],
    send: spec.send
  });
}

async function mac(body, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Buffer.from(sig).toString('base64url');
}

export async function signGateToken(emailHash, secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ s: GATE_SITE, h: String(emailHash).slice(0, 32), e: now + 30 * DAY_MS })).toString('base64url');
  return `${body}.${await mac(body, secret)}`;
}

export async function readGateToken(token, secret, now = Date.now()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return { ok: false };
  const expected = await mac(body, secret);
  if (expected !== sig) return { ok: false };
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return { ok: false }; }
  if (payload.s !== GATE_SITE || !payload.h || Number(payload.e) < now) return { ok: false };
  return { ok: true, emailHash: payload.h };
}

export async function verifyGate(store, spec, { env = {}, fetchImpl, headers = {}, now = Date.now() } = {}) {
  const email = normalizeEmail(spec.email);
  const checked = await confirmCode(prefixed(store), { email, code: spec.code, now, pepper: spec.pepper, allowlist: [], clubAllowlist: [], clubInvites: [] });
  if (!checked.ok) return checked;
  const token = await signGateToken(checked.emailHash, spec.pepper, now);
  await notifyNewMember(store, {
    email,
    memberId: `gate${checked.emailHash}`,
    ua: headers['user-agent'] || '',
    region: coarseRegion(headers),
    method: 'email',
    category: GATE_SITE,
    site: 'hederica.com',
    source: 'hederica.com',
    title: 'Hederica visitor',
    ip: spec.ip || 'local'
  }, { env, fetchImpl, now }).catch(() => {});
  return { ok: true, status: 200, token, device: parseDevice(headers['user-agent'] || '') };
}

