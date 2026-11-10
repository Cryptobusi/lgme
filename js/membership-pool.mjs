import { sha256Hex } from './device-sign.mjs';
import { ATTESTATION_NOTE, addAttestation, evaluateHold, rememberRow } from './high-value.mjs';
import { PRICE_UNAVAILABLE, lgmeForUsd, withinPeg } from './lgme-price.mjs';
import { LISTINGS_OPERATOR, LISTINGS_TOPIC } from './exchange-listing.mjs';
import { SETUP_ADDRESS, SETUP_MINT, confirmSetupTransfer } from './setup-fee.mjs';
import { buildTransferRequest } from './solana-pay.mjs';

export const POOL_TITLE = 'Membership fee pool: donate or use';
export const POOL_ID = 'membership-fee-pool';
export const POOL_MEMO = 'Membership fee pool';
export const POOL_USD = 1;
export const POOL_ADDRESS = SETUP_ADDRESS;
export const POOL_MINT = SETUP_MINT;

const HANDLE = /^[a-z0-9-]{1,32}$/;

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function cleanHandle(handle) {
  return String(handle || '').trim().toLowerCase();
}

export function emptyPool() {
  return {
    inUsd: 0,
    outUsd: 0,
    sponsorsWaiting: 0,
    covered: {},
    spent: {},
    holds: [],
    pending: [],
    hashes: []
  };
}

export function clonePool(pool) {
  return {
    inUsd: Number(pool?.inUsd) || 0,
    outUsd: Number(pool?.outUsd) || 0,
    sponsorsWaiting: Number(pool?.sponsorsWaiting) || 0,
    covered: { ...(pool?.covered || {}) },
    spent: { ...(pool?.spent || {}) },
    holds: [...(pool?.holds || [])],
    pending: [...(pool?.pending || [])],
    hashes: [...(pool?.hashes || [])]
  };
}

export function poolAvailable(pool) {
  return round2((Number(pool?.inUsd) || 0) - (Number(pool?.outUsd) || 0));
}

export function poolCovers(pool) {
  const available = poolAvailable(pool);
  return available > 0 ? Math.floor(available + 1e-9) : 0;
}

export function poolView(pool) {
  return {
    title: POOL_TITLE,
    inUsd: round2(pool?.inUsd),
    outUsd: round2(pool?.outUsd),
    covers: poolCovers(pool),
    offers: Number(pool?.sponsorsWaiting) || 0,
    anonymous: true
  };
}

export async function memberMark(handle) {
  return sha256Hex(`lgme-pool:${cleanHandle(handle)}`);
}

export async function entryHash(entry) {
  return sha256Hex(JSON.stringify({
    kind: entry.kind,
    usd: round2(entry.usd),
    at: entry.at,
    nonce: entry.nonce
  }));
}

function creditLeft(pool, mark, credit) {
  return round2(credit - (Number(pool.spent?.[mark]) || 0));
}

function rememberSpend(pool, mark, amount) {
  pool.spent[mark] = round2((Number(pool.spent[mark]) || 0) + amount);
}

export function publicPoolMessage(pool, hash) {
  const view = poolView(pool);
  return {
    v: 1,
    network: 'testnet',
    kind: 'pool',
    category: 'exchange',
    id: POOL_ID,
    title: POOL_TITLE,
    pinned: true,
    hash,
    inUsd: view.inUsd,
    outUsd: view.outUsd,
    covers: view.covers,
    offers: view.offers,
    topic: LISTINGS_TOPIC,
    payer: LISTINGS_OPERATOR
  };
}

export function poolPayLink(price, usd = POOL_USD, reference) {
  const amount = lgmeForUsd(usd, price);
  if (!(amount > 0)) return { ok: false, error: PRICE_UNAVAILABLE };
  const link = buildTransferRequest({
    recipient: POOL_ADDRESS,
    amount,
    reference,
    label: POOL_MEMO,
    message: POOL_MEMO
  });
  if (!link.ok) return link;
  return { ok: true, url: link.url, amount, usd: round2(usd), recipient: POOL_ADDRESS, mint: POOL_MINT };
}

function quotedLgme(usd, price) {
  const amount = lgmeForUsd(usd, price);
  return amount > 0 ? amount : 0;
}

