/**
 * Peer-to-peer mutual-credit simulation.
 * Each peer's book lives only in that peer's own store key.
 * Signing is local ECDSA. Links are SHA-256. Nothing here opens a network.
 */

export const GENESIS = '0'.repeat(64);
export const FLOOR_BLOCK = 'Blocked: Floor stays senior';
export const PEER_PREFIX = 'lgme-sim:peer:';

export const DEMO_OPENING = Object.freeze({
  alice: Object.freeze({ name: 'Alice (Providore)', balance: 120, creditLimit: -500, floor: 40, floorNote: 'food/rent' }),
  bob: Object.freeze({ name: 'Bob (Agronomist)', balance: 80, creditLimit: -300, floor: 50, floorNote: 'food/rent' }),
  charlie: Object.freeze({ name: 'Charlie (Logistics)', balance: 70, creditLimit: -400, floor: 45, floorNote: 'food/rent' })
});

export const MOCK_GRANT = 100;
export const KDF_ITERATIONS = 100000;

export function layoutMode({ width, coarse = false, uaMobile = false } = {}) {
  const w = Number(width);
  if (w <= 767) return 'phone';
  if (coarse && w <= 1023) return 'phone';
  if (uaMobile && coarse && w <= 1023) return 'phone';
  return 'desk';
}
const MESSAGE_KINDS = new Set(['proposal', 'countersign', 'refusal', 'transfer', 'attestation', 'iou', 'tape']);

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

export async function signText(privateKeyJwk, text) {
  const key = await importPrivate(privateKeyJwk);
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
    floor: genesis.payload.floor,
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
  const sig = await signText(peer.privateKeyJwk, hash);
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
    const valid = await verifyText(peer.publicKeyJwk, entry.hash, entry.sig);
    if (!valid) return { ok: false, index: i, reason: `signature mismatch at #${i}` };
    prev = entry.hash;
  }
  const genesis = peer.tape[0];
  if (genesis.type !== 'genesis') return { ok: false, reason: 'Tape does not open with genesis' };
  if (canonicalJSON(genesis.payload.publicKeyJwk) !== canonicalJSON(peer.publicKeyJwk)) {
    return { ok: false, reason: 'Genesis key does not match this peer' };
  }
  const rule = terms(peer);
  if (peer.opening && (peer.opening.balance !== rule.balance || peer.opening.floor !== rule.floor || peer.opening.creditLimit !== rule.creditLimit)) {
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
  if (!passphrase || String(passphrase).length < 8) return fail('Use a passphrase of at least 8 characters.');
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
  if (!peer?.privateKeyJwk) return fail('Wallet is locked.');
  if (!MESSAGE_KINDS.has(kind)) return fail('Unknown message.');
  const hash = await sha256(canonicalJSON(body));
  const sig = await signText(peer.privateKeyJwk, hash);
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

export async function createTransfer(store, fromId, spec) {
  const from = await store.get(fromId);
  if (!from) return fail('Unknown peer.');
  if (!from.privateKeyJwk) return fail('Wallet is locked.');
  const toId = String(spec.toId || '').trim();
  const amount = round2(spec.amount);
  if (!/^[a-z0-9-]{1,32}$/.test(toId) || toId === fromId) return fail('Name a different peer id.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Enter an amount greater than zero.');
  const next = round2(replay(from).balance - amount);
  const blocked = floorBlockReason(from, next);
  if (blocked) return fail(blocked);
  const at = spec.at || nowIso();
  const body = {
    simulated: true,
    kind: 'transfer',
    fromId,
    toId,
    amount,
    unit: '$lgme',
    note: String(spec.note || '').trim(),
    mock: true
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
  if (!from.wallet?.ciphertext) return { ok: false, error: 'Set up simulated 2FA before auto-send.', sent: false };
  const toId = String(spec.toId || '').trim();
  const amount = round2(spec.amount);
  if (!/^[a-z0-9-]{1,32}$/.test(toId) || toId === fromId) return { ok: false, error: 'Name a different peer id.', sent: false };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter an amount greater than zero.', sent: false };
  const unlocked = await unlockWallet(from, spec.passphrase, spec.code, spec.unixSeconds ?? Math.floor(Date.now() / 1000));
  if (!unlocked.ok) return { ok: false, error: unlocked.error, sent: false };
  const next = round2(replay(from).balance - amount);
  const blocked = floorBlockReason(from, next);
  if (blocked) return { ok: false, error: blocked, sent: false };
  const recipient = await store.get(toId);
  if (recipient && !recipient.privateKeyJwk) {
    return { ok: false, error: 'The recipient book is locked on this device. Nothing was sent.', sent: false };
  }
  const at = spec.at || nowIso();
  const signer = { ...from, privateKeyJwk: unlocked.privateKeyJwk };
  const body = {
    simulated: true,
    kind: 'transfer',
    fromId,
    toId,
    amount,
    unit: '$lgme',
    note: String(spec.note || '').trim(),
    mock: true,
    auto: true
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
  return fail('This message has no place on this book.');
}

async function applyImportedTransfer(store, peer, message, at) {
  const body = message.body || {};
  if (body.toId !== peer.id) return fail('This transfer is addressed to another peer.');
  if ((peer.tape || []).some((entry) => entry.type === 'transfer' && entry.payload?.hash === message.hash)) {
    return { ok: true, duplicate: true, balance: replay(peer).balance };
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

export async function resetAndSeed(store) {
  await store.clear();
  const at = nowIso();
  for (const [id, spec] of Object.entries(DEMO_OPENING)) {
    const created = await createPeer(store, { id, ...spec, at });
    if (!created.ok) return created;
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
  return { ok: true, exchangeId: proposed.exchangeId };
}
