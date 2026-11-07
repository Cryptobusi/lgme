/**
 * Peer-to-peer mutual-credit simulation.
 * Each peer's book lives only in that peer's own store key.
 * Signing is local ECDSA. Links are SHA-256. Nothing here opens a network.
 */

import { ACK_MS, CO_SIGN_ABOVE, FORK, OFFLINE_SPEND, REPLAY, STALE_ACK, ackFresh, assertOnline, coSignReason, expiryFrom, fraudPenalty, handoffToken, passphraseReason } from './p2p-sim-guard.mjs';

export const GENESIS = '0'.repeat(64);
export { ACK_MS, CO_SIGN_ABOVE, OFFLINE_SPEND, handoffToken };
export const FLOOR_BLOCK = 'Blocked: Floor stays senior';
export const PEER_PREFIX = 'lgme-sim:peer:';

export const DEMO_OPENING = Object.freeze({
  alice: Object.freeze({ name: 'Alice (Providore)', balance: 120, creditLimit: -500, floor: 40, floorNote: 'food/rent' }),
  bob: Object.freeze({ name: 'Bob (Agronomist)', balance: 80, creditLimit: -300, floor: 50, floorNote: 'food/rent' }),
  charlie: Object.freeze({ name: 'Charlie (Logistics)', balance: 70, creditLimit: -400, floor: 45, floorNote: 'food/rent' })
});

export const MOCK_GRANT = 100;
export const UNVERIFIED_SEND_LIMIT = 20;
export const REWARD_RATE = 0.02;
export const REWARD_CAP = 5;
export const REWARD_PERIOD_DAYS = 30;
export const LISTING_DAYS = 14;
export const LISTING_KINDS = Object.freeze(['ihavIT', 'IwanIT', 'IprovIT']);
export const TERM_MONTHS = Object.freeze([3, 4, 5, 6]);
export const OFFERUP_CAVEAT = 'Third-party listing on OfferUp, not verified by lgme. Price and availability may have changed. Deal is between you and the seller.';
export const DONATION_THANKS = 'THANK YOU FOR YOUR SUPPORT.';
export const STANDING_DONATION = Object.freeze({
  title: 'Donation — soBeIT',
  description: 'help grow n floor, thank you.',
  href: '/lgme-coin',
  action: 'Receive / send $lgme',
  kinds: Object.freeze(['ihavIT', 'IwanIT']),
  photo: '/icons/icon-512.png'
});
export const STANDING_WANTED = Object.freeze({
  title: 'Wanted: working treadmill and elliptical, under $500 total budget, Washington DC area',
  description: 'Cash, terms over 3 to 6 months, or $lgme services (IprovIT). SIMULATION. In-app $lgme stays simulated.',
  href: '',
  action: 'Wanted',
  kinds: Object.freeze(['IwanIT']),
  photo: '/icons/icon-512.png',
  payments: Object.freeze(['Cash', 'Terms over 3 to 6 months', '$lgme services (IprovIT)'])
});
export const STANDING_REPAIR = Object.freeze({
  title: 'Wanted: exercise equipment repair/service (treadmill, elliptical), Washington DC area',
  description: 'SIMULATION. In-app $lgme stays simulated. A Thumbtack pro is not affiliated with this desk.',
  href: '',
  action: 'Wanted',
  kinds: Object.freeze(['IwanIT']),
  photo: '/icons/icon-512.png',
  payments: Object.freeze(['Cash', 'Terms over 3 to 6 months', '$lgme services (IprovIT)'])
});
export const WANTED_STATUSES = Object.freeze(['Available', 'Pending reply', 'Offer made', 'Closed']);
export const TAILORED_AWAITING = 'Draft, awaiting approval';
export const THUMBTACK_CAVEAT = 'Third-party pro on Thumbtack, not verified by lgme';
export const INVITE_URL = 'https://lgme.app/p2p-exchange-sim';
export const KDF_ITERATIONS = 100000;

export function layoutMode({ width, coarse = false, uaMobile = false } = {}) {
  const w = Number(width);
  if (w <= 767) return 'phone';
  if (coarse && w <= 1023) return 'phone';
  if (uaMobile && coarse && w <= 1023) return 'phone';
  return 'desk';
}
const MESSAGE_KINDS = new Set(['proposal', 'countersign', 'refusal', 'transfer', 'attestation', 'iou', 'tape', 'handoff', 'chat', 'chat-match', 'invoice', 'offer']);

export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => JSON.stringify(key) + ':' + canonicalJSON(value[key])).join(',') + '}';
}

export function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function nowIso() {
  return new Date().toISOString();
}

export async function sha256(message) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(digest));
}

async function importPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

async function importPublic(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}

export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  return {
    publicKeyJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
    privateKeyJwk: await crypto.subtle.exportKey('jwk', pair.privateKey)
  };
}

export async function signText(material, text) {
  const key = material instanceof CryptoKey ? material : await importPrivate(material);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(text)
  );
  return bytesToHex(new Uint8Array(sig));
}

export async function verifyText(publicKeyJwk, text, sigHex) {
  try {
    if (!publicKeyJwk || !sigHex || !/^[0-9a-f]+$/i.test(sigHex) || sigHex.length % 2 !== 0) return false;
    const key = await importPublic(publicKeyJwk);
    const raw = new Uint8Array(sigHex.length / 2);
    for (let i = 0; i < raw.length; i++) raw[i] = parseInt(sigHex.slice(i * 2, i * 2 + 2), 16);
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      raw,
      new TextEncoder().encode(text)
    );
  } catch {
    return false;
  }
}

export function createMemoryStore() {
  const map = new Map();
  return {
    async get(id) {
      return map.has(id) ? structuredClone(map.get(id)) : null;
    },
    async set(id, value) {
      map.set(id, structuredClone(value));
    },
    async remove(id) {
      map.delete(id);
    },
    async listIds() {
      return [...map.keys()];
    },
    async clear() {
      map.clear();
    }
  };
}

export function createLocalStorageStore(storage = globalThis.localStorage) {
  return {
    async get(id) {
      const raw = storage.getItem(PEER_PREFIX + id);
      return raw ? JSON.parse(raw) : null;
    },
    async set(id, value) {
      storage.setItem(PEER_PREFIX + id, JSON.stringify(value));
    },
    async remove(id) {
      storage.removeItem(PEER_PREFIX + id);
    },
    async listIds() {
      const ids = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(PEER_PREFIX)) ids.push(key.slice(PEER_PREFIX.length));
      }
      return ids;
    },
    async clear() {
      const keys = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(PEER_PREFIX)) keys.push(key);
      }
      keys.forEach((key) => storage.removeItem(key));
    }
  };
}

export function slugPeerId(name, existing) {
  const base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'peer';
  let id = base;
  let n = 2;
  const taken = new Set(existing);
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

function fail(error) {
  return { ok: false, error };
}

export function terms(peer) {
  const genesis = (peer.tape || []).find((entry) => entry.type === 'genesis');
  if (!genesis) {
    return {
      name: peer.name,
      balance: peer.opening?.balance ?? 0,
      floor: peer.opening?.floor ?? 0,
      creditLimit: peer.opening?.creditLimit ?? 0,
      floorNote: peer.opening?.floorNote || 'food/rent'
    };
  }
  return {
    name: genesis.payload.name,
    balance: genesis.payload.balance,
    floor: round2(genesis.payload.floor + fraudPenalty(peer)),
    creditLimit: genesis.payload.creditLimit,
    floorNote: genesis.payload.floorNote
  };
}

export function applyLegs(balance, peerId, legs) {
  let next = balance;
  let debit = 0;
  let credit = 0;
  for (const leg of legs || []) {
    if (leg.debtorId === peerId) {
      next = round2(next - leg.amount);
      debit = round2(debit + leg.amount);
    }
    if (leg.creditorId === peerId) {
      next = round2(next + leg.amount);
      credit = round2(credit + leg.amount);
    }
  }
  return { balance: next, debit, credit };
}

export function applyTransfer(balance, peerId, payload) {
  let next = balance;
  let debit = 0;
  let credit = 0;
  const amount = round2(payload.amount);
  if (!Number.isFinite(amount)) return { balance, debit, credit };
  if (payload.fromId === peerId && payload.direction !== 'in') {
    next = round2(next - amount);
    debit = amount;
  }
  if (payload.toId === peerId && payload.direction !== 'out') {
    next = round2(next + amount);
    credit = amount;
  }
  return { balance: next, debit, credit };
}

export function replay(peer) {
  let balance = 0;
  let credits = 0;
  let debits = 0;
  const rows = [];
  for (const entry of peer.tape || []) {
    let debit = 0;
    let credit = 0;
    if (entry.type === 'genesis') {
      balance = round2(entry.payload.balance);
    } else if (entry.type === 'settlement') {
      const applied = applyLegs(balance, peer.id, entry.payload.legs || []);
      debit = applied.debit;
      credit = applied.credit;
      balance = applied.balance;
      debits = round2(debits + debit);
      credits = round2(credits + credit);
    } else if (entry.type === 'transfer') {
      const moved = applyTransfer(balance, peer.id, entry.payload || {});
      debit = moved.debit;
      credit = moved.credit;
      balance = moved.balance;
      debits = round2(debits + debit);
      credits = round2(credits + credit);
    } else if (entry.type === 'attested') {
      const applied = applyLegs(balance, peer.id, [entry.payload || {}]);
      debit = applied.debit;
      credit = applied.credit;
      balance = applied.balance;
      debits = round2(debits + debit);
      credits = round2(credits + credit);
    } else if (entry.type === 'REWARD') {
      const amount = round2(entry.payload?.amount || 0);
      if (Number.isFinite(amount) && amount > 0) {
        credit = amount;
        balance = round2(balance + amount);
        credits = round2(credits + credit);
      }
    } else if (entry.type === 'GRANT' && entry.payload?.role !== 'grantor' && entry.payload?.memberId === peer.id) {
      const amount = round2(entry.payload?.amount || 0);
      if (Number.isFinite(amount) && amount > 0) {
        credit = amount;
        balance = round2(balance + amount);
        credits = round2(credits + credit);
      }
    }
    rows.push({
      index: entry.index,
      at: entry.at,
      type: entry.type,
      debit,
      credit,
      balance,
      hash: entry.hash,
      prev: entry.prev,
      payload: entry.payload
    });
  }
  return { balance, credits, debits, rows };
}

export function floorBlockReason(peer, nextBalance) {
  const current = replay(peer).balance;
  const { floor, creditLimit } = terms(peer);
  const lowered = nextBalance < current - 1e-9;
  if (!lowered) return '';
  if (nextBalance < floor - 1e-9 || nextBalance < creditLimit - 1e-9) return FLOOR_BLOCK;
  return '';
}

export function coreOf(exchange) {
  return {
    simulated: true,
    kind: exchange.kind,
    proposerId: exchange.proposerId,
    thirdSeatId: exchange.thirdSeatId,
    charge: exchange.charge,
    legs: exchange.legs,
    publicKeys: exchange.publicKeys
  };
}

export function partyIds(exchange) {
  const ids = new Set();
  for (const leg of exchange.legs || []) {
    ids.add(leg.debtorId);
    ids.add(leg.creditorId);
  }
  return [...ids];
}

export function holderIds(exchange) {
  const ids = new Set(partyIds(exchange));
  if (exchange.thirdSeatId) ids.add(exchange.thirdSeatId);
  return [...ids];
}

export function requiredSigners(exchange) {
  return partyIds(exchange);
}

export function entryDetail(entry, names = {}) {
  const payload = entry.payload || {};
  const name = (id) => names[id] || id;
  if (entry.type === 'genesis') {
    const grant = payload.mock ? `Mock grant ${payload.balance} $lgme. ` : `Opening ${payload.balance}. `;
    return `${grant}Floor ${payload.floor} ${payload.floorNote || ''}`.trim();
  }
  if (entry.type === 'transfer') {
    const way = payload.direction === 'in' ? 'in' : 'out';
    return `$lgme ${way} ${payload.amount} ${name(payload.fromId)} → ${name(payload.toId)} ${payload.note || ''}`.trim();
  }
  if (entry.type === 'iou') return `IOU pending ${payload.amount} ${name(payload.debtorId)} → ${name(payload.creditorId)} ${payload.reference || ''}`.trim();
  if (entry.type === 'attested') return `IOU attested ${payload.amount} ${name(payload.debtorId)} → ${name(payload.creditorId)} ${payload.reference || ''}`.trim();
  if (entry.type === 'ididit') {
    const hours = payload.hours == null ? '' : ` · ${payload.hours} h`;
    return `${payload.work || 'Work'}${payload.scope ? ' · ' + payload.scope : ''}${hours}`;
  }
  if (entry.type === 'refusal') return payload.statement || 'REFUSAL';
  if (entry.type === 'block') return payload.message || FLOOR_BLOCK;
  if (entry.type === 'KYC_STARTED') return 'KYC started. Details stay on this device.';
  if (entry.type === 'KYC_2FA_OK') return 'KYC code confirmed.';
  if (entry.type === 'KYC_VOUCHED' || entry.type === 'VERIFIED') return 'Verified. A member vouched.';
  if (entry.type === 'listing') return `Listing ${payload.title || ''} ${payload.amount ?? ''} $lgme`.trim();
  if (entry.type === 'heartbeat') return `Listing refreshed ${payload.listingId ? String(payload.listingId).slice(0, 12) : ''}`.trim();
  if (entry.type === 'HOLD') return `Hold pending ${payload.amount} $lgme ${name(payload.buyerId)} → ${name(payload.sellerId)}`.trim();
  if (entry.type === 'HOLD_RELEASE') return 'Hold released. Nothing settled.';
  if (entry.type === 'HANDOFF') return `Handoff settled ${payload.amount} $lgme`.trim();
  if (entry.type === 'CHAT') return `Chat ${payload.seq} ${payload.senderKycHash ? String(payload.senderKycHash).slice(0, 12) : ''}`.trim();
  if (entry.type === 'CHAT_MATCHED') return `Chat matched ${payload.root ? String(payload.root).slice(0, 12) : ''}`.trim();
  if (entry.type === 'CALL') return `Call ${payload.start || ''} → ${payload.end || ''}`.trim();
  if (entry.type === 'INVOICE') return `Invoice ${payload.amount} $lgme due ${payload.dueAt || ''}`.trim();
  if (entry.type === 'INVOICE_PAID') return `Invoice paid ${payload.amount} $lgme`.trim();
  if (entry.type === 'INVOICE_REFUSED') return payload.statement || 'INVOICE_REFUSED';
  if (entry.type === 'REWARD') return `Mock reward ${payload.amount} $lgme`.trim();
  if (entry.type === 'GRANT') return `soBeIT grant ${payload.amount} $lgme ${payload.reason || ''}`.trim();
  if (entry.type === 'MEDIA' || entry.type === 'MEDIA_RECEIVED') return `${entry.type === 'MEDIA_RECEIVED' ? 'Received' : 'Media'} ${payload.mime || ''} ${payload.hash ? String(payload.hash).slice(0, 12) : ''}`.trim();
  if (entry.type === 'countersign') {
    return `${name(payload.by)} countersigned ${payload.exchangeId ? payload.exchangeId.slice(0, 12) : ''}`.trim();
  }
  const legs = payload.legs || [];
  if (!legs.length) return payload.exchangeId ? payload.exchangeId.slice(0, 12) : '';
  return legs.map((leg) => `${name(leg.debtorId)} → ${name(leg.creditorId)} ${leg.amount} ${leg.reference || ''}`.trim()).join('; ');
}

async function appendEntry(peer, type, payload, at) {
  const prev = peer.tape.length ? peer.tape[peer.tape.length - 1].hash : GENESIS;
  const body = {
    index: peer.tape.length,
    type,
    simulated: true,
    peerId: peer.id,
    prev,
    at: at || nowIso(),
    payload: structuredClone(payload)
  };
  const hash = await sha256(canonicalJSON(body));
  const material = peer.privateKeyJwk || peer.signingKey;
  if (!material) throw new Error('Wallet is locked.');
  const sig = await signText(material, hash);
  const entry = { ...body, hash, sig };
  peer.tape.push(entry);
  return entry;
}

async function saveAll(store, peers) {
  for (const peer of Object.values(peers)) await store.set(peer.id, peer);
}

async function loadMap(store, ids) {
  const peers = {};
  for (const id of ids) {
    const peer = await store.get(id);
    if (!peer) return null;
    peers[id] = peer;
  }
  return peers;
}

function coresMatch(left, right) {
  return canonicalJSON(coreOf(left)) === canonicalJSON(coreOf(right));
}

export async function createPeer(store, spec) {
  const id = String(spec.id || '').trim();
  const name = String(spec.name || '').trim();
  if (!/^[a-z0-9-]{1,32}$/.test(id)) return fail('Peer id must be a short lowercase name.');
  if (!name) return fail('Name the peer.');
  if (await store.get(id)) return fail('That peer already has a book.');
  const balance = round2(spec.balance);
  const floor = round2(spec.floor);
  const creditLimit = round2(spec.creditLimit);
  if (!Number.isFinite(balance) || !Number.isFinite(floor) || !Number.isFinite(creditLimit)) {
    return fail('Opening, floor, and limit need numbers.');
  }
  const keys = await generateKeyPair();
  const peer = {
    id,
    name,
    simulated: true,
    publicKeyJwk: keys.publicKeyJwk,
    privateKeyJwk: keys.privateKeyJwk,
    opening: { balance, floor, creditLimit, floorNote: spec.floorNote || 'food/rent' },
    tape: [],
    exchanges: {},
    receipts: {}
  };
  const genesis = {
    name,
    balance,
    floor,
    creditLimit,
    floorNote: peer.opening.floorNote,
    publicKeyJwk: keys.publicKeyJwk
  };
  if (spec.mock) {
    genesis.mock = true;
    genesis.unit = '$lgme';
    genesis.grant = balance;
    genesis.label = 'mock';
  }
  await appendEntry(peer, 'genesis', genesis, spec.at || nowIso());
  await store.set(id, peer);
  return { ok: true, id };
}

export async function listPeers(store) {
  const ids = await store.listIds();
  const peers = [];
  for (const id of ids) {
    const peer = await store.get(id);
    if (!peer) continue;
    const view = replay(peer);
    const rule = terms(peer);
    const genesis = (peer.tape || []).find((entry) => entry.type === 'genesis');
    peers.push({
      id: peer.id,
      name: peer.name,
      publicKeyJwk: peer.publicKeyJwk,
      floor: rule.floor,
      floorNote: rule.floorNote,
      creditLimit: rule.creditLimit,
      balance: view.balance,
      mock: Boolean(genesis?.payload?.mock),
      locked: Boolean(peer.wallet?.ciphertext) && !peer.privateKeyJwk,
      kyc: kycStatus(peer),
      credits: view.credits,
      debits: view.debits,
      tapeLength: peer.tape.length
    });
  }
  peers.sort((a, b) => a.name.localeCompare(b.name));
  return peers;
}

export async function recordIdidIt(store, peerId, spec) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  const work = String(spec.work || '').trim();
  if (!work) return fail('Name the work.');
  const scope = String(spec.scope || '').trim();
  const hours = spec.hours == null || spec.hours === '' ? null : round2(spec.hours);
  if (hours != null && (!Number.isFinite(hours) || hours < 0)) return fail('Hours need a positive number.');
  const at = spec.at || nowIso();
  const draft = { peerId, work, scope, hours };
  const receiptId = await sha256(canonicalJSON(draft));
  const entry = await appendEntry(peer, 'ididit', { receiptId, work, scope, hours }, at);
  peer.receipts[receiptId] = {
    receiptId,
    peerId,
    work,
    scope,
    hours,
    tapeHash: entry.hash,
    simulated: true
  };
  await store.set(peerId, peer);
  return { ok: true, receiptId, balance: replay(peer).balance };
}

function normalizeLeg(leg) {
  const referenceAvg = leg.referenceAvg == null || leg.referenceAvg === '' ? null : round2(leg.referenceAvg);
  return {
    debtorId: String(leg.debtorId || '').trim(),
    creditorId: String(leg.creditorId || '').trim(),
    amount: round2(leg.amount),
    reference: String(leg.reference || '').trim(),
    ididitId: leg.ididitId || null,
    ididit: null,
    referenceId: leg.referenceId || null,
    referenceAvg: Number.isFinite(referenceAvg) ? referenceAvg : null
  };
}

