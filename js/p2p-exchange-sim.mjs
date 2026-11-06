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
  bob: Object.freeze({ name: 'Bob (Agronomist)', balance: -45, creditLimit: -300, floor: 50, floorNote: 'food/rent' }),
  charlie: Object.freeze({ name: 'Charlie (Logistics)', balance: -75, creditLimit: -400, floor: 45, floorNote: 'food/rent' })
});

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
    return `Opening ${payload.balance}. Floor ${payload.floor} ${payload.floorNote || ''}`.trim();
  }
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
  await appendEntry(peer, 'genesis', {
    name,
    balance,
    floor,
    creditLimit,
    floorNote: peer.opening.floorNote,
    publicKeyJwk: keys.publicKeyJwk
  }, spec.at || nowIso());
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
    peers.push({
      id: peer.id,
      name: peer.name,
      publicKeyJwk: peer.publicKeyJwk,
      floor: rule.floor,
      floorNote: rule.floorNote,
      creditLimit: rule.creditLimit,
      balance: view.balance,
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
