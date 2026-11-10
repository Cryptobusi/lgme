import { CODE_TTL_MS, IP_HOUR_MAX, MAX_ATTEMPTS, SEND_GAP_MS, SEND_HOUR_MAX, codeKey, deviceThumb, hashCode, hashEmail, isCampusEmail, isClubEmail, makeCode, memberKey, normalizeEmail } from '../../js/email-check-core.mjs';

const HOUR_MS = 60 * 60 * 1000;

export async function requestCode(store, spec) {
  const email = normalizeEmail(spec.email);
  if (!email) return { ok: false, status: 400, error: 'Enter a valid email.' };
  const emailHash = await hashEmail(email, spec.pepper);
  const now = Number.isFinite(spec.now) ? spec.now : Date.now();
  const ip = spec.ip || 'local';
  const gap = await store.get(`email:gap:${emailHash}`);
  if (gap && now - Number(gap.at) < SEND_GAP_MS) {
    return { ok: false, status: 429, error: 'Wait a minute before asking for another code.' };
  }
  const emailHour = await bump(store, `email:hour:${emailHash}`, now);
  const ipHour = await bump(store, `email:ip:${ip}`, now);
  if (emailHour > SEND_HOUR_MAX || ipHour > IP_HOUR_MAX) {
    return { ok: false, status: 429, error: 'Too many codes. Try again later.' };
  }
  const code = spec.code || makeCode();
  const hash = await hashCode(code, spec.pepper);
  await store.set(codeKey(emailHash), { hash, attempts: 0, exp: now + CODE_TTL_MS }, 600);
  await store.set(`email:gap:${emailHash}`, { at: now }, 60);
  const sent = await spec.send(email, code);
  if (!sent.ok) {
    await store.del(codeKey(emailHash));
    return { ok: false, status: 502, error: 'The code could not be sent.' };
  }
  return { ok: true, status: 200, expiresIn: 600 };
}

export async function confirmCode(store, spec) {
  const email = normalizeEmail(spec.email);
  const code = String(spec.code || '').trim();
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, status: 400, error: 'Enter the email and the 6-digit code.' };
  const emailHash = await hashEmail(email, spec.pepper);
  const now = Number.isFinite(spec.now) ? spec.now : Date.now();
  const row = await store.get(codeKey(emailHash));
  if (!row || now > row.exp) return { ok: false, status: 400, error: 'That code expired. Ask for a new one.' };
  const nextAttempts = Number(row.attempts || 0) + 1;
  if (nextAttempts > MAX_ATTEMPTS) {
    await store.del(codeKey(emailHash));
    return { ok: false, status: 429, error: 'Too many tries. Ask for a new code.' };
  }
  const hash = await hashCode(code, spec.pepper);
  if (hash !== row.hash) {
    await store.set(codeKey(emailHash), { ...row, attempts: nextAttempts }, Math.max(1, Math.ceil((row.exp - now) / 1000)));
    return { ok: false, status: 400, error: 'That code does not match.' };
  }
  await store.del(codeKey(emailHash));
  const key = memberKey(emailHash);
  const existing = await store.get(key);
  const campusVerified = isCampusEmail(email, spec.allowlist || []);
  const invite = String(spec.invite || '').trim().toLowerCase();
  const clubVerified = isClubEmail(email, spec.clubAllowlist || []) || (invite && (spec.clubInvites || []).includes(invite));
  const thumb = spec.publicJwk?.x ? await deviceThumb(spec.publicJwk) : '';
  if (thumb) await store.set(`email:device:${thumb}`, { emailHash, verifiedAt: new Date(now).toISOString() });
  if (!existing) {
    await store.set(key, { emailHash, campusVerified, clubVerified: clubVerified === true, verifiedAt: new Date(now).toISOString(), deviceThumb: thumb }, 0);
    return { ok: true, status: 200, member: 'new', emailHash, campusVerified, clubVerified: clubVerified === true };
  }
  if (thumb) await store.set(key, { ...existing, deviceThumb: thumb });
  return { ok: true, status: 200, member: 'existing', emailHash, campusVerified: existing.campusVerified === true, clubVerified: existing.clubVerified === true };
}

async function bump(store, key, now) {
  const row = await store.get(key);
  const fresh = !row || now - Number(row.start) >= HOUR_MS;
  const count = fresh ? 1 : Number(row.count) + 1;
  await store.set(key, { start: fresh ? now : row.start, count }, 3600);
  return count;
}