async function propose(store, input) {
  const proposerId = String(input.proposerId || '').trim();
  const thirdSeatId = input.thirdSeatId ? String(input.thirdSeatId) : null;
  const charge = round2(input.charge ?? 0);
  const legs = (input.legs || []).map(normalizeLeg);
  if (!Number.isFinite(charge) || charge < 0) return fail('Named charge cannot be negative.');
  if (!legs.length) return fail('Add a line.');
  for (const leg of legs) {
    if (!leg.debtorId || !leg.creditorId) return fail('Each line needs two peers.');
    if (leg.debtorId === leg.creditorId) return fail('Debtor and creditor must be different peers.');
    if (!Number.isFinite(leg.amount) || leg.amount <= 0) return fail('Enter an amount greater than zero.');
    if (!leg.reference) return fail('Name the work.');
  }
  const parties = partyIds({ legs });
  if (input.kind === 'cycle' && (legs.length < 2 || parties.length < 3)) {
    return fail('A cycle needs at least three peers and two lines.');
  }
  if (input.kind === 'bilateral' && (legs.length !== 1 || parties.length !== 2)) {
    return fail('A bilateral line is one exchange between two peers.');
  }
  if (!parties.includes(proposerId)) return fail('Proposer must be a party to the exchange.');
  if (thirdSeatId && parties.includes(thirdSeatId)) return fail('Third seat must be a different person.');
  const holders = [...parties];
  if (thirdSeatId) holders.push(thirdSeatId);
  const peers = await loadMap(store, holders);
  if (!peers) return fail('Unknown peer.');
  for (const leg of legs) {
    if (!leg.ididitId) continue;
    const worker = peers[leg.creditorId];
    const receipt = worker && worker.receipts[leg.ididitId];
    if (!receipt || receipt.peerId !== leg.creditorId) {
      return fail("IdidIt receipt is not on the worker's tape.");
    }
    leg.ididit = {
      receiptId: receipt.receiptId,
      peerId: receipt.peerId,
      work: receipt.work,
      scope: receipt.scope,
      hours: receipt.hours
    };
  }
  const at = input.at || nowIso();
  const publicKeys = {};
  for (const id of holders) publicKeys[id] = peers[id].publicKeyJwk;
  const exchange = {
    id: '',
    simulated: true,
    kind: input.kind,
    proposerId,
    thirdSeatId,
    charge,
    legs,
    publicKeys,
    createdAt: at,
    status: 'proposed',
    signatures: {},
    refusal: null,
    block: null
  };
  exchange.id = await sha256(canonicalJSON(coreOf(exchange)));
  exchange.signatures[proposerId] = {
    sig: await signText(peers[proposerId].privateKeyJwk, exchange.id),
    at
  };
  for (const id of holders) {
    peers[id].exchanges[exchange.id] = structuredClone(exchange);
    await appendEntry(peers[id], 'proposal', {
      exchangeId: exchange.id,
      role: id === proposerId ? 'proposed' : 'received',
      kind: exchange.kind,
      legs: exchange.legs,
      charge: exchange.charge,
      thirdSeatId: exchange.thirdSeatId
    }, at);
  }
  await saveAll(store, peers);
  return { ok: true, exchangeId: exchange.id, status: 'proposed' };
}

export function proposeBilateral(store, input) {
  return propose(store, {
    kind: 'bilateral',
    proposerId: input.proposerId,
    thirdSeatId: input.thirdSeatId || null,
    charge: input.charge ?? 0,
    at: input.at,
    legs: [{
      debtorId: input.debtorId,
      creditorId: input.creditorId,
      amount: input.amount,
      reference: input.reference,
      ididitId: input.ididitId || null,
      referenceId: input.referenceId || null,
      referenceAvg: input.referenceAvg == null ? null : input.referenceAvg
    }]
  });
}

export function proposeCycle(store, input) {
  return propose(store, {
    kind: 'cycle',
    proposerId: input.proposerId,
    thirdSeatId: input.thirdSeatId || null,
    charge: input.charge ?? 0,
    legs: input.legs || [],
    at: input.at
  });
}

async function loadConsistent(store, actorId, exchangeId) {
  const actor = await store.get(actorId);
  if (!actor) return fail('Unknown peer.');
  const ex = actor.exchanges[exchangeId];
  if (!ex) return fail('This book has no copy of that exchange.');
  const peers = await loadMap(store, holderIds(ex));
  if (!peers) return fail('A peer on this line is missing.');
  for (const peer of Object.values(peers)) {
    const other = peer.exchanges[exchangeId];
    if (!other) return fail(`${peer.name} has no copy. Nothing moved.`);
    if (!coresMatch(other, ex)) return fail('Copies disagree. Nothing moved. Reconcile the two books.');
  }
  const idAgain = await sha256(canonicalJSON(coreOf(ex)));
  if (idAgain !== ex.id) return fail('This copy does not match its hash.');
  return { ok: true, ex, peers };
}

export async function countersign(store, peerId, exchangeId, at = nowIso()) {
  const loaded = await loadConsistent(store, peerId, exchangeId);
  if (!loaded.ok) return loaded;
  const { ex, peers } = loaded;
  if (ex.status === 'refused' || ex.refusal) return fail('Refused. No balance moves. No penalty.');
  if (ex.status === 'settled') return fail('Already settled on these books.');
  if (ex.status === 'blocked') return fail(FLOOR_BLOCK);
  if (!requiredSigners(ex).includes(peerId)) return fail('Only a party countersigns.');
  if (!ex.signatures[peerId]) {
    ex.signatures[peerId] = {
      sig: await signText(peers[peerId].privateKeyJwk, ex.id),
      at
    };
  }
  const complete = requiredSigners(ex).every((id) => ex.signatures[id]);
  ex.status = complete ? 'countersigned' : 'proposed';
  for (const peer of Object.values(peers)) {
    peer.exchanges[exchangeId] = structuredClone(ex);
    await appendEntry(peer, 'countersign', { exchangeId, by: peerId, role: peer.id === peerId ? 'signed' : 'recorded' }, at);
  }
  await saveAll(store, peers);
  return { ok: true, exchangeId, status: ex.status };
}

export async function refuse(store, peerId, exchangeId, statement, at = nowIso()) {
  const loaded = await loadConsistent(store, peerId, exchangeId);
  if (!loaded.ok) return loaded;
  const { ex, peers } = loaded;
  if (ex.status === 'settled') return fail('Already settled. A refusal does not unwind a shown line.');
  if (ex.status === 'blocked') return fail(FLOOR_BLOCK);
  const isThird = ex.thirdSeatId && ex.thirdSeatId === peerId;
  const isParty = partyIds(ex).includes(peerId);
  if (!isThird && !isParty) return fail('Only a party or the named third seat can refuse.');
  if (ex.status === 'refused' || ex.refusal) {
    return { ok: true, exchangeId, status: 'refused', noop: true };
  }
  const text = String(statement || 'REFUSAL').trim() || 'REFUSAL';
  const refusalBody = {
    exchangeId,
    type: 'refusal',
    peerId,
    role: isThird ? 'third-seat' : 'party',
    statement: text
  };
  const hash = await sha256(canonicalJSON(refusalBody));
  const sig = await signText(peers[peerId].privateKeyJwk, hash);
  ex.status = 'refused';
  ex.refusal = { ...refusalBody, hash, sig, at };
  for (const peer of Object.values(peers)) {
    peer.exchanges[exchangeId] = structuredClone(ex);
    await appendEntry(peer, 'refusal', {
      exchangeId,
      by: peerId,
      role: refusalBody.role,
      statement: text
    }, at);
  }
  await saveAll(store, peers);
  const balances = {};
  for (const peer of Object.values(peers)) balances[peer.id] = replay(peer).balance;
  return { ok: true, exchangeId, status: 'refused', balances };
}

async function signaturesComplete(ex) {
  for (const id of requiredSigners(ex)) {
    const rec = ex.signatures[id];
    if (!rec) return 'missing';
    const valid = await verifyText(ex.publicKeys[id], ex.id, rec.sig);
    if (!valid) return 'invalid';
  }
  return 'ok';
}

export async function settle(store, peerId, exchangeId, at = nowIso()) {
  const loaded = await loadConsistent(store, peerId, exchangeId);
  if (!loaded.ok) return loaded;
  const { ex, peers } = loaded;
  if (!partyIds(ex).includes(peerId)) return fail('Only a party can settle.');
  if (ex.status === 'refused' || ex.refusal) return fail('Refused. No balance moves. No penalty.');
  if (ex.status === 'settled') return fail('Already settled on these books.');
  if (ex.status === 'blocked' || ex.block) return fail(FLOOR_BLOCK);
  const signed = await signaturesComplete(ex);
  if (signed === 'missing') return fail('Countersign required');
  if (signed === 'invalid') return fail('Signature does not verify');
  const before = {};
  for (const id of Object.keys(peers)) before[id] = replay(peers[id]).balance;
  for (const id of partyIds(ex)) {
    const projected = applyLegs(before[id], id, ex.legs).balance;
    const reason = floorBlockReason(peers[id], projected);
    if (reason) {
      ex.status = 'blocked';
      ex.block = { message: FLOOR_BLOCK, at };
      for (const peer of Object.values(peers)) {
        peer.exchanges[exchangeId] = structuredClone(ex);
        await appendEntry(peer, 'block', { exchangeId, message: FLOOR_BLOCK }, at);
      }
      await saveAll(store, peers);
      return { ok: false, error: FLOOR_BLOCK, blocked: true, exchangeId };
    }
  }
  ex.status = 'settled';
  for (const peer of Object.values(peers)) {
    peer.exchanges[exchangeId] = structuredClone(ex);
    await appendEntry(peer, 'settlement', {
      exchangeId,
      legs: ex.legs,
      charge: ex.charge,
      signatures: ex.signatures
    }, at);
  }
  await saveAll(store, peers);
  const balances = {};
  for (const id of Object.keys(peers)) {
    const fresh = await store.get(id);
    balances[id] = replay(fresh).balance;
  }
  return { ok: true, exchangeId, status: 'settled', balances };
}

export async function verifyTape(peer) {
  if (!peer || !peer.tape || !peer.tape.length) return { ok: false, reason: 'Tape is empty' };
  let prev = GENESIS;
  let signingKey = peer.tape[0]?.payload?.publicKeyJwk || peer.publicKeyJwk;
  for (let i = 0; i < peer.tape.length; i++) {
    const entry = peer.tape[i];
    if (entry.index !== i) return { ok: false, index: i, reason: `break at #${i}: index does not match the tape` };
    if (entry.prev !== prev) {
      return { ok: false, index: i, reason: `break at #${i}: previous hash does not link` };
    }
    const body = { ...entry };
    delete body.hash;
    delete body.sig;
    const recomputed = await sha256(canonicalJSON(body));
    if (recomputed !== entry.hash) return { ok: false, index: i, reason: `hash mismatch at #${i}` };
    const valid = await verifyText(signingKey, entry.hash, entry.sig);
    if (!valid) return { ok: false, index: i, reason: `signature mismatch at #${i}` };
    if (entry.type === 'KEY_ROTATION' && entry.payload?.newPublic) signingKey = entry.payload.newPublic;
    prev = entry.hash;
  }
  const genesis = peer.tape[0];
  if (genesis.type !== 'genesis') return { ok: false, reason: 'Tape does not open with genesis' };
  if (canonicalJSON(signingKey) !== canonicalJSON(peer.publicKeyJwk)) {
    return { ok: false, reason: 'Genesis key does not match this peer' };
  }
  const rule = terms(peer);
  const floorNow = round2((genesis.payload.floor || 0) + fraudPenalty(peer));
  if (peer.opening && (peer.opening.balance !== rule.balance || round2(peer.opening.floor + fraudPenalty(peer)) !== floorNow || peer.opening.creditLimit !== rule.creditLimit)) {
    return { ok: false, reason: 'Opening mirror does not match genesis' };
  }
  return { ok: true, entries: peer.tape.length, balance: replay(peer).balance };
}

export async function verifyBook(peer) {
  const tape = await verifyTape(peer);
  if (!tape.ok) return tape;
  for (const ex of Object.values(peer.exchanges || {})) {
    const id = await sha256(canonicalJSON(coreOf(ex)));
    if (id !== ex.id) return { ok: false, reason: `Exchange ${String(ex.id).slice(0, 12)} does not match its hash` };
    for (const [pid, rec] of Object.entries(ex.signatures || {})) {
      const ok = await verifyText(ex.publicKeys?.[pid], ex.id, rec.sig);
      if (!ok) return { ok: false, reason: `Signature from ${pid} does not verify` };
    }
    if (ex.refusal) {
      const body = {
        exchangeId: ex.refusal.exchangeId,
        type: 'refusal',
        peerId: ex.refusal.peerId,
        role: ex.refusal.role,
        statement: ex.refusal.statement
      };
      const hash = await sha256(canonicalJSON(body));
      if (hash !== ex.refusal.hash) return { ok: false, reason: 'Refusal does not match its hash' };
      const ok = await verifyText(ex.publicKeys?.[ex.refusal.peerId], hash, ex.refusal.sig);
      if (!ok) return { ok: false, reason: 'Refusal signature does not verify' };
    }
  }
  return tape;
}

function settlementLegs(peer, exchangeId) {
  const rows = (peer.tape || []).filter((entry) => entry.type === 'settlement' && entry.payload?.exchangeId === exchangeId);
  if (!rows.length) return null;
  return rows.map((entry) => entry.payload.legs);
}

export function reconcile(peerA, peerB) {
  const mismatches = [];
  const matches = [];
  const ids = new Set([...Object.keys(peerA.exchanges || {}), ...Object.keys(peerB.exchanges || {})]);
  for (const exchangeId of ids) {
    const left = peerA.exchanges[exchangeId];
    const right = peerB.exchanges[exchangeId];
    if (!left || !right) {
      const missing = left ? peerB.name : peerA.name;
      mismatches.push({ exchangeId, field: 'presence', detail: `${missing} has no copy` });
      continue;
    }
    let matched = true;
    const push = (field, detail) => {
      matched = false;
      mismatches.push({ exchangeId, field, detail });
    };
    if (canonicalJSON(left.legs) !== canonicalJSON(right.legs)) push('legs', 'Leg amounts or work do not match');
    if (left.charge !== right.charge) push('charge', 'Named charge does not match');
    if (left.proposerId !== right.proposerId || left.thirdSeatId !== right.thirdSeatId || left.kind !== right.kind) {
      push('parties', 'Parties or kind do not match');
    }
    if (left.status !== right.status) push('status', `${left.status} vs ${right.status}`);
    if (canonicalJSON(left.signatures || {}) !== canonicalJSON(right.signatures || {})) push('signatures', 'Signatures do not match');
    if (canonicalJSON(left.refusal) !== canonicalJSON(right.refusal)) push('refusal', 'Refusal does not match');
    if (canonicalJSON(left.block) !== canonicalJSON(right.block)) push('block', 'Block does not match');
    if (canonicalJSON(settlementLegs(peerA, exchangeId)) !== canonicalJSON(settlementLegs(peerB, exchangeId))) {
      push('settlement', 'Settlement lines do not match');
    }
    if (matched) matches.push({ exchangeId, status: left.status });
  }
  return {
    ok: mismatches.length === 0,
    mismatches,
    matches,
    peerA: { id: peerA.id, name: peerA.name },
    peerB: { id: peerB.id, name: peerB.name }
  };
}

export async function reconcilePeers(store, idA, idB) {
  const peerA = await store.get(idA);
  const peerB = await store.get(idB);
  if (!peerA || !peerB) return { ok: false, mismatches: [{ exchangeId: '', field: 'presence', detail: 'One peer book is missing' }], matches: [] };
  return reconcile(peerA, peerB);
}

export function toExport(peer) {
  const view = replay(peer);
  return {
    simulated: true,
    label: 'personal tape (simulated)',
    id: peer.id,
    name: peer.name,
    publicKeyJwk: peer.publicKeyJwk,
    opening: terms(peer),
    balance: view.balance,
    credits: view.credits,
    debits: view.debits,
    tape: peer.tape,
    exchanges: peer.exchanges,
    receipts: peer.receipts
  };
}

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(peer, names = {}) {
  const header = ['index', 'at', 'type', 'detail', 'debit', 'credit', 'balance', 'prev', 'hash'];
  const lines = [header.join(',')];
  for (const row of replay(peer).rows) {
    lines.push([
      row.index,
      row.at,
      row.type,
      entryDetail(row, names),
      row.debit,
      row.credit,
      row.balance,
      row.prev,
      row.hash
    ].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text) {
  const clean = String(text || '').toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function hotp(secretBytes, counter, options = {}) {
  const digits = options.digits || 6;
  const algorithm = options.algorithm || 'SHA-1';
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: algorithm }, false, ['sign']);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const whole = Math.floor(Number(counter));
  view.setUint32(0, Math.floor(whole / 4294967296));
  view.setUint32(4, whole >>> 0);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % (10 ** digits)).padStart(digits, '0');
}

export async function totp(secretBytes, unixSeconds, options = {}) {
  const period = options.period || 30;
  const counter = Math.floor(Number(unixSeconds) / period);
  return hotp(secretBytes, counter, options);
}

function hexToBytes(hex) {
  const raw = new Uint8Array(hex.length / 2);
  for (let i = 0; i < raw.length; i++) raw[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return raw;
}

export async function encryptJson(passphrase, value, iterations = KDF_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return {
    iterations,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(cipher))
  };
}

export async function decryptJson(passphrase, sealed) {
  const salt = hexToBytes(sealed.salt);
  const iv = hexToBytes(sealed.iv);
  const iterations = sealed.iterations;
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, hexToBytes(sealed.ciphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}

export async function registerPeer(store, spec) {
  const floor = spec.floor == null ? 40 : spec.floor;
  if (Number(floor) > MOCK_GRANT) return fail('The floor sits under the mock grant.');
  return createPeer(store, {
    id: spec.id,
    name: spec.name,
    balance: MOCK_GRANT,
    floor,
    creditLimit: spec.creditLimit == null ? -200 : spec.creditLimit,
    floorNote: spec.floorNote || 'food/rent',
    mock: true,
    at: spec.at
  });
}

export async function setupWallet(store, peerId, passphrase, options = {}) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk) return fail('No key to lock.');
  const weak = passphraseReason(passphrase);
  if (weak) return fail(weak);
  const secretBytes = options.secretBytes || crypto.getRandomValues(new Uint8Array(20));
  const totpSecretBase32 = base32Encode(secretBytes);
  const iterations = options.iterations || KDF_ITERATIONS;
  const sealed = await encryptJson(String(passphrase), {
    privateKeyJwk: peer.privateKeyJwk,
    totpSecretBase32
  }, iterations);
  peer.wallet = {
    simulated: true,
    locked: true,
    mock: true,
    kdf: 'PBKDF2',
    cipher: 'AES-GCM',
    hash: 'SHA-256',
    iterations: sealed.iterations,
    salt: sealed.salt,
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
    totp: { algorithm: 'SHA-1', digits: 6, period: 30 }
  };
  peer.privateKeyJwk = null;
  await store.set(peerId, peer);
  const label = encodeURIComponent(`lgme-sim:${peer.name}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${totpSecretBase32}&issuer=lgme-sim&algorithm=SHA1&digits=6&period=30`;
  return { ok: true, secretBase32: totpSecretBase32, otpauthUrl };
}

export async function unlockWallet(record, passphrase, code, unixSeconds) {
  if (!record?.wallet?.ciphertext) return fail('This book has no locked wallet.');
  let plain;
  try {
    plain = await decryptJson(String(passphrase || ''), record.wallet);
  } catch {
    return fail('Wrong passphrase.');
  }
  const secret = base32Decode(plain.totpSecretBase32);
  const digits = record.wallet.totp?.digits || 6;
  const period = record.wallet.totp?.period || 30;
  const entered = String(code ?? '').replace(/\s/g, '');
  let matched = false;
  for (const step of [0, -1, 1]) {
    const guess = await totp(secret, Number(unixSeconds) + (step * period), { digits, period, algorithm: 'SHA-1' });
    if (guess === entered) matched = true;
  }
  if (!matched) return fail('Wrong code.');
  return { ok: true, privateKeyJwk: plain.privateKeyJwk, secretBase32: plain.totpSecretBase32 };
}