async function creditGift(pool, spec, kind) {
  const handle = cleanHandle(spec.handle);
  if (!HANDLE.test(handle)) return { ok: false, error: 'Use a short handle.' };
  const at = String(spec.at || '');
  const nonce = String(spec.nonce || '');
  if (!at || !nonce) return { ok: false, error: 'The entry needs a time and a nonce.' };
  const amount = round2(spec.amount);
  const credit = round2(spec.credit);
  if (!(amount > 0)) return { ok: false, error: 'Enter credit greater than zero.' };
  if (!(credit > 0)) return { ok: false, error: 'Credit on this phone does not cover that amount.' };
  const mark = await memberMark(handle);
  if (creditLeft(pool, mark, credit) + 1e-9 < amount) {
    return { ok: false, error: 'Credit on this phone does not cover that amount.' };
  }
  const hash = await entryHash({ kind, usd: amount, at, nonce });
  if (pool.hashes.includes(hash) || (pool.pending || []).some((row) => row.hash === hash)) {
    return { ok: true, duplicate: true, hash, pool: clonePool(pool), view: poolView(pool) };
  }
  const hold = evaluateHold(pool.holds || [], {
    id: hash,
    kind: 'usd',
    amount,
    fromId: mark,
    toId: 'membership-pool',
    at
  });
  if (!hold.ok) return hold;
  const next = clonePool(pool);
  rememberSpend(next, mark, amount);
  if (hold.needed) {
    next.holds = rememberRow(next.holds, hold.record);
    next.pending = [...next.pending, { hash, usd: amount, at, kind }];
    return { ok: true, pending: true, note: ATTESTATION_NOTE, hash, pool: next, view: poolView(next) };
  }
  next.inUsd = round2(next.inUsd + (kind === 'credit' ? amount : 0));
  next.hashes = [...next.hashes, hash];
  return { ok: true, pending: false, hash, pool: next, view: poolView(next), kind };
}

export async function donateCredit(pool, spec = {}) {
  const given = await creditGift(clonePool(pool), spec, 'credit');
  if (!given.ok || given.pending || given.duplicate) return given;
  return given;
}

export async function helpNext(pool, spec = {}) {
  const handle = cleanHandle(spec.handle);
  if (!HANDLE.test(handle)) return { ok: false, error: 'Use a short handle.' };
  const at = String(spec.at || '');
  const nonce = String(spec.nonce || '');
  if (!at || !nonce) return { ok: false, error: 'The entry needs a time and a nonce.' };
  const credit = round2(spec.credit);
  const mark = await memberMark(handle);
  const next = clonePool(pool);
  if (creditLeft(next, mark, credit) + 1e-9 < POOL_USD) {
    return { ok: false, error: 'Credit on this phone does not cover the next fee.' };
  }
  const hash = await entryHash({ kind: 'sponsor', usd: POOL_USD, at, nonce });
  if (next.hashes.includes(hash)) return { ok: true, duplicate: true, hash, pool: next, view: poolView(next) };
  rememberSpend(next, mark, POOL_USD);
  next.sponsorsWaiting += 1;
  next.hashes = [...next.hashes, hash];
  return { ok: true, hash, pool: next, view: poolView(next), label: 'Help the next member' };
}

export async function donateLgme(pool, spec = {}) {
  const handle = cleanHandle(spec.handle);
  if (!HANDLE.test(handle)) return { ok: false, error: 'Use a short handle.' };
  const at = String(spec.at || '');
  const nonce = String(spec.nonce || '');
  if (!at || !nonce) return { ok: false, error: 'The entry needs a time and a nonce.' };
  const usd = round2(spec.usd);
  const price = Number(spec.price);
  if (!(usd > 0) || !(price > 0)) return { ok: false, error: PRICE_UNAVAILABLE };
  const quote = quotedLgme(usd, price);
  if (!(quote > 0)) return { ok: false, error: PRICE_UNAVAILABLE };
  let confirmed = spec.confirmation;
  if (!confirmed && spec.tx) {
    confirmed = confirmSetupTransfer(spec.tx, {
      recipient: POOL_ADDRESS,
      mint: POOL_MINT,
      amount: quote,
      tolerance: 0.02,
      reference: spec.reference
    });
  }
  if (!confirmed?.ok) return confirmed?.ok === false ? confirmed : { ok: false, error: 'The payment was not confirmed.' };
  if (!withinPeg(confirmed.delta, quote, 0.02)) {
    return { ok: false, error: 'The amount is outside the locked quote.' };
  }
  const hash = await entryHash({ kind: 'lgme', usd, at, nonce });
  const next = clonePool(pool);
  if (next.hashes.includes(hash) || next.pending.some((row) => row.hash === hash)) {
    return { ok: true, duplicate: true, hash, pool: next, view: poolView(next) };
  }
  const mark = await memberMark(handle);
  const hold = evaluateHold(next.holds, {
    id: hash,
    kind: 'usd',
    amount: usd,
    fromId: mark,
    toId: 'membership-pool',
    at
  });
  if (!hold.ok) return hold;
  if (hold.needed) {
    next.holds = rememberRow(next.holds, hold.record);
    next.pending = [...next.pending, { hash, usd, at, kind: 'lgme' }];
    next.hashes = [...next.hashes, hash];
    return { ok: true, pending: true, note: ATTESTATION_NOTE, hash, pool: next, view: poolView(next) };
  }
  next.inUsd = round2(next.inUsd + usd);
  next.hashes = [...next.hashes, hash];
  return { ok: true, pending: false, hash, pool: next, view: poolView(next) };
}

