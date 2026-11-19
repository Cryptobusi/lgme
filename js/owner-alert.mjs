export const OWNER_COPY_DEFAULT = 'egonomist@mail.grokbot.com';
export const SIGNUP_NOTICE = 'The administrator sees new sign-ups in the owner inbox (email, phone, device, time). No email is sent.';

export function parseDevice(ua) {
  const text = String(ua || '');
  const os = /Android/i.test(text) ? 'Android' : /iPhone|iPad/i.test(text) ? 'iOS' : /Windows/i.test(text) ? 'Windows' : /Mac OS/i.test(text) ? 'Mac' : /Linux/i.test(text) ? 'Linux' : 'Unknown';
  const browser = /Edg\//.test(text) ? 'Edge' : /Chrome\//.test(text) ? 'Chrome' : /Firefox\//.test(text) ? 'Firefox' : /Safari\//.test(text) && !/Chrome\//.test(text) ? 'Safari' : 'Unknown';
  const platform = /Mobile|Android|iPhone/i.test(text) ? 'phone' : 'desktop';
  return { os, browser, platform };
}

export function coarseRegion(headers = {}) {
  const country = String(headers['x-vercel-ip-country'] || headers['cf-ipcountry'] || '').replace(/[^A-Za-z]/g, '').slice(0, 2);
  const region = String(headers['x-vercel-ip-country-region'] || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12);
  return [country, region].filter(Boolean).join('-') || 'unknown';
}

export function signupText(spec, now = Date.now()) {
  const when = new Date(now);
  const ny = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(when);
  const device = spec.device || parseDevice(spec.ua);
  return [
    `Email: ${spec.email || 'none'}`,
    `Phone: ${spec.phone || 'none'}`,
    `Device: ${device.os}, ${device.browser}, ${device.platform}, passkey ${spec.passkey ? 'yes' : 'no'}`,
    `Time: ${ny} America/New_York, ${when.toISOString()} UTC`,
    `Method: ${spec.method || 'email'}`,
    `Category: ${spec.category || 'home'}`,
    `Source: ${spec.source || 'none'}`,
    `Region: ${spec.region || 'unknown'}`,
    `Site: ${spec.site || spec.category || 'home'}`,
    `Member: ${String(spec.memberId || '').slice(0, 16)}`
  ].join('\n');
}

export async function notifyNewMember(store, spec, { now = Date.now() } = {}) {
  try {
    const id = String(spec.memberId || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    if (!id) return { ok: true, skipped: true };
    if (await store.get(`owner:new:${id}`)) return { ok: true, duplicate: true };
    const ip = String(spec.ip || 'local').slice(0, 64);
    const stamps = ((await store.get(`owner:signup:ip:${ip}`)) || []).filter((stamp) => now - stamp < 60 * 60 * 1000);
    if (stamps.length >= 10) return { ok: true, limited: true };
    const detail = signupText({ ...spec, memberId: id }, now);
    const notice = { category: 'Sign-up', title: spec.title || 'New member', at: new Date(now).toISOString(), link: '/owner', kind: 'signup', detail };
    const prior = (await store.get('owner:signups')) || [];
    await store.set('owner:signups', [...prior, notice].slice(-40));
    await store.set(`owner:new:${id}`, { at: notice.at });
    await store.set(`owner:signup:ip:${ip}`, [...stamps, now]);
    return { ok: true, sent: false, inbox: true, duplicate: false };
  } catch {
    return { ok: true, sent: false };
  }
}

export async function notifyOwnerInbox(store, spec, { env = {}, fetchImpl = globalThis.fetch, now = Date.now() } = {}) {
  const notice = {
    category: spec.category || 'Hold',
    title: spec.title || 'Help resolve',
    at: new Date(now).toISOString(),
    link: spec.link || '/owner',
    kind: spec.kind || 'hold',
    detail: spec.detail || ''
  };
  try {
    const prior = (await store.get('owner:signups')) || [];
    await store.set('owner:signups', [...prior, notice].slice(-40));
  } catch {
    return { ok: true, inbox: false, email: false };
  }
  return { ok: true, inbox: true, email: false };
}

export async function listSignupNotices(store) {
  const rows = (await store.get('owner:signups')) || [];
  return Array.isArray(rows) ? rows : [];
}