function b64urlEncode(bytes) {
  let bin = '';
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(text) {
  const b64 = text.replaceAll('-', '+').replaceAll('_', '/');
  const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function sealMessage(peer, kind, body) {
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail('Wallet is locked.');
  if (!MESSAGE_KINDS.has(kind)) return fail('Unknown message.');
  const hash = await sha256(canonicalJSON(body));
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, hash);
  return {
    ok: true,
    message: {
      v: 1,
      simulated: true,
      kind,
      fromId: peer.id,
      publicKeyJwk: peer.publicKeyJwk,
      body,
      hash,
      sig
    }
  };
}

export function encodeMessage(message) {
  return 'lgme1.' + b64urlEncode(new TextEncoder().encode(JSON.stringify(message)));
}

export function decodeMessage(input) {
  let text = String(input || '').trim();
  const mark = text.indexOf('lgme1.');
  if (mark >= 0) text = text.slice(mark);
  if (text.startsWith('lgme1.')) {
    return JSON.parse(new TextDecoder().decode(b64urlDecode(text.slice('lgme1.'.length))));
  }
  return JSON.parse(text);
}

export async function openMessage(input) {
  let message;
  try {
    message = typeof input === 'string' || input instanceof String ? decodeMessage(input) : input;
  } catch {
    return fail('The message could not be read.');
  }
  if (!message || message.simulated !== true || !MESSAGE_KINDS.has(message.kind)) return fail('This is not a simulated lgme message.');
  const hash = await sha256(canonicalJSON(message.body));
  if (hash !== message.hash) return fail('Hash does not match. Import stopped.');
  const valid = await verifyText(message.publicKeyJwk, message.hash, message.sig);
  if (!valid) return fail('Signature does not verify. Import stopped.');
  if (message.kind === 'tape') {
    const checked = await verifyTape(message.body);
    if (!checked.ok) return fail(checked.reason || 'Hash link does not verify. Import stopped.');
  }
  return { ok: true, message };
}

export function shareHrefs(address, text) {
  const body = encodeURIComponent(text);
  const to = address ? encodeURIComponent(String(address).trim()) : '';
  return {
    sms: `sms:${to}?&body=${body}`,
    mailto: `mailto:${to}?subject=${encodeURIComponent('SIMULATION lgme')}&body=${body}`
  };
}

export function shareText(summary, encoded) {
  return `SIMULATION lgme. ${summary} This page does not send it. Open the link in your own browser.\n${encoded}`;
}

function unspentSerials(peer) {
  return Object.values(peer.serials || {}).filter((serial) => serial.ownerId === peer.id && !serial.nextOwnerId);
}

async function ensureSerialBundle(peer, at) {
  if (unspentSerials(peer).length) return;
  const amount = replay(peer).balance;
  if (!(amount > 0)) return;
  const id = await sha256(canonicalJSON({ kind: 'serial', ownerId: peer.id, amount, at, parent: '' }));
  peer.serials = peer.serials || {};
  peer.serials[id] = { id, amount, ownerId: peer.id, parentId: '', nextOwnerId: '', depth: 0, unit: '$lgme' };
  await appendEntry(peer, 'SERIAL_MINT', { id, amount, ownerId: peer.id, depth: 0, mock: true, label: 'mock' }, at);
}

async function commitSerials(peer, amount, toId, at) {
  await ensureSerialBundle(peer, at);
  let need = round2(amount);
  const moved = [];
  let owned = unspentSerials(peer).sort((a, b) => b.amount - a.amount);
  const have = round2(owned.reduce((sum, serial) => sum + serial.amount, 0));
  if (have + 1e-9 < need) {
    const id = await sha256(canonicalJSON({ kind: 'serial', ownerId: peer.id, amount: round2(need - have), at, label: 'cover' }));
    peer.serials[id] = { id, amount: round2(need - have), ownerId: peer.id, parentId: '', nextOwnerId: '', depth: 0, unit: '$lgme', label: 'cover' };
    await appendEntry(peer, 'SERIAL_MINT', { id, amount: round2(need - have), ownerId: peer.id, depth: 0, mock: true, label: 'cover' }, at);
    owned = unspentSerials(peer).sort((a, b) => b.amount - a.amount);
  }
  for (const serial of owned) {
    if (need <= 1e-9) break;
    if (serial.nextOwnerId) return fail(FORK);
    const take = round2(Math.min(serial.amount, need));
    const depth = serial.depth + 1;
    const reissue = depth >= 8;
    const childId = await sha256(canonicalJSON({ parent: serial.id, toId, take, at }));
    serial.nextOwnerId = 'split';
    peer.serials[childId] = {
      id: childId,
      amount: take,
      ownerId: toId,
      parentId: serial.id,
      nextOwnerId: '',
      depth: reissue ? 0 : depth,
      unit: '$lgme',
      reissued: reissue
    };
    if (serial.amount - take > 1e-9) {
      const changeId = await sha256(canonicalJSON({ parent: serial.id, change: round2(serial.amount - take), at }));
      peer.serials[changeId] = {
        id: changeId,
        amount: round2(serial.amount - take),
        ownerId: peer.id,
        parentId: serial.id,
        nextOwnerId: '',
        depth: reissue ? 0 : depth,
        unit: '$lgme',
        reissued: reissue
      };
      moved.push(changeId);
    }
    moved.push(childId);
    need = round2(need - take);
    await appendEntry(peer, 'SERIAL_MOVE', {
      serialId: serial.id,
      childId,
      amount: take,
      fromId: peer.id,
      toId,
      depth: reissue ? 0 : depth,
      reissued: reissue,
      mock: true
    }, at);
  }
  return { ok: true, serials: moved };
}

export function auditSerial(peer, serialId) {
  const chain = [];
  const seen = new Set();
  let current = peer?.serials?.[serialId];
  while (current) {
    if (seen.has(current.id)) return { ok: false, error: FORK, chain };
    seen.add(current.id);
    chain.push(current);
    if (!current.parentId) return { ok: true, chain, root: current };
    current = peer.serials[current.parentId];
    if (!current) return { ok: false, error: 'The ownership chain does not reach GENESIS.', chain };
  }
  return { ok: false, error: 'Unknown serial.', chain };
}

export async function attemptDoubleSpend(store, fromId, toId, at = nowIso()) {
  const from = await store.get(fromId);
  if (!from?.privateKeyJwk && !from?.signingKey) return fail(from ? 'Wallet is locked.' : 'Unknown peer.');
  const spent = Object.values(from.serials || {}).find((serial) => serial.nextOwnerId && serial.nextOwnerId !== 'split' && serial.ownerId === from.id);
  const split = Object.values(from.serials || {}).find((serial) => serial.nextOwnerId === 'split');
  const target = spent || split;
  if (!target) return fail('Nothing has been spent yet.');
  const other = target.nextOwnerId === 'split'
    ? Object.values(from.serials).find((serial) => serial.parentId === target.id && serial.ownerId !== from.id)
    : null;
  const firstOwner = other?.ownerId || target.nextOwnerId;
  if (!firstOwner || firstOwner === toId) return fail('Name a different second owner.');
  const proofBody = { serialId: target.id, firstOwner, secondOwner: toId, cheaterId: from.id, mock: true, simulated: true };
  const proofHash = await sha256(canonicalJSON(proofBody));
  const proofSig = await signText(from.privateKeyJwk || from.signingKey, proofHash);
  await appendEntry(from, 'FRAUD_PROOF', { ...proofBody, hash: proofHash, sig: proofSig }, at);
  await store.set(fromId, from);
  const otherPeer = await store.get(toId);
  if (otherPeer?.privateKeyJwk || otherPeer?.signingKey) {
    await appendEntry(otherPeer, 'FRAUD_PROOF', { ...proofBody, hash: proofHash, sig: proofSig, shown: true }, at);
    await store.set(toId, otherPeer);
  }
  return { ok: false, fraud: true, error: FORK, proof: proofBody, standing: peerStanding(await store.get(fromId)), floor: terms(await store.get(fromId)).floor };
}

export async function exportBackup(peer, passphrase) {
  const weak = passphraseReason(passphrase);
  if (weak) return fail(weak);
  if (!peer?.privateKeyJwk) return fail('Unlock the wallet before export.');
  const sealed = await encryptJson(String(passphrase), {
    id: peer.id,
    publicKeyJwk: peer.publicKeyJwk,
    privateKeyJwk: peer.privateKeyJwk
  }, 2000);
  return { ok: true, backup: { simulated: true, kind: 'backup', sealed } };
}

export async function importBackup(store, backup, passphrase) {
  let plain;
  try {
    plain = await decryptJson(String(passphrase || ''), backup?.sealed || {});
  } catch {
    return fail('Wrong passphrase.');
  }
  const peer = await store.get(plain.id);
  if (!peer) return fail('Unknown peer.');
  peer.privateKeyJwk = plain.privateKeyJwk;
  await store.set(peer.id, peer);
  return { ok: true, id: peer.id };
}

export async function rotateKey(store, peerId, at = nowIso()) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const next = await generateKeyPair();
  const notice = { simulated: true, oldPublic: peer.publicKeyJwk, newPublic: next.publicKeyJwk, mock: true };
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, await sha256(canonicalJSON(notice)));
  await appendEntry(peer, 'KEY_ROTATION', { ...notice, sig }, at);
  peer.publicKeyJwk = next.publicKeyJwk;
  peer.privateKeyJwk = next.privateKeyJwk;
  await store.set(peerId, peer);
  return { ok: true, publicKeyJwk: next.publicKeyJwk };
}

export async function createTransfer(store, fromId, spec) {
  const from = await store.get(fromId);
  if (!from) return fail('Unknown peer.');
  if (!from.privateKeyJwk && !from.signingKey) return fail('Wallet is locked.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return fail(gate.error);
  const toId = String(spec.toId || '').trim();
  const amount = round2(spec.amount);
  if (!/^[a-z0-9-]{1,32}$/.test(toId) || toId === fromId) return fail('Name a different peer id.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter an amount greater than zero.');
  const limited = sendLimitReason(from, amount);
  if (limited) return fail(limited);
  const next = round2(replay(from).balance - heldBy(from) - amount);
  const blocked = floorBlockReason(from, next);
  if (blocked) return fail(blocked);
  const cosign = coSignReason(amount, spec.thirdSeatSig);
  if (cosign) return fail(cosign);
  const at = spec.at || nowIso();
  const recipient = await store.get(toId);
  if (!recipient?.privateKeyJwk && !recipient?.signingKey) return fail('The other peer has not acknowledged. Ask them to sign the challenge.');
  const nonce = await sha256(canonicalJSON({ kind: 'challenge', fromId, toId, amount, at }));
  const exp = expiryFrom(at, ACK_MS);
  const challenge = await sha256(canonicalJSON({ nonce, exp, fromId, toId, amount }));
  const senderAck = await signText(from.privateKeyJwk || from.signingKey, challenge);
  const recipientAck = await signText(recipient.privateKeyJwk || recipient.signingKey, challenge);
  const moved = await commitSerials(from, amount, toId, at);
  if (!moved.ok) return moved;
  from.spendSeq = (from.spendSeq || 0) + 1;
  const body = {
    simulated: true,
    kind: 'transfer',
    v: 2,
    fromId,
    toId,
    amount,
    unit: '$lgme',
    note: String(spec.note || '').trim(),
    mock: true,
    nonce,
    exp,
    seq: from.spendSeq,
    prevHash: from.tape.length ? from.tape[from.tape.length - 1].hash : GENESIS,
    serials: moved.serials,
    ack: { sender: senderAck, recipient: recipientAck }
  };
  const sealed = await sealMessage(from, 'transfer', body);
  if (!sealed.ok) return sealed;
  await appendEntry(from, 'transfer', { ...body, hash: sealed.message.hash, sig: sealed.message.sig, direction: 'out' }, at);
  from.outbox = from.outbox || [];
  from.outbox.push({ at, kind: 'transfer', toId, amount, hash: sealed.message.hash, channel: 'local', simulated: true });
  await store.set(fromId, from);
  return { ok: true, message: sealed.message, encoded: encodeMessage(sealed.message), balance: replay(from).balance };
}

export async function acceptAutoDelivery(store, peerId, input, at = nowIso()) {
  const opened = await openMessage(input);
  if (!opened.ok) return { ...opened, sent: false };
  if (opened.message.kind !== 'transfer') return fail('This auto-delivery is not a transfer.');
  return importMessage(store, peerId, opened.message, at);
}

export async function autoDeliverTransfer(store, fromId, spec) {
  const from = await store.get(fromId);
  if (!from) return fail('Unknown peer.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return { ok: false, error: gate.error, sent: false };
  if (!from.wallet?.ciphertext) return { ok: false, error: 'Set up simulated 2FA before auto-send.', sent: false };
  const toId = String(spec.toId || '').trim();
  const amount = round2(spec.amount);
  if (!/^[a-z0-9-]{1,32}$/.test(toId) || toId === fromId) return { ok: false, error: 'Name a different peer id.', sent: false };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.', sent: false };
  const limited = sendLimitReason(from, amount);
  if (limited) return { ok: false, error: limited, sent: false };
  const unlocked = await unlockWallet(from, spec.passphrase, spec.code, spec.unixSeconds ?? Math.floor(Date.now() / 1000));
  if (!unlocked.ok) return { ok: false, error: unlocked.error, sent: false };
  const next = round2(replay(from).balance - heldBy(from) - amount);
  const blocked = floorBlockReason(from, next);
  if (blocked) return { ok: false, error: blocked, sent: false };
  const recipient = await store.get(toId);
  if (recipient && !recipient.privateKeyJwk) {
    return { ok: false, error: 'The recipient book is locked on this device. Nothing was sent.', sent: false };
  }
  const at = spec.at || nowIso();
  const signer = { ...from, privateKeyJwk: unlocked.privateKeyJwk };
  if (!recipient?.privateKeyJwk && !recipient?.signingKey) return { ok: false, error: 'The other peer has not acknowledged. Ask them to sign the challenge.', sent: false };
  const nonce = await sha256(canonicalJSON({ kind: 'challenge', fromId, toId, amount, at }));
  const exp = expiryFrom(at, ACK_MS);
  const challenge = await sha256(canonicalJSON({ nonce, exp, fromId, toId, amount }));
  const moved = await commitSerials(signer, amount, toId, at);
  if (!moved.ok) return { ...moved, sent: false };
  signer.spendSeq = (signer.spendSeq || 0) + 1;
  const body = {
    simulated: true,
    kind: 'transfer',
    v: 2,
    fromId,
    toId,
    amount,
    unit: '$lgme',
    note: String(spec.note || '').trim(),
    mock: true,
    auto: true,
    nonce,
    exp,
    seq: signer.spendSeq,
    prevHash: signer.tape.length ? signer.tape[signer.tape.length - 1].hash : GENESIS,
    serials: moved.serials,
    ack: {
      sender: await signText(signer.privateKeyJwk, challenge),
      recipient: await signText(recipient.privateKeyJwk || recipient.signingKey, challenge)
    }
  };
  const sealed = await sealMessage(signer, 'transfer', body);
  if (!sealed.ok) return { ...sealed, sent: false };
  await appendEntry(signer, 'transfer', { ...body, hash: sealed.message.hash, sig: sealed.message.sig, direction: 'out' }, at);
  const notice = {
    at,
    kind: 'notice',
    toId,
    fromId,
    amount,
    hash: sealed.message.hash,
    simulated: true,
    text: 'SIMULATION notice. No message was sent.'
  };
  signer.outbox = signer.outbox || [];
  signer.outbox.push({ ...notice, channel: 'sms' }, { ...notice, channel: 'email' });
  signer.privateKeyJwk = null;
  signer.wallet = { ...signer.wallet, locked: true };
  await store.set(fromId, signer);
  let delivered = false;
  let recipientBalance = null;
  if (recipient?.privateKeyJwk) {
    const accepted = await acceptAutoDelivery(store, toId, sealed.message, at);
    if (!accepted.ok) return { ...accepted, sent: true, delivered: false };
    delivered = true;
    recipientBalance = accepted.balance;
    const fresh = await store.get(toId);
    fresh.inbox = fresh.inbox || [];
    fresh.inbox.push({ ...notice, channel: 'sms' }, { ...notice, channel: 'email' });
    await store.set(toId, fresh);
  }
  return {
    ok: true,
    sent: true,
    delivered,
    message: sealed.message,
    encoded: encodeMessage(sealed.message),
    balance: replay(await store.get(fromId)).balance,
    recipientBalance,
    notices: ['sms', 'email']
  };
}

async function rememberInbox(peer, item) {
  peer.inbox = peer.inbox || [];
  peer.inbox.push({ ...item, simulated: true });
}

export async function importMessage(store, peerId, input, at = nowIso()) {
  const opened = await openMessage(input);
  if (!opened.ok) return opened;
  const message = opened.message;
  if (message.kind === 'tape') return { ok: true, kind: 'tape', peer: message.body, appended: false };
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  if (!peer.privateKeyJwk) return fail('Wallet is locked.');
  const known = message.fromId ? await store.get(message.fromId) : null;
  if (known && canonicalJSON(known.publicKeyJwk) !== canonicalJSON(message.publicKeyJwk)) {
    return fail('The signing key does not match the book already stored for that peer.');
  }
  if (message.kind === 'transfer') return applyImportedTransfer(store, peer, message, at);
  if (message.kind === 'attestation') return applyImportedAttestation(store, peer, message, at);
  if (message.kind === 'refusal') return applyImportedRefusal(store, peer, message, at);
  if (message.kind === 'iou') return applyImportedIou(store, peer, message, at);
  if (message.kind === 'proposal' || message.kind === 'countersign') return applyImportedExchange(store, peer, message, at);
  if (message.kind === 'chat' || message.kind === 'chat-match') return fail('Open this token in Chats. Nothing was appended.');
  if (message.kind === 'invoice') return fail('Open this invoice in the ledger. Nothing was appended.');
  return fail('This message has no place on this book.');
}

async function applyImportedTransfer(store, peer, message, at) {
  const body = message.body || {};
  if (body.exp && !ackFresh(body.exp, at)) return fail(STALE_ACK);
  if (Array.isArray(body.serials)) {
    for (const serialId of body.serials) {
      const audited = auditSerial(peer.serials?.[serialId] ? peer : { serials: {} }, serialId);
      if (peer.serials?.[serialId] && !audited.ok) return fail(audited.error);
    }
  }
  if (body.toId !== peer.id) return fail('This transfer is addressed to another peer.');
  if ((peer.tape || []).some((entry) => entry.type === 'transfer' && entry.payload?.hash === message.hash)) {
    return { ok: true, duplicate: true, balance: replay(peer).balance };
  }
  if (body.nonce) {
    peer.nonces = peer.nonces || {};
    if (peer.nonces[body.nonce]) return fail(REPLAY);
    peer.nonces[body.nonce] = true;
  }
  await appendEntry(peer, 'transfer', {
    ...body,
    hash: message.hash,
    sig: message.sig,
    direction: 'in'
  }, at);
  await rememberInbox(peer, { at, kind: 'transfer', fromId: body.fromId, amount: body.amount, hash: message.hash });
  await store.set(peer.id, peer);
  return { ok: true, balance: replay(peer).balance };
}

export async function recordIou(store, makerId, spec) {
  const maker = await store.get(makerId);
  if (!maker) return fail('Unknown peer.');
  if (!maker.privateKeyJwk) return fail('Wallet is locked.');
  const debtorId = String(spec.debtorId || '').trim();
  const creditorId = String(spec.creditorId || '').trim();
  const amount = round2(spec.amount);
  const reference = String(spec.reference || '').trim();
  if (debtorId === creditorId || !debtorId || !creditorId) return fail('An IOU names two different peers.');
  if (makerId !== debtorId && makerId !== creditorId) return fail('The maker must be a party to the IOU.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter an amount greater than zero.');
  if (!reference) return fail('Name the dollar IOU.');
  const attesterId = makerId === debtorId ? creditorId : debtorId;
  const at = spec.at || nowIso();
  const body = {
    simulated: true,
    kind: 'iou',
    debtorId,
    creditorId,
    attesterId,
    amount,
    unit: 'USD',
    reference,
    status: 'pending',
    mock: true
  };
  const sealed = await sealMessage(maker, 'iou', body);
  if (!sealed.ok) return sealed;
  const iouId = sealed.message.hash;
  const pending = { ...body, iouId, hash: iouId, sig: sealed.message.sig };
  maker.ious = maker.ious || {};
  maker.ious[iouId] = pending;
  await appendEntry(maker, 'iou', pending, at);
  await store.set(makerId, maker);
  const other = await store.get(attesterId);
  if (other?.privateKeyJwk) {
    other.ious = other.ious || {};
    other.ious[iouId] = pending;
    await appendEntry(other, 'iou', { ...pending, role: 'received' }, at);
    await rememberInbox(other, { at, kind: 'iou', fromId: makerId, amount, hash: iouId });
    await store.set(attesterId, other);
  }
  return { ok: true, iouId, message: sealed.message, encoded: encodeMessage(sealed.message), balance: replay(maker).balance };
}

async function writeAttested(store, peers, pending, message, at) {
  const payload = {
    iouId: pending.iouId,
    debtorId: pending.debtorId,
    creditorId: pending.creditorId,
    attesterId: pending.attesterId,
    amount: pending.amount,
    unit: pending.unit,
    reference: pending.reference,
    hash: message.hash,
    sig: message.sig,
    mock: true
  };
  for (const peer of Object.values(peers)) {
    if ((peer.tape || []).some((entry) => entry.type === 'attested' && entry.payload?.iouId === pending.iouId)) continue;
    peer.ious = peer.ious || {};
    peer.ious[pending.iouId] = { ...pending, status: 'attested' };
    await appendEntry(peer, 'attested', payload, at);
    await store.set(peer.id, peer);
  }
}

export async function attestIou(store, attesterId, iouId, at = nowIso()) {
  const attester = await store.get(attesterId);
  if (!attester?.privateKeyJwk) return fail(attester ? 'Wallet is locked.' : 'Unknown peer.');
  const pending = attester.ious?.[iouId];
  if (!pending || pending.status === 'refused') return fail('No pending IOU on this book.');
  if (pending.status === 'attested') return { ok: true, duplicate: true, balance: replay(attester).balance };
  if (pending.attesterId !== attesterId) return fail('Only the named attester can sign this IOU.');
  const holders = [pending.debtorId, pending.creditorId];
  const peers = {};
  for (const id of holders) {
    const peer = await store.get(id);
    if (peer?.privateKeyJwk) peers[id] = peer;
  }
  if (!peers[attesterId]) peers[attesterId] = attester;
  const debtor = peers[pending.debtorId];
  if (debtor) {
    const next = applyLegs(replay(debtor).balance, pending.debtorId, [pending]).balance;
    if (floorBlockReason(debtor, next)) return fail(FLOOR_BLOCK);
  }
  const body = {
    simulated: true,
    kind: 'attestation',
    iouId,
    debtorId: pending.debtorId,
    creditorId: pending.creditorId,
    attesterId,
    amount: pending.amount,
    unit: pending.unit,
    reference: pending.reference,
    mock: true
  };
  const sealed = await sealMessage(peers[attesterId], 'attestation', body);
  if (!sealed.ok) return sealed;
  await writeAttested(store, peers, pending, sealed.message, at);
  const balances = {};
  for (const id of Object.keys(peers)) balances[id] = replay(await store.get(id)).balance;
  return { ok: true, message: sealed.message, encoded: encodeMessage(sealed.message), balances, status: 'attested' };
}

export async function refuseAttestation(store, peerId, iouId, statement, at = nowIso()) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const pending = peer.ious?.[iouId];
  if (!pending) return fail('No pending IOU on this book.');
  if (pending.attesterId !== peerId && peerId !== pending.debtorId && peerId !== pending.creditorId) {
    return fail('Only a party or the named attester can refuse.');
  }
  if (pending.status === 'attested') return fail('Already attested. A refusal does not unwind a shown line.');
  const before = replay(peer).balance;
  const text = String(statement || 'REFUSAL').trim() || 'REFUSAL';
  const body = { simulated: true, kind: 'refusal', iouId, peerId, role: pending.attesterId === peerId ? 'attester' : 'party', statement: text };
  const sealed = await sealMessage(peer, 'refusal', body);
  if (!sealed.ok) return sealed;
  const holders = {};
  for (const id of [pending.debtorId, pending.creditorId]) {
    const holder = await store.get(id);
    if (holder?.privateKeyJwk) holders[id] = holder;
  }
  if (!holders[peerId]) holders[peerId] = peer;
  for (const holder of Object.values(holders)) {
    holder.ious = holder.ious || {};
    if (holder.ious[iouId]) holder.ious[iouId] = { ...holder.ious[iouId], status: 'refused' };
    await appendEntry(holder, 'refusal', { iouId, by: peerId, role: body.role, statement: text, hash: sealed.message.hash, sig: sealed.message.sig }, at);
    await store.set(holder.id, holder);
  }
  return { ok: true, status: 'refused', balance: replay(await store.get(peerId)).balance, unchanged: replay(await store.get(peerId)).balance === before, message: sealed.message };
}

async function applyImportedIou(store, peer, message, at) {
  const body = message.body || {};
  if (peer.id !== body.debtorId && peer.id !== body.creditorId) return fail('This IOU does not name this peer.');
  const iouId = message.hash;
  if (peer.ious?.[iouId]) return { ok: true, duplicate: true, balance: replay(peer).balance };
  const pending = { ...body, iouId, status: 'pending', hash: iouId, sig: message.sig };
  peer.ious = peer.ious || {};
  peer.ious[iouId] = pending;
  await appendEntry(peer, 'iou', { ...pending, role: 'received' }, at);
  await rememberInbox(peer, { at, kind: 'iou', fromId: message.fromId, amount: body.amount, hash: iouId });
  await store.set(peer.id, peer);
  return { ok: true, balance: replay(peer).balance, iouId };
}

async function applyImportedAttestation(store, peer, message, at) {
  const body = message.body || {};
  if (message.fromId !== body.attesterId) return fail('The attester signature does not match.');
  if (peer.id !== body.debtorId && peer.id !== body.creditorId) return fail('This attestation does not name this peer.');
  if ((peer.tape || []).some((entry) => entry.type === 'attested' && entry.payload?.iouId === body.iouId)) {
    return { ok: true, duplicate: true, balance: replay(peer).balance };
  }
  if (peer.id === body.debtorId) {
    const next = applyLegs(replay(peer).balance, peer.id, [body]).balance;
    if (floorBlockReason(peer, next)) return fail(FLOOR_BLOCK);
  }
  const pending = peer.ious?.[body.iouId] || body;
  await rememberInbox(peer, { at, kind: 'attestation', fromId: message.fromId, amount: body.amount, hash: message.hash });
  await writeAttested(store, { [peer.id]: peer }, { ...pending, ...body }, message, at);
  return { ok: true, balance: replay(await store.get(peer.id)).balance, status: 'attested' };
}

async function applyImportedRefusal(store, peer, message, at) {
  const body = message.body || {};
  await appendEntry(peer, 'refusal', {
    iouId: body.iouId || null,
    exchangeId: body.exchangeId || null,
    by: body.peerId || message.fromId,
    role: body.role || 'imported',
    statement: body.statement || 'REFUSAL',
    hash: message.hash,
    sig: message.sig
  }, at);
  if (body.iouId && peer.ious?.[body.iouId]) peer.ious[body.iouId] = { ...peer.ious[body.iouId], status: 'refused' };
  await rememberInbox(peer, { at, kind: 'refusal', fromId: message.fromId, hash: message.hash });
  await store.set(peer.id, peer);
  return { ok: true, balance: replay(peer).balance, status: 'refused' };
}

async function applyImportedExchange(store, peer, message, at) {
  const exchange = message.body?.exchange || message.body;
  if (!exchange?.id || !exchange.legs) return fail('The exchange in this message could not be read.');
  const idAgain = await sha256(canonicalJSON(coreOf(exchange)));
  if (idAgain !== exchange.id) return fail('Hash does not match. Import stopped.');
  if (!holderIds(exchange).includes(peer.id)) return fail('This exchange does not name this peer.');
  const existing = peer.exchanges?.[exchange.id];
  if (existing && !coresMatch(existing, exchange)) return fail('Copies disagree. Nothing moved. Reconcile the two books.');
  peer.exchanges = peer.exchanges || {};
  const merged = existing ? { ...existing, signatures: { ...existing.signatures, ...(exchange.signatures || {}) }, status: exchange.status || existing.status, refusal: exchange.refusal || existing.refusal } : exchange;
  peer.exchanges[exchange.id] = merged;
  await appendEntry(peer, message.kind === 'countersign' ? 'countersign' : 'proposal', {
    exchangeId: exchange.id,
    role: 'received',
    kind: exchange.kind,
    legs: exchange.legs,
    charge: exchange.charge,
    thirdSeatId: exchange.thirdSeatId,
    by: message.fromId
  }, at);
  await rememberInbox(peer, { at, kind: message.kind, fromId: message.fromId, hash: message.hash });
  await store.set(peer.id, peer);
  return { ok: true, exchangeId: exchange.id, balance: replay(peer).balance };
}

export async function openTape(input) {
  let data = input;
  try {
    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (trimmed.includes('lgme1.')) {
        const opened = await openMessage(trimmed);
        if (!opened.ok) return opened;
        if (opened.message.kind !== 'tape') return fail('That message is not a tape.');
        data = opened.message.body;
      } else {
        data = JSON.parse(trimmed);
      }
    }
  } catch {
    return fail('The tape could not be read.');
  }
  if (!data?.tape || !data?.publicKeyJwk) return fail('This file is not a tape.');
  const checked = await verifyTape(data);
  if (!checked.ok) return fail(checked.reason || 'Hash link does not verify. Import stopped.');
  return { ok: true, peer: data };
}

