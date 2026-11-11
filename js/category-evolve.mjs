import { CATEGORIES } from './category-help.mjs';
import { notifyOwner } from './develop-want.mjs';

export const ATTEST_NEED = 3;
export const ACTIONS = Object.freeze([
  { id: 'ididit', name: 'IdidIt (verified receipt)', aria: 'IdidIt, verified receipt' },
  { id: 'iwantit', name: 'IwantIT', aria: 'IwantIT, ask for a deed' },
  { id: 'ihavit', name: 'IhavIT', aria: 'IhavIT, offer a deed' }
]);

const MEDICAL = /\b(diagnos\w*|prescription|treatment|cure)\b/i;
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .,'’-]{1,38}[\p{L}\p{N}]$/u;
const LINE = /^[\p{L}\p{N} .,'’+\-/#()?!]{8,120}$/u;
const MEMBER = /^[a-z0-9-]{2,32}$/;
const KEY = 'categories:proposals';
const NOTICES = 'categories:notices';
const HOUR_MS = 60 * 60 * 1000;

export function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function similarity(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return 0;
  if (left === right || left.includes(right) || right.includes(left)) return 1;
  const grams = (text) => {
    const padded = ` ${text} `;
    const bag = [];
    for (let i = 0; i < padded.length - 1; i += 1) bag.push(padded.slice(i, i + 2));
    return bag;
  };
  const one = grams(left);
  const two = grams(right);
  const counts = new Map();
  for (const gram of one) counts.set(gram, (counts.get(gram) || 0) + 1);
  let overlap = 0;
  for (const gram of two) {
    const n = counts.get(gram) || 0;
    if (!n) continue;
    overlap += 1;
    counts.set(gram, n - 1);
  }
  return (2 * overlap) / (one.length + two.length);
}

export function nearDuplicates(name, rows, threshold = 0.45) {
  const needle = normalizeName(name);
  if (needle.length < 3) return [];
  return (rows || []).filter((row) => {
    const other = normalizeName(row.name || row);
    return other && similarity(needle, other) >= threshold;
  });
}

export function countLabel(count) {
  const shown = Math.max(0, Math.min(ATTEST_NEED, Number(count) || 0));
  return `${shown} of ${ATTEST_NEED}`;
}

export function builtInNames(kind, category) {
  if (kind === 'listing') return ACTIONS.map((item) => ({ name: item.name, id: item.id, kind: 'listing' }));
  return CATEGORIES.map((item) => ({ name: item.name, id: item.id, kind: 'category' }));
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function publicRow(row) {
  const count = (row.attestations || []).length;
  return {
    id: row.id,
    kind: row.kind,
    category: row.category || '',
    name: row.name,
    description: row.description,
    status: row.status,
    count,
    label: row.status === 'promoted' ? 'Early / In development' : countLabel(count),
    proposerId: row.proposerId,
    at: row.at
  };
}

async function rowsOf(store) {
  const saved = (await store.get(KEY)) || [];
  return Array.isArray(saved) ? saved : [];
}

async function saveRows(store, rows) {
  await store.set(KEY, rows.slice(-80));
}

async function rememberNotice(store, notice) {
  const prior = (await store.get(NOTICES)) || [];
  const next = [...(Array.isArray(prior) ? prior : []), notice].slice(-40);
  await store.set(NOTICES, next);
  return next;
}

function badText(name, description) {
  const text = `${name} ${description}`;
  if (MEDICAL.test(text)) return 'Leave medical claims out of this.';
  if (/@|mailto:|https?:|\$trust/i.test(text)) return 'Leave out addresses, links, and $Trust.';
  return '';
}

export async function categoryRequest({ method = 'GET', search = '', body = {}, store, env = {}, fetchImpl, now = Date.now(), admin = false } = {}) {
  if (!store) return { status: 500, body: { ok: false, error: 'The proposal store is not open.' } };
  if (method === 'GET') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    if (params.get('notices') === '1') {
      if (!admin) return { status: 401, body: { ok: false, error: 'The owner inbox needs the admin token.' } };
      const notices = (await store.get(NOTICES)) || [];
      return { status: 200, body: { ok: true, notices } };
    }
    const rows = await rowsOf(store);
    return { status: 200, body: { ok: true, proposals: rows.map(publicRow), categories: CATEGORIES.map((item) => ({ id: item.id, name: item.name, href: item.href, badge: item.badge })) } };
  }
  if (method !== 'POST') return { status: 405, body: { ok: false, error: 'Use GET or POST.' } };
  const action = clean(body.action);
  const memberId = clean(body.memberId).toLowerCase();
  if (!MEMBER.test(memberId)) return { status: 400, body: { ok: false, error: 'Sign in on this phone first.' } };
  const rows = await rowsOf(store);
  if (action === 'attest') {
    const row = rows.find((item) => item.id === body.id);
    if (!row || row.status === 'promoted') return { status: 404, body: { ok: false, error: 'That proposal is not open.' } };
    if (row.proposerId === memberId) return { status: 403, body: { ok: false, error: 'The proposer cannot attest. Ask another member.' } };
    if ((row.attestations || []).some((item) => item.memberId === memberId)) return { status: 409, body: { ok: false, error: 'You already attested.' } };
    row.attestations = [...(row.attestations || []), { memberId, at: new Date(now).toISOString() }];
    let promoted = false;
    if (row.attestations.length >= ATTEST_NEED) {
      row.status = 'promoted';
      promoted = true;
      const notice = { title: `Promoted: ${row.name}`, category: row.kind === 'listing' ? row.category : row.name, at: row.attestations.at(-1).at, link: '/gym#category-board' };
      await rememberNotice(store, notice);
      await notifyOwner(env, notice, { fetchImpl });
    }
    await saveRows(store, rows);
    return { status: 200, body: { ok: true, promoted, proposal: publicRow(row) } };
  }
  if (action !== 'propose') return { status: 400, body: { ok: false, error: 'Use propose or attest.' } };
  const kind = body.kind === 'listing' ? 'listing' : 'category';
  const name = clean(body.name);
  const description = clean(body.description);
  const category = clean(body.category);
  if (!NAME.test(name)) return { status: 400, body: { ok: false, error: 'Use a short name.' } };
  if (!LINE.test(description)) return { status: 400, body: { ok: false, error: 'Add one short line.' } };
  const blocked = badText(name, description);
  if (blocked) return { status: 400, body: { ok: false, error: blocked } };
  if (kind === 'listing' && !CATEGORIES.some((item) => item.id === category || item.name.toLowerCase() === category.toLowerCase())) {
    return { status: 400, body: { ok: false, error: 'Pick a category first.' } };
  }
  const stamps = ((await store.get(`categories:rate:${memberId}`)) || []).filter((stamp) => now - stamp < HOUR_MS);
  if (stamps.length >= 8) return { status: 429, body: { ok: false, error: 'Too many proposals. Nothing was saved.' } };
  const scope = rows.filter((row) => row.kind === kind && (kind === 'category' || row.category === category));
  const known = [...builtInNames(kind, category), ...scope.map((row) => ({ name: row.name, id: row.id, kind }))];
  const matches = nearDuplicates(name, known).map((row) => ({ name: row.name, id: row.id, kind: row.kind || kind }));
  if (matches.length) return { status: 409, body: { ok: false, error: 'That is close to an existing one.', matches } };
  const at = new Date(now).toISOString();
  const row = {
    id: `prop-${now.toString(36)}`,
    kind,
    category: kind === 'listing' ? category : '',
    name,
    description,
    proposerId: memberId,
    status: 'proposed',
    attestations: [],
    at
  };
  rows.push(row);
  await saveRows(store, rows);
  await store.set(`categories:rate:${memberId}`, [...stamps, now].slice(-8));
  const notice = { title: `Proposed: ${name}`, category: kind === 'listing' ? category : name, at, link: '/gym#category-board' };
  await rememberNotice(store, notice);
  const alert = await notifyOwner(env, { ...notice, title: name }, { fetchImpl });
  return { status: 200, body: { ok: true, notified: true, emailed: alert.email === true, proposal: publicRow(row) } };
}
