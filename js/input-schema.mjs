const HANDLE = /^[a-z0-9-]{1,32}$/;
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const HEDERA = /^0\.0\.[0-9]{1,10}$/;
const INVITE = /^[a-z2-7]{10}$/;
const DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const PLAIN = /^[\p{L}\p{N} .,:'’+\-/#()]{0,280}$/u;

function fail(error) {
  return { ok: false, error };
}

export function parseStrictJson(text) {
  if (typeof text !== 'string') return fail('Send JSON.');
  if (text.length > 100000) return fail('That request is too large.');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) return fail('Control characters are not allowed.');
  if (!uniqueKeys(text)) return fail('Duplicate keys are not allowed.');
  try {
    const body = JSON.parse(text, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error('blocked-key');
      }
      return value;
    });
    return { ok: true, body };
  } catch (error) {
    if (String(error?.message) === 'blocked-key') return fail('That field is not allowed.');
    return fail('Send valid JSON.');
  }
}

function uniqueKeys(text) {
  let i = 0;
  const skip = () => { while (' \n\r\t'.includes(text[i] || '')) i += 1; };
  const parseString = () => {
    if (text[i] !== '"') return null;
    i += 1;
    let out = '';
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') { i += 1; return out; }
      out += text[i];
      i += 1;
    }
    return null;
  };
  const parseValue = () => {
    skip();
    if (text[i] === '{') return parseObject();
    if (text[i] === '[') return parseArray();
    if (text[i] === '"') return parseString() != null;
    while (i < text.length && !',}]'.includes(text[i])) i += 1;
    return true;
  };
  const parseObject = () => {
    i += 1;
    const keys = new Set();
    skip();
    if (text[i] === '}') { i += 1; return true; }
    while (i < text.length) {
      skip();
      const key = parseString();
      if (key == null) return false;
      if (keys.has(key)) return false;
      keys.add(key);
      skip();
      if (text[i] !== ':') return false;
      i += 1;
      if (!parseValue()) return false;
      skip();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === '}') { i += 1; return true; }
      return false;
    }
    return false;
  };
  const parseArray = () => {
    i += 1;
    skip();
    if (text[i] === ']') { i += 1; return true; }
    while (i < text.length) {
      if (!parseValue()) return false;
      skip();
      if (text[i] === ',') { i += 1; continue; }
      if (text[i] === ']') { i += 1; return true; }
      return false;
    }
    return false;
  };
  skip();
  return parseValue() === true;
}