export async function exportTapeMessage(peer) {
  return sealMessage(peer, 'tape', toExport(peer));
}

export async function logDispatch(store, peerId, item) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  peer.outbox = peer.outbox || [];
  peer.outbox.push({ ...item, at: item.at || nowIso(), simulated: true });
  await store.set(peerId, peer);
  return { ok: true };
}

export function kycStatus(peer) {
  if (!peer) return 'UNVERIFIED';
  if (peer.kyc?.status === 'VERIFIED') return 'VERIFIED';
  if ((peer.tape || []).some((entry) => entry.type === 'KYC_VOUCHED' || entry.type === 'VERIFIED')) return 'VERIFIED';
  return 'UNVERIFIED';
}

function outboundSent(peer) {
  let sum = 0;
  for (const entry of peer.tape || []) {
    if (entry.type === 'transfer' && entry.payload?.fromId === peer.id && entry.payload?.direction !== 'in') {
      sum = round2(sum + Number(entry.payload.amount || 0));
    }
  }
  return sum;
}

export function sendLimitReason(peer, amount) {
  if (kycStatus(peer) === 'VERIFIED') return '';
  const figure = round2(amount);
  if (!Number.isFinite(figure)) return 'Enter an amount greater than zero.';
  if (figure > UNVERIFIED_SEND_LIMIT + 1e-9 || round2(outboundSent(peer) + heldBy(peer) + figure) > UNVERIFIED_SEND_LIMIT + 1e-9) {
    return `Unverified members can send up to ${UNVERIFIED_SEND_LIMIT} $lgme.`;
  }
  return '';
}

async function requireCode(peer, spec) {
  if (!peer.wallet?.ciphertext) return fail('Set up the 6-digit code first.');
  return unlockWallet(peer, spec.passphrase, spec.code, spec.unixSeconds ?? Math.floor(Date.now() / 1000));
}

export async function startKyc(store, peerId, spec = {}) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  if (kycStatus(peer) === 'VERIFIED') return { ok: true, status: 'VERIFIED' };
  const displayName = String(spec.displayName || peer.name || '').trim();
  if (!displayName) return fail('Add a display name.');
  if (!peer.privateKeyJwk) return fail('Unlock the wallet before signing.');
  const phone = String(spec.phone || '').trim();
  const email = String(spec.email || '').trim();
  peer.kyc = {
    ...(peer.kyc || {}),
    status: 'UNVERIFIED',
    displayName,
    phone,
    email,
    salt: peer.kyc?.salt || bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
    simulated: true
  };
  if (displayName !== peer.name) peer.name = displayName;
  if (!(peer.tape || []).some((entry) => entry.type === 'KYC_STARTED')) {
    await appendEntry(peer, 'KYC_STARTED', { simulated: true, mock: true, displayName }, spec.at || nowIso());
  }
  await store.set(peerId, peer);
  return { ok: true, status: 'UNVERIFIED' };
}

export async function confirmKyc2fa(store, peerId, spec = {}) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  if (kycStatus(peer) === 'VERIFIED') return { ok: true, status: 'VERIFIED' };
  if (!(peer.tape || []).some((entry) => entry.type === 'KYC_STARTED')) return fail('Start with your name first.');
  const unlocked = await requireCode(peer, spec);
  if (!unlocked.ok) return { ok: false, error: unlocked.error, status: kycStatus(peer) };
  if (!(peer.tape || []).some((entry) => entry.type === 'KYC_2FA_OK')) {
    const signer = { ...peer, privateKeyJwk: unlocked.privateKeyJwk || peer.privateKeyJwk };
    await appendEntry(signer, 'KYC_2FA_OK', { simulated: true, mock: true }, spec.at || nowIso());
    signer.privateKeyJwk = peer.wallet?.ciphertext ? null : signer.privateKeyJwk;
    signer.kyc = { ...(signer.kyc || {}), status: 'UNVERIFIED', twoFaOk: true };
    await store.set(peerId, signer);
  }
  const fresh = await store.get(peerId);
  return { ok: true, status: kycStatus(fresh), verified: false };
}

export async function hashCameraPreview(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function keepSelfieHash(store, peerId, hash) {
  if (!/^[0-9a-f]{64}$/i.test(String(hash || ''))) return fail('The preview hash is not ready.');
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  peer.kyc = { ...(peer.kyc || {}), status: peer.kyc?.status || 'UNVERIFIED', selfieHash: String(hash).toLowerCase(), simulated: true };
  await store.set(peerId, peer);
  return { ok: true, selfieHash: peer.kyc.selfieHash };
}

export async function vouchMember(store, voucherId, memberId, spec = {}) {
  const voucher = await store.get(voucherId);
  const member = await store.get(memberId);
  if (!voucher || !member) return fail('Unknown peer.');
  if (voucherId === memberId) return fail('Ask a different verified member.');
  if (kycStatus(voucher) !== 'VERIFIED') return fail('Only a verified member can vouch.');
  if (kycStatus(member) === 'VERIFIED') return { ok: true, status: 'VERIFIED' };
  if (!(member.tape || []).some((entry) => entry.type === 'KYC_2FA_OK')) return fail('The new member still needs to confirm their code.');
  if (!member.privateKeyJwk) return fail('Unlock the new member book first.');
  const unlocked = await requireCode(voucher, spec);
  if (!unlocked.ok) return { ok: false, error: unlocked.error, status: kycStatus(member) };
  const at = spec.at || nowIso();
  const signer = { ...voucher, privateKeyJwk: unlocked.privateKeyJwk || voucher.privateKeyJwk };
  const sealed = await sealMessage(signer, 'attestation', {
    simulated: true,
    kind: 'kyc-vouch',
    memberId,
    voucherId,
    mock: true
  });
  if (!sealed.ok) return sealed;
  const payload = { simulated: true, mock: true, status: 'VERIFIED', voucherId, memberId, hash: sealed.message.hash, sig: sealed.message.sig };
  if (signer.privateKeyJwk) {
    await appendEntry(signer, 'KYC_VOUCHED', payload, at);
    signer.privateKeyJwk = voucher.wallet?.ciphertext ? null : signer.privateKeyJwk;
    await store.set(voucherId, signer);
  }
  const freshMember = await store.get(memberId);
  const memberKey = freshMember.privateKeyJwk;
  if (!memberKey) return fail('The new member book is locked.');
  freshMember.kyc = { ...(freshMember.kyc || {}), status: 'VERIFIED', simulated: true };
  await appendEntry(freshMember, 'KYC_VOUCHED', payload, at);
  await store.set(memberId, freshMember);
  return { ok: true, status: 'VERIFIED' };
}

export async function refuseVouch(store, actorId, memberId, statement, at = nowIso()) {
  const actor = await store.get(actorId);
  const member = await store.get(memberId);
  if (!actor || !member) return fail('Unknown peer.');
  if (!actor.privateKeyJwk) return fail('Wallet is locked.');
  const before = replay(member).balance;
  const text = String(statement || 'REFUSAL').trim() || 'REFUSAL';
  await appendEntry(actor, 'refusal', { simulated: true, mock: true, role: 'third-seat', statement: text, memberId, kind: 'kyc-vouch' }, at);
  await store.set(actorId, actor);
  const fresh = await store.get(memberId);
  if (fresh.privateKeyJwk && actorId !== memberId) {
    await appendEntry(fresh, 'refusal', { simulated: true, mock: true, role: 'third-seat', statement: text, memberId, by: actorId, kind: 'kyc-vouch' }, at);
    fresh.kyc = { ...(fresh.kyc || {}), status: 'UNVERIFIED', simulated: true };
    await store.set(memberId, fresh);
  } else if (actorId === memberId) {
    const self = await store.get(memberId);
    self.kyc = { ...(self.kyc || {}), status: 'UNVERIFIED', simulated: true };
    await store.set(memberId, self);
  }
  const after = await store.get(memberId);
  return {
    ok: true,
    status: kycStatus(after),
    balance: replay(after).balance,
    unchanged: replay(after).balance === before
  };
}

const DEMO_PHONE = { alice: '+12025550101', bob: '+12025550102', charlie: '+12025550103' };

async function markDemoVerified(store, peerId, at) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  peer.kyc = {
    status: 'VERIFIED',
    displayName: peer.name,
    phone: DEMO_PHONE[peerId] || '',
    salt: `sim-salt-${peerId}`,
    simulated: true,
    seeded: true
  };
  await appendEntry(peer, 'VERIFIED', { simulated: true, mock: true, status: 'VERIFIED', seeded: true }, at);
  await store.set(peerId, peer);
  return { ok: true, status: 'VERIFIED' };
}

export function heldBy(peer) {
  const closed = new Set();
  for (const entry of peer?.tape || []) {
    const id = entry.payload?.holdId;
    if (id && (entry.type === 'HOLD_RELEASE' || entry.type === 'HANDOFF')) closed.add(id);
  }
  let sum = 0;
  for (const entry of peer?.tape || []) {
    if (entry.type !== 'HOLD' || entry.payload?.role !== 'buyer') continue;
    if (closed.has(entry.payload.holdId)) continue;
    sum = round2(sum + Number(entry.payload.amount || 0));
  }
  return sum;
}

export function clearingCount(peer) {
  return (peer?.tape || []).filter((entry) => entry.type === 'transfer' || entry.type === 'settlement' || entry.type === 'HANDOFF').length;
}

export function peerStanding(peer) {
  let score = 40;
  if (kycStatus(peer) === 'VERIFIED') score += 30;
  score -= Math.min(40, fraudPenalty(peer) * 20);
  score += Math.min(20, clearingCount(peer) * 2);
  const balance = replay(peer).balance;
  if (balance > terms(peer).floor + 1e-9) score += 10;
  return Math.min(100, score);
}

export function peerProfile(peer, at = nowIso()) {
  const balance = replay(peer).balance;
  const { floor } = terms(peer);
  const aboveFloor = round2(balance - floor);
  const span = Math.max(Math.abs(balance), Math.abs(floor), 1);
  const utilization = balance <= floor + 1e-9 ? 1 : round2(Math.max(0, Math.min(1, 1 - aboveFloor / span)));
  const genesis = (peer.tape || []).find((entry) => entry.type === 'genesis');
  const started = genesis?.at || at;
  const ageDays = Math.max(0, Math.floor((new Date(at).getTime() - new Date(started).getTime()) / 86400000));
  return {
    peerId: peer.id,
    name: peer.name,
    clearingCount: clearingCount(peer),
    balance,
    floor,
    aboveFloor,
    utilization,
    ageDays,
    status: kycStatus(peer),
    standing: peerStanding(peer),
    held: heldBy(peer),
    rewards: rewardTotal(peer)
  };
}

export function listingCore(spec) {
  return {
    simulated: true,
    sellerId: spec.sellerId,
    title: String(spec.title || '').trim(),
    category: String(spec.category || '').trim(),
    condition: String(spec.condition || '').trim(),
    pickup: String(spec.pickup || '').trim(),
    circle: String(spec.circle || '').trim(),
    area: String(spec.area || '').trim(),
    amount: round2(spec.amount),
    referenceId: spec.referenceId || null,
    referenceAvg: spec.referenceAvg == null || spec.referenceAvg === '' ? null : spec.referenceAvg,
    photoHash: String(spec.photoHash || ''),
    kind: spec.kind === 'IwanIT' || spec.kind === 'IprovIT' ? spec.kind : 'ihavIT',
    description: String(spec.description || '').trim(),
    unit: '$lgme'
  };
}

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

export function listingVisible(listing, at = nowIso()) {
  if (!listing || listing.status === 'removed' || listing.status === 'settled') return false;
  if (listing.pinned) return true;
  return new Date(listing.expiresAt).getTime() > new Date(at).getTime();
}

function standingCore(listing) {
  const core = {
    simulated: true,
    pinned: true,
    sellerId: listing.sellerId,
    title: listing.title,
    description: listing.description,
    href: listing.href,
    action: listing.action,
    kinds: listing.kinds,
    photoHash: listing.photoHash,
    unit: '$lgme'
  };
  if (Array.isArray(listing.payments)) core.payments = listing.payments;
  return core;
}

export async function verifyListing(listing) {
  if (!listing) return { ok: false, error: 'No listing.' };
  const originHash = await sha256(canonicalJSON(listing.pinned ? standingCore(listing) : listingCore(listing)));
  if (originHash !== listing.originHash || originHash !== listing.id) return { ok: false, error: 'Origin hash does not match.' };
  const valid = await verifyText(listing.publicKeyJwk, originHash, listing.sig);
  if (!valid) return { ok: false, error: 'Listing signature does not verify.' };
  return { ok: true, originHash };
}

async function loadAll(store) {
  const ids = await store.listIds();
  const peers = [];
  for (const id of ids) {
    const peer = await store.get(id);
    if (peer) peers.push(peer);
  }
  return peers;
}

async function findListing(store, listingId) {
  for (const peer of await loadAll(store)) {
    const listing = peer.listings?.[listingId];
    if (listing) return { peer, listing };
  }
  return null;
}

function spendBlock(buyer, amount) {
  const figure = round2(amount);
  if (!Number.isFinite(figure) || figure <= 0) return 'Enter an amount greater than zero.';
  const limited = sendLimitReason(buyer, figure);
  if (limited) return limited;
  const next = round2(replay(buyer).balance - heldBy(buyer) - figure);
  return floorBlockReason(buyer, next);
}

export async function createListing(store, sellerId, spec = {}) {
  const seller = await store.get(sellerId);
  if (!seller) return fail('Unknown peer.');
  if (!seller.privateKeyJwk) return fail('Wallet is locked.');
  const photo = String(spec.photo || '');
  const photoHash = spec.photoHash || (photo ? await sha256(photo) : '');
  const core = listingCore({ ...spec, sellerId, photoHash });
  if (!core.title) return fail('Name the item.');
  if (!core.category || !core.condition || !core.pickup || !core.circle) return fail('Add category, condition, pickup, and a circle.');
  if (!Number.isFinite(core.amount) || core.amount <= 0) return fail('Enter an amount greater than zero.');
  if (!/^[0-9a-f]{64}$/i.test(core.photoHash)) return fail('Add a photo first.');
  const originHash = await sha256(canonicalJSON(core));
  const sig = await signText(seller.privateKeyJwk, originHash);
  const at = spec.at || nowIso();
  const listing = {
    ...core,
    id: originHash,
    originHash,
    sig,
    publicKeyJwk: seller.publicKeyJwk,
    photo,
    createdAt: at,
    heartbeatAt: at,
    expiresAt: addDays(at, LISTING_DAYS),
    status: 'active'
  };
  seller.listings = seller.listings || {};
  seller.listings[listing.id] = listing;
  await appendEntry(seller, 'listing', {
    listingId: listing.id,
    originHash,
    title: listing.title,
    amount: listing.amount,
    circle: listing.circle,
    expiresAt: listing.expiresAt,
    sig
  }, at);
  await store.set(sellerId, seller);
  return { ok: true, listing };
}

