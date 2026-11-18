import { canonicalDevice, verifyDevice } from './device-sign.mjs';
import { PRICE_UNAVAILABLE, averagePrice } from './lgme-price.mjs';
import { notifyOwnerInbox } from './owner-alert.mjs';

export const ATTESTATION_THRESHOLD = 100;
export const DAY_THRESHOLD = 1000;
export const ATTESTATION_NOTE = 'Needs 3 attestations (over $100)';
export const DAY_NOTE = 'Needs 3 attestations and administrator approval (over $1,000/day)';
export const ADMIN_APPROVAL_LABEL = 'until a member DAO publishes its approval path';
export const RULE_SHORT = 'Up to $100 bilateral; over $100 three independent attestations; over $1,000/day three plus admin approval until DAO path published; any refusal stays on record, no penalty; An unpublished change is not a change; Floor stays senior. Same rules bind state, firm, and person.';
export const ATTESTATION_TOPIC = '0.0.11399829';
export const WINDOW_MS = 24 * 60 * 60 * 1000;
export const ESCALATE_MS = 3 * 60 * 60 * 1000;

export function pairKey(fromId, toId) {
  return [String(fromId || ''), String(toId || '')].sort().join('|');
}

export function usdOf({ kind, amount, price, samples, now } = {}) {
  const figure = Number(amount);
  if (!Number.isFinite(figure) || figure <= 0) return 0;
  if (kind === 'usd' || kind === 'credit') return Math.round(figure * 100) / 100;
  if (kind === 'lgme') {
    let rate = Number(price);
    if (samples) {
      const avg = averagePrice(samples, Number.isFinite(Number(now)) ? Number(now) : Date.now());
      if (!avg.ok) return null;
      rate = avg.price;
    }
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
    if (!row || row.kind === 'refusal' || row.pair !== pair || row.status === 'withdrawn') return sum;
    const when = Date.parse(row.at || '');
    if (!Number.isFinite(when) || when <= start || when > end) return sum;
    return sum + (Number(row.usd) || 0);
  }, 0);
}

export function evaluateHold(rows, entry) {
  const usd = usdOf(entry);
  if (usd == null) {
    return { ok: false, error: entry.samples ? PRICE_UNAVAILABLE : 'Store the GeckoTerminal price for this $lgme entry.' };
  }
  const pair = pairKey(entry.fromId, entry.toId);
  const priorRows = (rows || []).filter((row) => row.id !== entry.id);
  const total = windowTotal(priorRows, pair, entry.at) + usd;
  const existing = (rows || []).find((row) => row.id === entry.id) || null;
  if (existing?.status === 'withdrawn') return { ok: false, error: 'That entry was withdrawn.' };
  if (existing?.status === 'cleared') return { ok: true, pending: false, needed: false, record: existing };
  const tier = total > DAY_THRESHOLD ? 'day' : total > ATTESTATION_THRESHOLD ? 'pair' : '';
  if (!tier) return { ok: true, pending: false, needed: false, usd, pair, total };
  const note = tier === 'day' ? DAY_NOTE : ATTESTATION_NOTE;
  const opened = existing?.openedAt || existing?.at || entry.at;
  const record = {
    id: entry.id,
    pair,
    fromId: entry.fromId,
    toId: entry.toId,
    usd,
    kind: entry.kind,
    amount: Number(entry.amount) || usd,
    price: Number(entry.price) || 0,
    at: existing?.at || entry.at,
    openedAt: opened,
    deadline: existing?.deadline || new Date(Date.parse(opened) + WINDOW_MS).toISOString(),
    extended: existing?.extended === true,
    status: existing?.status === 'unresolved' ? 'unresolved' : 'pending',
    tier,
    adminRequired: tier === 'day',
    adminApproval: existing?.adminApproval || null,
    attestations: existing?.attestations || [],
    refusals: existing?.refusals || [],
    autoApproved: false,
    note
  };
  const ready = holdReady(record);
  if (ready) record.status = 'ready';
  return { ok: true, pending: !ready && record.status !== 'unresolved', needed: true, ready, usd, pair, total, record, count: record.attestations.length, note, tier };
}

export function rememberRow(rows, row) {
  return [...(rows || []).filter((item) => item.id !== row.id), row];
}

export function attestationReady(record) {
  const people = new Set((record?.attestations || []).map((item) => item.key).filter(Boolean));
  return people.size >= 3;
}

export function holdReady(record) {
  if (!attestationReady(record)) return false;
  if (record?.adminRequired && !record.adminApproval?.at) return false;
  return true;
}

