export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const SEND_GAP_MS = 60 * 1000;
export const SEND_HOUR_MAX = 5;
export const IP_HOUR_MAX = 20;

export const EMAIL_ENV = Object.freeze([
  'EMAIL_CHECK',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_CODE_PEPPER',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
]);

export function emailReadiness(env = {}) {
  const missing = [];
  if (env.EMAIL_CHECK !== 'on') missing.push('EMAIL_CHECK=on');
  for (const name of EMAIL_ENV) {
    if (name === 'EMAIL_CHECK') continue;
    if (!String(env[name] || '').trim()) missing.push(name);
  }
  return { enabled: missing.length === 0, missing };
}

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return '';
  return email;
}

export function allowlistFrom(value) {
  return String(value || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function isCampusEmail(email, allowlist = []) {
  const domain = String(email || '').split('@')[1] || '';
  if (!domain) return false;
  if (domain === 'edu' || domain.endsWith('.edu')) return true;
  return allowlist.includes(domain);
}

export function makeCode(bytes = crypto.getRandomValues(new Uint8Array(4))) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(0) % 1000000;
  return String(n).padStart(6, '0');
}

export async function hashCode(code, pepper) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${pepper}:${code}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function clientIp(headers) {
  const forwarded = String(headers?.['x-forwarded-for'] || headers?.get?.('x-forwarded-for') || '');
  const first = forwarded.split(',')[0].trim();
  return first || 'local';
}

export function memberKey(email) {
  return `email:member:${email}`;
}

export function codeKey(email) {
  return `email:code:${email}`;
}
