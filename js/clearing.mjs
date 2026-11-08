export const CLEARING_EPOCH = '2026-01-01T00:00:00.000Z';
export const CLEARING_WINDOW_DAYS = 7;

export function clearingRules(rules = {}) {
  const days = Number(rules.windowDays ?? rules.holdDays ?? CLEARING_WINDOW_DAYS);
  const windowDays = Number.isFinite(days) && days > 0 ? Math.round(days) : CLEARING_WINDOW_DAYS;
  return { windowDays, epoch: rules.epoch || CLEARING_EPOCH };
}

export function clearingWindow(at = new Date().toISOString(), rules = {}) {
  const { windowDays, epoch } = clearingRules(rules);
  const start0 = Date.parse(epoch);
  const now = Date.parse(at);
  const span = windowDays * 86400000;
  const index = Number.isFinite(now) ? Math.floor((now - start0) / span) : 0;
  const opens = start0 + index * span;
  return {
    windowId: `w${index}`,
    index,
    opensAt: new Date(opens).toISOString(),
    closesAt: new Date(opens + span).toISOString(),
    windowDays,
    epoch,
    remainingMs: Math.max(0, opens + span - now)
  };
}

export function nextWindow(window) {
  const span = window.windowDays * 86400000;
  const opens = Date.parse(window.closesAt);
  return {
    windowId: `w${window.index + 1}`,
    index: window.index + 1,
    opensAt: new Date(opens).toISOString(),
    closesAt: new Date(opens + span).toISOString(),
    windowDays: window.windowDays,
    epoch: window.epoch,
    remainingMs: span
  };
}

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function bilateralNet(ious) {
  const groups = new Map();
  for (const iou of ious || []) {
    if (!iou || iou.status !== 'attested' || iou.closed || iou.netted) continue;
    if (!iou.debtorId || !iou.creditorId || iou.debtorId === iou.creditorId) continue;
    const key = [iou.debtorId, iou.creditorId].sort().join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(iou);
  }
  const nets = [];
  for (const group of groups.values()) {
    const left = group[0].debtorId < group[0].creditorId ? group[0].debtorId : group[0].creditorId;
    const right = left === group[0].debtorId ? group[0].creditorId : group[0].debtorId;
    let forward = 0;
    let back = 0;
    for (const iou of group) {
      if (iou.debtorId === left && iou.creditorId === right) forward = round2(forward + Number(iou.amount));
      if (iou.debtorId === right && iou.creditorId === left) back = round2(back + Number(iou.amount));
    }
    const offset = round2(Math.min(forward, back));
    const residual = round2(Math.abs(forward - back));
    const debtorId = forward >= back ? left : right;
    const creditorId = debtorId === left ? right : left;
    if (offset <= 0 && residual <= 0) continue;
    nets.push({
      shape: 'bilateral',
      debtorId: residual > 0 ? debtorId : left,
      creditorId: residual > 0 ? creditorId : right,
      offset,
      residual,
      iouIds: group.map((iou) => iou.iouId).filter(Boolean)
    });
  }
  return nets;
}

export function cycleNetStub(legs) {
  const rows = (legs || []).map((leg) => ({
    debtorId: String(leg.debtorId || ''),
    creditorId: String(leg.creditorId || ''),
    amount: round2(leg.amount)
  }));
  const parties = [...new Set(rows.flatMap((leg) => [leg.debtorId, leg.creditorId]).filter(Boolean))];
  return {
    ok: true,
    shape: 'cycle',
    kind: 'cycle',
    parties,
    legs: rows,
    ready: false,
    appliesAt: 'window-close',
    note: 'A 3-party cycle is stored for a later window close. It is not settled here.'
  };
}

function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
}

async function sha256(message) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPair(left, right) {
  return sha256(canonicalJSON({ left, right }));
}

export async function merkleRootOf(leaves) {
  const level = (leaves || []).slice();
  if (!level.length) return sha256(canonicalJSON({ empty: true }));
  let row = level;
  while (row.length > 1) {
    const next = [];
    for (let i = 0; i < row.length; i += 2) next.push(await hashPair(row[i], row[i + 1] ?? row[i]));
    row = next;
  }
  return row[0];
}

export async function merkleProofFor(leaves, index) {
  if (!Number.isInteger(index) || index < 0 || index >= (leaves || []).length) return null;
  const path = [];
  let row = leaves.slice();
  let idx = index;
  while (row.length > 1) {
    const siblingIndex = idx ^ 1;
    const missing = siblingIndex >= row.length;
    path.push({ hash: row[missing ? idx : siblingIndex], side: missing || siblingIndex > idx ? 'right' : 'left' });
    const next = [];
    for (let i = 0; i < row.length; i += 2) next.push(await hashPair(row[i], row[i + 1] ?? row[i]));
    idx = Math.floor(idx / 2);
    row = next;
  }
  return { index, leaf: leaves[index], root: row[0], path };
}

export async function verifyMerkleProof(proof) {
  if (!proof || typeof proof.leaf !== 'string' || typeof proof.root !== 'string' || !Array.isArray(proof.path)) return false;
  let acc = proof.leaf;
  for (const step of proof.path) {
    if (!step || typeof step.hash !== 'string') return false;
    acc = step.side === 'left' ? await hashPair(step.hash, acc) : await hashPair(acc, step.hash);
  }
  return acc === proof.root;
}

export function dayEntries(tape, day) {
  return (tape || []).filter((entry) => String(entry.at || '').slice(0, 10) === day);
}

export function windowEntries(tape, window, at) {
  const open = Date.parse(window.opensAt);
  const end = Date.parse(at || window.closesAt);
  return (tape || []).filter((entry) => {
    const t = Date.parse(entry.at);
    return Number.isFinite(t) && t >= open && t <= end;
  });
}