export async function refreshListing(store, sellerId, listingId, at = nowIso()) {
  const seller = await store.get(sellerId);
  const listing = seller?.listings?.[listingId];
  if (!seller || !listing || listing.sellerId !== sellerId) return fail('No listing.');
  if (listing.pinned) return { ok: true, listing };
  if (!seller.privateKeyJwk) return fail('Wallet is locked.');
  const beat = { simulated: true, listingId, originHash: listing.originHash, at };
  const hash = await sha256(canonicalJSON(beat));
  const sig = await signText(seller.privateKeyJwk, hash);
  listing.heartbeatAt = at;
  listing.expiresAt = addDays(at, LISTING_DAYS);
  listing.heartbeat = { hash, sig, at };
  listing.status = 'active';
  await appendEntry(seller, 'heartbeat', { listingId, expiresAt: listing.expiresAt, hash, sig }, at);
  await store.set(sellerId, seller);
  return { ok: true, listing };
}

export async function marketFeed(store, query = {}, at = nowIso()) {
  const cards = [];
  const q = String(query.q || '').trim().toLowerCase();
  const min = query.min === '' || query.min == null ? null : round2(query.min);
  const max = query.max === '' || query.max == null ? null : round2(query.max);
  for (const peer of await loadAll(store)) {
    for (const listing of Object.values(peer.listings || {})) {
      if (!listingVisible(listing, at)) continue;
      if (query.kind && query.kind !== 'all') {
        const kinds = listing.kinds || [listing.kind || 'ihavIT'];
        if (!kinds.includes(query.kind)) continue;
      }
      if (query.category && listing.category !== query.category) continue;
      if (query.condition && listing.condition !== query.condition) continue;
      if (query.pickup && listing.pickup !== query.pickup) continue;
      if (query.circle && listing.circle !== query.circle) continue;
      if (q && !`${listing.title} ${listing.circle} ${listing.area}`.toLowerCase().includes(q)) continue;
      if (!listing.pinned && min != null && Number.isFinite(min) && listing.amount < min) continue;
      if (!listing.pinned && max != null && Number.isFinite(max) && listing.amount > max) continue;
      const checked = await verifyListing(listing);
      cards.push({
        ...listing,
        photo: listing.photo,
        sellerName: peer.name,
        verified: kycStatus(peer) === 'VERIFIED',
        standing: peerStanding(peer),
        signatureOk: checked.ok
      });
    }
  }
  cards.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.pinned && b.pinned) {
      if (a.title === STANDING_DONATION.title) return -1;
      if (b.title === STANDING_DONATION.title) return 1;
    }
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
  return cards;
}

export async function ensureStandingDonation(store, at = nowIso()) {
  const peers = await loadAll(store);
  for (const peer of peers) {
    const found = Object.values(peer.listings || {}).find((listing) => listing.pinned && listing.title === STANDING_DONATION.title);
    if (found) return { ok: true, listing: found };
  }
  const signer = peers.find((peer) => peer.id === 'alice' && peer.privateKeyJwk) || peers.find((peer) => peer.privateKeyJwk);
  if (!signer) return fail('No book can hold the standing listing.');
  const photoHash = await sha256(STANDING_DONATION.photo);
  const draft = {
    sellerId: signer.id,
    title: STANDING_DONATION.title,
    description: STANDING_DONATION.description,
    href: STANDING_DONATION.href,
    action: STANDING_DONATION.action,
    kinds: [...STANDING_DONATION.kinds],
    photoHash
  };
  const originHash = await sha256(canonicalJSON(standingCore(draft)));
  const sig = await signText(signer.privateKeyJwk, originHash);
  const listing = {
    ...standingCore(draft),
    id: originHash,
    originHash,
    sig,
    publicKeyJwk: signer.publicKeyJwk,
    photo: STANDING_DONATION.photo,
    kind: 'ihavIT',
    category: 'Services',
    condition: 'Good',
    pickup: 'Meet',
    circle: 'soBeIT',
    area: '',
    amount: 0,
    referenceId: null,
    referenceAvg: null,
    createdAt: at,
    heartbeatAt: null,
    expiresAt: null,
    status: 'active'
  };
  signer.listings = signer.listings || {};
  signer.listings[listing.id] = listing;
  await appendEntry(signer, 'listing', {
    listingId: listing.id,
    originHash,
    title: listing.title,
    pinned: true,
    href: listing.href,
    expiresAt: null,
    sig
  }, at);
  await store.set(signer.id, signer);
  return { ok: true, listing };
}

async function ensurePinned(store, spec, at) {
  const peers = await loadAll(store);
  for (const peer of peers) {
    const found = Object.values(peer.listings || {}).find((listing) => listing.pinned && listing.title === spec.title);
    if (found) return { ok: true, listing: found };
  }
  const signer = peers.find((peer) => peer.id === 'alice' && peer.privateKeyJwk) || peers.find((peer) => peer.privateKeyJwk);
  if (!signer) return fail('No book can hold the standing listing.');
  const photoHash = await sha256(spec.photo);
  const draft = {
    sellerId: signer.id,
    title: spec.title,
    description: spec.description,
    href: spec.href,
    action: spec.action,
    kinds: [...spec.kinds],
    photoHash,
    payments: spec.payments ? [...spec.payments] : undefined
  };
  const originHash = await sha256(canonicalJSON(standingCore(draft)));
  const sig = await signText(signer.privateKeyJwk, originHash);
  const listing = {
    ...standingCore(draft),
    id: originHash,
    originHash,
    sig,
    publicKeyJwk: signer.publicKeyJwk,
    photo: spec.photo,
    kind: spec.kinds[0] || 'ihavIT',
    category: 'Goods',
    condition: 'Good',
    pickup: 'Pickup',
    circle: spec.kinds.includes('IwanIT') && spec.kinds.length === 1 ? 'Wanted' : 'soBeIT',
    area: spec.kinds.length === 1 ? 'Washington DC area' : '',
    amount: 0,
    referenceId: null,
    referenceAvg: null,
    createdAt: at,
    heartbeatAt: null,
    expiresAt: null,
    status: 'active'
  };
  signer.listings = signer.listings || {};
  signer.listings[listing.id] = listing;
  await appendEntry(signer, 'listing', {
    listingId: listing.id,
    originHash,
    title: listing.title,
    pinned: true,
    href: listing.href,
    expiresAt: null,
    sig
  }, at);
  await store.set(signer.id, signer);
  return { ok: true, listing };
}

export async function ensureStandingWanted(store, at = nowIso()) {
  return ensurePinned(store, STANDING_WANTED, at);
}

export async function ensureStandingRepair(store, at = nowIso()) {
  return ensurePinned(store, STANDING_REPAIR, at);
}

export function normalizeWantedMatch(item) {
  const row = normalizeOfferupItem(item);
  const status = WANTED_STATUSES.includes(item?.status) ? item.status : 'Available';
  const type = String(item?.type || '').trim().toLowerCase();
  return {
    ...row,
    kind: row.kind || 'sell',
    type,
    note: String(item?.note || '').trim(),
    inquiry: String(item?.inquiry || '').trim(),
    sellerSaysWorking: item?.sellerSaysWorking === true,
    status
  };
}

export function wantedFeed(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  return items.map(normalizeWantedMatch).filter((item) => item.title && item.url && (item.kind || item.type));
}

export function workingBadge(item) {
  return item?.sellerSaysWorking === true ? 'Seller says working' : 'Ask if working';
}

export function wantedInquiry(item) {
  if (item?.inquiry) return item.inquiry;
  const title = item?.title || 'item';
  const price = item?.price || 'your price';
  return `Hi! Is your ${title} still available and fully working? I'd offer ${price} after a quick demonstration. What pickup or delivery works? We can continue here on OfferUp, or use lgme.app to record our agreed terms (its in-app balances are simulated).`;
}

export function tailoredDraft(item, spec = {}) {
  const pay = spec.pay === 'service'
    ? '$lgme services (IprovIT). In-app $lgme stays simulated.'
    : spec.pay === 'full' || !spec.pay
      ? 'Pay in full'
      : `Terms over ${spec.pay} months`;
  return [
    'SIMULATION draft. Nothing was sent.',
    spec.channel === 'thumbtack' ? THUMBTACK_CAVEAT : OFFERUP_CAVEAT,
    item?.title || '',
    item?.price ? `Listed price: ${item.price}` : '',
    `Offer amount: ${spec.amount || ''}`,
    pay,
    spec.handoff === 'delivery' ? 'Delivery' : 'Pickup',
    spec.askWorking ? 'Is it fully working?' : '',
    spec.note || '',
    item?.url || ''
  ].filter(Boolean).join('\n');
}

export function tailoredOpenEnabled(status) {
  return status === 'Approved';
}

export function normalizeThumbtack(item) {
  const row = normalizeWantedMatch(item);
  return {
    ...row,
    isIprovIT: item?.isIprovIT === true,
    role: String(item?.role || '').trim(),
    rating: String(item?.rating || '').trim(),
    service: String(item?.service || '').trim()
  };
}

export function thumbtackFeed(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  return items.map(normalizeThumbtack).filter((item) => item.title && item.url);
}

export function thumbtackIprov(catalog) {
  return thumbtackFeed(catalog).filter((item) => item.isIprovIT);
}

export function suggestedWantedPair(items) {
  const list = Array.isArray(items) ? items : [];
  const schwinn = list.find((item) => /Schwinn 810/.test(item.title || ''));
  const elliptical = list.find((item) => /E5500XL/.test(item.title || ''));
  if (!schwinn || !elliptical) return '';
  const total = (offerupAmount(schwinn.price) || 0) + (offerupAmount(elliptical.price) || 0);
  return `Suggested pair: Schwinn 810 + E5500XL = $${total}`;
}

export function wantedMatchDraft(match) {
  return [
    'SIMULATION draft. Nothing was sent.',
    OFFERUP_CAVEAT,
    STANDING_WANTED.title,
    match?.title || '',
    match?.price || '',
    match?.city || '',
    match?.url || '',
    'Cash, terms over 3 to 6 months, or $lgme services (IprovIT).',
    'In-app $lgme stays simulated.'
  ].filter(Boolean).join('\n');
}

export function inviteSellerText(match) {
  return [
    'SIMULATION. Nothing was sent.',
    `You listed ${match?.title || 'an item'} on OfferUp.`,
    `The practice desk is here: ${INVITE_URL}`,
    'In-app $lgme stays simulated.'
  ].join('\n');
}

export async function concludeWantedMatch(store, peerId, match, at = nowIso()) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const title = String(match?.title || '').trim();
  if (!title) return fail('Name the match.');
  const before = replay(peer).balance;
  const work = await recordIdidIt(store, peerId, { work: title, scope: 'OfferUp match', at });
  if (!work.ok) return work;
  await writeOn(store, peerId, 'WANTED_CLOSED', {
    simulated: true,
    title,
    url: String(match?.url || ''),
    receiptId: work.receiptId,
    penalty: false
  }, at);
  return { ok: true, receiptId: work.receiptId, unchanged: replay(await store.get(peerId)).balance === before, penalty: false };
}

export async function circlesOf(store, at = nowIso()) {
  const feed = await marketFeed(store, {}, at);
  const map = new Map();
  for (const card of feed) {
    if (!map.has(card.circle)) map.set(card.circle, { name: card.circle, area: card.area || '', listings: 0, members: new Set() });
    const row = map.get(card.circle);
    row.listings += 1;
    row.members.add(card.sellerId);
    if (card.area && !row.area) row.area = card.area;
  }
  return [...map.values()].map((row) => ({ name: row.name, area: row.area, listings: row.listings, members: [...row.members] }));
}

function dealTerms(thread, amount) {
  return {
    simulated: true,
    kind: 'market-deal',
    threadId: thread.id,
    listingId: thread.listingId,
    buyerId: thread.buyerId,
    sellerId: thread.sellerId,
    amount: round2(amount),
    unit: '$lgme'
  };
}

async function saveThread(store, thread) {
  for (const id of [thread.buyerId, thread.sellerId]) {
    const peer = await store.get(id);
    if (!peer) continue;
    peer.threads = peer.threads || {};
    peer.threads[thread.id] = structuredClone(thread);
    await store.set(id, peer);
  }
}

async function loadThread(store, threadId) {
  for (const peer of await loadAll(store)) {
    if (peer.threads?.[threadId]) return peer.threads[threadId];
  }
  return null;
}