export function autoApprove() {
  return false;
}

export function shownRecords(rows) {
  return (rows || []).filter((row) => row && (row.kind === 'refusal' || row.status !== 'hidden'));
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
  next.status = holdReady(next) ? 'ready' : 'pending';
  next.autoApproved = false;
  return { ok: true, ready: next.status === 'ready', count: attestationCount(next), record: next, hash, topic: ATTESTATION_TOPIC, penalty: 0 };
}

export function refusalEntry(record, item) {
  return {
    id: `refusal:${record.id}:${item.key}`,
    kind: 'refusal',
    pair: record.pair,
    fromId: record.fromId,
    toId: record.toId,
    usd: 0,
    at: item.at,
    status: 'record',
    seat: item.seat,
    handle: item.handle,
    penalty: 0,
    hidden: false,
    note: 'Refusal stays on record. No penalty.'
  };
}

export async function addRefusal(record, spec = {}) {
  if (!record || record.status === 'withdrawn') return { ok: false, error: 'That entry is not pending.' };
  const handle = String(spec.handle || '').trim();
  const publicJwk = spec.publicJwk;
  if (!handle || !publicJwk?.x || !spec.sig) return { ok: false, error: 'A refusal is signed with a device key.' };
  const payload = { action: 'refuse', entryId: record.id, at: spec.at || '' };
  const signed = await verifyDevice(publicJwk, payload, spec.sig);
  if (!signed) return { ok: false, error: 'The device signature was refused.' };
  const key = `${publicJwk.x}.${publicJwk.y || ''}`;
  const seat = spec.seat === 'third' || handle === record.fromId || handle === record.toId ? 'third' : 'member';
  if ((record.refusals || []).some((item) => item.key === key)) {
    const kept = record.refusals.find((item) => item.key === key);
    return { ok: true, duplicate: true, penalty: 0, hidden: false, record, entry: refusalEntry(record, kept) };
  }
  const item = { key, handle, at: spec.at || '', seat, hash: await attestationChainHash(record.id, spec.sig) };
  const next = { ...record, refusals: [...(record.refusals || []), item], status: record.status === 'ready' ? 'ready' : 'pending', autoApproved: false };
  return { ok: true, penalty: 0, hidden: false, record: next, entry: refusalEntry(next, item) };
}

export async function adminAct(record, spec = {}) {
  if (!record) return { ok: false, error: 'That entry is not pending.' };
  if (spec.role !== 'administrator') return { ok: false, error: 'The administrator signs this.' };
  const action = String(spec.action || '');
  if (action === 'attest') return addAttestation(record, spec);
  const publicJwk = spec.publicJwk;
  if (!publicJwk?.x || !spec.sig) return { ok: false, error: 'The administrator signs with their device key.' };
  const payload = { action, entryId: record.id, at: spec.at || '' };
  const signed = await verifyDevice(publicJwk, payload, spec.sig);
  if (!signed) return { ok: false, error: 'The device signature was refused.' };
  if (action === 'approve') {
    if (!record.adminRequired) return { ok: false, error: 'This hold does not need administrator approval.' };
    const next = {
      ...record,
      adminApproval: { handle: spec.handle || 'administrator', at: spec.at || '', label: ADMIN_APPROVAL_LABEL, key: `${publicJwk.x}.${publicJwk.y || ''}` },
      autoApproved: false
    };
    next.status = holdReady(next) ? 'ready' : 'pending';
    return { ok: true, ready: next.status === 'ready', autoApproved: false, record: next };
  }
  if (action === 'extend') {
    if (record.extended) return { ok: false, error: 'A hold can be extended once.' };
    const base = Date.parse(record.deadline || record.openedAt || record.at || '');
    const next = { ...record, extended: true, deadline: new Date(base + WINDOW_MS).toISOString(), status: 'pending', autoApproved: false };
    return { ok: true, extended: true, autoApproved: false, record: next };
  }
  if (action === 'unresolved') {
    return { ok: true, autoApproved: false, record: { ...record, status: 'unresolved', autoApproved: false } };
  }
  return { ok: false, error: 'The administrator can attest, approve, extend once, or mark unresolved.' };
}

export function nearingMarks(total) {
  const marks = [];
  for (const cap of [ATTESTATION_THRESHOLD, DAY_THRESHOLD]) {
    for (const ratio of [0.8, 0.95]) {
      const line = Math.round(cap * ratio * 100) / 100;
      if (total + 1e-9 >= line && total <= cap + 1e-9) marks.push({ cap, ratio, line });
    }
  }
  return marks;
}

