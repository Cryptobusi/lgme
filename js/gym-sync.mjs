import { redisRest } from './redis-env.mjs';

export const LOCAL_CHAT_NOTE = 'This chat is on this phone only. It is not shared with other phones yet. Chat text is not written to Hedera.';

const PRIVATE = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;

export function gymChatReady(env = {}) {
  const missing = [];
  if (env.GYM_CHAT_SYNC !== 'on') missing.push('GYM_CHAT_SYNC=on');
  missing.push(...redisRest(env).missing);
  return { enabled: missing.length === 0, missing, hedera: false, shared: missing.length === 0 };
}

export function publicChatMessage(spec = {}) {
  const text = String(spec.text || '').trim().replace(/\s+/g, ' ').slice(0, 280);
  const handle = String(spec.handle || '').trim().slice(0, 40);
  const code = String(spec.code || '').trim().toLowerCase();
  if (!text || !handle || (code !== 'demo-club' && !/^[a-z2-7]{10,32}$/.test(code))) {
    return { ok: false, error: 'Add a short message, a handle, and an invite code.' };
  }
  if (PRIVATE.test(text) || text.includes('$Trust')) return { ok: false, error: 'Leave out emails, links, phone numbers, and location.' };
  return { ok: true, message: { text, handle, code, at: spec.at || '', example: spec.example === true, hedera: false } };
}

export async function chatStatus(fetcher = globalThis.fetch) {
  if (typeof fetcher !== 'function') return { enabled: false, shared: false, hedera: false, message: LOCAL_CHAT_NOTE };
  try {
    const response = await fetcher('/api/gym/chat');
    const body = await response.json();
    return { ...body, hedera: false, message: body.message || (body.shared ? 'Chat can sync between phones.' : LOCAL_CHAT_NOTE) };
  } catch {
    return { enabled: false, shared: false, hedera: false, message: LOCAL_CHAT_NOTE };
  }
}