export async function listThreads(store, peerId) {
  const peer = await store.get(peerId);
  return Object.values(peer?.threads || {}).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function openChat(store, buyerId, listingId, at = nowIso()) {
  const found = await findListing(store, listingId);
  if (!found) return fail('That listing is not on this desk.');
  if (!listingVisible(found.listing, at)) return fail('That listing has expired.');
  const buyer = await store.get(buyerId);
  if (!buyer) return fail('Unknown peer.');
  if (buyerId === found.listing.sellerId) return fail('This is your listing.');
  const existing = Object.values(buyer.threads || {}).find((thread) => thread.listingId === listingId && thread.buyerId === buyerId && !['settled', 'refused', 'cancelled'].includes(thread.status));
  if (existing) return { ok: true, thread: existing };
  const id = await sha256(canonicalJSON({ simulated: true, listingId, buyerId, sellerId: found.listing.sellerId, at }));
  const thread = {
    id,
    simulated: true,
    listingId,
    title: found.listing.title,
    buyerId,
    sellerId: found.listing.sellerId,
    amount: found.listing.amount,
    status: 'open',
    messages: [],
    buyerSig: '',
    sellerSig: '',
    termsHash: '',
    holdId: '',
    nonce: '',
    handoffCode: '',
    handoffUsed: false,
    createdAt: at,
    updatedAt: at
  };
  await saveThread(store, thread);
  return { ok: true, thread };
}

async function postLine(store, thread, fromId, text, at) {
  thread.messages.push({ fromId, text, at });
  thread.updatedAt = at;
  await saveThread(store, thread);
  return { ok: true, thread };
}

export async function postChat(store, actorId, threadId, text, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  if (!thread) return fail('No chat.');
  if (actorId !== thread.buyerId && actorId !== thread.sellerId) return fail('You are not in this chat.');
  const line = String(text || '').trim();
  if (!line) return fail('Write a note.');
  return postLine(store, thread, actorId, line, at);
}

async function signTerms(peer, thread, amount) {
  const terms = dealTerms(thread, amount);
  const termsHash = await sha256(canonicalJSON(terms));
  const sig = await signText(peer.privateKeyJwk, termsHash);
  return { terms, termsHash, sig };
}

export async function makeOffer(store, buyerId, threadId, amount, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const buyer = await store.get(buyerId);
  if (!thread || !buyer) return fail('No chat.');
  if (buyerId !== thread.buyerId) return fail('Only the buyer makes the offer.');
  if (!buyer.privateKeyJwk) return fail('Wallet is locked.');
  if (['pending', 'settled'].includes(thread.status)) return fail('This chat already has a signed hold.');
  const blocked = spendBlock(buyer, amount);
  if (blocked) return fail(blocked);
  const signed = await signTerms(buyer, thread, amount);
  thread.amount = signed.terms.amount;
  thread.termsHash = signed.termsHash;
  thread.buyerSig = signed.sig;
  thread.sellerSig = '';
  thread.status = 'offered';
  thread.messages.push({ fromId: buyerId, text: `Offer ${signed.terms.amount} $lgme`, at, kind: 'offer' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  return { ok: true, thread, held: heldBy(buyer) };
}

export async function counterOffer(store, sellerId, threadId, amount, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const seller = await store.get(sellerId);
  const buyer = thread ? await store.get(thread.buyerId) : null;
  if (!thread || !seller || !buyer) return fail('No chat.');
  if (sellerId !== thread.sellerId) return fail('Only the seller counters.');
  if (!seller.privateKeyJwk) return fail('Wallet is locked.');
  if (['pending', 'settled'].includes(thread.status)) return fail('This chat already has a signed hold.');
  const blocked = spendBlock(buyer, amount);
  if (blocked) return fail(blocked);
  const signed = await signTerms(seller, thread, amount);
  thread.amount = signed.terms.amount;
  thread.termsHash = signed.termsHash;
  thread.sellerSig = signed.sig;
  thread.buyerSig = '';
  thread.status = 'countered';
  thread.messages.push({ fromId: sellerId, text: `Counter ${signed.terms.amount} $lgme`, at, kind: 'counter' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  return { ok: true, thread };
}

async function writeHold(store, thread, at) {
  const buyer = await store.get(thread.buyerId);
  const seller = await store.get(thread.sellerId);
  if (!buyer?.privateKeyJwk && !seller?.privateKeyJwk) return fail('Wallet is locked.');
  if (buyer?.privateKeyJwk) {
    const blocked = spendBlock(buyer, thread.amount);
    if (blocked) return fail(blocked);
  }
  const holdId = await sha256(canonicalJSON({ threadId: thread.id, termsHash: thread.termsHash, amount: thread.amount }));
  const payload = {
    simulated: true,
    holdId,
    threadId: thread.id,
    listingId: thread.listingId,
    buyerId: thread.buyerId,
    sellerId: thread.sellerId,
    amount: thread.amount,
    termsHash: thread.termsHash,
    buyerSig: thread.buyerSig,
    sellerSig: thread.sellerSig
  };
  if (buyer?.privateKeyJwk) {
    await appendEntry(buyer, 'HOLD', { ...payload, role: 'buyer' }, at);
    await store.set(thread.buyerId, buyer);
  }
  if (seller?.privateKeyJwk) {
    const freshSeller = await store.get(thread.sellerId);
    await appendEntry(freshSeller, 'HOLD', { ...payload, role: 'seller' }, at);
    await store.set(thread.sellerId, freshSeller);
  }
  thread.holdId = holdId;
  thread.status = 'pending';
  thread.expiresAt = addDays(at, LISTING_DAYS);
  thread.updatedAt = at;
  thread.messages.push({ fromId: 'desk', text: `Pending hold ${thread.amount} $lgme. Final balances have not moved.`, at, kind: 'hold' });
  await saveThread(store, thread);
  return { ok: true, thread, holdId };
}

export async function acceptAndSign(store, actorId, threadId, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const actor = await store.get(actorId);
  if (!thread || !actor) return fail('No chat.');
  if (actorId !== thread.buyerId && actorId !== thread.sellerId) return fail('You are not in this chat.');
  if (!actor.privateKeyJwk) return fail('Wallet is locked.');
  if (thread.status === 'settled') return fail('This chat already settled.');
  if (thread.status === 'pending') return fail('Both signatures are already on the hold.');
  if (!thread.termsHash || !thread.amount) return fail('Name an amount first.');
  const mine = actorId === thread.buyerId ? thread.buyerSig : thread.sellerSig;
  const theirs = actorId === thread.buyerId ? thread.sellerSig : thread.buyerSig;
  if (mine && theirs) return fail('Both signatures are already on the hold.');
  if (!theirs && mine) return fail('Waiting for the other signature.');
  if (!theirs && !mine) return fail('Name an amount first.');
  const signed = await signTerms(actor, thread, thread.amount);
  if (signed.termsHash !== thread.termsHash) return fail('The amount changed. Sign the current terms.');
  if (actorId === thread.buyerId) thread.buyerSig = signed.sig;
  else thread.sellerSig = signed.sig;
  thread.messages.push({ fromId: actorId, text: 'Accept & Sign', at, kind: 'accept' });
  thread.updatedAt = at;
  if (thread.buyerSig && thread.sellerSig) return writeHold(store, thread, at);
  await saveThread(store, thread);
  return { ok: true, thread, pending: false };
}

async function releaseHold(store, thread, type, at) {
  if (!thread.holdId || thread.status !== 'pending') return;
  const payload = { simulated: true, holdId: thread.holdId, threadId: thread.id, amount: thread.amount, listingId: thread.listingId };
  for (const id of [thread.buyerId, thread.sellerId]) {
    const peer = await store.get(id);
    if (!peer?.privateKeyJwk) continue;
    await appendEntry(peer, type, payload, at);
    await store.set(id, peer);
  }
}

export async function refuseDeal(store, actorId, threadId, statement, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const actor = await store.get(actorId);
  if (!thread || !actor) return fail('No chat.');
  if (actorId !== thread.buyerId && actorId !== thread.sellerId) return fail('You are not in this chat.');
  if (thread.status === 'settled') return fail('A settled line stays settled.');
  if (!actor.privateKeyJwk) return fail('Wallet is locked.');
  const buyerBefore = replay(await store.get(thread.buyerId)).balance;
  const sellerBefore = replay(await store.get(thread.sellerId)).balance;
  const text = String(statement || 'REFUSAL').trim() || 'REFUSAL';
  if (thread.status === 'pending') await releaseHold(store, thread, 'HOLD_RELEASE', at);
  const fresh = await store.get(actorId);
  await appendEntry(fresh, 'refusal', {
    simulated: true,
    role: 'third-seat',
    statement: text,
    threadId,
    listingId: thread.listingId,
    penalty: false
  }, at);
  await store.set(actorId, fresh);
  thread.status = 'refused';
  thread.buyerSig = '';
  thread.sellerSig = '';
  thread.holdId = '';
  thread.messages.push({ fromId: actorId, text, at, kind: 'refusal' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  const buyer = await store.get(thread.buyerId);
  const seller = await store.get(thread.sellerId);
  return {
    ok: true,
    thread,
    unchanged: replay(buyer).balance === buyerBefore && replay(seller).balance === sellerBefore,
    held: heldBy(buyer)
  };
}

export async function cancelDeal(store, actorId, threadId, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const actor = await store.get(actorId);
  if (!thread || !actor) return fail('No chat.');
  if (actorId !== thread.buyerId && actorId !== thread.sellerId) return fail('You are not in this chat.');
  if (thread.status === 'settled') return fail('A settled line stays settled.');
  if (!actor.privateKeyJwk) return fail('Wallet is locked.');
  const before = replay(await store.get(thread.buyerId)).balance;
  if (thread.status === 'pending') await releaseHold(store, thread, 'HOLD_RELEASE', at);
  thread.status = 'cancelled';
  thread.holdId = '';
  thread.messages.push({ fromId: actorId, text: 'Cancelled. The hold is released.', at, kind: 'cancel' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  const buyer = await store.get(thread.buyerId);
  return { ok: true, thread, unchanged: replay(buyer).balance === before, held: heldBy(buyer) };
}

export async function expireDeal(store, threadId, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  if (!thread) return fail('No chat.');
  if (thread.status !== 'pending') return { ok: true, thread, expired: false };
  if (new Date(thread.expiresAt).getTime() > new Date(at).getTime()) return { ok: true, thread, expired: false };
  const before = replay(await store.get(thread.buyerId)).balance;
  await releaseHold(store, thread, 'HOLD_RELEASE', at);
  thread.status = 'cancelled';
  thread.holdId = '';
  thread.messages.push({ fromId: 'desk', text: 'The hold expired. Nothing settled.', at, kind: 'expire' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  const buyer = await store.get(thread.buyerId);
  return { ok: true, thread, expired: true, unchanged: replay(buyer).balance === before, held: heldBy(buyer) };
}

export async function buyerHandoff(store, buyerId, threadId, at = nowIso()) {
  const thread = await loadThread(store, threadId);
  const buyer = await store.get(buyerId);
  if (!thread || !buyer) return fail('No chat.');
  if (buyerId !== thread.buyerId) return fail('The buyer shows the handoff.');
  if (thread.status !== 'pending' || !thread.holdId) return fail('Nothing is waiting for handoff.');
  if (thread.handoffUsed) return fail('This handoff was already used.');
  const gate = assertOnline();
  if (!gate.ok) return gate;
  if (!buyer.privateKeyJwk && !buyer.signingKey) return fail('Wallet is locked.');
  if (thread.handoffCode && thread.nonce) return { ok: true, encoded: thread.handoffCode, qr: thread.handoffQr || handoffToken(thread.nonce), nonce: thread.nonce, thread };
  const nonce = await sha256(canonicalJSON({ threadId, holdId: thread.holdId, at, singleUse: true }));
  const sealed = await sealMessage(buyer, 'handoff', {
    simulated: true,
    threadId,
    holdId: thread.holdId,
    nonce,
    amount: thread.amount,
    buyerId: thread.buyerId,
    sellerId: thread.sellerId,
    listingId: thread.listingId
  });
  if (!sealed.ok) return sealed;
  thread.nonce = nonce;
  thread.handoffCode = encodeMessage(sealed.message);
  thread.handoffQr = handoffToken(nonce);
  thread.updatedAt = at;
  await saveThread(store, thread);
  return { ok: true, encoded: thread.handoffCode, qr: thread.handoffQr, nonce, thread };
}

export async function sellerHandoff(store, sellerId, encoded, at = nowIso()) {
  const gate = assertOnline();
  if (!gate.ok) return gate;
  let carried = encoded;
  if (String(encoded || '').trim().startsWith('lgme1q.')) {
    const token = String(encoded).trim();
    const sellerBook = await store.get(sellerId);
    const threads = Object.values(sellerBook?.threads || {});
    const match = threads.find((thread) => thread.handoffQr === token || handoffToken(thread.nonce) === token);
    if (!match?.handoffCode) return fail('Open the handoff link so this book has the body.');
    carried = match.handoffCode;
  }
  const opened = await openMessage(carried);
  if (!opened.ok) return opened;
  if (opened.message.kind !== 'handoff') return fail('This is not a handoff.');
  const body = opened.message.body || {};
  if (body.sellerId !== sellerId) return fail('This handoff is for a different peer.');
  const seller = await store.get(sellerId);
  if (!seller?.privateKeyJwk) return fail('Wallet is locked.');
  const thread = await loadThread(store, body.threadId);
  if (!thread || thread.holdId !== body.holdId) return fail('Nothing is waiting for handoff.');
  if (thread.handoffUsed || thread.status === 'settled' || (thread.nonce && thread.nonce !== body.nonce)) return fail('This handoff was already used.');
  if (thread.status !== 'pending') return fail('Nothing is waiting for handoff.');
  const buyer = await store.get(thread.buyerId);
  if (!buyer?.privateKeyJwk) return fail('Unlock the buyer book on this device, or carry the settlement back.');
  const beforeBuyer = replay(buyer).balance;
  const beforeSeller = replay(seller).balance;
  const sellerSig = await signText(seller.privateKeyJwk, body.nonce);
  const payload = {
    simulated: true,
    holdId: thread.holdId,
    threadId: thread.id,
    listingId: thread.listingId,
    amount: thread.amount,
    fromId: thread.buyerId,
    toId: thread.sellerId,
    nonce: body.nonce,
    buyerSig: opened.message.sig,
    sellerSig
  };
  await appendEntry(buyer, 'HANDOFF', payload, at);
  await appendEntry(buyer, 'transfer', {
    fromId: thread.buyerId,
    toId: thread.sellerId,
    amount: thread.amount,
    unit: '$lgme',
    note: thread.title || 'Market handoff',
    direction: 'out',
    mock: true,
    holdId: thread.holdId
  }, at);
  await store.set(thread.buyerId, buyer);
  const freshSeller = await store.get(sellerId);
  await appendEntry(freshSeller, 'HANDOFF', payload, at);
  await appendEntry(freshSeller, 'transfer', {
    fromId: thread.buyerId,
    toId: thread.sellerId,
    amount: thread.amount,
    unit: '$lgme',
    note: thread.title || 'Market handoff',
    direction: 'in',
    mock: true,
    holdId: thread.holdId
  }, at);
  await store.set(sellerId, freshSeller);
  thread.status = 'settled';
  thread.handoffUsed = true;
  thread.sellerHandoffSig = sellerSig;
  thread.messages.push({ fromId: sellerId, text: `Settled ${thread.amount} $lgme.`, at, kind: 'settled' });
  thread.updatedAt = at;
  await saveThread(store, thread);
  const buyerAfter = await store.get(thread.buyerId);
  const sellerAfter = await store.get(sellerId);
  return {
    ok: true,
    thread,
    buyerBalance: replay(buyerAfter).balance,
    sellerBalance: replay(sellerAfter).balance,
    moved: replay(buyerAfter).balance === round2(beforeBuyer - thread.amount) && replay(sellerAfter).balance === round2(beforeSeller + thread.amount),
    held: heldBy(buyerAfter)
  };
}

async function swatch(label, color) {
  const photo = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${color}"/><text x="8" y="44" fill="#1c1b19" font-size="12">${label}</text></svg>`)}`;
  return { photo, photoHash: await sha256(photo) };
}

export async function seedMarket(store, at = nowIso()) {
  const samples = [
    { sellerId: 'alice', title: 'Walkway tools', category: 'Tools', condition: 'Good', pickup: 'Pickup', circle: 'Walkway', area: 'Near the path', amount: 18, color: '#F97316', label: 'Tools' },
    { sellerId: 'bob', title: 'Tomato starts', category: 'Food', condition: 'Good', pickup: 'Porch', circle: 'Soil', area: 'Garden bench', amount: 12, color: '#86efac', label: 'Food' },
    { sellerId: 'charlie', title: 'Bike tune', category: 'Services', condition: 'Fair', pickup: 'Meet', circle: 'Logistics', area: 'By the shop', amount: 22, color: '#93c5fd', label: 'Tune' }
  ];
  const listings = {};
  for (const sample of samples) {
    const photo = await swatch(sample.label, sample.color);
    const created = await createListing(store, sample.sellerId, { ...sample, ...photo, kind: 'ihavIT', at });
    if (!created.ok) return created;
    listings[sample.sellerId] = created.listing;
  }
  const chat = await openChat(store, 'charlie', listings.alice.id, at);
  if (!chat.ok) return chat;
  const offer = await makeOffer(store, 'charlie', chat.thread.id, 16, at);
  if (!offer.ok) return offer;
  const counter = await counterOffer(store, 'alice', chat.thread.id, 17, at);
  if (!counter.ok) return counter;
  const pendingChat = await openChat(store, 'bob', listings.charlie.id, at);
  if (!pendingChat.ok) return pendingChat;
  const pendingOffer = await makeOffer(store, 'bob', pendingChat.thread.id, 20, at);
  if (!pendingOffer.ok) return pendingOffer;
  const accepted = await acceptAndSign(store, 'charlie', pendingChat.thread.id, at);
  if (!accepted.ok) return accepted;
  const handoff = await buyerHandoff(store, 'bob', pendingChat.thread.id, at);
  if (!handoff.ok) return handoff;
  return { ok: true, listings, threadId: chat.thread.id, pendingThreadId: pendingChat.thread.id };
}

export async function resetAndSeed(store) {
  await store.clear();
  const at = nowIso();
  for (const [id, spec] of Object.entries(DEMO_OPENING)) {
    const created = await createPeer(store, { id, ...spec, at });
    if (!created.ok) return created;
    const verified = await markDemoVerified(store, id, at);
    if (!verified.ok) return verified;
  }
  const soil = await recordIdidIt(store, 'bob', { work: 'Soil credits', scope: 'biomass on the bench', hours: 3, at });
  await recordIdidIt(store, 'alice', { work: 'Walkway clearing', scope: 'path and tools', hours: 2, at });
  await recordIdidIt(store, 'charlie', { work: 'Logistics run', scope: 'delivery', hours: 1, at });
  const proposed = await proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    thirdSeatId: 'charlie',
    amount: 10,
    reference: 'Soil credits',
    charge: 0,
    ididitId: soil.receiptId,
    at
  });
  if (!proposed.ok) return proposed;
  const market = await seedMarket(store, at);
  if (!market.ok) return market;
  const standing = await ensureStandingDonation(store, at);
  if (!standing.ok) return standing;
  const wanted = await ensureStandingWanted(store, at);
  if (!wanted.ok) return wanted;
  const repair = await ensureStandingRepair(store, at);
  if (!repair.ok) return repair;
  return { ok: true, exchangeId: proposed.exchangeId, threadId: market.threadId, pendingThreadId: market.pendingThreadId };
}

export function normalizePhone(value) {
  const raw = String(value || '').trim();
  const keep = raw.startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/g, '');
  return digits ? keep + digits : '';
}

export function telHref(phone) {
  const number = normalizePhone(phone);
  return number ? `tel:${number}` : '';
}

function vouchIds(peer) {
  return (peer?.tape || []).filter((entry) => entry.type === 'KYC_VOUCHED' || entry.type === 'VERIFIED').map((entry) => entry.hash);
}

export async function memberKycHash(peer) {
  if (!peer) return fail('Unknown peer.');
  const salt = String(peer.kyc?.salt || '');
  if (!salt) return fail('The member salt is not on this device.');
  const displayName = String(peer.kyc?.displayName || peer.name || '').trim();
  const phone = normalizePhone(peer.kyc?.phone || '');
  const keyThumb = await sha256(canonicalJSON(peer.publicKeyJwk));
  const hash = await sha256(canonicalJSON({
    simulated: true,
    salt,
    displayName,
    phone,
    vouchIds: vouchIds(peer),
    keyThumb
  }));
  return { ok: true, hash, phone, keyThumb };
}

export async function bindMemberKyc(store, peerId, spec = {}) {
  const peer = await store.get(peerId);
  if (!peer) return fail('Unknown peer.');
  const phone = normalizePhone(spec.phone == null ? peer.kyc?.phone : spec.phone);
  const displayName = String(spec.displayName || peer.kyc?.displayName || peer.name || '').trim();
  if (!displayName) return fail('Add a display name.');
  if (!phone) return fail('Add a phone number on this device.');
  peer.kyc = {
    ...(peer.kyc || {}),
    status: peer.kyc?.status || kycStatus(peer),
    displayName,
    phone,
    salt: spec.salt || peer.kyc?.salt || bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
    simulated: true
  };
  const hashed = await memberKycHash(peer);
  if (!hashed.ok) return hashed;
  peer.kyc.kycHash = hashed.hash;
  await store.set(peerId, peer);
  const tape = JSON.stringify((await store.get(peerId)).tape || []);
  return { ok: true, hash: hashed.hash, phone, onTape: tape.includes(phone) || tape.includes(hashed.hash) };
}

function bindCore(senderId, kycHash, keyThumb) {
  return { simulated: true, kind: 'kyc-bind', senderId, kycHash, keyThumb };
}

function chatCore(message) {
  const core = {
    simulated: true,
    kind: 'chat',
    threadId: message.threadId,
    seq: message.seq,
    prev: message.prev,
    senderId: message.senderId,
    kycHash: message.kycHash,
    keyThumb: message.keyThumb,
    at: message.at,
    text: message.text,
    negotiation: message.negotiation || null
  };
  if (message.media) {
    core.media = {
      hash: message.media.hash,
      mime: message.media.mime,
      size: message.media.size,
      duration: message.media.duration || 0,
      sig: message.media.sig,
      listingId: message.media.listingId || null,
      threadId: message.media.threadId || null,
      ownerId: message.media.ownerId || null
    };
  }
  return core;
}

async function chatAes(privateKeyJwk) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lgme-chat|${privateKeyJwk.d}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function readVault(peer) {
  if (!peer?.chatVault || !peer.privateKeyJwk) return { threads: {} };
  try {
    const key = await chatAes(peer.privateKeyJwk);
    const clear = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBytes(peer.chatVault.iv) },
      key,
      hexToBytes(peer.chatVault.ciphertext)
    );
    const parsed = JSON.parse(new TextDecoder().decode(clear));
    return parsed && typeof parsed === 'object' ? parsed : { threads: {} };
  } catch {
    return { threads: {} };
  }
}

async function writeVault(peer, vault) {
  const key = await chatAes(peer.privateKeyJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(vault))
  );
  peer.chatVault = { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(cipher)) };
}

export async function readChat(store, peerId, threadId) {
  const peer = await store.get(peerId);
  if (!peer) return [];
  const vault = await readVault(peer);
  return structuredClone(vault.threads?.[threadId] || []);
}

export async function listChatThreads(store, peerId) {
  const peer = await store.get(peerId);
  if (!peer) return [];
  const vault = await readVault(peer);
  return Object.entries(vault.threads || {}).map(([id, messages]) => {
    const last = messages[messages.length - 1];
    return { id, length: messages.length, preview: last?.text || '', at: last?.at || '' };
  });
}

export async function auditChat(messages) {
  let prev = GENESIS;
  const hashes = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const hash = await sha256(canonicalJSON(chatCore(message)));
    if (hash !== message.hash || message.prev !== prev || message.seq !== index + 1) {
      return { ok: false, index, hashes };
    }
    hashes.push(hash);
    prev = hash;
  }
  const root = await sha256(canonicalJSON(hashes));
  return { ok: true, hashes, root };
}

export async function chatRoot(messages) {
  const audit = await auditChat(messages);
  if (!audit.ok) return audit;
  return { ok: true, root: audit.root, hashes: audit.hashes, length: audit.hashes.length };
}

export async function matchChat(messages, remoteHashes = [], remoteRoot = '') {
  const audit = await auditChat(messages);
  if (!audit.ok) {
    const local = messages[audit.index] || null;
    return { ok: true, matched: false, index: audit.index, reason: 'tamper', divergent: local ? [{ index: audit.index, seq: local.seq, text: local.text }] : [] };
  }
  const hashes = remoteHashes || [];
  const root = remoteRoot || await sha256(canonicalJSON(hashes));
  const same = audit.root === root && audit.hashes.length === hashes.length && audit.hashes.every((hash, index) => hash === hashes[index]);
  if (same) return { ok: true, matched: true, root: audit.root, divergent: [] };
  let index = 0;
  const limit = Math.max(audit.hashes.length, hashes.length);
  for (; index < limit; index += 1) {
    if (audit.hashes[index] !== hashes[index]) break;
  }
  const local = messages[index] || null;
  return {
    ok: true,
    matched: false,
    index,
    reason: 'diverge',
    root: audit.root,
    divergent: [{ index, seq: local?.seq || index + 1, text: local?.text || '' }]
  };
}

async function rememberContact(peer, spec) {
  peer.contacts = peer.contacts || {};
  const phone = normalizePhone(spec.phone);
  if (!phone) return;
  const prior = peer.contacts[phone];
  if (prior && prior.kycHash !== spec.kycHash) {
    const error = fail('KYC hash does not match.');
    error.mismatch = true;
    return error;
  }
  if (prior && canonicalJSON(prior.publicKeyJwk) !== canonicalJSON(spec.publicKeyJwk)) {
    return fail('KYC hash does not match.');
  }
  peer.contacts[phone] = {
    phone,
    kycHash: spec.kycHash,
    publicKeyJwk: spec.publicKeyJwk,
    senderId: spec.senderId
  };
  return { ok: true };
}

async function assertKycBinding(message) {
  const body = message.body || message;
  const keyThumb = await sha256(canonicalJSON(message.publicKeyJwk));
  if (keyThumb !== body.keyThumb) return fail('KYC hash does not match.');
  const bindHash = await sha256(canonicalJSON(bindCore(body.senderId, body.kycHash, body.keyThumb)));
  const valid = await verifyText(message.publicKeyJwk, bindHash, body.bindSig);
  if (!valid) return fail('KYC hash does not match.');
  return { ok: true, keyThumb };
}

export async function composeChat(store, senderId, spec = {}) {
  const sender = await store.get(senderId);
  if (!sender) return fail('Unknown peer.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return gate;
  if (!sender.privateKeyJwk && !sender.signingKey) return fail('Wallet is locked.');
  const identity = await memberKycHash(sender);
  if (!identity.ok) return identity;
  if (!identity.phone) return fail('Add a phone number on this device.');
  const toPhone = normalizePhone(spec.toPhone || '');
  const toId = String(spec.toId || '').trim();
  if (!toPhone && !toId) return fail('Name the other phone.');
  const text = String(spec.text || '').trim();
  if (!text) return fail('Write a text.');
  const threadId = String(spec.threadId || spec.toId || toPhone);
  const at = spec.at || nowIso();
  const vault = await readVault(sender);
  const prior = vault.threads?.[threadId] || [];
  const seq = prior.length + 1;
  const prev = prior.length ? prior[prior.length - 1].hash : GENESIS;
  const core = chatCore({
    threadId,
    seq,
    prev,
    senderId,
    kycHash: identity.hash,
    keyThumb: identity.keyThumb,
    at,
    text,
    negotiation: spec.negotiation || null,
    media: spec.media || null
  });
  const messageHash = await sha256(canonicalJSON(core));
  const bindSig = await signText(sender.privateKeyJwk, await sha256(canonicalJSON(bindCore(senderId, identity.hash, identity.keyThumb))));
  const body = {
    ...core,
    bindSig,
    senderPhone: identity.phone,
    toId: toId || null,
    toPhone: toPhone || null
  };
  const sealed = await sealMessage(sender, 'chat', body);
  if (!sealed.ok) return sealed;
  await appendEntry(sender, 'CHAT', {
    simulated: true,
    threadId,
    messageHash,
    prev,
    senderKycHash: identity.hash,
    seq,
    at
  }, at);
  const stored = {
    ...core,
    hash: messageHash,
    sig: sealed.message.sig,
    bindSig,
    publicKeyJwk: sender.publicKeyJwk,
    senderPhone: identity.phone,
    toId: body.toId,
    toPhone: body.toPhone
  };
  vault.threads = vault.threads || {};
  vault.threads[threadId] = prior.concat([stored]);
  await writeVault(sender, vault);
  sender.outbox = sender.outbox || [];
  const encoded = encodeMessage(sealed.message);
  const preview = `SIMULATION lgme. This page does not send it.\n${text}\n${encoded}`;
  const links = shareHrefs(toPhone, preview);
  sender.outbox.push({ at, kind: 'chat', channel: 'sms', toPhone, hash: messageHash, simulated: true, text: 'SIMULATION. The page did not send a message.' });
  await store.set(senderId, sender);
  return { ok: true, message: sealed.message, encoded, sms: links.sms, tel: telHref(toPhone), threadId, hash: messageHash, kycHash: identity.hash, seq };
}

export async function acceptChatToken(store, recipientId, input, at = nowIso()) {
  const opened = await openMessage(input);
  if (!opened.ok) return opened;
  if (opened.message.kind !== 'chat') return fail('This is not a signed text.');
  const body = opened.message.body || {};
  const recipient = await store.get(recipientId);
  if (!recipient?.privateKeyJwk) return fail('Wallet is locked.');
  if (body.senderId === recipientId) return fail('This text is already on your book.');
  if (body.toId && body.toId !== recipientId) return fail('This text is for a different peer.');
  const bound = await assertKycBinding(opened.message);
  if (!bound.ok) return bound;
  const coreHash = await sha256(canonicalJSON(chatCore(body)));
  const contactTry = await rememberContact(recipient, {
    phone: body.senderPhone,
    kycHash: body.kycHash,
    publicKeyJwk: opened.message.publicKeyJwk,
    senderId: body.senderId
  });
  if (contactTry && contactTry.ok === false) return contactTry;
  const vault = await readVault(recipient);
  const prior = vault.threads?.[body.threadId] || [];
  const expected = prior.length + 1;
  if (body.seq !== expected) return fail(`Sequence gap at ${body.seq}. Expected ${expected}.`);
  const prev = prior.length ? prior[prior.length - 1].hash : GENESIS;
  if (body.prev !== prev) return fail('Chat hash link does not match.');
  if ((recipient.tape || []).some((entry) => entry.type === 'CHAT' && entry.payload?.messageHash === coreHash && entry.payload?.threadId === body.threadId)) {
    return { ok: true, duplicate: true };
  }
  await appendEntry(recipient, 'CHAT', {
    simulated: true,
    threadId: body.threadId,
    messageHash: coreHash,
    prev,
    senderKycHash: body.kycHash,
    seq: body.seq,
    at: body.at || at
  }, at);
  const stored = {
    ...chatCore(body),
    hash: coreHash,
    sig: opened.message.sig,
    bindSig: body.bindSig,
    publicKeyJwk: opened.message.publicKeyJwk,
    senderPhone: normalizePhone(body.senderPhone),
    toId: body.toId || null,
    toPhone: normalizePhone(body.toPhone)
  };
  vault.threads = vault.threads || {};
  vault.threads[body.threadId] = prior.concat([stored]);
  await writeVault(recipient, vault);
  await store.set(recipientId, recipient);
  return { ok: true, threadId: body.threadId, hash: coreHash, seq: body.seq, kycHash: body.kycHash };
}

export async function composeMatch(store, senderId, threadId, toPhone = '') {
  const sender = await store.get(senderId);
  if (!sender?.privateKeyJwk) return fail('Wallet is locked.');
  const identity = await memberKycHash(sender);
  if (!identity.ok) return identity;
  const messages = await readChat(store, senderId, threadId);
  const audit = await chatRoot(messages);
  if (!audit.ok) return fail(`The local chat breaks at message ${audit.index + 1}.`);
  const body = {
    simulated: true,
    kind: 'chat-match',
    threadId,
    root: audit.root,
    length: audit.length,
    hashes: audit.hashes,
    senderId,
    kycHash: identity.hash,
    keyThumb: identity.keyThumb,
    senderPhone: identity.phone
  };
  body.bindSig = await signText(sender.privateKeyJwk, await sha256(canonicalJSON(bindCore(senderId, identity.hash, identity.keyThumb))));
  const sealed = await sealMessage(sender, 'chat-match', body);
  if (!sealed.ok) return sealed;
  const encoded = encodeMessage(sealed.message);
  const preview = `SIMULATION lgme. Chat root ${audit.root.slice(0, 12)}. This page does not send it.\n${encoded}`;
  return { ok: true, encoded, root: audit.root, hashes: audit.hashes, length: audit.length, sms: shareHrefs(toPhone, preview).sms, preview };
}

export async function acceptMatch(store, recipientId, input) {
  const opened = await openMessage(input);
  if (!opened.ok) return opened;
  if (opened.message.kind !== 'chat-match') return fail('This is not a chat root.');
  const body = opened.message.body || {};
  const recipient = await store.get(recipientId);
  if (!recipient?.privateKeyJwk) return fail('Wallet is locked.');
  const bound = await assertKycBinding(opened.message);
  if (!bound.ok) return bound;
  const contactTry = await rememberContact(recipient, {
    phone: body.senderPhone,
    kycHash: body.kycHash,
    publicKeyJwk: opened.message.publicKeyJwk,
    senderId: body.senderId
  });
  if (contactTry && contactTry.ok === false) return contactTry;
  await store.set(recipientId, recipient);
  const local = await readChat(store, recipientId, body.threadId);
  return matchChat(local, body.hashes || [], body.root || '');
}

export async function recordCall(store, peerId, spec = {}) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk) return fail('Wallet is locked.');
  const peerKycHash = String(spec.peerKycHash || '').trim();
  if (!/^[0-9a-f]{64}$/i.test(peerKycHash)) return fail('The other member hash is missing.');
  const start = spec.start || nowIso();
  const end = spec.end || nowIso();
  if (new Date(end).getTime() < new Date(start).getTime()) return fail('The call ends after it starts.');
  const note = String(spec.note || '').trim();
  await appendEntry(peer, 'CALL', {
    simulated: true,
    start,
    end,
    peerKycHash,
    note
  }, end);
  await store.set(peerId, peer);
  const entry = (await store.get(peerId)).tape.find((row) => row.type === 'CALL' && row.payload?.start === start);
  const packed = JSON.stringify(entry || {});
  return { ok: true, tel: telHref(spec.phone || ''), audio: false, leaked: /audio|recording|wav|mp3/i.test(packed) };
}

export function mediaCore(spec) {
  return {
    simulated: true,
    kind: 'media',
    hash: String(spec.hash || ''),
    mime: String(spec.mime || ''),
    size: Number(spec.size || 0),
    duration: spec.duration == null ? 0 : Number(spec.duration),
    listingId: spec.listingId || null,
    threadId: spec.threadId || null,
    ownerId: spec.ownerId
  };
}

export async function hashBytes(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return bytesToHex(new Uint8Array(digest));
}

async function mediaKey(privateKeyJwk) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`lgme-media|${privateKeyJwk.d}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealMediaBytes(privateKeyJwk, bytes) {
  const key = await mediaKey(privateKeyJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
  return { iv, ciphertext: cipher };
}

export async function openMediaBytes(privateKeyJwk, sealed) {
  const key = await mediaKey(privateKeyJwk);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv }, key, sealed.ciphertext);
  return new Uint8Array(clear);
}

export async function recordMedia(store, ownerId, spec = {}) {
  const owner = await store.get(ownerId);
  if (!owner?.privateKeyJwk) return fail('Wallet is locked.');
  const bytes = spec.bytes ? new Uint8Array(spec.bytes) : null;
  const hash = bytes ? await hashBytes(bytes) : String(spec.hash || '');
  if (!/^[0-9a-f]{64}$/i.test(hash)) return fail('The file hash is not ready.');
  const core = mediaCore({ ...spec, hash, size: bytes ? bytes.byteLength : spec.size, ownerId });
  const coreHash = await sha256(canonicalJSON(core));
  const sig = await signText(owner.privateKeyJwk, coreHash);
  const at = spec.at || nowIso();
  await appendEntry(owner, 'MEDIA', { ...core, sig, coreHash }, at);
  await store.set(ownerId, owner);
  const marker = bytes ? new TextDecoder().decode(bytes) : '';
  const tape = JSON.stringify((await store.get(ownerId)).tape.filter((entry) => entry.type === 'MEDIA').slice(-1));
  return {
    ok: true,
    hash,
    sig,
    coreHash,
    core,
    publicKeyJwk: owner.publicKeyJwk,
    ownerId,
    leaked: marker.length > 8 && tape.includes(marker)
  };
}

export function listMedia(peer, filter = {}) {
  return (peer?.tape || [])
    .filter((entry) => entry.type === 'MEDIA' || entry.type === 'MEDIA_RECEIVED')
    .map((entry) => entry.payload)
    .filter((payload) => !filter.listingId || payload.listingId === filter.listingId)
    .filter((payload) => !filter.threadId || payload.threadId === filter.threadId);
}

export async function verifyMedia(owner, record, bytes) {
  const hash = await hashBytes(bytes);
  if (hash !== record.hash) return { ok: false, authentic: false, error: 'Not authentic' };
  const core = mediaCore({ ...record, hash });
  const coreHash = await sha256(canonicalJSON(core));
  const key = record.publicKeyJwk || owner?.publicKeyJwk;
  if (owner?.publicKeyJwk && record.ownerId === owner.id && canonicalJSON(key) !== canonicalJSON(owner.publicKeyJwk)) {
    return { ok: false, authentic: false, error: 'The signature is not the owner’s.' };
  }
  const valid = key ? await verifyText(key, coreHash, record.sig) : false;
  if (!valid) return { ok: false, authentic: false, error: 'The signature is not the owner’s.' };
  return { ok: true, authentic: true, hash };
}

export async function receiveMedia(store, recipientId, spec = {}) {
  const recipient = await store.get(recipientId);
  if (!recipient?.privateKeyJwk) return fail('Wallet is locked.');
  const bytes = new Uint8Array(spec.bytes || []);
  const hash = await hashBytes(bytes);
  if (hash !== spec.hash) return { ok: false, authentic: false, error: 'Not authentic' };
  const known = spec.ownerId ? await store.get(spec.ownerId) : null;
  if (known && spec.publicKeyJwk && canonicalJSON(known.publicKeyJwk) !== canonicalJSON(spec.publicKeyJwk)) {
    return { ok: false, authentic: false, error: 'The signature is not the owner’s.' };
  }
  const core = mediaCore({ ...spec, hash, size: bytes.byteLength, ownerId: spec.ownerId });
  const coreHash = await sha256(canonicalJSON(core));
  const valid = await verifyText(spec.publicKeyJwk, coreHash, spec.sig);
  if (!valid) return { ok: false, authentic: false, error: 'The signature is not the owner’s.' };
  const at = spec.at || nowIso();
  await appendEntry(recipient, 'MEDIA_RECEIVED', { ...core, sig: spec.sig, coreHash }, at);
  await store.set(recipientId, recipient);
  return { ok: true, authentic: true, hash };
}

export function rewardTotal(peer) {
  let sum = 0;
  for (const entry of peer?.tape || []) {
    if (entry.type === 'REWARD') sum = round2(sum + Number(entry.payload?.amount || 0));
  }
  return sum;
}

function rewardInPeriod(peer, at) {
  const start = new Date(at).getTime() - REWARD_PERIOD_DAYS * 86400000;
  let sum = 0;
  for (const entry of peer?.tape || []) {
    if (entry.type !== 'REWARD') continue;
    if (new Date(entry.at).getTime() < start) continue;
    sum = round2(sum + Number(entry.payload?.amount || 0));
  }
  return sum;
}

export function invoiceCore(spec) {
  const referenceAvg = spec.referenceAvg == null || spec.referenceAvg === '' ? null : spec.referenceAvg;
  return {
    simulated: true,
    kind: 'invoice',
    receiptId: spec.receiptId,
    workerId: spec.workerId,
    payerId: spec.payerId,
    payerPhone: normalizePhone(spec.payerPhone || ''),
    payerKycHash: String(spec.payerKycHash || ''),
    amount: round2(spec.amount),
    referenceId: spec.referenceId || null,
    referenceAvg,
    dueAt: spec.dueAt,
    mediaHashes: Array.isArray(spec.mediaHashes) ? spec.mediaHashes : [],
    unit: '$lgme'
  };
}

function daysPastDue(dueAt, at) {
  return Math.floor((new Date(at).getTime() - new Date(dueAt).getTime()) / 86400000);
}

export function ageBucket(dueAt, at) {
  const days = daysPastDue(dueAt, at);
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  return '60+';
}

function decorateInvoice(row, at) {
  const paid = round2(row.paid || 0);
  const remaining = row.refused || row.donated ? 0 : round2(Math.max(0, row.amount - paid));
  let status = 'open';
  if (row.donated) status = 'donated';
  else if (row.refused) status = 'refused';
  else if (remaining <= 0) status = 'paid';
  else if (daysPastDue(row.dueAt, at) > 0) status = 'overdue';
  else if (daysPastDue(row.dueAt, at) === 0) status = 'due';
  return { ...row, paid, remaining, status, bucket: ageBucket(row.dueAt, at), thanks: row.thanks || '' };
}

export function readInvoices(peer, at = nowIso()) {
  const map = new Map();
  for (const entry of peer?.tape || []) {
    const payload = entry.payload || {};
    if (entry.type === 'INVOICE' && payload.invoiceId) {
      map.set(payload.invoiceId, { ...payload, paid: 0, refused: false, at: entry.at });
    } else if (entry.type === 'INVOICE_PAID' && map.has(payload.invoiceId)) {
      const row = map.get(payload.invoiceId);
      row.paid = round2(row.paid + Number(payload.amount || 0));
    } else if (entry.type === 'INVOICE_REFUSED' && map.has(payload.invoiceId)) {
      map.get(payload.invoiceId).refused = true;
    } else if (entry.type === 'DONATION_CLOSE' && map.has(payload.invoiceId)) {
      const row = map.get(payload.invoiceId);
      row.donated = true;
      row.thanks = payload.message || DONATION_THANKS;
    }
  }
  return [...map.values()].map((row) => {
    const view = decorateInvoice(row, at);
    view.role = peer.id === row.workerId ? 'AR' : peer.id === row.payerId ? 'AP' : '';
    return view;
  });
}

export function sortInvoices(rows, at = nowIso()) {
  const rank = { overdue: 0, due: 1, open: 2, paid: 3, refused: 4, donated: 5 };
  return [...rows].sort((a, b) => {
    const byStatus = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
    if (byStatus) return byStatus;
    return daysPastDue(b.dueAt, at) - daysPastDue(a.dueAt, at);
  });
}

export function overdueInvoices(peer, at = nowIso()) {
  return sortInvoices(readInvoices(peer, at), at).filter((row) => row.status === 'overdue' && row.remaining > 0);
}

export function invoiceBuckets(peer, at = nowIso()) {
  const buckets = { '0-30': 0, '31-60': 0, '60+': 0 };
  for (const row of readInvoices(peer, at)) {
    if (row.role !== 'AR' || row.remaining <= 0 || row.status === 'refused') continue;
    buckets[row.bucket] = round2(buckets[row.bucket] + row.remaining);
  }
  return buckets;
}

export function invoicesToCsv(peer, at = nowIso()) {
  const header = ['role', 'invoiceId', 'receiptId', 'workerId', 'payerId', 'payerPhone', 'amount', 'paid', 'remaining', 'status', 'bucket', 'dueAt'];
  const lines = [header.join(',')];
  for (const row of readInvoices(peer, at)) {
    lines.push([
      row.role, row.invoiceId, row.receiptId, row.workerId, row.payerId, row.payerPhone,
      row.amount, row.paid, row.remaining, row.status, row.bucket, row.dueAt
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));
  }
  return lines.join('\n');
}

async function copyInvoice(store, peerId, payload, at) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk) return;
  if ((peer.tape || []).some((entry) => entry.type === 'INVOICE' && entry.payload?.invoiceId === payload.invoiceId)) return;
  await appendEntry(peer, 'INVOICE', payload, at);
  await store.set(peerId, peer);
}

export async function createInvoice(store, workerId, spec = {}) {
  const worker = await store.get(workerId);
  if (!worker?.privateKeyJwk) return fail('Wallet is locked.');
  const receiptId = String(spec.receiptId || '');
  if (!worker.receipts?.[receiptId] && !(worker.tape || []).some((entry) => entry.type === 'ididit' && entry.payload?.receiptId === receiptId)) {
    return fail('Record the work before invoicing it.');
  }
  const payerId = String(spec.payerId || '').trim();
  const payer = payerId ? await store.get(payerId) : null;
  let payerPhone = normalizePhone(spec.payerPhone || payer?.kyc?.phone || '');
  let payerKycHash = String(spec.payerKycHash || '');
  if (!payerKycHash && payer) {
    const hashed = await memberKycHash(payer);
    if (!hashed.ok) return hashed;
    payerKycHash = hashed.hash;
    if (!payerPhone) payerPhone = hashed.phone;
  }
  if (!payerPhone || !/^[0-9a-f]{64}$/i.test(payerKycHash)) return fail('Address the invoice to a phone and a member hash.');
  const amount = round2(spec.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter an amount greater than zero.');
  const dueAt = spec.dueAt || '';
  if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) return fail('Add a due date.');
  const mediaHashes = (spec.mediaHashes || []).filter((hash) => /^[0-9a-f]{64}$/i.test(hash));
  const core = invoiceCore({ ...spec, workerId, payerId, payerPhone, payerKycHash, amount, dueAt, mediaHashes });
  const invoiceId = await sha256(canonicalJSON(core));
  const sig = await signText(worker.privateKeyJwk, invoiceId);
  const at = spec.at || nowIso();
  const before = replay(worker).balance;
  const payerBefore = payer ? replay(payer).balance : null;
  const payload = { ...core, invoiceId, sig, workerKey: worker.publicKeyJwk };
  await appendEntry(worker, 'INVOICE', payload, at);
  await store.set(workerId, worker);
  if (payer?.privateKeyJwk) await copyInvoice(store, payerId, payload, at);
  const sealed = await sealMessage(worker, 'invoice', payload);
  const encoded = sealed.ok ? encodeMessage(sealed.message) : '';
  return {
    ok: true,
    invoiceId,
    encoded,
    sms: shareHrefs(payerPhone, `SIMULATION lgme. Invoice ${amount} $lgme. This page does not send it.\n${encoded}`).sms,
    balance: replay(await store.get(workerId)).balance,
    unchanged: replay(await store.get(workerId)).balance === before && (payerBefore == null || replay(await store.get(payerId)).balance === payerBefore)
  };
}

export async function acceptInvoice(store, payerId, input, at = nowIso()) {
  const opened = await openMessage(input);
  if (!opened.ok) return opened;
  if (opened.message.kind !== 'invoice') return fail('This is not an invoice.');
  const body = opened.message.body || {};
  if (body.payerId && body.payerId !== payerId) return fail('This invoice is for a different peer.');
  const valid = await verifyText(body.workerKey || opened.message.publicKeyJwk, body.invoiceId, body.sig);
  if (!valid) return fail('The invoice signature does not verify.');
  await copyInvoice(store, payerId, body, at);
  return { ok: true, invoiceId: body.invoiceId };
}

function findInvoice(peer, invoiceId, at) {
  return readInvoices(peer, at).find((row) => row.invoiceId === invoiceId) || null;
}

export async function payInvoice(store, payerId, invoiceId, spec = {}) {
  const payer = await store.get(payerId);
  if (!payer) return fail('Unknown peer.');
  const at = spec.at || nowIso();
  const invoice = findInvoice(payer, invoiceId, at);
  if (!invoice) return fail('That invoice is not on this book.');
  if (invoice.payerId !== payerId) return fail('Only the payer can pay this invoice.');
  if (invoice.refused) return fail('This invoice was refused.');
  if (invoice.remaining <= 0) return fail('This invoice is already paid.');
  const figure = spec.amount == null || spec.amount === '' ? invoice.remaining : round2(spec.amount);
  if (!Number.isFinite(figure) || figure <= 0) return fail('Enter an amount greater than zero.');
  if (figure - invoice.remaining > 1e-9) return fail('That is more than the amount still open.');
  let key = payer.privateKeyJwk;
  if (payer.wallet?.ciphertext) {
    const unlocked = await unlockWallet(payer, spec.passphrase, spec.code, spec.unixSeconds ?? Math.floor(Date.now() / 1000));
    if (!unlocked.ok) return { ok: false, error: unlocked.error, paid: false };
    key = unlocked.privateKeyJwk;
  }
  if (!key) return fail('Set up the 6-digit code first.');
  const limited = sendLimitReason(payer, figure);
  if (limited) return fail(limited);
  const next = round2(replay(payer).balance - heldBy(payer) - figure);
  const blocked = floorBlockReason(payer, next);
  if (blocked) return fail(blocked);
  const worker = await store.get(invoice.workerId);
  if (!worker?.privateKeyJwk) return fail('The worker book is not on this device.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return fail(gate.error);
  const beforePayer = replay(payer).balance;
  const beforeWorker = replay(worker).balance;
  const paymentId = await sha256(canonicalJSON({ invoiceId, amount: figure, at }));
  const paid = {
    simulated: true,
    invoiceId,
    receiptId: invoice.receiptId,
    paymentId,
    amount: figure,
    payerId,
    workerId: invoice.workerId,
    unit: '$lgme'
  };
  const signer = { ...payer, privateKeyJwk: key };
  const moved = await commitSerials(signer, figure, invoice.workerId, at);
  if (!moved.ok) return moved;
  await appendEntry(signer, 'transfer', {
    fromId: payerId,
    toId: invoice.workerId,
    amount: figure,
    unit: '$lgme',
    note: `Invoice ${invoiceId.slice(0, 12)}`,
    direction: 'out',
    mock: true,
    invoiceId,
    receiptId: invoice.receiptId
  }, at);
  await appendEntry(signer, 'INVOICE_PAID', paid, at);
  signer.privateKeyJwk = payer.wallet?.ciphertext ? null : key;
  await store.set(payerId, signer);
  const freshWorker = await store.get(invoice.workerId);
  await appendEntry(freshWorker, 'transfer', {
    fromId: payerId,
    toId: invoice.workerId,
    amount: figure,
    unit: '$lgme',
    note: `Invoice ${invoiceId.slice(0, 12)}`,
    direction: 'in',
    mock: true,
    invoiceId,
    receiptId: invoice.receiptId
  }, at);
  await appendEntry(freshWorker, 'INVOICE_PAID', paid, at);
  let reward = 0;
  const remaining = round2(invoice.remaining - figure);
  if (remaining <= 0) {
    const room = round2(REWARD_CAP - rewardInPeriod(freshWorker, at));
    const raw = round2(invoice.amount * REWARD_RATE);
    reward = round2(Math.max(0, Math.min(raw, room)));
    if (reward > 0) {
      await appendEntry(freshWorker, 'REWARD', {
        simulated: true,
        mock: true,
        label: 'mock',
        unit: '$lgme',
        amount: reward,
        rate: REWARD_RATE,
        invoiceId,
        receiptId: invoice.receiptId
      }, at);
    }
  }
  await store.set(invoice.workerId, freshWorker);
  const payerAfter = replay(await store.get(payerId)).balance;
  const workerAfter = replay(await store.get(invoice.workerId)).balance;
  return {
    ok: true,
    paid: true,
    amount: figure,
    remaining,
    reward,
    receiptId: invoice.receiptId,
    payerBalance: payerAfter,
    workerBalance: workerAfter,
    moved: payerAfter === round2(beforePayer - figure) && workerAfter === round2(beforeWorker + figure + reward)
  };
}

export async function refuseInvoice(store, payerId, invoiceId, statement, at = nowIso()) {
  const payer = await store.get(payerId);
  if (!payer?.privateKeyJwk) return fail('Wallet is locked.');
  const invoice = findInvoice(payer, invoiceId, at);
  if (!invoice) return fail('That invoice is not on this book.');
  if (invoice.payerId !== payerId) return fail('Only the payer can refuse this invoice.');
  if (invoice.status === 'paid') return fail('A settled line stays settled.');
  const before = replay(payer).balance;
  const workerBefore = replay(await store.get(invoice.workerId)).balance;
  const text = String(statement || 'REFUSAL').trim() || 'REFUSAL';
  const payload = {
    simulated: true,
    role: 'third-seat',
    statement: text,
    penalty: false,
    invoiceId,
    receiptId: invoice.receiptId,
    payerId,
    workerId: invoice.workerId
  };
  await appendEntry(payer, 'INVOICE_REFUSED', payload, at);
  await store.set(payerId, payer);
  const worker = await store.get(invoice.workerId);
  if (worker?.privateKeyJwk) {
    await appendEntry(worker, 'INVOICE_REFUSED', payload, at);
    await store.set(invoice.workerId, worker);
  }
  const freshPayer = await store.get(payerId);
  const freshWorker = await store.get(invoice.workerId);
  return {
    ok: true,
    unchanged: replay(freshPayer).balance === before && replay(freshWorker).balance === workerBefore,
    reward: rewardTotal(freshWorker),
    status: findInvoice(freshPayer, invoiceId, at)?.status
  };
}

function grantCore(spec) {
  return {
    simulated: true,
    kind: 'grant',
    mock: true,
    label: 'mock',
    unit: '$lgme',
    memberId: spec.memberId,
    grantorId: spec.grantorId,
    amount: round2(spec.amount),
    reason: String(spec.reason || '').trim(),
    attested: true
  };
}

export async function soBeItGrant(store, grantorId, memberId, spec = {}) {
  const grantor = await store.get(grantorId);
  const member = await store.get(memberId);
  if (!grantor || !member) return fail('Unknown peer.');
  if (!grantor.privateKeyJwk) return fail('Wallet is locked.');
  if (!member.privateKeyJwk) return fail('Unlock the member book first.');
  if (grantorId === memberId) return fail('Name another member.');
  const reason = String(spec.reason || '').trim();
  if (!reason) return fail('Name the reason.');
  const amount = round2(spec.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter an amount greater than zero.');
  const at = spec.at || nowIso();
  const core = grantCore({ memberId, grantorId, amount, reason });
  const hash = await sha256(canonicalJSON(core));
  const sig = await signText(grantor.privateKeyJwk, hash);
  const payload = { ...core, hash, sig, publicKeyJwk: grantor.publicKeyJwk };
  const before = replay(member).balance;
  const grantorBefore = replay(grantor).balance;
  await appendEntry(member, 'GRANT', { ...payload, role: 'member' }, at);
  await store.set(memberId, member);
  const freshGrantor = await store.get(grantorId);
  await appendEntry(freshGrantor, 'GRANT', { ...payload, role: 'grantor' }, at);
  await store.set(grantorId, freshGrantor);
  const memberAfter = replay(await store.get(memberId)).balance;
  const grantorAfter = replay(await store.get(grantorId)).balance;
  return {
    ok: true,
    attested: true,
    balance: memberAfter,
    grantorBalance: grantorAfter,
    moved: memberAfter === round2(before + amount),
    grantorUnchanged: grantorAfter === grantorBefore
  };
}

export async function verifyGrant(entry) {
  const payload = entry?.payload || entry;
  if (!payload) return fail('No grant.');
  const core = grantCore(payload);
  const hash = await sha256(canonicalJSON(core));
  if (hash !== payload.hash) return fail('Hash does not match.');
  const valid = await verifyText(payload.publicKeyJwk, hash, payload.sig);
  if (!valid) return fail('The grantor signature does not verify.');
  return { ok: true, attested: payload.attested === true };
}

function addMonths(iso, months) {
  const date = new Date(iso);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  if (date.getUTCDate() !== day) date.setUTCDate(0);
  return date.toISOString();
}

export function normalizeOfferupItem(item) {
  const kind = ['sell', 'buy', 'give'].includes(item?.kind) ? item.kind : '';
  return {
    title: String(item?.title || '').trim(),
    price: item?.price == null ? '' : String(item.price).trim(),
    city: String(item?.city || '').trim(),
    url: String(item?.url || '').trim(),
    image: String(item?.image || '').trim(),
    kind,
    sourcedAt: String(item?.sourcedAt || '').trim()
  };
}

export function offerupKindLabel(kind) {
  if (kind === 'sell') return 'For sale';
  if (kind === 'give') return 'Free';
  if (kind === 'buy') return 'Wanted';
  return '';
}

export function offerupAmount(price) {
  const match = String(price ?? '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = round2(match[0]);
  return Number.isFinite(number) ? number : null;
}

export function offerupFeed(catalog) {
  const items = Array.isArray(catalog?.items) ? catalog.items : [];
  return items.map(normalizeOfferupItem).filter((item) => item.title && item.url && item.kind);
}

export function termSchedule(amount, months, startAt) {
  const figure = round2(amount);
  const count = Number(months);
  if (!TERM_MONTHS.includes(count)) return fail('Choose 3, 4, 5, or 6 months.');
  if (!Number.isFinite(figure) || figure <= 0) return fail('Enter an amount greater than zero.');
  const base = Math.floor((figure * 100) / count) / 100;
  const installments = [];
  let allocated = 0;
  for (let i = 0; i < count; i += 1) {
    const part = i === count - 1 ? round2(figure - allocated) : base;
    allocated = round2(allocated + part);
    installments.push({ n: i + 1, amount: part, dueAt: addMonths(startAt, i + 1) });
  }
  return { ok: true, installments, total: figure };
}

export function offerupDraft(offer) {
  const cash = offer?.cash;
  const services = offer?.services || [];
  const lines = [
    'SIMULATION draft. Nothing was sent.',
    OFFERUP_CAVEAT,
    offer?.external?.title || '',
    offer?.external?.price || '',
    offer?.external?.city || '',
    offer?.external?.url || ''
  ];
  if (cash?.mode === 'full') lines.push(`Cash in full: ${cash.amount}`);
  if (cash?.mode === 'terms') {
    lines.push(`Term plan: ${cash.amount} over ${cash.months} months`);
    for (const row of cash.schedule || []) lines.push(`  ${row.n}. ${row.amount} due ${String(row.dueAt).slice(0, 10)}`);
  }
  for (const service of services) lines.push(`IprovIT service: ${service.title} (${service.amount} $lgme, simulated)`);
  lines.push('In-app $lgme balances stay simulated. Paste this on OfferUp yourself.');
  return lines.filter(Boolean).join('\n');
}

export function auditAllSerials(peer) {
  const reports = Object.keys(peer?.serials || {}).map((id) => ({ id, ...auditSerial(peer, id) }));
  const bad = reports.find((row) => !row.ok);
  return { ok: !bad, reports, error: bad?.error || '' };
}

function offerParties(offer) {
  return [offer.buyerId, offer.sellerId].filter(Boolean);
}

async function writeOn(store, peerId, type, payload, at) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return null;
  await appendEntry(peer, type, payload, at);
  await store.set(peerId, peer);
  return peer;
}

async function findOffer(store, offerId) {
  for (const peer of await loadAll(store)) {
    const offer = peer.offers?.[offerId];
    if (offer) return { peer, offer };
  }
  return null;
}

export async function signOffer(store, peerId, spec = {}) {
  if (spec.offerId) return countersignOffer(store, peerId, spec.offerId, spec);
  const at = spec.at || nowIso();
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return fail(gate.error);
  const external = spec.external ? normalizeOfferupItem(spec.external) : null;
  if (external && (!external.title || !external.url || !external.kind)) return fail('This OfferUp row is not a listing.');
  let listing = null;
  if (!external) {
    const found = await findListing(store, spec.listingId);
    if (!found) return fail('No listing.');
    listing = found.listing;
  }
  const cashMode = spec.cashMode || '';
  let schedule = [];
  let cashAmount = null;
  if (cashMode === 'full' || cashMode === 'terms') {
    cashAmount = round2(spec.amount ?? (external ? offerupAmount(external.price) : null) ?? listing?.amount);
  }
  if (cashMode === 'terms') {
    const built = termSchedule(cashAmount, spec.months, at);
    if (!built.ok) return built;
    schedule = built.installments;
    cashAmount = built.total;
  } else if (cashMode === 'full' && (!Number.isFinite(cashAmount) || cashAmount <= 0)) {
    return fail('Enter an amount greater than zero.');
  } else if (cashMode && cashMode !== 'full') {
    return fail('Choose cash in full or a term plan.');
  }
  const services = [];
  for (const id of spec.serviceIds || []) {
    const found = await findListing(store, id);
    if (!found || found.listing.kind !== 'IprovIT') return fail('Pick an IprovIT service.');
    services.push({ listingId: id, title: found.listing.title, amount: found.listing.amount, sellerId: found.listing.sellerId });
  }
  if (!cashMode && !services.length) return fail('Choose cash, a term plan, or an IprovIT service.');
  const sellerId = external ? '' : listing.sellerId;
  const buyerId = !external && listing.sellerId === peerId ? String(spec.toId || '').trim() : peerId;
  if (!external && (!buyerId || buyerId === sellerId)) return fail('Name the other party.');
  const kyc = await memberKycHash(peer);
  if (!kyc.ok) return kyc;
  const core = {
    simulated: true,
    buyerId,
    sellerId,
    listingId: listing?.id || '',
    title: external?.title || listing.title,
    external: external || null,
    cash: cashMode ? { mode: cashMode, amount: cashAmount, months: cashMode === 'terms' ? Number(spec.months) : 0, schedule } : null,
    services,
    penalty: false,
    unit: '$lgme'
  };
  const offerId = await sha256(canonicalJSON(core));
  const consentBody = { offerId, peerId, kycHash: kyc.hash, automate: spec.automate === true, passkey: 'fingerprint / face / device PIN (your phone decides)' };
  const hash = await sha256(canonicalJSON(consentBody));
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, hash);
  const offer = {
    ...core,
    id: offerId,
    status: external ? 'draft' : 'awaiting',
    consents: { [peerId]: { ...consentBody, hash, sig, at } },
    invoiceIds: [],
    thanks: ''
  };
  peer.offers = peer.offers || {};
  peer.offers[offerId] = offer;
  await appendEntry(peer, 'OFFER', { ...core, offerId, sig, status: offer.status }, at);
  await store.set(peerId, peer);
  if (buyerId && sellerId) {
    const otherId = peerId === buyerId ? sellerId : buyerId;
    const other = await store.get(otherId);
    if (other) {
      other.offers = other.offers || {};
      other.offers[offerId] = offer;
      await store.set(otherId, other);
    }
  }
  const sealed = await sealMessage(await store.get(peerId), 'offer', offer);
  const draft = external ? offerupDraft(offer) : '';
  return { ok: true, offer, draft, encoded: sealed.ok ? encodeMessage(sealed.message) : '', contract: false, sent: false };
}

export async function countersignOffer(store, peerId, offerId, spec = {}) {
  const at = spec.at || nowIso();
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const gate = assertOnline(spec.navigator);
  if (!gate.ok) return fail(gate.error);
  const found = await findOffer(store, offerId);
  if (!found) return fail('No offer.');
  const offer = structuredClone(found.offer);
  if (offer.external) return fail('An OfferUp draft is copied by hand. This desk does not send it.');
  const parties = offerParties(offer);
  if (!parties.includes(peerId)) return fail('This offer is for someone else.');
  if (offer.status === 'contract' || offer.status === 'donated') return { ok: true, offer, contract: offer.status === 'contract' };
  const kyc = await memberKycHash(peer);
  if (!kyc.ok) return kyc;
  const consentBody = { offerId, peerId, kycHash: kyc.hash, automate: spec.automate === true, passkey: 'fingerprint / face / device PIN (your phone decides)' };
  const hash = await sha256(canonicalJSON(consentBody));
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, hash);
  offer.consents[peerId] = { ...consentBody, hash, sig, at };
  const signed = parties.filter((id) => offer.consents[id]);
  offer.status = signed.length >= 2 ? 'contract' : 'awaiting';
  peer.offers = peer.offers || {};
  peer.offers[offerId] = offer;
  await appendEntry(peer, 'OFFER_CONSENT', { offerId, peerId, hash, sig, status: offer.status, penalty: false }, at);
  await store.set(peerId, peer);
  for (const id of parties) {
    if (id === peerId) continue;
    const other = await store.get(id);
    if (!other) continue;
    other.offers = other.offers || {};
    other.offers[offerId] = offer;
    if (other.privateKeyJwk || other.signingKey) await appendEntry(other, 'OFFER_CONSENT', { offerId, peerId, hash, sig, status: offer.status, penalty: false }, at);
    await store.set(id, other);
  }
  if (offer.status !== 'contract') return { ok: true, offer, contract: false, sent: false };
  const automate = parties.every((id) => offer.consents[id]?.automate === true);
  const invoiceIds = [];
  if (automate && offer.cash?.mode === 'terms') {
    const buyer = await store.get(offer.buyerId);
    const audit = auditAllSerials(buyer);
    await writeOn(store, offer.sellerId, 'SERIAL_AUDIT', { offerId, ok: audit.ok, count: audit.reports.length, error: audit.error, penalty: false }, at);
    await writeOn(store, offer.buyerId, 'SERIAL_AUDIT', { offerId, ok: audit.ok, count: audit.reports.length, error: audit.error, penalty: false }, at);
    if (!audit.ok) return { ok: false, error: audit.error, offer, contract: true };
    for (const row of offer.cash.schedule) {
      const work = await recordIdidIt(store, offer.sellerId, { work: `Installment ${row.n} · ${offer.title}`, scope: offerId, at });
      if (!work.ok) return { ok: false, error: work.error, offer, contract: true };
      const invoice = await createInvoice(store, offer.sellerId, {
        receiptId: work.receiptId,
        payerId: offer.buyerId,
        amount: row.amount,
        dueAt: row.dueAt,
        at
      });
      if (!invoice.ok) return { ok: false, error: invoice.error, offer, contract: true };
      invoiceIds.push(invoice.invoiceId);
    }
  }
  const fresh = await findOffer(store, offerId);
  fresh.offer.invoiceIds = invoiceIds;
  fresh.offer.status = 'contract';
  for (const id of parties) {
    const book = await store.get(id);
    if (!book) continue;
    book.offers = book.offers || {};
    book.offers[offerId] = fresh.offer;
    await store.set(id, book);
  }
  return { ok: true, offer: fresh.offer, contract: true, invoiceIds, sent: false };
}

export async function remindInvoice(store, peerId, invoiceId, at = nowIso()) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const invoice = findInvoice(peer, invoiceId, at);
  if (!invoice) return fail('That invoice is not on this book.');
  if (invoice.donated || invoice.refused || invoice.remaining <= 0) return fail('This invoice is closed.');
  const before = replay(peer).balance;
  const payload = { simulated: true, invoiceId, peerId, penalty: false, remaining: invoice.remaining };
  await appendEntry(peer, 'REMINDER', payload, at);
  await store.set(peerId, peer);
  const otherId = peerId === invoice.workerId ? invoice.payerId : invoice.workerId;
  await writeOn(store, otherId, 'REMINDER', payload, at);
  const after = replay(await store.get(peerId)).balance;
  return { ok: true, penalty: false, unchanged: after === before };
}

function donationConsents(peer, invoiceId) {
  return (peer?.tape || []).filter((entry) => entry.type === 'DONATION_CONSENT' && entry.payload?.invoiceId === invoiceId);
}

export async function consentFloorDonation(store, peerId, invoiceId, at = nowIso()) {
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail(peer ? 'Wallet is locked.' : 'Unknown peer.');
  const invoice = findInvoice(peer, invoiceId, at);
  if (!invoice) return fail('That invoice is not on this book.');
  if (invoice.donated) return { ok: true, status: 'donated', message: DONATION_THANKS, closed: true, penalty: false };
  if (peerId !== invoice.workerId && peerId !== invoice.payerId) return fail('Only the two parties can donate this to the floor.');
  const before = replay(peer).balance;
  const body = { simulated: true, invoiceId, peerId, kind: 'floor-donation', penalty: false };
  const hash = await sha256(canonicalJSON(body));
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, hash);
  const consent = { ...body, hash, sig };
  if (!donationConsents(peer, invoiceId).some((entry) => entry.payload?.peerId === peerId)) {
    await appendEntry(peer, 'DONATION_CONSENT', consent, at);
    await store.set(peerId, peer);
  }
  const otherId = peerId === invoice.workerId ? invoice.payerId : invoice.workerId;
  const other = await store.get(otherId);
  if (other && !donationConsents(other, invoiceId).some((entry) => entry.payload?.peerId === peerId)) {
    await writeOn(store, otherId, 'DONATION_CONSENT', consent, at);
  }
  const mine = await store.get(peerId);
  const seen = new Set(donationConsents(mine, invoiceId).map((entry) => entry.payload?.peerId));
  if (!(seen.has(invoice.workerId) && seen.has(invoice.payerId))) {
    return { ok: true, status: 'awaiting', closed: false, penalty: false, unchanged: replay(mine).balance === before };
  }
  const close = { simulated: true, invoiceId, message: DONATION_THANKS, penalty: false };
  if (!(mine.tape || []).some((entry) => entry.type === 'DONATION_CLOSE' && entry.payload?.invoiceId === invoiceId)) {
    await appendEntry(mine, 'DONATION_CLOSE', close, at);
    await store.set(peerId, mine);
  }
  const otherFresh = await store.get(otherId);
  if (otherFresh && !(otherFresh.tape || []).some((entry) => entry.type === 'DONATION_CLOSE' && entry.payload?.invoiceId === invoiceId)) {
    await writeOn(store, otherId, 'DONATION_CLOSE', close, at);
  }
  return { ok: true, status: 'donated', message: DONATION_THANKS, closed: true, penalty: false, unchanged: replay(await store.get(peerId)).balance === before };
}

export async function consentContractDonation(store, peerId, offerId, at = nowIso()) {
  const found = await findOffer(store, offerId);
  if (!found) return fail('No offer.');
  const parties = offerParties(found.offer);
  if (!parties.includes(peerId)) return fail('Only the two parties can donate this to the floor.');
  const peer = await store.get(peerId);
  if (!peer?.privateKeyJwk && !peer?.signingKey) return fail('Wallet is locked.');
  const mark = { simulated: true, offerId, peerId, kind: 'floor-donation', penalty: false };
  const hash = await sha256(canonicalJSON(mark));
  const sig = await signText(peer.privateKeyJwk || peer.signingKey, hash);
  await appendEntry(peer, 'DONATION_CONSENT', { ...mark, hash, sig, invoiceId: '' }, at);
  await store.set(peerId, peer);
  for (const id of parties) {
    if (id === peerId) continue;
    await writeOn(store, id, 'DONATION_CONSENT', { ...mark, hash, sig, invoiceId: '' }, at);
  }
  const mine = await store.get(peerId);
  const seen = new Set((mine.tape || []).filter((entry) => entry.type === 'DONATION_CONSENT' && entry.payload?.offerId === offerId).map((entry) => entry.payload?.peerId));
  if (!(seen.has(found.offer.buyerId) && seen.has(found.offer.sellerId))) {
    return { ok: true, status: 'awaiting', closed: false, penalty: false };
  }
  for (const invoiceId of found.offer.invoiceIds || []) {
    const book = await store.get(peerId);
    if (findInvoice(book, invoiceId, at) && !findInvoice(book, invoiceId, at).donated) {
      await consentFloorDonation(store, found.offer.buyerId, invoiceId, at);
      await consentFloorDonation(store, found.offer.sellerId, invoiceId, at);
    }
  }
  const close = { simulated: true, offerId, message: DONATION_THANKS, penalty: false };
  for (const id of parties) {
    const book = await store.get(id);
    if (!book) continue;
    if (book.offers?.[offerId]) {
      book.offers[offerId].status = 'donated';
      book.offers[offerId].thanks = DONATION_THANKS;
    }
    if (!(book.tape || []).some((entry) => entry.type === 'DONATION_CLOSE' && entry.payload?.offerId === offerId)) {
      if (book.privateKeyJwk || book.signingKey) await appendEntry(book, 'DONATION_CLOSE', close, at);
    }
    await store.set(id, book);
  }
  return { ok: true, status: 'donated', message: DONATION_THANKS, closed: true, penalty: false };
}
