import { compactCode, deviceThumb, hashEmail, memberKey, normalizeEmail } from './email-check-core.mjs';
import { sha256Hex, verifyDevice } from './device-sign.mjs';

const STEP_SEC = 30;
const WINDOW_MS = 10 * 60 * 1000;
const TRY_MAX = 5;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromB64(text) {
  const raw = atob(String(text || ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export function generateTotpSecret(bytes = crypto.getRandomValues(new Uint8Array(20))) {
  return base32Encode(bytes);
}

export function otpauthUri(secret, email) {
  const label = encodeURIComponent(`lgme.app:${normalizeEmail(email) || 'member'}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('lgme.app')}&algorithm=SHA1&digits=6&period=30`;
}

async function hotp(secret, counter) {
  const key = await crypto.subtle.importKey('raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const big = BigInt(counter);
  view.setUint32(0, Number((big >> 32n) & 0xffffffffn));
  view.setUint32(4, Number(big & 0xffffffffn));
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = mac[mac.length - 1] & 0xf;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 1000000).padStart(6, '0');
}

export async function totpAt(secret, now = Date.now()) {
  return hotp(secret, Math.floor(now / 1000 / STEP_SEC));
}

export async function matchTotp(secret, code, now = Date.now(), used = []) {
  const clean = compactCode(code);
  if (!/^\d{6}$/.test(clean)) return { ok: false, error: 'Enter the 6-digit authenticator code.' };
  const step = Math.floor(now / 1000 / STEP_SEC);
  for (let delta = -1; delta <= 1; delta += 1) {
    const counter = step + delta;
    if ((await hotp(secret, counter)) !== clean) continue;
    if (used.includes(counter)) return { ok: false, reused: true, error: 'That code was already used.' };
    return { ok: true, counter };
  }
  return { ok: false, error: 'That authenticator code does not match.' };
}

async function aesKey(pepper) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`totp:${pepper}`));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSecret(secret, pepper) {
  const key = await aesKey(pepper);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(secret)));
  return { iv: b64(iv), cipher: b64(cipher) };
}

export async function openSecret(sealed, pepper) {
  const key = await aesKey(pepper);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sealed.iv) }, key, fromB64(sealed.cipher));
  return new TextDecoder().decode(plain);
}

function noSecret(body) {
  const copy = { ...body };
  delete copy.secret;
  delete copy.uri;
  return copy;
}

async function memberOf(store, email, pepper) {
  const normal = normalizeEmail(email);
  if (!normal) return { ok: false, status: 400, error: 'Enter a valid email.' };
  const emailHash = await hashEmail(normal, pepper);
  const member = await store.get(memberKey(emailHash));
  if (!member) return { ok: false, status: 400, error: 'Continue on this phone first.' };
  return { ok: true, email: normal, emailHash, member };
}

async function charge(store, emailHash, ip, now) {
  const keys = [`totp:try:${emailHash}`, `totp:ip:${ip || 'local'}`];
  const rows = [];
  for (const key of keys) {
    const row = (await store.get(key)) || { stamps: [] };
    const stamps = (row.stamps || []).filter((stamp) => now - stamp < WINDOW_MS);
    if (stamps.length >= TRY_MAX) return { ok: false, status: 429, error: 'Too many authenticator tries. Wait and try again.' };
    rows.push({ key, stamps });
  }
  for (const row of rows) {
    await store.set(row.key, { stamps: [...row.stamps, now] }, 600);
  }
  return { ok: true };
}

export async function beginEnrollment(store, spec) {
  const found = await memberOf(store, spec.email, spec.pepper);
  if (!found.ok) return found;
  const thumb = spec.publicJwk?.x ? await deviceThumb(spec.publicJwk) : '';
  if (!thumb) return { ok: false, status: 400, error: 'This device has no key yet.' };
  const secret = spec.secret || generateTotpSecret();
  const pending = await sealSecret(secret, spec.pepper);
  const now = spec.now || Date.now();
  await store.set(memberKey(found.emailHash), { ...found.member, deviceThumb: thumb, totpPending: { ...pending, exp: now + 10 * 60 * 1000 } }, 0);
  return { ok: true, status: 200, secret, uri: otpauthUri(secret, found.email) };
}

export async function finishEnrollment(store, spec) {
  const found = await memberOf(store, spec.email, spec.pepper);
  if (!found.ok) return found;
  const pending = found.member.totpPending;
  if (!pending || (spec.now || Date.now()) > pending.exp) return { ok: false, status: 400, error: 'Start authenticator setup again.' };
  const secret = await openSecret(pending, spec.pepper);
  const matched = await matchTotp(secret, spec.code, spec.now || Date.now(), []);
  if (!matched.ok) return { ok: false, status: 400, error: matched.error };
  const thumb = spec.publicJwk?.x ? await deviceThumb(spec.publicJwk) : found.member.deviceThumb;
  const next = { ...found.member, deviceThumb: thumb, totp: { iv: pending.iv, cipher: pending.cipher }, totpUsed: [matched.counter] };
  delete next.totpPending;
  await store.set(memberKey(found.emailHash), next, 0);
  return noSecret({ ok: true, status: 200, enrolled: true });
}

export async function issueNonce(store, spec) {
  const found = await memberOf(store, spec.email, spec.pepper);
  if (!found.ok) return found;
  if (!found.member.totp) return { ok: false, status: 400, fallback: 'device', error: 'Set up the authenticator app first. Use fingerprint.' };
  const nonce = spec.nonce || base32Encode(crypto.getRandomValues(new Uint8Array(16)));
  const now = spec.now || Date.now();
  await store.set(`totp:nonce:${found.emailHash}`, { nonce, exp: now + 2 * 60 * 1000 }, 120);
  return { ok: true, status: 200, nonce };
}