export function check(value, spec, label = 'field') {
  if (value == null) return spec.required ? fail(`${label} is required.`) : { ok: true };
  if (spec.type === 'string') {
    if (typeof value !== 'string') return fail(`${label} must be text.`);
    if (value.length > (spec.max || 280)) return fail(`${label} is too long.`);
    if (spec.min && value.length < spec.min) return fail(`${label} is too short.`);
    if (spec.pattern && !spec.pattern.test(value)) return fail(`${label} is not in the right form.`);
    return { ok: true, value };
  }
  if (spec.type === 'boolean') {
    if (typeof value !== 'boolean') return fail(`${label} must be yes or no.`);
    return { ok: true, value };
  }
  if (spec.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${label} must be a finite number.`);
    if (spec.min != null && value < spec.min) return fail(`${label} is too small.`);
    if (spec.max != null && value > spec.max) return fail(`${label} is too large.`);
    return { ok: true, value };
  }
  if (spec.type === 'enum') {
    if (!spec.values.includes(value)) return fail(`${label} is not allowed.`);
    return { ok: true, value };
  }
  if (spec.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(`${label} must be an object.`);
    for (const key of Object.keys(value)) {
      if (!spec.keys[key]) return fail(`Unknown field ${key}.`);
      const inner = check(value[key], spec.keys[key], key);
      if (!inner.ok) return inner;
    }
    for (const key of spec.required || []) {
      if (value[key] == null || value[key] === '') return fail(`${key} is required.`);
    }
    return { ok: true, value };
  }
  return fail(`${label} is not allowed.`);
}

export const fields = {
  handle: { type: 'string', max: 32, pattern: HANDLE },
  email: { type: 'string', max: 120, pattern: EMAIL },
  code: { type: 'string', min: 6, max: 6, pattern: /^[0-9]{6}$/ },
  invite: { type: 'string', min: 10, max: 10, pattern: INVITE },
  hash: { type: 'string', min: 64, max: 64, pattern: HEX64 },
  hedera: { type: 'string', max: 16, pattern: HEDERA },
  day: { type: 'string', min: 10, max: 10, pattern: DAY },
  plain: { type: 'string', max: 280, pattern: PLAIN },
  flag: { type: 'boolean' },
  usd: { type: 'number', min: 0, max: 100000 }
};

export function originAllowed(origin) {
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    return host === 'lgme.app' || host === 'localhost' || host.startsWith('127.0.0.1') || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

export function listingTransition(from, to) {
  const prev = String(from || '');
  const next = String(to || '');
  if (!next) return fail('That status is missing.');
  if (!prev) return { ok: true };
  if (prev.startsWith('Claimed by')) return fail('That listing is already claimed.');
  if (next.startsWith('Claimed by')) return { ok: true };
  if (/declined|cancelled/.test(prev)) return fail('That listing is closed.');
  const rank = (status) => {
    if (/receipt|ididit|finished/.test(status)) return 4;
    if (/confirmed/.test(status)) return 3;
    if (/matched|partial/.test(status)) return 2;
    if (/open|repeat|unclaimed|example|author/.test(status)) return 1;
    return 0;
  };
  if (/declined|cancelled/.test(next)) return rank(prev) <= 2 ? { ok: true } : fail('That listing cannot move backward.');
  if (rank(next) < rank(prev)) return fail('That listing cannot move backward.');
  return { ok: true };
}

export const ROUTES = Object.freeze([
  { path: '/api/email/status', method: 'GET', auth: 'none', goes: 'nowhere' },
  { path: '/api/email/send', method: 'POST', auth: 'none', goes: 'Resend and hashed code in KV' },
  { path: '/api/email/verify', method: 'POST', auth: 'email code', goes: 'KV hash compare' },
  { path: '/api/gym/chat', method: 'GET,POST,DELETE', auth: 'device signature', goes: 'KV' },
  { path: '/api/gym/covenant', method: 'GET,POST', auth: 'device signature', goes: 'KV' },
  { path: '/api/gym/dispute', method: 'GET,POST', auth: 'device signature', goes: 'KV hash' },
  { path: '/api/gym/intake', method: 'GET,POST', auth: 'device signature', goes: 'KV' },
  { path: '/api/gym/presence', method: 'GET,POST', auth: 'device signature', goes: 'KV' },
  { path: '/api/gym/progress', method: 'GET,POST,DELETE', auth: 'device signature', goes: 'KV' },
  { path: '/api/exchange/repair', method: 'GET,POST', auth: 'device signature', goes: 'KV' },
  { path: '/api/hedera/status', method: 'GET', auth: 'none', goes: 'testnet and mainnet mirror read' },
  { path: '/api/hedera/mirror', method: 'GET', auth: 'none', goes: 'testnet mirror read' },
  { path: '/api/hedera/queue', method: 'POST', auth: 'device signature', goes: 'KV then testnet hash' },
  { path: '/api/hedera/anchor', method: 'POST', auth: 'cron secret', goes: 'testnet topic' },
  { path: '/api/hedera/cron', method: 'GET,POST', auth: 'cron secret', goes: 'testnet topic' },
  { path: '/api/hedera/topic', method: 'POST', auth: 'admin flags', goes: 'refuses until flags' },
  { path: '/api/hedera/listings', method: 'GET,POST', auth: 'device signature', goes: 'testnet topic and KV' }
]);
