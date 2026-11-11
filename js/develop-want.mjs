import { check } from './input-schema.mjs';
import { categoryByName } from './category-help.mjs';

const TITLE = /^[\p{L}\p{N} .,'’+\-/#()]{8,80}$/u;
const BODY = /^[\p{L}\p{N} .,'’+\-/#()?!]{8,280}$/u;
const SHORT = /^[\p{L}\p{N} .,'’+\-/#()]{0,80}$/u;
const HANDLE = /^[a-z0-9-]{0,32}$/;
const DEDUPE_MS = 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const HOUR_MAX = 5;

const schema = {
  type: 'object',
  required: ['kind', 'category', 'title', 'body'],
  keys: {
    kind: { type: 'string', min: 6, max: 6 },
    category: { type: 'string', min: 1, max: 40 },
    title: { type: 'string', min: 8, max: 80, pattern: TITLE },
    body: { type: 'string', min: 8, max: 280, pattern: BODY },
    skill: { type: 'string', max: 80, pattern: SHORT },
    time: { type: 'string', max: 40, pattern: SHORT },
    handle: { type: 'string', max: 32, pattern: HANDLE }
  }
};

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function publicHelpWant(spec = {}) {
  const parsed = check(spec, schema, 'want');
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
  if (parsed.value.kind !== 'IwanIT') return { ok: false, status: 400, error: 'Use an IwanIT.' };
  const known = categoryByName(parsed.value.category);
  if (!known) return { ok: false, status: 400, error: 'That category is not on this desk.' };
  const title = clean(parsed.value.title);
  const body = clean(parsed.value.body);
  if (/@|mailto:|https?:/i.test(`${title} ${body} ${parsed.value.skill || ''} ${parsed.value.time || ''}`)) {
    return { ok: false, status: 400, error: 'Leave out email addresses and links.' };
  }
  const at = new Date().toISOString();
  return {
    ok: true,
    item: {
      kind: 'IwanIT',
      category: known.name,
      title,
      body,
      skill: clean(parsed.value.skill),
      time: clean(parsed.value.time),
      at
    }
  };
}

export function noticeOf(item) {
  return {
    category: item.category,
    title: item.title,
    at: item.at,
    link: `/develop?category=${encodeURIComponent(item.category)}`
  };
}

export async function notifyOwner(env, notice, { fetchImpl = globalThis.fetch, push } = {}) {
  const result = { email: false, push: false };
  const to = String(env.OWNER_NOTIFY_EMAIL || '').trim();
  const key = String(env.RESEND_API_KEY || '').trim();
  const from = String(env.EMAIL_FROM || '').trim();
  if (to && key && from) {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: notice.subject || `IwanIT: ${notice.category}`,
        text: `${notice.title}\n${notice.at}\n${notice.link}${notice.variant ? `\n\n${JSON.stringify(notice.variant)}` : ''}`
      })
    });
    result.email = response.ok === true;
  }
  if (typeof push === 'function') {
    const sent = await push(notice);
    result.push = sent?.ok === true;
  }
  return result;
}

export async function acceptHelpWant(store, spec, { now = Date.now(), ip = 'local', env = {}, fetchImpl, push } = {}) {
  const built = publicHelpWant(spec);
  if (!built.ok) return built;
  const stamps = ((await store.get(`develop:ip:${ip}`)) || []).filter((stamp) => now - stamp < HOUR_MS);
  if (stamps.length >= HOUR_MAX) return { ok: false, status: 429, error: 'Too many requests. Nothing was posted.' };
  const prior = (await store.get('develop:wants')) || [];
  const key = `${built.item.category}|${built.item.title}`.toLowerCase();
  const duplicate = prior.some((row) => row.key === key && now - Date.parse(row.at) < DEDUPE_MS);
  const notice = noticeOf(built.item);
  let alert = { email: false, push: false };
  if (!duplicate) {
    prior.push({ ...notice, key });
    await store.set('develop:wants', prior.slice(-40));
    alert = await notifyOwner(env, notice, { fetchImpl, push });
  }
  await store.set(`develop:ip:${ip}`, [...stamps, now].slice(-HOUR_MAX));
  return { ok: true, status: 200, item: built.item, notice, duplicate, notified: !duplicate && (alert.email || alert.push || !env.OWNER_NOTIFY_EMAIL) };
}

export async function listHelpWants(store) {
  const rows = (await store.get('develop:wants')) || [];
  return rows.map((row) => ({ category: row.category, title: row.title, at: row.at, link: row.link }));
}