async function takeCover(pool, spec, mode) {
  const handle = cleanHandle(spec.handle);
  if (!HANDLE.test(handle)) return { ok: false, error: 'Use a short handle.' };
  const at = String(spec.at || '');
  const nonce = String(spec.nonce || '');
  if (!at || !nonce) return { ok: false, error: 'The entry needs a time and a nonce.' };
  const mark = await memberMark(handle);
  const next = clonePool(pool);
  if (next.covered[mark]) return { ok: false, error: 'This member already used the pool.' };
  if (mode === 'pool' && poolCovers(next) < 1) {
    return { ok: false, error: 'The pool cannot cover a setup fee right now.' };
  }
  if (mode === 'sponsor' && next.sponsorsWaiting < 1) {
    return { ok: false, error: 'No direct cover is waiting.' };
  }
  const hash = await entryHash({ kind: mode === 'pool' ? 'draw' : 'accept', usd: POOL_USD, at, nonce });
  if (next.hashes.includes(hash)) return { ok: true, duplicate: true, hash, pool: next, view: poolView(next) };
  if (mode === 'pool') next.outUsd = round2(next.outUsd + POOL_USD);
  else next.sponsorsWaiting -= 1;
  next.covered[mark] = mode;
  next.hashes = [...next.hashes, hash];
  return { ok: true, hash, pool: next, view: poolView(next), covered: true };
}

export function drawPool(pool, spec = {}) {
  return takeCover(pool, spec, 'pool');
}

export function acceptSponsor(pool, spec = {}) {
  return takeCover(pool, spec, 'sponsor');
}

export async function attestPoolDonation(pool, spec = {}) {
  const hash = String(spec.entryId || '');
  const pending = (pool?.pending || []).find((row) => row.hash === hash);
  const record = (pool?.holds || []).find((row) => row.id === hash);
  if (!pending || !record) return { ok: false, error: 'That donation is not pending.' };
  const added = await addAttestation(record, spec);
  if (!added.ok) return added;
  const next = clonePool(pool);
  if (!added.ready) {
    next.holds = rememberRow(next.holds, added.record);
    return { ok: true, pending: true, note: ATTESTATION_NOTE, hash, pool: next, view: poolView(next) };
  }
  const cleared = { ...added.record, status: 'cleared' };
  next.holds = rememberRow(next.holds, cleared);
  next.pending = next.pending.filter((row) => row.hash !== hash);
  if (!next.hashes.includes(hash)) next.hashes.push(hash);
  next.inUsd = round2(next.inUsd + pending.usd);
  return { ok: true, pending: false, hash, pool: next, view: poolView(next) };
}

export async function applyPoolAction(pool, payload = {}, confirmation) {
  if (payload.action === 'pool-credit') return donateCredit(pool, payload);
  if (payload.action === 'pool-lgme') return donateLgme(pool, { ...payload, confirmation });
  if (payload.action === 'pool-sponsor') return helpNext(pool, payload);
  if (payload.action === 'pool-draw') return drawPool(pool, payload);
  if (payload.action === 'pool-accept') return acceptSponsor(pool, payload);
  if (payload.action === 'pool-attest') return attestPoolDonation(pool, { ...payload, sig: payload.sig || payload.attestSig });
  return { ok: false, error: 'That pool action is not available.' };
}

export function poolLedgerEntry(spec = {}) {
  return {
    type: 'POOL',
    payload: {
      kind: spec.kind || '',
      usd: round2(spec.usd),
      hash: spec.hash || '',
      anonymous: true,
      custodial: false,
      covered: spec.kind === 'draw' || spec.kind === 'accept'
    }
  };
}