async function checkDeviceAndCode(store, spec, purpose) {
  const found = await memberOf(store, spec.email, spec.pepper);
  if (!found.ok) return found;
  const now = spec.now || Date.now();
  const ip = spec.ip || 'local';
  const limit = await charge(store, found.emailHash, ip, now);
  if (!limit.ok) return limit;
  if (!found.member.totp) return { ok: false, status: 400, fallback: 'device', error: 'Use fingerprint or the authenticator.' };
  const thumb = spec.publicJwk?.x ? await deviceThumb(spec.publicJwk) : '';
  const nonceRow = await store.get(`totp:nonce:${found.emailHash}`);
  const payload = { nonce: spec.nonce, purpose };
  const signed = nonceRow && nonceRow.nonce === spec.nonce && now <= nonceRow.exp && await verifyDevice(spec.publicJwk, payload, spec.sig);
  if (!signed || thumb !== found.member.deviceThumb) {
    return { ok: false, status: 400, fallback: 'device', error: 'This device does not match. Use fingerprint or the authenticator.' };
  }
  const secret = await openSecret(found.member.totp, spec.pepper);
  const matched = await matchTotp(secret, spec.code, now, found.member.totpUsed || []);
  if (!matched.ok) return { ok: false, status: matched.reused ? 400 : 400, error: matched.error };
  await store.del(`totp:nonce:${found.emailHash}`);
  await store.set(memberKey(found.emailHash), { ...found.member, totpUsed: [...(found.member.totpUsed || []), matched.counter].slice(-8) }, 0);
  if (purpose !== 'totp-signin') return noSecret({ ok: true, status: 200 });
  const sessionId = base32Encode(crypto.getRandomValues(new Uint8Array(16)));
  await store.set(`totp:session:${sessionId}`, {
    emailHash: found.emailHash,
    deviceThumb: thumb,
    ipHash: await sha256Hex(ip),
    actions: [],
    at: now
  }, 0);
  return noSecret({ ok: true, status: 200, sessionId });
}

const NOTICES = 'security:notices';

async function logSuspicious(store, { emailHash, ipHash, reason, now }) {
  const notices = (await store.get(NOTICES)) || [];
  notices.push({
    title: 'Suspicious session',
    category: 'Security',
    at: new Date(now).toISOString(),
    link: '/owner',
    kind: 'security',
    reason,
    member: emailHash || '',
    ip: ipHash
  });
  await store.set(NOTICES, notices.slice(-40), 0);
}

export async function watchSession(store, spec) {
  const now = spec.now || Date.now();
  const session = spec.sessionId ? await store.get(`totp:session:${spec.sessionId}`) : null;
  const ipHash = await sha256Hex(spec.ip || 'local');
  const thumb = spec.publicJwk?.x ? await deviceThumb(spec.publicJwk) : '';
  const signed = Boolean(session) && Boolean(spec.sig) && await verifyDevice(spec.publicJwk, { sessionId: spec.sessionId, purpose: 'watch' }, spec.sig);
  const reasons = [];
  if (!session) reasons.push('no-session');
  if (!signed) reasons.push('missing-signature');
  if (spec.webdriver === true || spec.headless === true) reasons.push('automated-browser');
  if (session && thumb && thumb !== session.deviceThumb) reasons.push('device-change');
  if (session && ipHash !== session.ipHash) reasons.push('ip-change');
  const recent = (session?.actions || []).filter((stamp) => now - stamp < 10_000);
  if (recent.filter((stamp) => now - stamp < 1000).length >= 3) reasons.push('rapid-fire');
  if (recent.length >= 8) reasons.push('burst');
  const fails = session ? (((await store.get(`totp:try:${session.emailHash}`)) || {}).stamps || []).filter((stamp) => now - stamp < WINDOW_MS) : [];
  if (fails.length >= 3) reasons.push('failed-codes');
  if (reasons.length) {
    await logSuspicious(store, { emailHash: session?.emailHash || '', ipHash, reason: reasons[0], now });
    return { ok: true, status: 200, prompt: true, reason: reasons[0] };
  }
  await store.set(`totp:session:${spec.sessionId}`, { ...session, actions: [...recent, now] }, 0);
  return { ok: true, status: 200, prompt: false };
}

export async function listSuspicious(store) {
  const notices = (await store.get(NOTICES)) || [];
  return notices.map((notice) => ({ title: notice.title, category: notice.category, at: notice.at, link: notice.link, kind: notice.kind, reason: notice.reason, member: notice.member, ip: notice.ip }));
}

export function signInWithAuthenticator(store, spec) {
  return checkDeviceAndCode(store, spec, 'totp-signin');
}

export function confirmWithAuthenticator(store, spec) {
  return checkDeviceAndCode(store, spec, 'totp-gate');
}

export async function resetAuthenticator(store, spec, confirmCode) {
  const confirmed = await confirmCode(store, spec);
  if (!confirmed.ok) return confirmed;
  const key = memberKey(confirmed.emailHash);
  const member = await store.get(key);
  if (!member) return { ok: false, status: 400, error: 'Continue on this phone first.' };
  const next = { ...member };
  delete next.totp;
  delete next.totpPending;
  delete next.totpUsed;
  await store.set(key, next, 0);
  return noSecret({ ok: true, status: 200, reset: true });
}
