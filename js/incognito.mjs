export const INCOGNITO_KEY = 'lgme.incognito';
export const PENDING_KEY = 'lgme.incognito.pending';
export const NOTICE = 'Incognito — stays on this phone';
export const UNPUBLISHED = 'Unpublished. Not verified. Not on the network.';
export const VOICE_BLOCKED = 'Incognito is on. Voice input is off because this browser would send audio away. Typing still works. Nothing was sent.';

const AUTH_PREFIXES = ['/api/email/', '/api/authenticator', '/api/webauthn', '/api/hedera/status'];

function readRows(storage) {
  try {
    const rows = JSON.parse(storage.getItem(PENDING_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeRows(storage, rows) {
  storage.setItem(PENDING_KEY, JSON.stringify(rows));
}

function pathOf(url) {
  const raw = String(url || '');
  try { return new URL(raw, 'https://lgme.app').pathname; } catch { return raw; }
}

export function incognitoOn(storage) {
  try { return storage.getItem(INCOGNITO_KEY) === '1'; } catch { return false; }
}

export function setIncognito(storage, on) {
  storage.setItem(INCOGNITO_KEY, on ? '1' : '0');
  return { on: on === true, pending: readRows(storage).length, flushed: false };
}

export function isAuthTraffic(url) {
  const path = pathOf(url);
  return AUTH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function isPrivateWrite(url, method = 'GET') {
  const verb = String(method || 'GET').toUpperCase();
  if (verb === 'GET' || verb === 'HEAD') return false;
  if (isAuthTraffic(url)) return false;
  return pathOf(url).startsWith('/api/');
}

export function destinationFor(url) {
  const path = pathOf(url);
  if (path.startsWith('/api/hedera/queue')) return 'Hedera testnet queue';
  if (path.startsWith('/api/hedera/listings')) return 'Hedera testnet listings';
  if (path.startsWith('/api/gym/progress')) return 'Health progress for this account';
  if (path.startsWith('/api/gym/dispute')) return 'Dispute record';
  if (path.startsWith('/api/gym/presence') || path.startsWith('/api/gym/chat')) return 'Health presence';
  if (path.startsWith('/api/develop')) return 'Develop request';
  return 'App server';
}

export function kindFor(url) {
  const path = pathOf(url);
  if (path.includes('queue')) return 'receipt';
  if (path.includes('listing')) return 'listing';
  if (path.includes('dispute')) return 'attestation';
  if (path.includes('progress') || path.includes('presence')) return 'health';
  if (path.includes('develop')) return 'listing';
  return 'draft';
}

export function listPending(storage) {
  return readRows(storage);
}

export function holdPrivate(storage, item) {
  const rows = readRows(storage);
  const seq = rows.reduce((max, row) => Math.max(max, Number(String(row.id || '').replace(/\D/g, '')) || 0), 0) + 1;
  const next = {
    id: `hold-${seq}`,
    kind: String(item.kind || 'draft'),
    summary: String(item.summary || '').slice(0, 180),
    destination: item.shareable ? String(item.destination || 'App server') : 'Stays on this phone',
    shareable: item.shareable === true,
    url: item.shareable ? String(item.url || '') : '',
    method: item.shareable ? String(item.method || 'POST') : '',
    body: item.shareable ? String(item.body || '').slice(0, 4000) : '',
    state: 'unpublished',
    at: item.at || new Date().toISOString()
  };
  rows.push(next);
  writeRows(storage, rows);
  return next;
}

export function editPending(storage, id, summary) {
  const rows = readRows(storage);
  const row = rows.find((item) => item.id === id);
  if (!row) return { ok: false, error: 'That item is not pending.' };
  row.summary = String(summary || '').slice(0, 180);
  writeRows(storage, rows);
  return { ok: true, item: row, flushed: false };
}

export function deletePending(storage, id) {
  const rows = readRows(storage);
  const next = rows.filter((item) => item.id !== id);
  if (next.length === rows.length) return { ok: false, error: 'That item is not pending.' };
  writeRows(storage, next);
  return { ok: true, pending: next.length, flushed: false };
}

export function sharePreview(storage, ids) {
  const wanted = new Set(ids || []);
  return readRows(storage).filter((item) => wanted.has(item.id)).map((item) => ({
    id: item.id,
    kind: item.kind,
    destination: item.shareable ? item.destination : 'Stays on this phone',
    leaves: item.shareable ? (item.summary || item.body) : 'Nothing leaves. This stays on this phone.',
    shareable: item.shareable === true,
    label: UNPUBLISHED
  }));
}

export function receiptStatus(result) {
  if (result?.held || result?.unpublished) return `${UNPUBLISHED} The receipt stayed on this phone.`;
  if (result?.ok) return `Recorded on testnet. ${result.transactionId || result.sequenceNumber || ''}`.trim();
  return result?.error || 'The receipt stayed on this phone.';
}

export function voiceInputAllowed({ incognito, processLocally }) {
  if (!incognito) return { ok: true };
  if (processLocally === true) return { ok: true, onDevice: true };
  return { ok: false, message: VOICE_BLOCKED };
}

export function installIncognitoGuard(scope = globalThis, storage = scope.localStorage) {
  if (!scope || scope.__lgmeIncognitoGuard || typeof scope.fetch !== 'function') return;
  const native = scope.fetch.bind(scope);
  scope.__lgmeNativeFetch = native;
  scope.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    const method = init.method || (typeof input === 'string' ? 'GET' : input?.method) || 'GET';
    if (incognitoOn(storage) && isPrivateWrite(url, method)) {
      let body = '';
      try { body = typeof init.body === 'string' ? init.body : ''; } catch { body = ''; }
      holdPrivate(storage, {
        kind: kindFor(url),
        summary: body.slice(0, 180) || kindFor(url),
        destination: destinationFor(url),
        shareable: true,
        url,
        method,
        body
      });
      return new Response(JSON.stringify({ ok: false, held: true, unpublished: true, error: `${UNPUBLISHED} The receipt stayed on this phone.` }), {
        status: 409,
        headers: { 'content-type': 'application/json' }
      });
    }
    return native(input, init);
  };
  scope.__lgmeIncognitoGuard = true;
}

export async function shareApproved(storage, ids, fetchImpl) {
  const preview = sharePreview(storage, ids).filter((item) => item.shareable);
  const rows = readRows(storage);
  const chosen = rows.filter((item) => preview.some((line) => line.id === item.id));
  const sent = [];
  const failed = [];
  for (const item of chosen) {
    try {
      const response = await fetchImpl(item.url, {
        method: item.method || 'POST',
        headers: { 'content-type': 'application/json' },
        body: item.body
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok === false) failed.push(item.id);
      else sent.push(item.id);
    } catch {
      failed.push(item.id);
    }
  }
  writeRows(storage, rows.filter((item) => !sent.includes(item.id)));
  return { sent, failed, pending: readRows(storage), flushed: false };
}
