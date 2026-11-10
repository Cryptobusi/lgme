export const SESSION_KEY = 'lgme.health.email';
export const EMAIL_GATEWAY = '/gym#/start';
export const EMAIL_WAITING = 'Email sign-in is coming. Nothing is sent until that step is connected.';

const GATED = new Set([EMAIL_GATEWAY, 'health-join']);

export function requiresEmail(route) {
  return GATED.has(String(route || ''));
}

export function saveEmailSession(storage, session) {
  storage.setItem(SESSION_KEY, JSON.stringify({
    email: String(session.email || ''),
    emailHash: String(session.emailHash || ''),
    x: String(session.x || ''),
    y: String(session.y || ''),
    at: String(session.at || '')
  }));
}

export function readEmailSession(storage) {
  try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}

export function joinEmailDone(storage) {
  const saved = readEmailSession(storage);
  return Boolean(saved?.emailHash && saved.x && saved.y);
}
