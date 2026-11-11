export const SESSION_KEY = 'lgme.health.email';
export const EMAIL_GATEWAY = '/gym#/start';
export const EMAIL_WAITING = 'Email sign-in is coming. Nothing is sent until that step is connected.';

const GATED = new Set([EMAIL_GATEWAY, 'health-join']);

export function requiresEmail(route) {
  return GATED.has(String(route || ''));
}

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function saveEmailSession(storage, session, now = Date.now()) {
  storage.setItem(SESSION_KEY, JSON.stringify({
    email: String(session.email || ''),
    emailHash: String(session.emailHash || ''),
    x: String(session.x || ''),
    y: String(session.y || ''),
    at: String(session.at || new Date(now).toISOString()),
    until: now + SESSION_MS
  }));
}

export function readEmailSession(storage, now = Date.now()) {
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
    if (!saved) return null;
    if (saved.until && Number(saved.until) < now) {
      storage.removeItem(SESSION_KEY);
      return null;
    }
    if (saved.emailHash) {
      saved.until = now + SESSION_MS;
      storage.setItem(SESSION_KEY, JSON.stringify(saved));
    }
    return saved;
  } catch { return null; }
}

export function joinEmailDone(storage) {
  const saved = readEmailSession(storage);
  return Boolean(saved?.emailHash && saved.x && saved.y);
}
