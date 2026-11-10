import { canonicalDevice, verifyDevice } from './device-sign.mjs';

export const ATTESTATION_THRESHOLD = 100;
export const ATTESTATION_NOTE = 'Needs 3 attestations (over $100)';
export const ATTESTATION_TOPIC = '0.0.11399829';
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function pairKey(fromId, toId) {
  return [String(fromId || ''), String(toId || '')].sort().join('|');
}

export function usdOf({ kind, amount, price } = {}) {
  const figure = Number(amount);
  if (!Number.isFinite(figure) || figure <= 0) return 0;
  if (kind === 'usd' || kind === 'credit') return Math.round(figure * 100) / 100;
  if (kind === 'lgme') {
    const rate = Number(price);
    if (!(rate > 0)) return null;
    return Math.round(figure * rate * 100) / 100;
  }
  return 0;
}

export function windowTotal(rows, pair, at) {
  const end = Date.parse(at || '');
  if (!Number.isFinite(end)) return 0;
  const start = end - WINDOW_MS;
  return (rows || []).reduce((sum, row) => {
    if (!row || row.pair !== pair || row.status === 'withdrawn') return sum;
    const when = Date.parse(row.at || '');
    if (!Number.isFinite(when) || when <= start || when > end) return sum;
    return sum + (Number(row.usd) || 0);
  }, 0);
}

export function evaluateHold(rows, entry) {
  const usd = usdOf(entry);
  if (usd == null) return { ok: false, error: 'Store the GeckoTerminal price for this $lgme entry.' };
  const pair = pairKey(entry.fromId, entry.toId);
  const priorRows = (rows || []).filter((row) => row.id !== entry.id);
  const total = windowTotal(priorRows, pair, entry.at) + usd;
  const existing = (rows || []).find((row) => row.id === entry.id) || null;
  if (existing?.status === 'withdrawn') return { ok: false, error: 'That entry was withdrawn.' };
  if (existing?.status === 'cleared') return { ok: true, pending: false, needed: false, record: existing };
  const needed = total > ATTESTATION_THRESHOLD;
  if (!needed) return { ok: true, pending: false, needed: false, usd, pair };
  const record = existing || {
    id: entry.id,
    pair,
    fromId: entry.fromId,
    toId: entry.toId,
    usd,
    kind: entry.kind,
    amount: Number(entry.amount) || usd,
    price: Number(entry.price) || 0,
    at: entry.at,
    status: 'pending',
    attestations: [],
    note: ATTESTATION_NOTE
  };
  const ready = attestationReady(record);
  return { ok: true, pending: !ready, needed: true, ready, usd, pair, record, count: record.attestations.length, note: ATTESTATION_NOTE };
}

export function rememberRow(rows, row) {
  return [...(rows || []).filter((item) => item.id !== row.id), row];
}

export function attestationReady(record) {
  const people = new Set((record?.attestations || []).map((item) => item.key).filter(Boolean));
  return people.size >= 3;
}

export function attestationCount(record) {
  return new Set((record?.attestations || []).map((item) => item.key).filter(Boolean)).size;
}

export function pendingCount(rows) {
  return (rows || []).filter((row) => row.status === 'pending').length;
}

function trainerStamp(peer, code) {
  return peer?.clubGroups?.[code]?.trainerAt || peer?.trainerAt || '';
}

function isTrainer(peer, code) {
  return peer?.gymRole === 'trainer' || peer?.trainer === true || peer?.clubGroups?.[code]?.role === 'trainer';
}

export function suggestThird(members, giver, receiver) {
  const parties = new Set([giver?.id, receiver?.id].filter(Boolean));
  const shared = Object.keys(giver?.clubGroups || {}).filter((code) => receiver?.clubGroups?.[code]);
  const code = shared[0] || '';
  if (!code) return { handle: '', role: 'any other member', text: 'Suggested third attester: any other member' };
  const rows = (members || []).filter((peer) => peer?.clubGroups?.[code] && !parties.has(peer.id));
  const admin = rows.find((peer) => peer.clubGroups[code].role === 'admin' || peer.clubGroups[code].admin === true);
  if (admin) return { handle: admin.id, role: 'group administrator', text: 'Suggested third attester: group administrator' };
  const trainers = rows.filter((peer) => isTrainer(peer, code)).sort((a, b) => {
    const at = trainerStamp(a, code);
    const bt = trainerStamp(b, code);
    if (at && bt && at !== bt) return at < bt ? -1 : 1;
    if (at && !bt) return -1;
    if (!at && bt) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
  if (trainers[0]) return { handle: trainers[0].id, role: 'trainer', text: 'Suggested third attester: trainer' };
  const creator = giver.clubGroups?.[code]?.creator || receiver.clubGroups?.[code]?.creator || '';
  if (creator && !parties.has(creator)) return { handle: creator, role: 'group creator', text: 'Suggested third attester: group creator' };
  return { handle: '', role: 'any other member', text: 'Suggested third attester: any other member' };
}

export async function attestationChainHash(entryId, sig) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalDevice({ entryId, sig, topic: ATTESTATION_TOPIC })));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function addAttestation(record, spec = {}) {
  if (!record || record.status === 'withdrawn') return { ok: false, error: 'That entry is not pending.' };
  if (record.status === 'cleared') return { ok: true, ready: true, count: attestationCount(record), record };
  const handle = String(spec.handle || '').trim();
  if (!handle || handle === record.fromId || handle === record.toId) return { ok: false, error: 'An attester is a third member.' };
  const publicJwk = spec.publicJwk;
  if (!publicJwk?.x || !spec.sig) return { ok: false, error: 'The attester signs with their device key.' };
  const payload = { action: 'attest', entryId: record.id, at: spec.at || '' };
  const signed = await verifyDevice(publicJwk, payload, spec.sig);
  if (!signed) return { ok: false, error: 'The device signature was refused.' };
  const key = `${publicJwk.x}.${publicJwk.y || ''}`;
  if ((record.attestations || []).some((item) => item.key === key || item.handle === handle)) {
    return { ok: true, duplicate: true, ready: attestationReady(record), count: attestationCount(record), record };
  }
  const hash = await attestationChainHash(record.id, spec.sig);
  const next = {
    ...record,
    attestations: [...(record.attestations || []), { key, handle, hash, at: spec.at || '', outside: false }]
  };
  next.status = attestationReady(next) ? 'ready' : 'pending';
  return { ok: true, ready: next.status === 'ready', count: attestationCount(next), record: next, hash, topic: ATTESTATION_TOPIC };
}

export function withdrawEntry(record, handle) {
  if (!record || record.status === 'cleared') return { ok: false, error: 'A cleared entry stays on the book.' };
  if (handle !== record.fromId && handle !== record.toId) return { ok: false, error: 'Either party can withdraw while it is pending.' };
  return { ok: true, record: { ...record, status: 'withdrawn' } };
}