export function reminderCadence(leftMs) {
  if (leftMs <= ESCALATE_MS) return { everyMs: 15 * 60 * 1000, urgent: true, label: 'Urgent' };
  if (leftMs <= 6 * 60 * 60 * 1000) return { everyMs: 30 * 60 * 1000, urgent: true, label: 'Urgent' };
  if (leftMs <= 12 * 60 * 60 * 1000) return { everyMs: 60 * 60 * 1000, urgent: true, label: 'Urgent' };
  return { everyMs: 3 * 60 * 60 * 1000, urgent: false, label: '' };
}

export function planReminders(rows, now) {
  const plans = [];
  const seen = new Set();
  const at = new Date(now).toISOString();
  for (const row of rows || []) {
    if (!row || row.kind === 'refusal' || row.status === 'withdrawn') continue;
    if (row.pair && !seen.has(row.pair)) {
      seen.add(row.pair);
      for (const mark of nearingMarks(windowTotal(rows, row.pair, at))) {
        plans.push({ kind: 'threshold', pair: row.pair, inApp: true, local: true, ...mark });
      }
    }
    if (row.status === 'pending' && row.deadline) {
      const leftMs = Date.parse(row.deadline) - now;
      plans.push({ kind: 'hold', id: row.id, inApp: true, local: true, leftMs, ...reminderCadence(leftMs) });
    }
  }
  return plans;
}

export function holdLink(id) {
  return `/exchange?hold=${encodeURIComponent(id)}#help-resolve`;
}

export function holdQuery(search) {
  return new URLSearchParams(String(search || '').replace(/^\?/, '')).get('hold') || '';
}

export function attestCard(record, now) {
  const left = Date.parse(record?.deadline || '') - now;
  const cadence = reminderCadence(Number.isFinite(left) ? left : WINDOW_MS);
  const hours = Number.isFinite(left) ? Math.max(0, Math.floor(left / 3600000)) : 0;
  const mins = Number.isFinite(left) ? Math.max(0, Math.floor((left % 3600000) / 60000)) : 0;
  return {
    what: record?.note || ATTESTATION_NOTE,
    amount: record?.usd || 0,
    parties: `${record?.fromId || ''} and ${record?.toId || ''}`,
    timeLeft: `${hours}h ${mins}m`,
    href: holdLink(record?.id || ''),
    urgent: cadence.urgent,
    label: cadence.label
  };
}

export function escalationNotice(record, now, extras = {}) {
  if (!record || record.kind === 'refusal') return null;
  if (record.status === 'cleared' || record.status === 'ready' || record.status === 'withdrawn' || record.status === 'unresolved') return null;
  if (holdReady(record)) return null;
  const left = Date.parse(record.deadline || '') - now;
  if (!(left <= ESCALATE_MS && left > 0)) return null;
  return {
    title: 'Help resolve',
    link: holdLink(record.id),
    parties: [record.fromId, record.toId],
    attesters: extras.attesters || [],
    administrator: true,
    autoApprove: false
  };
}

export async function escalateHold(store, record, now, options = {}) {
  const notice = escalationNotice(record, now, options);
  if (!notice) return { ok: true, due: false, autoApproved: autoApprove() };
  const key = `owner:hold:${record.id}`;
  if (await store.get(key)) return { ok: true, due: true, duplicate: true, inbox: true, autoApproved: false };
  let inbox = { ok: true, inbox: true, email: false };
  try {
    inbox = await notifyOwnerInbox(store, {
      title: 'Help resolve',
      link: notice.link,
      detail: `${record.note} ${record.usd} US$ between ${record.fromId} and ${record.toId}.`,
      category: 'Hold',
      kind: 'hold'
    }, { ...options, now });
  } catch {
    inbox = { ok: true, inbox: false, email: false };
  }
  await store.set(key, { at: new Date(now).toISOString() });
  return { ok: true, due: true, inbox: inbox.inbox !== false, email: inbox.email === true, autoApproved: false, notice };
}

export function withdrawEntry(record, handle) {
  if (!record || record.status === 'cleared') return { ok: false, error: 'A cleared entry stays on the book.' };
  if (handle !== record.fromId && handle !== record.toId) return { ok: false, error: 'Either party can withdraw while it is pending.' };
  return { ok: true, record: { ...record, status: 'withdrawn' } };
}
