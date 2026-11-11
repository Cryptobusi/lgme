import { nearDuplicates, countLabel, ATTEST_NEED } from './category-evolve.mjs';
import { notifyOwner } from './develop-want.mjs';
import { DAO_LINE, validateVariant } from './variant-schema.mjs';

export const ADMIN_WINDOW_MS = 72 * 60 * 60 * 1000;
export { DAO_LINE, countLabel, ATTEST_NEED };

const KEY = 'versions:rows';
const NOTICES = 'versions:notices';
const MEMBER = /^[a-z0-9-]{2,32}$/;
const NAME = /^[\p{L}\p{N}][\p{L}\p{N} .,'’-]{1,38}[\p{L}\p{N}]$/u;
const LINE = /^[\p{L}\p{N} .,'’+\-/#()?!]{8,120}$/u;
const MEDICAL = /\b(diagnos\w*|prescription|treatment|cure)\b/i;

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function rowsOf(store) {
  const saved = (await store.get(KEY)) || [];
  return Array.isArray(saved) ? saved : [];
}

async function saveRows(store, rows) {
  await store.set(KEY, rows.slice(-80));
}

function publicProposed(row) {
  const count = (row.attestations || []).length;
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    authorId: row.authorId,
    status: row.status,
    count,
    label: countLabel(count),
    summary: row.summary || [],
    at: row.at
  };
}

function publicCommitted(row) {
  return {
    id: row.id,
    name: row.name,
    purpose: row.purpose,
    authorId: row.authorId,
    status: 'committed',
    variant: row.variant,
    offered: row.offered === true,
    at: row.committedAt || row.at
  };
}

async function tellOwner(store, env, fetchImpl, notice) {
  const prior = (await store.get(NOTICES)) || [];
  const next = [...(Array.isArray(prior) ? prior : []), notice].slice(-40);
  await store.set(NOTICES, next);
  const alert = await notifyOwner(env, notice, { fetchImpl });
  return alert.email === true;
}

async function sweep(store, env, fetchImpl, now) {
  const rows = await rowsOf(store);
  let changed = false;
  for (const row of rows) {
    if (row.status !== 'awaiting-admin' || !row.readyAt) continue;
    if (Date.parse(row.readyAt) + ADMIN_WINDOW_MS > now) continue;
    row.status = 'committed';
    row.committedAt = new Date(now).toISOString();
    changed = true;
    await tellOwner(store, env, fetchImpl, {
      subject: `Version committed: ${row.name}`,
      category: 'Versions',
      title: `Committed after the review window: ${row.name}`,
      at: row.committedAt,
      link: '/versions',
      variant: row.variant,
      versionId: row.id,
      status: 'committed',
      kind: 'version'
    });
  }
  if (changed) await saveRows(store, rows);
  return rows;
}

export async function versionRequest({ method = 'GET', search = '', body = {}, store, env = {}, fetchImpl, now = Date.now(), admin = false } = {}) {
  if (!store) return { status: 500, body: { ok: false, error: 'The version store is not open.' } };
  const rows = await sweep(store, env, fetchImpl, now);
  if (method === 'GET') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    if (params.get('notices') === '1') {
      if (!admin) return { status: 401, body: { ok: false, error: 'The owner inbox needs the admin token.' } };
      const openIds = rows.filter((row) => row.status === 'proposed' || row.status === 'awaiting-admin').map((row) => row.id);
      return { status: 200, body: { ok: true, notices: (await store.get(NOTICES)) || [], openIds, dao: DAO_LINE } };
    }
    const mineId = clean(params.get('mine') || '').toLowerCase();
    const mine = mineId ? rows.filter((row) => row.authorId === mineId) : [];
    return {
      status: 200,
      body: {
        ok: true,
        dao: DAO_LINE,
        windowHours: ADMIN_WINDOW_MS / (60 * 60 * 1000),
        proposed: rows.filter((row) => row.status === 'proposed' || row.status === 'awaiting-admin').map(publicProposed),
        committed: rows.filter((row) => row.status === 'committed').map(publicCommitted),
        offers: rows.filter((row) => row.status === 'committed' && row.offered).map(publicCommitted),
        mine: mine.map((row) => ({ ...publicProposed(row), status: row.status, variant: row.variant, deniedReason: row.deniedReason || '', readyAt: row.readyAt || '' }))
      }
    };
  }
  if (method !== 'POST') return { status: 405, body: { ok: false, error: 'Use GET or POST.' } };
  const action = clean(body.action);
  if (action === 'deny' || action === 'approve') {
    if (!admin) return { status: 401, body: { ok: false, error: 'The owner inbox needs the admin token.' } };
    const row = rows.find((item) => item.id === body.id);
    if (!row || row.status === 'committed' || row.status === 'denied') return { status: 404, body: { ok: false, error: 'That version is not open for review.' } };
    if (action === 'deny') {
      row.status = 'denied';
      row.deniedReason = clean(body.reason).slice(0, 160);
      await saveRows(store, rows);
      await tellOwner(store, env, fetchImpl, {
        subject: `Version denied: ${row.name}`,
        category: 'Versions',
        title: `Denied: ${row.name}`,
        at: new Date(now).toISOString(),
        link: '/owner',
        variant: row.variant,
        versionId: row.id,
        status: 'denied',
        kind: 'version'
      });
      return { status: 200, body: { ok: true, denied: true, proposal: { id: row.id, status: 'denied', deniedReason: row.deniedReason } } };
    }
    row.status = 'committed';
    row.committedAt = new Date(now).toISOString();
    await saveRows(store, rows);
    await tellOwner(store, env, fetchImpl, {
      subject: `Version approved: ${row.name}`,
      category: 'Versions',
      title: `Approved: ${row.name}`,
      at: row.committedAt,
      link: '/versions',
      variant: row.variant,
      versionId: row.id,
      status: 'committed',
      kind: 'version'
    });
    return { status: 200, body: { ok: true, committed: true, version: publicCommitted(row) } };
  }
  const memberId = clean(body.memberId).toLowerCase();
  if (!MEMBER.test(memberId)) return { status: 400, body: { ok: false, error: 'Sign in on this phone first.' } };
  if (action === 'attest') {
    const row = rows.find((item) => item.id === body.id && item.status === 'proposed');
    if (!row) return { status: 404, body: { ok: false, error: 'That version is not open for attestation.' } };
    if (row.authorId === memberId) return { status: 403, body: { ok: false, error: 'The author cannot attest. Ask another member.' } };
    if ((row.attestations || []).some((item) => item.memberId === memberId)) return { status: 409, body: { ok: false, error: 'You already attested.' } };
    row.attestations = [...(row.attestations || []), { memberId, at: new Date(now).toISOString() }];
    let ready = false;
    if (row.attestations.length >= ATTEST_NEED) {
      row.status = 'awaiting-admin';
      row.readyAt = new Date(now).toISOString();
      ready = true;
      await tellOwner(store, env, fetchImpl, {
        subject: `Version ready: ${row.name}`,
        category: 'Versions',
        title: `Ready for review: ${row.name}`,
        at: row.readyAt,
        link: '/owner',
        variant: row.variant,
        versionId: row.id,
        status: 'awaiting-admin',
        kind: 'version'
      });
    }
    await saveRows(store, rows);
    return { status: 200, body: { ok: true, ready, proposal: { ...publicProposed(row), status: row.status, readyAt: row.readyAt || '' } } };
  }
  if (action === 'offer') {
    const row = rows.find((item) => item.id === body.id && item.status === 'committed' && item.authorId === memberId);
    if (!row) return { status: 404, body: { ok: false, error: 'Only the author can offer a committed version.' } };
    row.offered = true;
    await saveRows(store, rows);
    return { status: 200, body: { ok: true, version: publicCommitted(row) } };
  }
  if (action !== 'propose') return { status: 400, body: { ok: false, error: 'Use propose, attest, offer, deny, or approve.' } };
  const name = clean(body.name);
  const purpose = clean(body.purpose);
  if (!NAME.test(name)) return { status: 400, body: { ok: false, error: 'Use a short name.' } };
  if (!LINE.test(purpose)) return { status: 400, body: { ok: false, error: 'Add one short line.' } };
  if (MEDICAL.test(`${name} ${purpose}`)) return { status: 400, body: { ok: false, error: 'Leave medical claims out of this.' } };
  const checked = validateVariant(body.variant);
  if (!checked.ok) return { status: 400, body: { ok: false, error: checked.error } };
  const open = rows.filter((row) => row.status !== 'denied');
  const matches = nearDuplicates(name, open.map((row) => ({ name: row.name, id: row.id }))).map((row) => ({ name: row.name, id: row.id }));
  if (matches.length) return { status: 409, body: { ok: false, error: 'That is close to an existing version.', matches } };
  const at = new Date(now).toISOString();
  const row = {
    id: `ver-${now.toString(36)}`,
    name,
    purpose,
    authorId: memberId,
    variant: checked.variant,
    summary: Array.isArray(body.summary) ? body.summary.map((line) => clean(line)).filter(Boolean).slice(0, 12) : [],
    status: 'proposed',
    attestations: [],
    at
  };
  rows.push(row);
  await saveRows(store, rows);
  await tellOwner(store, env, fetchImpl, {
    subject: `Version proposed: ${name}`,
    category: 'Versions',
    title: `Proposed version: ${name}`,
    at,
    link: '/owner',
    variant: row.variant,
    versionId: row.id,
    status: 'proposed',
    kind: 'version'
  });
  return { status: 200, body: { ok: true, notified: true, proposal: publicProposed(row) } };
}
