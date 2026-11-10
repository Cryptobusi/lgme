import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { INSTALLED_WAIT_MS, bindInstallLaunch, decideInstallAction, isIosSafari, isStandalone } from '../js/install-launch.mjs';
import * as guard from '../js/p2p-sim-guard.mjs';
import { REFERENCE_LABEL, averagedReference, referenceLine } from '../js/dc-reference.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function books() {
  const store = sim.createMemoryStore();
  for (const [id, spec] of Object.entries(sim.DEMO_OPENING)) {
    const created = await sim.createPeer(store, { id, ...spec, at: '2026-11-06T00:00:00.000Z' });
    assert.equal(created.ok, true, created.error);
  }
  return store;
}

async function balances(store) {
  const out = {};
  for (const id of ['alice', 'bob', 'charlie']) {
    out[id] = sim.replay(await store.get(id)).balance;
  }
  return out;
}

async function readyCoin(store, payerId, payeeId, { amount, invoiceId = '', at, purpose = 'settlement' } = {}) {
  const stamp = new Date(at || new Date().toISOString()).getTime();
  const online = { onLine: true };
  const quoteAt = new Date(stamp - 10000).toISOString();
  const seeAt = new Date(stamp - 8000).toISOString();
  const issueAt = new Date(stamp - 5000).toISOString();
  const opened = await sim.openQuote(store, payerId, {
    usdAmount: amount,
    price: 1,
    priceSource: 'geckoterminal',
    invoiceId,
    otherId: payeeId,
    purpose,
    at: quoteAt,
    history: 'history unavailable',
    navigator: online
  });
  assert.equal(opened.ok, true, opened.error);
  assert.equal((await sim.acknowledgeQuote(store, payerId, { lockId: opened.lock.lockId, at: seeAt, navigator: online })).ok, true);
  assert.equal((await sim.acknowledgeQuote(store, payeeId, { lockId: opened.lock.lockId, at: seeAt, navigator: online })).ok, true);
  const issued = await sim.issueSolanaRequest(store, payerId, { lockId: opened.lock.lockId, at: issueAt, navigator: online });
  assert.equal(issued.ok, true, issued.error);
  return opened.lock;
}

test('floor block', async () => {
  const store = await books();
  const before = await balances(store);
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    thirdSeatId: 'charlie',
    amount: 100,
    reference: 'Soil credits',
    charge: 0,
    at: '2026-11-06T00:01:00.000Z'
  });
  assert.equal(proposed.ok, true, proposed.error);
  const signed = await sim.countersign(store, 'bob', proposed.exchangeId, '2026-11-06T00:02:00.000Z');
  assert.equal(signed.ok, true, signed.error);
  const settled = await sim.settle(store, 'alice', proposed.exchangeId, '2026-11-06T00:03:00.000Z');
  assert.equal(settled.ok, false);
  assert.equal(settled.blocked, true);
  assert.equal(settled.error, 'Blocked: Floor stays senior');
  assert.deepEqual(await balances(store), before);
  const alice = await store.get('alice');
  assert.equal(alice.tape.some((entry) => entry.type === 'settlement'), false);
  assert.equal(alice.tape.some((entry) => entry.type === 'block' && entry.payload.message === sim.FLOOR_BLOCK), true);
  assert.equal(alice.exchanges[proposed.exchangeId].status, 'blocked');
  const edge = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 80,
    reference: 'Down to the floor',
    at: '2026-11-06T00:04:00.000Z'
  });
  await sim.countersign(store, 'bob', edge.exchangeId, '2026-11-06T00:05:00.000Z');
  const held = await sim.settle(store, 'alice', edge.exchangeId, '2026-11-06T00:06:00.000Z');
  assert.equal(held.ok, true, held.error);
  assert.equal(held.balances.alice, 40);
});

test('refusal no-op', async () => {
  const store = await books();
  const before = await balances(store);
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    thirdSeatId: 'charlie',
    amount: 10,
    reference: 'Soil credits',
    charge: 0,
    at: '2026-11-06T00:01:00.000Z'
  });
  assert.equal(proposed.ok, true, proposed.error);
  const refused = await sim.refuse(store, 'charlie', proposed.exchangeId, 'REFUSAL', '2026-11-06T00:02:00.000Z');
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.status, 'refused');
  assert.deepEqual(await balances(store), before);
  const charlie = await store.get('charlie');
  const alice = await store.get('alice');
  const refusal = charlie.tape.find((entry) => entry.type === 'refusal');
  assert.ok(refusal);
  assert.equal(refusal.payload.role, 'third-seat');
  assert.equal(refusal.payload.statement, 'REFUSAL');
  assert.equal('penalty' in refusal.payload, false);
  assert.equal(alice.tape.some((entry) => entry.type === 'refusal'), true);
  assert.equal(alice.tape.some((entry) => entry.type === 'settlement'), false);
  assert.equal(alice.exchanges[proposed.exchangeId].charge, 0);
  assert.equal('penalty' in (alice.exchanges[proposed.exchangeId].refusal), false);
  const settled = await sim.settle(store, 'bob', proposed.exchangeId, '2026-11-06T00:03:00.000Z');
  assert.equal(settled.ok, false);
  assert.match(settled.error, /No balance moves/);
  assert.match(settled.error, /No penalty/);
  assert.deepEqual(await balances(store), before);
});

test('countersign required', async () => {
  const store = await books();
  const before = await balances(store);
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 10,
    reference: 'Walkway clearing',
    charge: 0,
    at: '2026-11-06T00:01:00.000Z'
  });
  assert.equal(proposed.ok, true, proposed.error);
  const early = await sim.settle(store, 'alice', proposed.exchangeId, '2026-11-06T00:02:00.000Z');
  assert.equal(early.ok, false);
  assert.equal(early.error, 'Countersign required');
  assert.deepEqual(await balances(store), before);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'settlement'), false);
  const signed = await sim.countersign(store, 'bob', proposed.exchangeId, '2026-11-06T00:03:00.000Z');
  assert.equal(signed.ok, true, signed.error);
  assert.equal(signed.status, 'countersigned');
  const bobCopy = (await store.get('bob')).exchanges[proposed.exchangeId];
  const aliceCopy = (await store.get('alice')).exchanges[proposed.exchangeId];
  assert.equal(bobCopy.signatures.bob.sig.length > 0, true);
  assert.equal(aliceCopy.signatures.bob.sig, bobCopy.signatures.bob.sig);
  const valid = await sim.verifyText(bobCopy.publicKeys.bob, proposed.exchangeId, bobCopy.signatures.bob.sig);
  assert.equal(valid, true);
  const settled = await sim.settle(store, 'alice', proposed.exchangeId, '2026-11-06T00:04:00.000Z');
  assert.equal(settled.ok, true, settled.error);
  assert.equal(settled.balances.alice, 110);
  assert.equal(settled.balances.bob, 90);
  assert.equal((await balances(store)).charlie, 70);
  const verified = await sim.verifyTape(await store.get('alice'));
  assert.equal(verified.ok, true, verified.reason);
});

test('tamper detection', async () => {
  const store = await books();
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 10,
    reference: 'Walkway clearing',
    at: '2026-11-06T00:01:00.000Z'
  });
  await sim.countersign(store, 'bob', proposed.exchangeId);
  await sim.settle(store, 'alice', proposed.exchangeId);
  const clean = await store.get('alice');
  assert.equal((await sim.verifyTape(clean)).ok, true);
  const tampered = await store.get('alice');
  tampered.tape[0].payload.balance = 1;
  const broken = await sim.verifyTape(tampered);
  assert.equal(broken.ok, false);
  assert.match(broken.reason, /hash mismatch/);
  const unlinked = await store.get('alice');
  unlinked.tape[1].prev = 'f'.repeat(64);
  const link = await sim.verifyTape(unlinked);
  assert.equal(link.ok, false);
  assert.match(link.reason, /previous hash does not link/);
});

test('reconcile mismatch', async () => {
  const store = await books();
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    thirdSeatId: 'charlie',
    amount: 10,
    reference: 'Soil credits',
    at: '2026-11-06T00:01:00.000Z'
  });
  const before = sim.reconcile(await store.get('alice'), await store.get('bob'));
  assert.equal(before.ok, true);
  assert.equal(before.matches.length, 1);
  const bob = await store.get('bob');
  bob.exchanges[proposed.exchangeId].legs[0].amount = 999;
  await store.set('bob', bob);
  const report = sim.reconcile(await store.get('alice'), await store.get('bob'));
  assert.equal(report.ok, false);
  assert.ok(report.mismatches.some((row) => row.field === 'legs'));
  const missing = await store.get('charlie');
  delete missing.exchanges[proposed.exchangeId];
  const gap = sim.reconcile(await store.get('alice'), missing);
  assert.equal(gap.ok, false);
  assert.ok(gap.mismatches.some((row) => row.field === 'presence'));
});

test('cycle settles only on the net, and a floor breach blocks every leg', async () => {
  const store = await books();
  const before = await balances(store);
  const even = await sim.proposeCycle(store, {
    proposerId: 'alice',
    charge: 0,
    at: '2026-11-06T00:01:00.000Z',
    legs: [
      { debtorId: 'alice', creditorId: 'bob', amount: 10, reference: 'Walkway clearing' },
      { debtorId: 'bob', creditorId: 'charlie', amount: 10, reference: 'Soil credits' },
      { debtorId: 'charlie', creditorId: 'alice', amount: 10, reference: 'Logistics run' }
    ]
  });
  assert.equal(even.ok, true, even.error);
  assert.equal((await sim.settle(store, 'alice', even.exchangeId)).error, 'Countersign required');
  await sim.countersign(store, 'bob', even.exchangeId);
  assert.equal((await sim.settle(store, 'alice', even.exchangeId)).error, 'Countersign required');
  await sim.countersign(store, 'charlie', even.exchangeId);
  const settled = await sim.settle(store, 'bob', even.exchangeId);
  assert.equal(settled.ok, true, settled.error);
  assert.deepEqual(await balances(store), before);

  const heavy = await sim.proposeCycle(store, {
    proposerId: 'alice',
    charge: 0,
    legs: [
      { debtorId: 'alice', creditorId: 'bob', amount: 100, reference: 'Over the floor' },
      { debtorId: 'bob', creditorId: 'charlie', amount: 10, reference: 'Soil credits' },
      { debtorId: 'charlie', creditorId: 'alice', amount: 10, reference: 'Logistics run' }
    ]
  });
  await sim.countersign(store, 'bob', heavy.exchangeId);
  await sim.countersign(store, 'charlie', heavy.exchangeId);
  const blocked = await sim.settle(store, 'alice', heavy.exchangeId);
  assert.equal(blocked.error, sim.FLOOR_BLOCK);
  assert.deepEqual(await balances(store), before);
  const alice = await store.get('alice');
  assert.equal(alice.tape.filter((entry) => entry.type === 'settlement').length, 1);
});

test('a new work receipt is refused and an old one still verifies', async () => {
  const store = await books();
  const before = (await balances(store)).alice;
  const closed = await sim.recordIdidIt(store, 'alice', { work: 'Walkway clearing', scope: 'path', hours: 2 });
  assert.equal(closed.ok, false);
  assert.match(closed.error, /closed/);
  assert.equal((await balances(store)).alice, before);
  const legacy = await sim.recordIdidIt(store, 'alice', { work: 'Walkway clearing', scope: 'path', hours: 2, allowLegacyWrite: true });
  assert.equal(legacy.ok, true, legacy.error);
  assert.equal(legacy.balance, before);
  const alice = await store.get('alice');
  const exported = sim.toExport(alice);
  assert.equal(exported.privateKeyJwk, undefined);
  assert.equal(exported.tape.some((entry) => entry.type === 'ididit'), true);
  assert.equal((await sim.verifyTape(exported)).ok, true);
  const opened = await sim.openTape(JSON.stringify(exported));
  assert.equal(opened.ok, true, opened.error);
  assert.equal(sim.entryDetail(opened.peer.tape.find((entry) => entry.type === 'ididit')).includes('Walkway clearing'), true);
  assert.equal(sim.toCsv(alice).includes('Walkway clearing'), true);
  const cited = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 5,
    reference: 'Walkway clearing',
    ididitId: legacy.receiptId
  });
  assert.equal(cited.ok, false);
  assert.match(cited.error, /legacy receipt/);
  const owned = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'bob',
    creditorId: 'alice',
    amount: 5,
    reference: 'Walkway clearing',
    ididitId: legacy.receiptId
  });
  assert.equal(owned.ok, true, owned.error);
});

test('demo seed keeps Bob and Charlie above their floors', () => {
  assert.ok(sim.DEMO_OPENING.bob.balance > sim.DEMO_OPENING.bob.floor);
  assert.ok(sim.DEMO_OPENING.charlie.balance > sim.DEMO_OPENING.charlie.floor);
});

test('TOTP matches the RFC 6238 SHA-1 vectors', async () => {
  const secret = new TextEncoder().encode('12345678901234567890');
  const vectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130']
  ];
  for (const [when, code] of vectors) {
    assert.equal(await sim.totp(secret, when, { digits: 8, period: 30, algorithm: 'SHA-1' }), code);
  }
  assert.equal(await sim.totp(secret, 59, { digits: 6, period: 30, algorithm: 'SHA-1' }), '287082');
});

test('wallet lock and wrong-code rejection', async () => {
  const store = sim.createMemoryStore();
  const created = await sim.registerPeer(store, { id: 'dana', name: 'Dana', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  assert.equal(created.ok, true, created.error);
  const setup = await sim.setupWallet(store, 'dana', 'correct horse', { iterations: 2000 });
  assert.equal(setup.ok, true, setup.error);
  const stored = await store.get('dana');
  assert.equal(stored.privateKeyJwk, null);
  assert.equal(stored.wallet.kdf, 'PBKDF2');
  assert.equal(stored.wallet.cipher, 'AES-GCM');
  assert.equal(stored.wallet.locked, true);
  assert.equal(JSON.stringify(stored).includes(setup.secretBase32), false);
  const secret = sim.base32Decode(setup.secretBase32);
  const now = 1_111_111_111;
  const code = await sim.totp(secret, now, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const wrong = await sim.unlockWallet(stored, 'correct horse', code === '000000' ? '111111' : '000000', now);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.error, 'Wrong code.');
  assert.equal(wrong.privateKeyJwk, undefined);
  assert.equal((await store.get('dana')).privateKeyJwk, null);
  const badPass = await sim.unlockWallet(stored, 'nope nope', code, now);
  assert.equal(badPass.ok, false);
  assert.equal(badPass.error, 'Wrong passphrase.');
  const opened = await sim.unlockWallet(stored, 'correct horse', code, now);
  assert.equal(opened.ok, true, opened.error);
  assert.equal(typeof opened.privateKeyJwk.d, 'string');
  assert.equal((await store.get('dana')).privateKeyJwk, null);
});

test('the 100 genesis grant', async () => {
  const store = sim.createMemoryStore();
  const created = await sim.registerPeer(store, { id: 'dana', name: 'Dana', floor: 40 });
  assert.equal(created.ok, true, created.error);
  const dana = await store.get('dana');
  const genesis = dana.tape[0];
  assert.equal(genesis.type, 'genesis');
  assert.equal(genesis.payload.balance, 100);
  assert.equal(genesis.payload.grant, 100);
  assert.equal(genesis.payload.unit, '$lgme');
  assert.equal(genesis.payload.mock, true);
  assert.equal(genesis.payload.label, 'mock');
  assert.equal(sim.replay(dana).balance, 100);
  assert.ok(sim.replay(dana).balance > sim.terms(dana).floor);
});

test('transfer signature survives export and import, and a tampered import is rejected', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'bob', name: 'Bob', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  const sent = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 10, note: 'milk', at: '2026-11-06T00:01:00.000Z' });
  assert.equal(sent.ok, true, sent.error);
  assert.equal(sent.balance, 90);
  assert.equal(sim.replay(await store.get('bob')).balance, 100);
  const packed = sim.encodeMessage(sent.message);
  const hrefs = sim.shareHrefs('', sim.shareText('10 mock $lgme', packed));
  assert.equal(hrefs.sms.startsWith('sms:'), true);
  assert.equal(hrefs.mailto.startsWith('mailto:'), true);
  const opened = await sim.openMessage(packed);
  assert.equal(opened.ok, true, opened.error);
  assert.equal(await sim.verifyText(opened.message.publicKeyJwk, opened.message.hash, opened.message.sig), true);
  const imported = await sim.importMessage(store, 'bob', packed, '2026-11-06T00:02:00.000Z');
  assert.equal(imported.ok, true, imported.error);
  assert.equal(imported.balance, 110);
  const evil = structuredClone(sent.message);
  evil.body.amount = 999;
  const rejected = await sim.importMessage(store, 'bob', evil, '2026-11-06T00:03:00.000Z');
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /Hash/);
  assert.equal(sim.replay(await store.get('bob')).balance, 110);
  const tape = sim.toExport(await store.get('alice'));
  assert.equal((await sim.openTape(JSON.stringify(tape))).ok, true);
  tape.tape[1].prev = 'f'.repeat(64);
  const broken = await sim.openTape(JSON.stringify(tape));
  assert.equal(broken.ok, false);
  assert.match(broken.error, /previous hash does not link/);
  const report = sim.reconcile(await store.get('bob'), await sim.openTape(sim.toExport(await store.get('bob'))).then((result) => result.peer));
  assert.equal(report.peerB.id, 'bob');
});

test('IOU stays pending until attested, and a refusal moves nothing', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'bob', name: 'Bob', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  const pending = await sim.recordIou(store, 'alice', {
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 25,
    reference: 'Repair',
    at: '2026-11-06T00:01:00.000Z'
  });
  assert.equal(pending.ok, true, pending.error);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
  assert.equal(sim.replay(await store.get('bob')).balance, 100);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'attested'), false);
  const attested = await sim.attestIou(store, 'bob', pending.iouId, '2026-11-06T00:02:00.000Z');
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.status, 'attested');
  assert.equal(sim.replay(await store.get('alice')).balance, 75);
  assert.equal(sim.replay(await store.get('bob')).balance, 125);

  const second = await sim.recordIou(store, 'alice', {
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 5,
    reference: 'Unseen',
    at: '2026-11-06T00:03:00.000Z'
  });
  const before = sim.replay(await store.get('alice')).balance;
  const bobBefore = sim.replay(await store.get('bob')).balance;
  const refused = await sim.refuseAttestation(store, 'bob', second.iouId, 'REFUSAL', '2026-11-06T00:04:00.000Z');
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.status, 'refused');
  assert.equal(sim.replay(await store.get('alice')).balance, before);
  assert.equal(sim.replay(await store.get('bob')).balance, bobBefore);
  const line = (await store.get('bob')).tape.find((entry) => entry.type === 'refusal' && entry.payload.iouId === second.iouId);
  assert.ok(line);
  assert.equal(line.payload.statement, 'REFUSAL');
  assert.equal('penalty' in line.payload, false);
  assert.equal(sim.replay(await store.get('alice')).balance, before);
});

test('auto-delivery happens only after a valid TOTP', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'bob', name: 'Bob', floor: 40, at: '2026-11-06T00:00:00.000Z' });
  const setup = await sim.setupWallet(store, 'alice', 'correct horse', { iterations: 2000 });
  assert.equal(setup.ok, true, setup.error);
  const now = 1_111_111_111;
  const code = await sim.totp(sim.base32Decode(setup.secretBase32), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const wrongCode = code === '000000' ? '111111' : '000000';
  const wrong = await sim.autoDeliverTransfer(store, 'alice', {
    toId: 'bob',
    amount: 10,
    passphrase: 'correct horse',
    code: wrongCode,
    unixSeconds: now
  });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.sent, false);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
  assert.equal(sim.replay(await store.get('bob')).balance, 100);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'transfer'), false);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'transfer'), false);
  const sent = await sim.autoDeliverTransfer(store, 'alice', {
    toId: 'bob',
    amount: 10,
    passphrase: 'correct horse',
    code,
    unixSeconds: now,
    note: 'auto',
    at: '2026-11-06T00:05:00.000Z'
  });
  assert.equal(sent.ok, true, sent.error);
  assert.equal(sent.sent, true);
  assert.equal(sent.delivered, true);
  assert.equal(sim.replay(await store.get('alice')).balance, 90);
  assert.equal(sim.replay(await store.get('bob')).balance, 110);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'transfer'), true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'transfer' && entry.payload.direction === 'in'), true);
  const outbox = (await store.get('alice')).outbox.map((item) => item.channel);
  const inbox = (await store.get('bob')).inbox.map((item) => item.channel);
  assert.ok(outbox.includes('sms') && outbox.includes('email'));
  assert.ok(inbox.includes('sms') && inbox.includes('email'));
  const evil = structuredClone(sent.message);
  evil.body.amount = 999;
  const rejected = await sim.acceptAutoDelivery(store, 'bob', evil, '2026-11-06T00:06:00.000Z');
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /Hash/);
  assert.equal(sim.replay(await store.get('bob')).balance, 110);
  assert.equal(sim.layoutMode({ width: 390, coarse: true, uaMobile: true }), 'phone');
  assert.equal(sim.layoutMode({ width: 768, coarse: true, uaMobile: true }), 'phone');
  assert.equal(sim.layoutMode({ width: 1280, coarse: false, uaMobile: true }), 'desk');
});

test('unverified members can send only up to 20 and can still receive', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'dana', name: 'Dana', floor: 0, at: '2026-11-06T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-06T00:00:00.000Z' });
  const alice = await store.get('alice');
  alice.kyc = { status: 'VERIFIED', simulated: true };
  await store.set('alice', alice);
  assert.equal(sim.kycStatus(await store.get('dana')), 'UNVERIFIED');
  const over = await sim.createTransfer(store, 'dana', { toId: 'alice', amount: 21, at: '2026-11-06T00:01:00.000Z' });
  assert.equal(over.ok, false);
  assert.match(over.error, /20 \$lgme/);
  assert.equal(sim.replay(await store.get('dana')).balance, 100);
  const small = await sim.createTransfer(store, 'dana', { toId: 'alice', amount: 20, at: '2026-11-06T00:02:00.000Z' });
  assert.equal(small.ok, true, small.error);
  assert.equal(sim.replay(await store.get('dana')).balance, 80);
  const more = await sim.createTransfer(store, 'dana', { toId: 'alice', amount: 1, at: '2026-11-06T00:03:00.000Z' });
  assert.equal(more.ok, false);
  const gift = await sim.createTransfer(store, 'alice', { toId: 'dana', amount: 50, at: '2026-11-06T00:04:00.000Z' });
  assert.equal(gift.ok, true, gift.error);
  await sim.importMessage(store, 'dana', small.message, '2026-11-06T00:05:00.000Z');
  await sim.importMessage(store, 'dana', gift.message, '2026-11-06T00:06:00.000Z');
  assert.equal(sim.replay(await store.get('dana')).balance, 130);
});

test('KYC needs a valid code, a voucher code, and a refusal does not verify', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'dana', name: 'Dana', floor: 0, at: '2026-11-06T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-06T00:00:00.000Z' });
  const started = await sim.startKyc(store, 'dana', { displayName: 'Dana', phone: '555', email: 'dana@example.com', at: '2026-11-06T00:01:00.000Z' });
  assert.equal(started.ok, true, started.error);
  assert.equal((await store.get('dana')).tape.some((entry) => entry.type === 'KYC_STARTED'), true);
  const startedPayload = (await store.get('dana')).tape.find((entry) => entry.type === 'KYC_STARTED').payload;
  assert.equal(startedPayload.phone, undefined);
  assert.equal(JSON.stringify(startedPayload).includes('555'), false);
  assert.equal(JSON.stringify(startedPayload).includes('dana@example.com'), false);
  const early = await sim.confirmKyc2fa(store, 'dana', { passphrase: 'correct horse', code: '000000', unixSeconds: 59 });
  assert.equal(early.ok, false);
  const setup = await sim.setupWallet(store, 'dana', 'correct horse', { iterations: 2000 });
  const now = 1_111_111_111;
  const code = await sim.totp(sim.base32Decode(setup.secretBase32), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const wrong = await sim.confirmKyc2fa(store, 'dana', { passphrase: 'correct horse', code: code === '000000' ? '111111' : '000000', unixSeconds: now });
  assert.equal(wrong.ok, false);
  assert.equal((await store.get('dana')).tape.some((entry) => entry.type === 'KYC_2FA_OK'), false);
  assert.equal(sim.kycStatus(await store.get('dana')), 'UNVERIFIED');
  const confirmed = await sim.confirmKyc2fa(store, 'dana', { passphrase: 'correct horse', code, unixSeconds: now, at: '2026-11-06T00:02:00.000Z' });
  assert.equal(confirmed.ok, true, confirmed.error);
  assert.equal(confirmed.verified, false);
  assert.equal(sim.kycStatus(await store.get('dana')), 'UNVERIFIED');
  const alice = await store.get('alice');
  alice.kyc = { status: 'VERIFIED', simulated: true };
  await store.set('alice', alice);
  const aliceSetup = await sim.setupWallet(store, 'alice', 'voucher pass', { iterations: 2000 });
  const aliceCode = await sim.totp(sim.base32Decode(aliceSetup.secretBase32), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const danaKey = await sim.unlockWallet(await store.get('dana'), 'correct horse', code, now);
  const dana = await store.get('dana');
  dana.privateKeyJwk = danaKey.privateKeyJwk;
  await store.set('dana', dana);
  const badVouch = await sim.vouchMember(store, 'alice', 'dana', { passphrase: 'voucher pass', code: '999999', unixSeconds: now });
  assert.equal(badVouch.ok, false);
  assert.equal(sim.kycStatus(await store.get('dana')), 'UNVERIFIED');
  const refused = await sim.refuseVouch(store, 'alice', 'dana', 'REFUSAL', '2026-11-06T00:03:00.000Z');
  assert.equal(refused.ok, false);
  const aliceOpen = await sim.unlockWallet(await store.get('alice'), 'voucher pass', aliceCode, now);
  const aliceBook = await store.get('alice');
  aliceBook.privateKeyJwk = aliceOpen.privateKeyJwk;
  await store.set('alice', aliceBook);
  const before = sim.replay(await store.get('dana')).balance;
  const no = await sim.refuseVouch(store, 'alice', 'dana', 'REFUSAL', '2026-11-06T00:04:00.000Z');
  assert.equal(no.ok, true, no.error);
  assert.equal(no.status, 'UNVERIFIED');
  assert.equal(sim.replay(await store.get('dana')).balance, before);
  const line = (await store.get('alice')).tape.find((entry) => entry.type === 'refusal');
  assert.equal(line.payload.statement, 'REFUSAL');
  assert.equal('penalty' in line.payload, false);
  const yes = await sim.vouchMember(store, 'alice', 'dana', { passphrase: 'voucher pass', code: aliceCode, unixSeconds: now, at: '2026-11-06T00:05:00.000Z' });
  assert.equal(yes.ok, true, yes.error);
  assert.equal(yes.status, 'VERIFIED');
  assert.equal((await store.get('dana')).tape.some((entry) => entry.type === 'KYC_VOUCHED'), true);
  const preview = new TextEncoder().encode('simulated-preview');
  const hash = await sim.hashCameraPreview(preview);
  const kept = await sim.keepSelfieHash(store, 'dana', hash);
  assert.equal(kept.ok, true, kept.error);
  assert.equal(JSON.stringify(await store.get('dana')).includes('simulated-preview'), false);
});

test('resources magazine keeps the explainer sections', () => {
  const text = readFileSync(join(root, 'js/p2p-resources.mjs'), 'utf8');
  for (const phrase of [
    'Alice, Bob, and Charlie',
    'Fifteen exchanges',
    'Ride share',
    'Bookkeeping',
    'How an open item is resolved',
    'Settled dashboard',
    'The refusal',
    'The unresolved line',
    'Mutual credit',
    'Deployment manifest',
    'The third seat',
    'The broken car',
    'Market',
    'IprovIT',
    'Found on OfferUp (DC area)',
    'Reconcile as donation to the floor',
    'THANK YOU FOR YOUR SUPPORT.',
    'How this desk stays shut'
  ]) {
    assert.equal(text.includes(phrase), true, phrase);
  }
});

test('pages stay simulation-only', () => {
  const files = [
    'js/p2p-exchange-sim.mjs',
    'js/p2p-exchange-sim-ui.mjs',
    'js/p2p-resources.mjs',
    'exchange.html',
    'manifest.webmanifest',
    'lgme-coin.html'
  ];
  const banned = ['0.0.489104', 'hederica.com', 'lgme.hederica.com', '$Trust', 'XMLHttpRequest', 'WebSocket'];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const word of banned) assert.equal(text.includes(word), false, `${file} contains ${word}`);
  }
  const engine = readFileSync(join(root, 'js/p2p-exchange-sim.mjs'), 'utf8');
  assert.equal(engine.includes('fetch('), false);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(ui.includes("fetch('/data/dc-reference-values-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/offerup-dc-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/offerup-wanted-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/thumbtack-wanted-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/payment-methods.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/sourcing-daily.json', { signal: gate.signal })"), true);
  assert.equal((ui.match(/fetch\(/g) || []).length, 6);
  const design = readFileSync(join(root, 'docs/marketplace-design.md'), 'utf8');
  for (const word of banned) assert.equal(design.includes(word), false, `docs/marketplace-design.md contains ${word}`);
  assert.equal(design.includes('Trust Score'), false);
  assert.equal(design.includes('Peer standing'), true);
});

async function sampleListing(store, sellerId, spec = {}) {
  const photo = spec.photo || 'data:image/svg+xml,listing';
  return sim.createListing(store, sellerId, {
    title: spec.title || 'Hand saw',
    category: spec.category || 'Tools',
    condition: spec.condition || 'Good',
    pickup: spec.pickup || 'Pickup',
    circle: spec.circle || 'Walkway',
    area: spec.area || 'Near the path',
    amount: spec.amount ?? 12,
    kind: spec.kind,
    photo,
    photoHash: await sim.sha256(photo),
    at: spec.at || '2026-11-06T00:00:00.000Z'
  });
}

test('a listing signature and origin hash verify', async () => {
  const store = await books();
  const created = await sampleListing(store, 'alice', { title: 'Walkway tools', amount: 18 });
  assert.equal(created.ok, true, created.error);
  const checked = await sim.verifyListing(created.listing);
  assert.equal(checked.ok, true, checked.error);
  assert.equal(created.listing.id, created.listing.originHash);
  const tampered = { ...created.listing, title: 'Different tools' };
  const broken = await sim.verifyListing(tampered);
  assert.equal(broken.ok, false);
  assert.match(broken.error, /Origin hash/);
  const resigned = { ...created.listing, sig: 'aa' };
  const badSig = await sim.verifyListing(resigned);
  assert.equal(badSig.ok, false);
  assert.match(badSig.error, /signature/i);
});

test('an expired listing is hidden until a signed heartbeat', async () => {
  const store = await books();
  const created = await sampleListing(store, 'bob', { at: '2026-01-01T00:00:00.000Z', title: 'Tomato starts' });
  assert.equal(created.ok, true, created.error);
  const later = '2026-02-01T00:00:00.000Z';
  assert.equal(sim.listingVisible(created.listing, later), false);
  const hidden = await sim.marketFeed(store, {}, later);
  assert.equal(hidden.some((card) => card.id === created.listing.id), false);
  const refreshed = await sim.refreshListing(store, 'bob', created.listing.id, later);
  assert.equal(refreshed.ok, true, refreshed.error);
  const beat = (await store.get('bob')).tape.find((entry) => entry.type === 'heartbeat');
  assert.equal(await sim.verifyText(created.listing.publicKeyJwk, beat.payload.hash, beat.payload.sig), true);
  assert.equal(sim.listingVisible(refreshed.listing, later), true);
  const shown = await sim.marketFeed(store, {}, later);
  assert.equal(shown.some((card) => card.id === created.listing.id), true);
});

test('offer, counter, and accept hold the line without moving final balances', async () => {
  const store = await books();
  const created = await sampleListing(store, 'bob', { amount: 12, title: 'Tomato starts' });
  const chat = await sim.openChat(store, 'alice', created.listing.id, '2026-11-06T00:00:00.000Z');
  assert.equal(chat.ok, true, chat.error);
  const before = await balances(store);
  const offer = await sim.makeOffer(store, 'alice', chat.thread.id, 10, '2026-11-06T00:00:00.000Z');
  assert.equal(offer.ok, true, offer.error);
  const counter = await sim.counterOffer(store, 'bob', chat.thread.id, 11, '2026-11-06T00:00:00.000Z');
  assert.equal(counter.ok, true, counter.error);
  const accepted = await sim.acceptAndSign(store, 'alice', chat.thread.id, '2026-11-06T00:00:00.000Z');
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.thread.status, 'pending');
  const after = await balances(store);
  assert.deepEqual(after, before);
  assert.equal(sim.heldBy(await store.get('alice')), 11);
  assert.equal(sim.replay(await store.get('alice')).balance, before.alice);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'HOLD' && entry.payload.role === 'seller'), true);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'transfer'), false);
});

test('the dual-sign handoff settles both books once', async () => {
  const store = await books();
  const created = await sampleListing(store, 'charlie', { amount: 22, title: 'Bike tune' });
  const chat = await sim.openChat(store, 'bob', created.listing.id);
  await sim.makeOffer(store, 'bob', chat.thread.id, 20);
  const accepted = await sim.acceptAndSign(store, 'charlie', chat.thread.id);
  assert.equal(accepted.thread.status, 'pending');
  const before = await balances(store);
  const shown = await sim.buyerHandoff(store, 'bob', chat.thread.id);
  assert.equal(shown.ok, true, shown.error);
  assert.match(shown.encoded, /^lgme1\./);
  const settled = await sim.sellerHandoff(store, 'charlie', shown.encoded);
  assert.equal(settled.ok, true, settled.error);
  assert.equal(settled.moved, true);
  const after = await balances(store);
  assert.equal(after.bob, sim.round2(before.bob - 20));
  assert.equal(after.charlie, sim.round2(before.charlie + 20));
  assert.equal(sim.heldBy(await store.get('bob')), 0);
  const again = await sim.sellerHandoff(store, 'charlie', shown.encoded);
  assert.equal(again.ok, false);
  assert.match(again.error, /already used/);
  assert.equal((await balances(store)).bob, after.bob);
});

test('cancel releases a pending hold and leaves balances', async () => {
  const store = await books();
  const created = await sampleListing(store, 'alice');
  const chat = await sim.openChat(store, 'bob', created.listing.id);
  await sim.makeOffer(store, 'bob', chat.thread.id, 12);
  await sim.acceptAndSign(store, 'alice', chat.thread.id);
  const before = await balances(store);
  assert.equal(sim.heldBy(await store.get('bob')), 12);
  const cancelled = await sim.cancelDeal(store, 'bob', chat.thread.id);
  assert.equal(cancelled.ok, true, cancelled.error);
  assert.equal(cancelled.unchanged, true);
  assert.equal(cancelled.held, 0);
  assert.deepEqual(await balances(store), before);
  const expiredStore = await books();
  const listing = await sampleListing(expiredStore, 'alice');
  const second = await sim.openChat(expiredStore, 'charlie', listing.listing.id, '2026-11-06T00:00:00.000Z');
  await sim.makeOffer(expiredStore, 'charlie', second.thread.id, 10, '2026-11-06T00:00:00.000Z');
  await sim.acceptAndSign(expiredStore, 'alice', second.thread.id, '2026-11-06T00:00:00.000Z');
  const expired = await sim.expireDeal(expiredStore, second.thread.id, '2026-12-01T00:00:00.000Z');
  assert.equal(expired.expired, true);
  assert.equal(expired.unchanged, true);
  assert.equal(expired.held, 0);
});

test('a floor-violating offer is blocked and a refusal moves nothing', async () => {
  const store = await books();
  const alice = await store.get('alice');
  alice.kyc = { status: 'VERIFIED', simulated: true };
  await store.set('alice', alice);
  const created = await sampleListing(store, 'bob', { amount: 90 });
  const chat = await sim.openChat(store, 'alice', created.listing.id);
  const before = await balances(store);
  const blocked = await sim.makeOffer(store, 'alice', chat.thread.id, 81);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'Blocked: Floor stays senior');
  assert.equal(sim.heldBy(await store.get('alice')), 0);
  assert.deepEqual(await balances(store), before);
  const allowed = await sim.makeOffer(store, 'alice', chat.thread.id, 10);
  assert.equal(allowed.ok, true, allowed.error);
  const refused = await sim.refuseDeal(store, 'bob', chat.thread.id, 'REFUSAL');
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.unchanged, true);
  assert.equal(refused.held, 0);
  const line = (await store.get('bob')).tape.find((entry) => entry.type === 'refusal' && entry.payload.threadId === chat.thread.id);
  assert.equal(line.payload.role, 'third-seat');
  assert.equal(line.payload.penalty, false);
  assert.deepEqual(await balances(store), before);
});

test('an unverified member cannot hold more than 20 $lgme', async () => {
  const store = await books();
  const dana = await sim.createPeer(store, { id: 'dana', name: 'Dana', balance: 100, floor: 0, creditLimit: -50, at: '2026-11-06T00:00:00.000Z' });
  assert.equal(dana.ok, true, dana.error);
  const created = await sampleListing(store, 'alice', { amount: 30 });
  const chat = await sim.openChat(store, 'dana', created.listing.id);
  const over = await sim.makeOffer(store, 'dana', chat.thread.id, 21);
  assert.equal(over.ok, false);
  assert.match(over.error, /20 \$lgme/);
  const first = await sim.makeOffer(store, 'dana', chat.thread.id, 15);
  assert.equal(first.ok, true, first.error);
  const accepted = await sim.acceptAndSign(store, 'alice', chat.thread.id);
  assert.equal(accepted.thread.status, 'pending');
  assert.equal(sim.replay(await store.get('dana')).balance, 100);
  const again = await sim.openChat(store, 'dana', (await sampleListing(store, 'bob', { title: 'Seedlings', amount: 10 })).listing.id);
  const second = await sim.makeOffer(store, 'dana', again.thread.id, 6);
  assert.equal(second.ok, false);
  assert.match(second.error, /20 \$lgme/);
  assert.equal(sim.heldBy(await store.get('dana')), 15);
});

async function phoneBooks() {
  const store = await books();
  const alice = await sim.bindMemberKyc(store, 'alice', { displayName: 'Alice (Providore)', phone: '+12025550101', salt: 'salt-alice' });
  const bob = await sim.bindMemberKyc(store, 'bob', { displayName: 'Bob (Agronomist)', phone: '+12025550102', salt: 'salt-bob' });
  assert.equal(alice.ok, true, alice.error);
  assert.equal(bob.ok, true, bob.error);
  assert.equal(alice.onTape, false);
  return { store, alicePhone: '+12025550101', bobPhone: '+12025550102', aliceHash: alice.hash, bobHash: bob.hash };
}

test('a signed SMS token verifies and both tapes record the same chat hash', async () => {
  const { store, bobPhone, aliceHash } = await phoneBooks();
  const threadId = 'desk-chat';
  const sent = await sim.composeChat(store, 'alice', { toId: 'bob', toPhone: bobPhone, threadId, text: 'Is the bike still there?', at: '2026-11-07T00:00:00.000Z' });
  assert.equal(sent.ok, true, sent.error);
  assert.match(sent.sms, /^sms:/);
  assert.match(sent.sms, /lgme1\./);
  assert.match(sent.tel, /^tel:\+12025550102$/);
  const opened = await sim.openMessage(sent.encoded);
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.message.body.text, 'Is the bike still there?');
  assert.equal(opened.message.body.kycHash, aliceHash);
  const got = await sim.acceptChatToken(store, 'bob', sent.encoded);
  assert.equal(got.ok, true, got.error);
  const aliceLine = (await store.get('alice')).tape.find((entry) => entry.type === 'CHAT');
  const bobLine = (await store.get('bob')).tape.find((entry) => entry.type === 'CHAT');
  assert.equal(aliceLine.payload.messageHash, bobLine.payload.messageHash);
  assert.equal(aliceLine.payload.prev, sim.GENESIS);
  assert.equal(bobLine.payload.senderKycHash, aliceHash);
  assert.equal(bobLine.payload.seq, 1);
  assert.equal(JSON.stringify(bobLine).includes('+12025550101'), false);
  assert.equal(JSON.stringify(bobLine).includes('Alice (Providore)'), false);
  assert.equal(JSON.stringify(bobLine).includes('Is the bike still there?'), false);
  const contact = (await store.get('bob')).contacts['+12025550101'];
  assert.equal(contact.kycHash, aliceHash);
  assert.equal(contact.displayName, undefined);
  assert.equal(JSON.stringify(contact).includes('salt-alice'), false);
  const call = await sim.recordCall(store, 'bob', { phone: '+12025550101', peerKycHash: aliceHash, start: '2026-11-07T00:01:00.000Z', end: '2026-11-07T00:04:00.000Z', note: 'Asked about the bike.' });
  assert.equal(call.ok, true, call.error);
  assert.equal(call.audio, false);
  assert.equal(call.leaked, false);
  assert.match(call.tel, /^tel:/);
  const callLine = (await store.get('bob')).tape.find((entry) => entry.type === 'CALL');
  assert.equal(callLine.payload.peerKycHash, aliceHash);
  assert.equal(callLine.payload.note, 'Asked about the bike.');
  assert.equal(JSON.stringify(callLine).includes('+12025550101'), false);
});

test('a token with the wrong KYC hash is rejected', async () => {
  const { store, bobPhone } = await phoneBooks();
  const threadId = 'desk-chat';
  const first = await sim.composeChat(store, 'alice', { toId: 'bob', toPhone: bobPhone, threadId, text: 'Hello', at: '2026-11-07T00:00:00.000Z' });
  assert.equal((await sim.acceptChatToken(store, 'bob', first.encoded)).ok, true);
  const second = await sim.composeChat(store, 'alice', { toId: 'bob', toPhone: bobPhone, threadId, text: 'Again', at: '2026-11-07T00:02:00.000Z' });
  const opened = await sim.openMessage(second.encoded);
  const alice = await store.get('alice');
  const body = { ...opened.message.body, kycHash: 'ab'.repeat(32) };
  const bind = { simulated: true, kind: 'kyc-bind', senderId: body.senderId, kycHash: body.kycHash, keyThumb: body.keyThumb };
  body.bindSig = await sim.signText(alice.privateKeyJwk, await sim.sha256(sim.canonicalJSON(bind)));
  const sealed = await sim.sealMessage(alice, 'chat', body);
  const rejected = await sim.acceptChatToken(store, 'bob', sealed.message);
  assert.equal(rejected.ok, false);
  assert.match(rejected.error, /KYC hash/);
  assert.equal((await store.get('bob')).tape.filter((entry) => entry.type === 'CHAT').length, 1);
});

test('a tampered local message and a sequence gap are found', async () => {
  const { store, bobPhone, aliceHash } = await phoneBooks();
  const threadId = 'desk-chat';
  const sent = await sim.composeChat(store, 'alice', { toId: 'bob', toPhone: bobPhone, threadId, text: 'Original', at: '2026-11-07T00:00:00.000Z' });
  await sim.acceptChatToken(store, 'bob', sent.encoded);
  const local = await sim.readChat(store, 'alice', threadId);
  local[0].text = 'Changed';
  const remote = await sim.chatRoot(await sim.readChat(store, 'bob', threadId));
  const report = await sim.matchChat(local, remote.hashes, remote.root);
  assert.equal(report.matched, false);
  assert.equal(report.index, 0);
  assert.equal(report.divergent[0].text, 'Changed');
  const alice = await store.get('alice');
  const identity = await sim.memberKycHash(alice);
  const core = {
    simulated: true,
    kind: 'chat',
    threadId,
    seq: 3,
    prev: local[0].hash,
    senderId: 'alice',
    kycHash: aliceHash,
    keyThumb: identity.keyThumb,
    at: '2026-11-07T00:05:00.000Z',
    text: 'Skipped one',
    negotiation: null
  };
  const bindSig = await sim.signText(alice.privateKeyJwk, await sim.sha256(sim.canonicalJSON({ simulated: true, kind: 'kyc-bind', senderId: 'alice', kycHash: aliceHash, keyThumb: identity.keyThumb })));
  const sealed = await sim.sealMessage(alice, 'chat', { ...core, bindSig, senderPhone: '+12025550101', toId: 'bob', toPhone: bobPhone });
  const gap = await sim.acceptChatToken(store, 'bob', sealed.message);
  assert.equal(gap.ok, false);
  assert.match(gap.error, /Sequence gap at 3/);
  assert.match(gap.error, /Expected 2/);
});

test('the SMS root hash matches, and a divergent text names the first message', async () => {
  const { store, bobPhone } = await phoneBooks();
  const threadId = 'desk-chat';
  const sent = await sim.composeChat(store, 'alice', { toId: 'bob', toPhone: bobPhone, threadId, text: 'Same line', at: '2026-11-07T00:00:00.000Z' });
  await sim.acceptChatToken(store, 'bob', sent.encoded);
  const aliceRoot = await sim.chatRoot(await sim.readChat(store, 'alice', threadId));
  const bobRoot = await sim.chatRoot(await sim.readChat(store, 'bob', threadId));
  assert.equal(aliceRoot.root, bobRoot.root);
  const token = await sim.composeMatch(store, 'alice', threadId, bobPhone);
  assert.equal(token.ok, true, token.error);
  assert.match(token.sms, /^sms:/);
  assert.equal(token.sms.includes('lgme1.'), true);
  const matched = await sim.acceptMatch(store, 'bob', token.encoded);
  assert.equal(matched.matched, true);
  assert.equal(matched.root, aliceRoot.root);
  const broken = await sim.readChat(store, 'alice', threadId);
  broken[0].text = 'Not the same line';
  const again = await sim.matchChat(broken, bobRoot.hashes, bobRoot.root);
  assert.equal(again.matched, false);
  assert.equal(again.index, 0);
  assert.equal(again.divergent[0].text, 'Not the same line');
});

test('a media hash on the tape verifies, and a changed file does not', async () => {
  const store = await books();
  const bytes = new TextEncoder().encode('SIMULATION-PHOTO-MARKER');
  const made = await sim.recordMedia(store, 'alice', { bytes, mime: 'image/jpeg', listingId: 'walkway', threadId: null, duration: 0, at: '2026-11-07T01:00:00.000Z' });
  assert.equal(made.ok, true, made.error);
  assert.equal(made.leaked, false);
  const alice = await store.get('alice');
  const line = alice.tape.find((entry) => entry.type === 'MEDIA');
  assert.equal(line.payload.hash, made.hash);
  assert.equal(line.payload.mime, 'image/jpeg');
  assert.equal(line.payload.size, bytes.byteLength);
  assert.equal(line.payload.listingId, 'walkway');
  assert.equal(JSON.stringify(line).includes('SIMULATION-PHOTO-MARKER'), false);
  const sealed = await sim.sealMediaBytes(alice.privateKeyJwk, bytes);
  const opened = await sim.openMediaBytes(alice.privateKeyJwk, sealed);
  assert.equal(await sim.hashBytes(opened), made.hash);
  const checked = await sim.verifyMedia(alice, { ...made.core, sig: made.sig, publicKeyJwk: made.publicKeyJwk }, bytes);
  assert.equal(checked.authentic, true);
  const flipped = new Uint8Array(bytes);
  flipped[0] ^= 0xff;
  const broken = await sim.verifyMedia(alice, { ...made.core, sig: made.sig, publicKeyJwk: made.publicKeyJwk }, flipped);
  assert.equal(broken.authentic, false);
  assert.equal(broken.error, 'Not authentic');
});

test('a signature from the wrong owner is rejected, and a matching file is received', async () => {
  const store = await books();
  const bytes = new TextEncoder().encode('SIMULATION-PHOTO-MARKER-2');
  const made = await sim.recordMedia(store, 'alice', { bytes, mime: 'image/jpeg', threadId: 'desk-chat', duration: 0 });
  const charlie = await store.get('charlie');
  const alice = await store.get('alice');
  const forgedSig = await sim.signText(charlie.privateKeyJwk, made.coreHash);
  const wrong = await sim.verifyMedia(alice, { ...made.core, sig: forgedSig, publicKeyJwk: charlie.publicKeyJwk }, bytes);
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /owner/);
  const rejected = await sim.receiveMedia(store, 'bob', {
    bytes,
    hash: made.hash,
    mime: 'image/jpeg',
    size: bytes.byteLength,
    duration: 0,
    threadId: 'desk-chat',
    ownerId: 'alice',
    publicKeyJwk: charlie.publicKeyJwk,
    sig: forgedSig
  });
  assert.equal(rejected.authentic, false);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'MEDIA_RECEIVED'), false);
  const got = await sim.receiveMedia(store, 'bob', {
    bytes,
    hash: made.hash,
    mime: 'image/jpeg',
    size: bytes.byteLength,
    duration: 0,
    threadId: 'desk-chat',
    listingId: null,
    ownerId: 'alice',
    publicKeyJwk: made.publicKeyJwk,
    sig: made.sig
  });
  assert.equal(got.ok, true, got.error);
  assert.equal(got.authentic, true);
  const received = (await store.get('bob')).tape.find((entry) => entry.type === 'MEDIA_RECEIVED');
  assert.equal(received.payload.hash, made.hash);
  assert.equal(received.payload.ownerId, 'alice');
  const flipped = new Uint8Array(bytes);
  flipped[3] ^= 0xff;
  const mismatch = await sim.receiveMedia(store, 'bob', {
    bytes: flipped,
    hash: made.hash,
    mime: 'image/jpeg',
    size: flipped.byteLength,
    duration: 0,
    threadId: 'desk-chat',
    ownerId: 'alice',
    publicKeyJwk: made.publicKeyJwk,
    sig: made.sig
  });
  assert.equal(mismatch.error, 'Not authentic');
  assert.equal((await store.get('bob')).tape.filter((entry) => entry.type === 'MEDIA_RECEIVED').length, 1);
});

async function invoiced(amount, dueAt = '2026-12-01T00:00:00.000Z') {
  const store = await books();
  for (const [id, phone] of [['alice', '+12025550101'], ['bob', '+12025550102']]) {
    const peer = await store.get(id);
    peer.kyc = { ...(peer.kyc || {}), status: 'VERIFIED' };
    await store.set(id, peer);
    const bound = await sim.bindMemberKyc(store, id, { displayName: peer.name, phone, salt: `salt-${id}` });
    assert.equal(bound.ok, true, bound.error);
  }
  const before = await balances(store);
  const invoice = await sim.createInvoice(store, 'bob', {
    payerId: 'alice',
    amount,
    dueAt,
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(invoice.ok, true, invoice.error);
  assert.equal(invoice.unchanged, true);
  assert.deepEqual(await balances(store), before);
  assert.match(invoice.sms, /^sms:/);
  return { store, invoice, before };
}

test('an invoice does not move a balance', async () => {
  const { store, invoice } = await invoiced(12, '2026-10-01T00:00:00.000Z');
  const view = sim.readInvoices(await store.get('bob'), '2026-11-07T00:00:00.000Z');
  const row = view.find((item) => item.invoiceId === invoice.invoiceId);
  assert.equal(row.role, 'AR');
  assert.equal(row.status, 'overdue');
  assert.equal(row.bucket, '31-60');
  assert.equal(row.remaining, 12);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'transfer'), false);
  assert.match(sim.invoicesToCsv(await store.get('bob'), '2026-11-07T00:00:00.000Z'), /AR/);
});

test('a coded payment settles the invoice and a partial leaves the rest open', async () => {
  const { store, invoice, receiptId } = await invoiced(10);
  const now = 1700000000;
  const setup = await sim.setupWallet(store, 'alice', 'correct horse', { iterations: 2000 });
  assert.equal(setup.ok, true, setup.error);
  const wrong = await sim.payInvoice(store, 'alice', invoice.invoiceId, { amount: 4, passphrase: 'correct horse', code: '000000', unixSeconds: now, at: '2026-11-07T01:00:00.000Z' });
  assert.equal(wrong.paid, false);
  assert.equal(sim.replay(await store.get('alice')).balance, 120);
  const code = await sim.totp(sim.base32Decode(setup.secretBase32), now, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const part = await sim.payInvoice(store, 'alice', invoice.invoiceId, { amount: 4, passphrase: 'correct horse', code, unixSeconds: now, at: '2026-11-07T01:00:00.000Z' });
  assert.equal(part.ok, true, part.error);
  assert.equal(part.remaining, 6);
  assert.equal(part.reward, 0);
  assert.equal(part.receiptId, receiptId);
  assert.equal(sim.replay(await store.get('alice')).balance, 116);
  assert.equal(sim.replay(await store.get('bob')).balance, 84);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'REWARD'), false);
  const paid = (await store.get('bob')).tape.find((entry) => entry.type === 'INVOICE_PAID');
  assert.equal(paid.payload.receiptId, receiptId);
  const rest = await sim.payInvoice(store, 'alice', invoice.invoiceId, { amount: 6, passphrase: 'correct horse', code, unixSeconds: now, at: '2026-11-07T02:00:00.000Z' });
  assert.equal(rest.ok, true, rest.error);
  assert.equal(rest.remaining, 0);
  assert.equal(rest.reward, 0.2);
  assert.equal(sim.replay(await store.get('alice')).balance, 110);
  assert.equal(sim.replay(await store.get('bob')).balance, 90);
});

test('a refused invoice moves nothing and pays no reward', async () => {
  const { store, invoice, before } = await invoiced(10);
  const refused = await sim.refuseInvoice(store, 'alice', invoice.invoiceId, 'REFUSAL', '2026-11-07T03:00:00.000Z');
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.unchanged, true);
  assert.equal(refused.reward, 0);
  assert.equal(refused.status, 'refused');
  const line = (await store.get('alice')).tape.find((entry) => entry.type === 'INVOICE_REFUSED');
  assert.equal(line.payload.role, 'third-seat');
  assert.equal(line.payload.penalty, false);
  assert.deepEqual(await balances(store), before);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'REWARD'), false);
});

test('a reward is minted only when the invoice is paid, and the period cap holds', async () => {
  const { store } = await invoiced(10);
  assert.equal(sim.rewardTotal(await store.get('bob')), 0);
  const dana = await sim.createPeer(store, { id: 'dana', name: 'Dana', balance: 1000, floor: 0, creditLimit: -50, at: '2026-11-06T00:00:00.000Z' });
  assert.equal(dana.ok, true, dana.error);
  const book = await store.get('dana');
  book.kyc = { status: 'VERIFIED', displayName: 'Dana', phone: '+12025550109', salt: 'salt-dana' };
  await store.set('dana', book);
  const bound = await sim.bindMemberKyc(store, 'dana', { displayName: 'Dana', phone: '+12025550109', salt: 'salt-dana' });
  assert.equal(bound.ok, true, bound.error);
  async function bill(amount, at) {
    return sim.createInvoice(store, 'bob', { payerId: 'dana', amount, dueAt: '2026-12-01T00:00:00.000Z', at });
  }
  const first = await bill(400, '2026-11-08T00:00:00.000Z');
  const paid = await sim.payInvoice(store, 'dana', first.invoiceId, { at: '2026-11-08T01:00:00.000Z' });
  assert.equal(paid.ok, true, paid.error);
  assert.equal(paid.reward, 5);
  assert.equal(sim.replay(await store.get('dana')).balance, 600);
  const second = await bill(100, '2026-11-09T00:00:00.000Z');
  const again = await sim.payInvoice(store, 'dana', second.invoiceId, { at: '2026-11-09T01:00:00.000Z' });
  assert.equal(again.ok, true, again.error);
  assert.equal(again.reward, 0);
  assert.equal(sim.rewardTotal(await store.get('bob')), 5);
});

test('the floor blocks an invoice payment', async () => {
  const { store, invoice, before } = await invoiced(81);
  const blocked = await sim.payInvoice(store, 'alice', invoice.invoiceId, { at: '2026-11-07T04:00:00.000Z' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error, 'Blocked: Floor stays senior');
  assert.deepEqual(await balances(store), before);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'INVOICE_PAID'), false);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'REWARD'), false);
});

test('a soBeIT grant is attested on the member tape and does not touch the real token page', async () => {
  const store = await books();
  const before = await balances(store);
  const granted = await sim.soBeItGrant(store, 'alice', 'bob', { amount: 15, reason: 'Shown soil work', at: '2026-11-07T05:00:00.000Z' });
  assert.equal(granted.ok, true, granted.error);
  assert.equal(granted.attested, true);
  assert.equal(granted.moved, true);
  assert.equal(granted.grantorUnchanged, true);
  assert.equal(sim.replay(await store.get('bob')).balance, before.bob + 15);
  assert.equal(sim.replay(await store.get('alice')).balance, before.alice);
  const line = (await store.get('bob')).tape.find((entry) => entry.type === 'GRANT');
  assert.equal(line.payload.reason, 'Shown soil work');
  assert.equal(line.payload.attested, true);
  const checked = await sim.verifyGrant(line);
  assert.equal(checked.ok, true, checked.error);
  const forged = structuredClone(line);
  forged.payload.sig = 'aa';
  const bad = await sim.verifyGrant(forged);
  assert.equal(bad.ok, false);
  const engine = readFileSync(join(root, 'js/p2p-exchange-sim.mjs'), 'utf8');
  assert.equal(engine.includes('pump.fun'), false);
  assert.equal(engine.includes('7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump'), false);
});

test('the coin page names the mint and the donate address exactly', () => {
  const page = readFileSync(join(root, 'lgme-coin.html'), 'utf8');
  const mint = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';
  const donate = '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY';
  assert.equal(page.includes(mint), true);
  assert.equal(page.includes(`https://pump.fun/coin/${mint}`), true);
  assert.equal(page.includes(donate), true);
  assert.equal(page.includes('https://x.com/EgonomicAnon'), false);
  assert.equal(page.includes('https://pump.fun/profile/EgonAnon'), false);
  assert.equal(page.includes('soBeIT contributions'), true);
  assert.equal(page.includes('Pump.fun wallet'), true);
  assert.equal(page.includes('@EgonAnon'), true);
  assert.equal(page.includes('Send via X Money to '), true);
  assert.equal(page.includes('https://x.com/Trancesage'), true);
  assert.equal(page.includes('This is a separate account from the Solana wallet.'), true);
  assert.equal(page.includes('Real token on Solana. Not financial advice. High risk; you may lose everything. Always verify the mint address. Transfers are irreversible.'), true);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(ui.includes(donate), true);
  assert.equal(ui.includes('@EgonAnon'), true);
  assert.equal(ui.includes('https://x.com/Trancesage'), true);
  assert.equal(ui.includes('Send via X Money to '), true);
  assert.equal(ui.includes('This is a separate account from the Solana wallet.'), true);
  assert.equal(ui.includes('https://x.com/EgonomicAnon'), false);
  assert.equal(ui.includes('https://pump.fun/profile/EgonAnon'), false);
  assert.equal(readFileSync(join(root, 'exchange.html'), 'utf8').includes('$lgme on pump.fun'), true);
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8').includes('$lgme on pump.fun'), true);
  assert.equal(readFileSync(join(root, 'sitemap.xml'), 'utf8').includes('https://lgme.app/lgme-coin'), true);
});

test('real gifts are announced above the simulation and the two methods stay separate', () => {
  const banner = 'Real donations &amp; grants accepted';
  for (const file of ['index.html', 'exchange.html', 'lgme-coin.html', 'grants.html']) {
    const page = readFileSync(join(root, file), 'utf8');
    const body = page.slice(page.indexOf('<body>'));
    const launch = body.indexOf('class="launch-bar"');
    const give = body.indexOf('class="give-banner"');
    assert.ok(launch >= 0 && give > launch && give - launch < 500, file);
    assert.equal(page.includes(banner), true, file);
    assert.equal(page.includes('href="/lgme-coin#give">Give via soBeIT</a>'), true, file);
    assert.equal(page.includes('href="/lgme-coin#give">How to give</a>'), true, file);
    assert.equal(page.includes('href="/grants">Grants</a>'), true, file);
    assert.equal(page.includes('$Trust'), false, file);
    assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false, file);
  }
  const coin = readFileSync(join(root, 'lgme-coin.html'), 'utf8');
  assert.equal(coin.includes('id="give"'), true);
  assert.equal(coin.includes('@EgonAnon'), true);
  assert.equal(coin.includes('6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY'), true);
  assert.equal(coin.includes('https://x.com/Trancesage'), true);
  assert.equal(coin.includes('Solana payments are real $lgme.'), true);
  assert.equal(coin.includes('id="copy-donate"'), true);
  assert.equal(coin.includes('id="solana-pay"'), true);
  assert.equal(coin.includes('Never share a seed phrase'), true);
  assert.equal(coin.includes('THANK YOU FOR YOUR SUPPORT.'), true);
  assert.equal(coin.includes('Install Phantom or Solflare.'), true);
  assert.equal(readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes('Give via soBeIT'), true);
  const desk = readFileSync(join(root, 'exchange.html'), 'utf8');
  assert.ok(desk.indexOf('give-banner') < desk.indexOf('id="beta-notice"'));
  assert.equal(desk.includes('lgme · BETA'), true);
  assert.match(desk, /name="description" content="Beta\. Peer-to-peer exchange that settles real \$lgme from your own Solana wallet\./);
  assert.match(desk, /This beta needs JavaScript/);
  assert.equal(desk.includes('This simulation needs JavaScript'), false);
  assert.equal(desk.includes('href="/how-it-works"'), true);
  assert.equal(desk.includes('href="/mutual-credit"'), true);
  const grants = readFileSync(join(root, 'grants.html'), 'utf8');
  assert.equal(grants.includes('How to propose'), true);
  assert.equal(grants.includes('class="give-now"'), true);
  assert.equal(grants.includes('href="/lgme-coin#give">Give via soBeIT</a>'), true);
});

test('the standing donation is pinned in both listing kinds and never expires', async () => {
  const store = await books();
  const far = '2099-01-01T00:00:00.000Z';
  const ensured = await sim.ensureStandingDonation(store, '2026-11-07T00:00:00.000Z');
  assert.equal(ensured.ok, true, ensured.error);
  assert.equal(ensured.listing.pinned, true);
  assert.equal(ensured.listing.expiresAt, null);
  assert.equal(sim.listingVisible(ensured.listing, far), true);
  const checked = await sim.verifyListing(ensured.listing);
  assert.equal(checked.ok, true, checked.error);
  const ordinary = await sampleListing(store, 'bob', { at: '2026-01-01T00:00:00.000Z', title: 'Old saw', kind: 'ihavIT' });
  assert.equal(sim.listingVisible(ordinary.listing, far), false);
  for (const kind of ['ihavIT', 'IwanIT']) {
    const feed = await sim.marketFeed(store, { kind }, far);
    assert.equal(feed[0].title, 'Donation — soBeIT');
    assert.equal(feed[0].description, 'help grow n floor, thank you.');
    assert.equal(feed[0].href, '/lgme-coin');
    assert.equal(feed[0].action, 'Receive / send $lgme');
    assert.equal(feed[0].pinned, true);
    assert.equal(feed.some((card) => card.id === ordinary.listing.id), false);
  }
  const page = readFileSync(join(root, 'lgme-coin.html'), 'utf8');
  assert.equal(page.includes('6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY'), true);
  assert.equal(page.includes('https://pump.fun/coin/7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump'), true);
  const again = await sim.ensureStandingDonation(store, far);
  assert.equal(again.listing.id, ensured.listing.id);
});

test('the wanted pin stays on IwanIT and a concluded match closes on the book', async () => {
  const file = JSON.parse(readFileSync(join(root, 'data/offerup-wanted-v0.json'), 'utf8'));
  const matches = sim.wantedFeed(file);
  assert.equal(matches.length, 8);
  assert.equal(matches.every((item) => item.sourcedAt === '2026-11-07' && item.status === 'Available'), true);
  assert.deepEqual(matches.filter((item) => item.sellerSaysWorking).map((item) => item.title), ['Schwinn 810 Treadmill', 'Fitness Reality E5500XL Elliptical']);
  assert.equal(matches.filter((item) => !item.sellerSaysWorking).every((item) => sim.workingBadge(item) === 'Ask if working'), true);
  assert.equal(sim.workingBadge(matches[0]), 'Seller says working');
  assert.equal(sim.suggestedWantedPair(matches), 'Suggested pair: Schwinn 810 + E5500XL = $400');
  const greenbelt = matches.find((item) => item.city === 'Greenbelt, MD');
  assert.match(greenbelt.note, /Description says \$325; confirm price/);
  assert.match(greenbelt.inquiry, /I'd offer \$250/);
  assert.match(matches[0].inquiry, /Is your Schwinn 810 Treadmill still available/);
  assert.match(matches[0].inquiry, /signed by your wallet/);
  const store = await books();
  const far = '2099-01-01T00:00:00.000Z';
  const donation = await sim.ensureStandingDonation(store, '2026-11-07T00:00:00.000Z');
  const wanted = await sim.ensureStandingWanted(store, '2026-11-07T00:00:00.000Z');
  assert.equal(wanted.ok, true, wanted.error);
  assert.equal(wanted.listing.pinned, true);
  assert.equal(wanted.listing.kind, 'IwanIT');
  assert.equal(wanted.listing.expiresAt, null);
  assert.equal(wanted.listing.title, sim.STANDING_WANTED.title);
  assert.deepEqual(wanted.listing.payments, ['Cash', 'Terms over 3 to 6 months', '$lgme services (IprovIT)']);
  assert.equal((await sim.verifyListing(wanted.listing)).ok, true);
  assert.equal(sim.listingVisible(wanted.listing, far), true);
  const feed = await sim.marketFeed(store, { kind: 'IwanIT' }, far);
  assert.equal(feed[0].title, 'Donation — soBeIT');
  assert.equal(feed.some((card) => card.title === sim.STANDING_WANTED.title), true);
  assert.equal((await sim.marketFeed(store, { kind: 'ihavIT' }, far)).some((card) => card.title === sim.STANDING_WANTED.title), false);
  assert.equal(donation.listing.id !== wanted.listing.id, true);
  const match = { title: 'Folding treadmill', price: '$50', city: 'Washington, DC', url: 'https://offerup.com/item/detail/example', kind: 'sell' };
  const draft = sim.wantedMatchDraft(match);
  assert.match(draft, /Nothing was sent/);
  assert.match(draft, /Free|\$50/);
  const invite = sim.inviteSellerText(match);
  assert.match(invite, /Nothing was sent/);
  assert.match(invite, /https:\/\/lgme\.app\/exchange/);
  const before = (await sim.replay(await store.get('alice'))).balance;
  const concluded = await sim.concludeWantedMatch(store, 'alice', match, '2026-11-07T01:00:00.000Z');
  assert.equal(concluded.ok, true, concluded.error);
  assert.equal(concluded.unchanged, true);
  assert.equal(concluded.penalty, false);
  const tape = (await store.get('alice')).tape;
  assert.equal(tape.some((entry) => entry.type === 'ididit'), false);
  assert.equal(tape.some((entry) => entry.type === 'WANTED_CLOSED' && entry.payload.penalty === false), true);
  assert.equal((await sim.replay(await store.get('alice'))).balance, before);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  for (const phrase of ['Matches from OfferUp', 'Make an offer', 'Copy inquiry', 'Continue on OfferUp', 'Invite seller to lgme.app', 'Available', 'Pending reply', 'Offer made', 'Closed', 'No OfferUp matches in this file yet.', 'Reconcile as donation to the floor', 'wanted-pair']) {
    assert.equal(ui.includes(phrase), true, phrase);
  }
  assert.equal(ui.includes('navigator.share'), true);
  assert.equal(ui.includes("fetch('/data/offerup-wanted-v0.json', { signal: gate.signal })"), true);
  const repair = await sim.ensureStandingRepair(store, '2026-11-07T00:00:00.000Z');
  assert.equal(repair.ok, true, repair.error);
  assert.equal(repair.listing.title, 'Wanted: exercise equipment repair/service (treadmill, elliptical), Washington DC area');
  assert.equal(repair.listing.kind, 'IwanIT');
  assert.equal(repair.listing.pinned, true);
  assert.equal((await sim.verifyListing(repair.listing)).ok, true);
  const again = await sim.marketFeed(store, { kind: 'IwanIT' }, far);
  assert.equal(again[0].title, 'Donation — soBeIT');
  assert.equal(again.some((card) => card.id === repair.listing.id), true);
  const thumb = JSON.parse(readFileSync(join(root, 'data/thumbtack-wanted-v0.json'), 'utf8'));
  const pros = sim.thumbtackFeed(thumb);
  assert.equal(pros.length, 1);
  assert.equal(pros.every((item) => item.sourcedAt === '2026-11-07' && item.status === 'Available'), true);
  assert.equal(pros[0].title, 'The Repair Extraordinaire');
  assert.equal(pros[0].isIprovIT, true);
  assert.equal(pros[0].rating, '4.8 stars, 639 reviews, 8 yrs');
  assert.equal(JSON.stringify(thumb).includes('Mauricio'), false);
  assert.equal(JSON.stringify(thumb).includes('Fefe'), false);
  assert.match(pros[0].city, /confirm ZIP/);
  assert.match(pros[0].price, /\$99\/hr/);
  assert.match(pros[0].inquiry, /call-out, labor and parts/);
  assert.match(pros[0].inquiry, /signed by your wallet/);
  assert.equal(pros.filter((item) => item.isIprovIT).length, 1);
  assert.equal(/recommend|best pro|endorsed/i.test(JSON.stringify(thumb)), false);
  assert.deepEqual(sim.thumbtackIprov(thumb).map((item) => item.title), ['The Repair Extraordinaire']);
  const tailored = sim.tailoredDraft({ title: 'Schwinn 810 Treadmill', price: '$300', url: 'https://offerup.com/item' }, { amount: '280', pay: '4', handoff: 'pickup', askWorking: true, note: 'Saturday', channel: 'offerup' });
  assert.match(tailored, /Nothing was sent/);
  assert.match(tailored, /Terms over 4 months/);
  assert.match(tailored, /Is it fully working/);
  assert.equal(sim.tailoredOpenEnabled(sim.TAILORED_AWAITING), false);
  assert.equal(sim.tailoredOpenEnabled('Approved'), true);
  assert.equal(sim.TAILORED_AWAITING, 'Draft, awaiting approval');
  assert.equal(sim.THUMBTACK_CAVEAT, 'Third-party pro on Thumbtack, not verified by lgme');
  for (const phrase of ['Continue with tailored options', 'Continue on Thumbtack', 'Listed from Thumbtack (not affiliated)', 'TAILORED_AWAITING', 'Approve']) {
    assert.equal(ui.includes(phrase), true, phrase);
  }
});

test('Install & launch hides in the app, prompts when it can, and otherwise opens the desk', () => {
  assert.equal(decideInstallAction({ standalone: true, iosSafari: false, hasPrompt: true, installed: false }), 'hide');
  assert.equal(decideInstallAction({ standalone: true, iosSafari: true, hasPrompt: false, installed: true }), 'hide');
  assert.equal(decideInstallAction({ standalone: false, iosSafari: true, hasPrompt: false, installed: false }), 'tooltip');
  assert.equal(decideInstallAction({ standalone: false, iosSafari: false, hasPrompt: true, installed: false }), 'prompt');
  assert.equal(decideInstallAction({ standalone: false, iosSafari: false, hasPrompt: true, installed: true }), 'launch');
  assert.equal(decideInstallAction({ standalone: false, iosSafari: false, hasPrompt: false, installed: false }), 'launch');
  assert.equal(isStandalone({ matchMedia: () => ({ matches: true }) }, {}), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }) }, { standalone: true }), true);
  assert.equal(isStandalone({ matchMedia: () => ({ matches: false }) }, { standalone: false }), false);
  assert.equal(isIosSafari({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 }), false);
  assert.equal(isIosSafari({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36', platform: 'Linux', maxTouchPoints: 0 }), false);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(ui.includes('openCall = { phone, hash: identity?.hash || \'\', start: new Date().toISOString(), threadId }; render();'), true);
  assert.equal(ui.includes('long ? QR.CorrectLevel.L : QR.CorrectLevel.M'), true);
  const source = readFileSync(join(root, 'js/install-launch.mjs'), 'utf8');
  assert.equal(source.includes('Share > Add to Home Screen'), true);
  assert.equal(source.includes('beforeinstallprompt'), true);
  assert.equal(source.includes('appinstalled'), true);
  assert.equal(source.includes('getInstalledRelatedApps'), true);
  assert.equal(source.includes("location.assign('/exchange')") || source.includes('location.assign(APP_PATH)'), true);
  for (const file of ['index.html', 'exchange.html', 'lgme-coin.html', 'pumpup.html', 'developer-notes.html']) {
    assert.equal(readFileSync(join(root, file), 'utf8').includes('EgonomicAnon'), false, file);
  }
  for (const file of ['index.html', 'exchange.html', 'lgme-coin.html']) {
    const page = readFileSync(join(root, file), 'utf8');
    assert.equal(page.includes('data-install-launch'), true, file);
    assert.equal(page.includes('Install &amp; launch'), true, file);
    assert.equal(page.includes('/js/install-launch.mjs'), true, file);
    assert.equal(page.includes('#F97316'), true, file);
    const top = page.slice(page.indexOf('<body>'), page.indexOf('<body>') + 280);
    assert.equal(top.includes('data-install-launch'), true, file + ' top');
  }
});

function installHarness(navExtras = {}, assign) {
  const assigned = [];
  const listeners = { win: {}, control: {} };
  const control = {
    getAttribute(name) { return name === 'href' ? '/exchange' : null; },
    closest() { return { querySelector() { return null; }, append() {} }; },
    addEventListener(type, fn) { listeners.control[type] = fn; }
  };
  const doc = {
    body: {},
    querySelectorAll(sel) { return sel === '[data-install-launch]' ? [control] : []; },
    createElement() { return { className: '', hidden: false, setAttribute() {}, textContent: '' }; }
  };
  const win = {
    location: {
      assign(path) {
        if (assign) assign(path, assigned);
        else assigned.push(path);
      }
    },
    matchMedia() { return { matches: false }; },
    addEventListener(type, fn) { (listeners.win[type] ||= []).push(fn); },
    setTimeout,
    clearTimeout
  };
  const nav = {
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/121.0.0.0 Mobile Safari/537.36',
    platform: 'Linux',
    maxTouchPoints: 5,
    ...navExtras
  };
  bindInstallLaunch(doc, nav, win);
  return {
    assigned,
    listeners,
    click() {
      return listeners.control.click({ preventDefault() {}, currentTarget: control });
    },
    prompt(outcome, { fail } = {}) {
      const event = {
        preventDefault() {},
        prompt() { if (fail === 'prompt') throw new Error('prompt failed'); },
        userChoice: fail === 'choice' ? Promise.reject(new Error('choice failed')) : Promise.resolve({ outcome })
      };
      listeners.win.beforeinstallprompt.forEach((fn) => fn(event));
    }
  };
}

test('Install & launch opens the desk after the prompt, a slow install check, and a back navigation', async () => {
  assert.equal(INSTALLED_WAIT_MS, 500);
  for (const outcome of ['accepted', 'dismissed']) {
    const harness = installHarness({ getInstalledRelatedApps: async () => [] });
    harness.prompt(outcome);
    await harness.click();
    assert.deepEqual(harness.assigned, ['/exchange'], outcome);
  }
  const thrown = installHarness({ getInstalledRelatedApps: async () => [] });
  thrown.prompt('dismissed', { fail: 'prompt' });
  await thrown.click();
  assert.deepEqual(thrown.assigned, ['/exchange']);
  const choice = installHarness({ getInstalledRelatedApps: async () => [] });
  choice.prompt('accepted', { fail: 'choice' });
  await choice.click();
  assert.deepEqual(choice.assigned, ['/exchange']);

  const hung = installHarness({ getInstalledRelatedApps: () => new Promise(() => {}) });
  const started = Date.now();
  await hung.click();
  const elapsed = Date.now() - started;
  assert.ok(elapsed >= 450, String(elapsed));
  assert.ok(elapsed < 1200, String(elapsed));
  assert.deepEqual(hung.assigned, ['/exchange']);

  const back = installHarness({ getInstalledRelatedApps: async () => [] });
  await back.click();
  await back.click();
  assert.equal(back.assigned.length, 1);
  back.listeners.win.pageshow.forEach((fn) => fn({ persisted: true }));
  await back.click();
  assert.deepEqual(back.assigned, ['/exchange', '/exchange']);

  let calls = 0;
  const broken = installHarness({ getInstalledRelatedApps: async () => [] }, (path, assigned) => {
    calls += 1;
    if (calls === 1) throw new Error('assign failed');
    assigned.push(path);
  });
  await broken.click();
  assert.deepEqual(broken.assigned, ['/exchange']);

  for (const file of ['index.html', 'exchange.html', 'lgme-coin.html']) {
    const page = readFileSync(join(root, file), 'utf8');
    assert.match(page, /<a class="install-launch" data-install-launch href="\/exchange">/, file);
  }
});

test('an offer waits for both signatures, then a term plan and a floor donation stay simulated', async () => {
  const file = JSON.parse(readFileSync(join(root, 'data/offerup-dc-v0.json'), 'utf8'));
  assert.equal(file.schema.kind, 'sell|buy|give');
  const offerup = sim.offerupFeed(file);
  assert.equal(offerup.length, 5);
  assert.deepEqual(offerup.map((item) => item.price), ['$50', '$45', '$150', 'Free', 'Free / negotiable']);
  assert.deepEqual(offerup.map((item) => sim.offerupKindLabel(item.kind)), ['For sale', 'For sale', 'For sale', 'Free', 'Free']);
  assert.equal(offerup.every((item) => item.sourcedAt === '2026-11-07'), true);
  assert.equal(sim.offerupAmount('$50'), 50);
  assert.equal(sim.offerupAmount('Free / negotiable'), null);
  const schedule = sim.termSchedule(10, 3, '2026-11-07T00:00:00.000Z');
  assert.equal(schedule.ok, true, schedule.error);
  assert.equal(schedule.installments.map((row) => row.amount).reduce((sum, n) => sim.round2(sum + n), 0), 10);
  assert.equal(schedule.installments[0].dueAt.slice(0, 10), '2026-12-07');
  assert.equal(sim.termSchedule(10, 2, '2026-11-07T00:00:00.000Z').ok, false);
  const store = await books();
  for (const [id, phone] of [['alice', '+12025550101'], ['bob', '+12025550102']]) {
    const peer = await store.get(id);
    peer.kyc = { status: 'VERIFIED', displayName: peer.name, phone, salt: `salt-${id}` };
    await store.set(id, peer);
  }
  const service = await sampleListing(store, 'bob', { title: 'Soil hours', kind: 'IprovIT', amount: 12, category: 'Services' });
  assert.equal(service.listing.kind, 'IprovIT');
  const external = await sim.signOffer(store, 'alice', {
    external: { title: 'Lamp', price: 20, city: 'Washington', url: 'https://offerup.com/item/example', image: '', kind: 'sell', sourcedAt: '2026-11-07' },
    cashMode: 'full',
    amount: 20,
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(external.ok, true, external.error);
  assert.equal(external.contract, false);
  assert.equal(external.sent, false);
  assert.equal(external.offer.status, 'draft');
  assert.match(external.draft, /Third-party listing on OfferUp, not verified by lgme/);
  assert.match(external.draft, /Nothing was sent/);
  const listed = await sampleListing(store, 'bob', { title: 'Hand saw', amount: 10 });
  const first = await sim.signOffer(store, 'alice', {
    listingId: listed.listing.id,
    cashMode: 'terms',
    months: 3,
    amount: 10,
    serviceIds: [service.listing.id],
    automate: true,
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.contract, false);
  assert.equal(first.offer.status, 'awaiting');
  const before = await balances(store);
  const second = await sim.countersignOffer(store, 'bob', first.offer.id, { automate: true, at: '2026-11-07T00:10:00.000Z' });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.contract, true);
  assert.equal(second.invoiceIds.length, 3);
  assert.deepEqual(await balances(store), before);
  const aliceBook = await store.get('alice');
  const bobBook = await store.get('bob');
  assert.equal(aliceBook.tape.filter((entry) => entry.type === 'INVOICE').length, 3);
  assert.equal(bobBook.tape.filter((entry) => entry.type === 'INVOICE').length, 3);
  assert.equal(aliceBook.tape.some((entry) => entry.type === 'SERIAL_AUDIT' && entry.payload.penalty === false), true);
  assert.equal(bobBook.tape.some((entry) => entry.type === 'SERIAL_AUDIT'), true);
  const overdue = sim.overdueInvoices(aliceBook, '2027-03-01T00:00:00.000Z');
  assert.equal(overdue.length, 3);
  assert.ok(overdue[0].dueAt <= overdue[2].dueAt);
  const reminded = await sim.remindInvoice(store, 'bob', second.invoiceIds[0], '2027-03-01T00:00:00.000Z');
  assert.equal(reminded.ok, true, reminded.error);
  assert.equal(reminded.penalty, false);
  assert.equal(reminded.unchanged, true);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'REMINDER'), true);
  const part = await sim.payInvoice(store, 'alice', second.invoiceIds[0], { amount: 1, at: '2026-12-08T00:00:00.000Z' });
  assert.equal(part.ok, true, part.error);
  assert.ok(part.remaining > 0);
  const one = await sim.consentFloorDonation(store, 'alice', second.invoiceIds[1], '2026-12-08T00:00:00.000Z');
  assert.equal(one.closed, false);
  const both = await sim.consentFloorDonation(store, 'bob', second.invoiceIds[1], '2026-12-08T00:00:00.000Z');
  assert.equal(both.ok, true, both.error);
  assert.equal(both.closed, true);
  assert.equal(both.penalty, false);
  assert.equal(both.message, 'THANK YOU FOR YOUR SUPPORT.');
  const closed = sim.readInvoices(await store.get('alice'), '2026-12-08T00:00:00.000Z').find((row) => row.invoiceId === second.invoiceIds[1]);
  assert.equal(closed.status, 'donated');
  assert.equal(closed.thanks, 'THANK YOU FOR YOUR SUPPORT.');
  const page = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(page.includes('Found on OfferUp (DC area)'), true);
  assert.equal(page.includes('No OfferUp listings in this file yet.'), true);
  assert.equal(page.includes('Continue on OfferUp'), true);
  assert.equal(page.includes('Make an offer'), true);
  assert.equal(page.includes("addEventListener('error'"), true);
  assert.equal(page.includes('onerror='), false);
  assert.equal(page.includes("rel: 'noopener noreferrer'"), true);
  assert.equal(page.includes('Offer on this item'), true);
  assert.equal(page.includes('Reconcile as donation to the floor'), true);
  assert.equal(page.includes('IprovIT · I provide it'), true);
});

test('offline mode refuses a spend and an online challenge is acknowledged', async () => {
  const store = await books();
  const offline = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 1, navigator: { onLine: false } });
  assert.equal(offline.ok, false);
  assert.equal(offline.error, guard.OFFLINE_SPEND);
  const before = (await balances(store)).alice;
  assert.equal(before, 120);
  const sent = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 1, at: '2026-11-07T00:00:00.000Z', navigator: { onLine: true } });
  assert.equal(sent.ok, true, sent.error);
  assert.equal(Boolean(sent.message.body.ack.sender && sent.message.body.ack.recipient), true);
  assert.equal(guard.ackFresh(sent.message.body.exp, '2026-11-07T00:05:00.000Z'), true);
  assert.equal(guard.ackFresh(sent.message.body.exp, '2026-11-07T00:11:00.000Z'), false);
  const stale = await sim.importMessage(store, 'bob', sent.message, '2026-11-07T00:11:00.000Z');
  assert.equal(stale.ok, false);
  assert.equal(stale.error, 'This acknowledgement is stale.');
});

test('a second owner of the same serial is a signed fraud proof', async () => {
  const store = await books();
  const sent = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 5, at: '2026-11-07T01:00:00.000Z', navigator: { onLine: true } });
  assert.equal(sent.ok, true, sent.error);
  const alice = await store.get('alice');
  const child = sent.message.body.serials.find((id) => alice.serials[id].ownerId === 'bob');
  const audited = sim.auditSerial(alice, child);
  assert.equal(audited.ok, true, audited.error);
  const before = (await balances(store)).alice;
  const fraud = await sim.attemptDoubleSpend(store, 'alice', 'charlie', '2026-11-07T01:05:00.000Z');
  assert.equal(fraud.fraud, true);
  assert.equal(fraud.error, 'Fork. The same serial has two next owners.');
  assert.equal((await balances(store)).alice, before);
  assert.equal(sim.terms(await store.get('alice')).floor, 41);
  assert.ok(sim.peerStanding(await store.get('alice')) < sim.peerStanding(await store.get('bob')) || fraud.standing < 80);
  const shown = (await store.get('charlie')).tape.some((entry) => entry.type === 'FRAUD_PROOF');
  assert.equal(shown, true);
});

test('passkey options, recovery codes, and an encrypted backup round trip', async () => {
  const challenge = new Uint8Array(32);
  const options = guard.passkeyCreationOptions('alice', 'Alice', challenge);
  assert.equal(options.publicKey.rp.id, 'lgme.app');
  assert.equal(options.publicKey.authenticatorSelection.userVerification, 'required');
  assert.equal(options.publicKey.attestation, 'none');
  assert.equal(guard.passphraseReason('12345678'), 'Use a passphrase, not a short PIN.');
  const prf = crypto.getRandomValues(new Uint8Array(32));
  const wrapped = await guard.wrapDekWithPrf(prf);
  const opened = await guard.openDekWithPrf(prf, wrapped);
  assert.equal(Buffer.from(opened).toString('hex'), Buffer.from(wrapped.dek).toString('hex'));
  const codes = await guard.recoveryCodes();
  assert.equal(codes.codes.length, 8);
  const used = await guard.redeemRecovery(codes.hashes, codes.codes[0]);
  assert.equal(used.ok, true);
  assert.equal(used.hashes.length, 7);
  const again = await guard.redeemRecovery(used.hashes, codes.codes[0]);
  assert.equal(again.ok, false);
  const store = await books();
  const alice = await store.get('alice');
  const backup = await sim.exportBackup(alice, 'correct horse battery');
  assert.equal(backup.ok, true, backup.error);
  alice.privateKeyJwk = null;
  await store.set('alice', alice);
  const restored = await sim.importBackup(store, backup.backup, 'correct horse battery');
  assert.equal(restored.ok, true, restored.error);
  assert.equal(Boolean((await store.get('alice')).privateKeyJwk), true);
  const rotated = await sim.rotateKey(store, 'alice', '2026-11-07T02:00:00.000Z');
  assert.equal(rotated.ok, true, rotated.error);
  const checked = await sim.verifyTape(await store.get('alice'));
  assert.equal(checked.ok, true, checked.reason);
});

test('a handoff QR is a short token and a large transfer needs a co-sign', async () => {
  assert.equal(guard.handoffToken('abcdef0123456789abcdef0123456789').startsWith('lgme1q.'), true);
  assert.ok(guard.handoffToken('abcdef0123456789abcdef0123456789').length < 40);
  const store = await books();
  for (const id of ['alice', 'bob']) {
    const peer = await store.get(id);
    peer.kyc = { ...(peer.kyc || {}), status: 'VERIFIED' };
    await store.set(id, peer);
  }
  const blocked = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 60, at: '2026-11-07T03:00:00.000Z', navigator: { onLine: true } });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /third-seat co-sign/);
  const allowed = await sim.createTransfer(store, 'alice', { toId: 'bob', amount: 60, thirdSeatSig: 'co-signed', at: '2026-11-07T03:00:00.000Z', navigator: { onLine: true } });
  assert.equal(allowed.ok, true, allowed.error);
});

function installMockIndexedDb() {
  const tables = { keys: new Map(), meta: new Map() };
  function succeed(req, value, after) {
    queueMicrotask(() => {
      req.result = value;
      if (typeof req.onsuccess === 'function') req.onsuccess();
      if (typeof after === 'function') after();
    });
  }
  function storeFor(tx, name) {
    return {
      put(value, id) {
        tables[name].set(id, value);
        const req = {};
        succeed(req, id, () => { if (typeof tx.oncomplete === 'function') tx.oncomplete(); });
        return req;
      },
      get(id) {
        const req = {};
        succeed(req, tables[name].has(id) ? tables[name].get(id) : undefined, () => {
          if (typeof tx.oncomplete === 'function') tx.oncomplete();
        });
        return req;
      }
    };
  }
  const db = {
    objectStoreNames: { contains: () => true },
    transaction(name) {
      const tx = {};
      tx.objectStore = () => storeFor(tx, name);
      return tx;
    },
    close() {}
  };
  globalThis.indexedDB = {
    open() {
      const req = {};
      succeed(req, db);
      return req;
    }
  };
}

test('the key vault finishes its write and still opens a sealed member salt', async () => {
  const previous = globalThis.indexedDB;
  installMockIndexedDb();
  try {
    const vault = guard.createIndexedDbVault();
    const dek = new Uint8Array(32);
    dek[0] = 9;
    const saved = await Promise.race([
      vault.putMeta('alice', dek).then(() => 'saved'),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 400))
    ]);
    assert.equal(saved, 'saved');
    await vault.put('alice', { kind: 'signing' });
    const sealed = await guard.sealJson(dek, { phone: '+12025550101', email: '', salt: 'sim-salt-alice' });
    const again = guard.createIndexedDbVault();
    const back = await again.getMeta('alice');
    assert.equal(back[0], 9);
    assert.equal(back.length, 32);
    const opened = await guard.openJson(back, sealed);
    assert.equal(opened.salt, 'sim-salt-alice');
    assert.equal((await again.get('alice')).kind, 'signing');
    const kept = guard.deviceKeyForMigration(back);
    assert.equal(kept.length, 32);
    assert.equal(kept[0], 9);
    const fresh = guard.deviceKeyForMigration(null);
    assert.equal(fresh.length, 32);
    assert.equal(guard.deviceKeyForMigration(new Uint8Array(16)).length, 32);
  } finally {
    if (previous === undefined) delete globalThis.indexedDB;
    else globalThis.indexedDB = previous;
  }
});

test('the QR drawer reads a major-only Android version', () => {
  const source = readFileSync(join(root, 'js/vendor/qrcode.js'), 'utf8');
  assert.equal(source.includes('android ([0-9]+(?:\\.[0-9]+)?)'), true);
  const pattern = /android ([0-9]+(?:\.[0-9]+)?)/i;
  const pixel = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
  const found = pixel.match(pattern);
  assert.ok(found, pixel);
  assert.equal(parseFloat(found[1]) >= 3, true);
  const old = 'Mozilla/5.0 (Linux; Android 4.4.2; Phone)'.match(pattern);
  assert.equal(old[1], '4.4');
});

test('DC reference values stay pending when a series has no number', () => {
  const catalog = JSON.parse(readFileSync(join(root, 'data/dc-reference-values-v0.json'), 'utf8'));
  assert.equal(catalog.label, REFERENCE_LABEL);
  assert.equal(catalog.date, '2026-11-02');
  const byName = Object.fromEntries(catalog.items.map((item) => [item.name, item]));
  for (const name of ['Cooking / meal prep', 'Apples', 'Diesel']) {
    const item = byName[name];
    assert.ok(item, name);
    assert.equal(item.avg_value_usd, null);
    assert.equal(averagedReference(item), null);
    const line = referenceLine(item, catalog);
    assert.equal(line.pending, true);
    assert.equal(line.value, 'pending');
    assert.equal(line.label, 'DC reference values');
    assert.match(line.text, /^DC reference values\. /);
    assert.match(line.sources, /BLS/);
    assert.equal(/\d+\.\d+ USD/.test(line.text), false);
  }
  const lawn = referenceLine(byName['Lawn mowing'], catalog);
  assert.equal(lawn.pending, false);
  assert.equal(lawn.value, '109.5 USD per job');
  assert.match(lawn.asOf, /May 2025/);
  assert.match(lawn.sources, /SOC 37-3011/);
  const eggs = referenceLine(byName['Eggs, grade A large'], catalog);
  assert.equal(eggs.value, '2.368 USD per dozen');
  assert.match(eggs.asOf, /Sep 2026/);
  for (const item of catalog.items) {
    if (item.avg_value_usd == null) assert.equal(referenceLine(item, catalog).value, 'pending', item.name);
  }
  const helper = readFileSync(join(root, 'js/dc-reference.mjs'), 'utf8');
  assert.equal(helper.includes('fetch('), false);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(ui.includes("fetch('/data/dc-reference-values-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/offerup-dc-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/offerup-wanted-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/thumbtack-wanted-v0.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/payment-methods.json', { signal: gate.signal })"), true);
  assert.equal(ui.includes("fetch('/data/sourcing-daily.json', { signal: gate.signal })"), true);
  assert.equal((ui.match(/fetch\(/g) || []).length, 6);
  assert.equal(ui.includes('REFERENCE_LABEL'), true);
  assert.equal(ui.includes("id: 'dc-reference'"), true);
  assert.equal(helper.includes("DC reference values"), true);
  const mutual = readFileSync(join(root, 'js/pages/mutual-credit-simulator.js'), 'utf8');
  assert.equal((mutual.match(/fetch\(/g) || []).length, 1);
  assert.equal(mutual.includes("fetch('/data/dc-reference-values-v0.json', { signal: controller.signal })"), true);
  assert.equal(mutual.includes('AbortController'), true);
  assert.equal(mutual.includes('DC reference values') || mutual.includes('REFERENCE_LABEL'), true);
  assert.equal(mutual.includes('— pending') || mutual.includes('optionLabel'), true);
  const page = readFileSync(join(root, 'mutual-credit.html'), 'utf8');
  assert.equal(page.includes('DC reference values'), true);
  assert.equal(page.includes('id="refList"'), true);
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(page), false);
  const worker = readFileSync(join(root, 'sw.js'), 'utf8');
  assert.equal(worker.includes('lgme-v91'), true);
  assert.equal(worker.includes('key.startsWith("lgme-v")'), true);
  assert.equal(ui.includes('the arbiter who can veto'), true);
  assert.equal(ui.includes('Public Ledger / Verified Receipt'), true);
  assert.equal(ui.includes('lgme.exchange.introSeen'), true);
  assert.equal(ui.includes('Show intro'), true);
  assert.equal(ui.includes("sessionStorage.getItem('lgme-sim:ui:seen-walk')"), false);
  const desk = readFileSync(join(root, 'exchange.html'), 'utf8');
  assert.equal(desk.includes('splash-skip'), false);
  assert.equal(desk.includes('>Skip<'), false);
  assert.equal(desk.includes('preload="none"'), true);
  assert.equal(ui.includes('splash-skip'), false);
  assert.equal(ui.includes('AbortController'), true);
  const pay = readFileSync(join(root, 'js/solana-pay.mjs'), 'utf8');
  assert.equal(pay.includes('AbortController'), true);
  assert.equal(pay.includes('RPC_TIMEOUT_MS'), true);
  assert.equal(worker.includes('AbortController'), true);
  assert.equal(worker.includes('skipWaiting'), true);
  assert.equal(worker.includes('clients.claim'), true);
  assert.equal(worker.includes('/data/thumbtack-wanted-v0.json'), true);
  assert.equal(worker.includes('/data/offerup-wanted-v0.json'), true);
  assert.equal(worker.includes('/js/dc-reference.mjs'), true);
  assert.equal(worker.includes('/data/dc-reference-values-v0.json'), true);
});

test('a Solana signature settles one invoice and only after both parties attest', async () => {
  const store = await books();
  const online = { onLine: true };
  for (const [id, phone] of [['alice', '+12025550111'], ['bob', '+12025550112']]) {
    const peer = await store.get(id);
    peer.kyc = { status: 'VERIFIED', displayName: peer.name, phone, salt: `salt-${id}` };
    await store.set(id, peer);
  }
  const invoice = await sim.createInvoice(store, 'bob', {
    payerId: 'alice',
    amount: 1.5,
    dueAt: '2026-12-01T00:00:00.000Z',
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(invoice.ok, true, invoice.error);
  const before = await balances(store);
  await readyCoin(store, 'alice', 'bob', { amount: 1.5, invoiceId: invoice.invoiceId, at: '2026-11-07T01:00:00.000Z' });
  const spec = {
    signature: 'sig-one',
    reference: 'ref-one',
    mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump',
    amount: 1.5,
    recipient: '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY',
    invoiceId: invoice.invoiceId,
    otherId: 'bob',
    cluster: 'devnet',
    navigator: online,
    at: '2026-11-07T01:00:00.000Z'
  };
  const recorded = await sim.recordSolanaTx(store, 'alice', spec);
  assert.equal(recorded.ok, true, recorded.error);
  assert.equal(recorded.status, 'pending-attestation');
  assert.equal(recorded.unchanged, true);
  const aliceTape = (await store.get('alice')).tape.filter((entry) => entry.type === 'SOLANA_TX');
  const bobTape = (await store.get('bob')).tape.filter((entry) => entry.type === 'SOLANA_TX');
  assert.equal(aliceTape.length, 1);
  assert.equal(bobTape.length, 0);
  assert.equal(sim.readInvoices(await store.get('bob'), '2026-11-07T01:00:00.000Z').find((row) => row.invoiceId === invoice.invoiceId).status === 'paid', false);
  const reuse = await sim.recordSolanaTx(store, 'alice', spec);
  assert.equal(reuse.ok, false);
  assert.match(reuse.error, /already used/);
  const otherInvoice = await sim.recordSolanaTx(store, 'alice', { ...spec, invoiceId: 'invoice-two' });
  assert.equal(otherInvoice.ok, false);
  assert.match(otherInvoice.error, /Flagged double-spend/);
  const pendingHandoff = await sim.sealSolanaHandoff(store, 'alice', 'sig-one');
  assert.equal(pendingHandoff.ok, true, pendingHandoff.error);
  const staged = await sim.importMessage(store, 'bob', pendingHandoff.message);
  assert.equal(staged.ok, true, staged.error);
  assert.equal(staged.status, 'pending-attestation');
  assert.equal(staged.applied, false);
  assert.equal((await store.get('bob')).tape.filter((entry) => entry.type === 'SOLANA_TX').length, 0);
  const attested = await sim.attestSolanaTx(store, 'bob', { ...spec, payerId: 'alice', navigator: online, at: '2026-11-07T02:00:00.000Z' });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.status, 'settled');
  assert.equal(attested.penalty, false);
  assert.equal(attested.unchanged, true);
  assert.equal(sim.solanaStatus([await store.get('alice'), await store.get('bob')], 'sig-one'), 'settled');
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'SOLANA_FINAL' && entry.payload.signature === 'sig-one'), true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'SOLANA_FINAL' && entry.payload.signature === 'sig-one'), true);
  assert.equal((await store.get('bob')).tape.filter((entry) => entry.type === 'SOLANA_TX').length, 1);
  assert.equal(sim.readInvoices(await store.get('bob'), '2026-11-07T02:00:00.000Z').find((row) => row.invoiceId === invoice.invoiceId).status, 'paid');
  const after = await balances(store);
  assert.deepEqual(after, before);
  const again = await sim.recordSolanaTx(store, 'alice', { ...spec, signature: 'sig-two' });
  assert.equal(again.ok, false);
  assert.match(again.error, /already settled/);
  const handoff = await sim.sealSolanaHandoff(store, 'alice', 'sig-one');
  assert.equal(handoff.ok, true, handoff.error);
  const clash = sim.solanaDoubleSpend(await store.get('bob'), { tape: [{ type: 'SOLANA_TX', payload: { signature: 'sig-one', invoiceId: 'invoice-two' } }] });
  assert.equal(clash.ok, false);
  assert.equal(clash.flagged, true);
  const forged = await sim.sealMessage(await store.get('alice'), 'solana', { ...handoff.message.body, invoiceId: 'invoice-two' });
  const imported = await sim.importMessage(store, 'bob', forged.message);
  assert.equal(imported.ok, false);
  assert.match(imported.error, /Nothing was applied/);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.payload?.invoiceId === 'invoice-two'), false);
  await readyCoin(store, 'alice', 'bob', { amount: 1.5, invoiceId: '', at: '2026-11-07T03:00:00.000Z' });
  const refused = await sim.recordSolanaTx(store, 'alice', { ...spec, signature: 'sig-refuse', reference: 'ref-refuse', invoiceId: '', otherId: 'bob', at: '2026-11-07T03:00:00.000Z' });
  assert.equal(refused.ok, true, refused.error);
  const refusal = await sim.refuseSolanaTx(store, 'bob', { ...spec, signature: 'sig-refuse', reference: 'ref-refuse', payerId: 'alice', navigator: online }, 'REFUSAL');
  assert.equal(refusal.ok, true, refusal.error);
  assert.equal(refusal.status, 'refused');
  assert.equal(refusal.penalty, false);
  assert.equal(sim.solanaStatus([await store.get('alice'), await store.get('bob')], 'sig-refuse'), 'refused');
  assert.deepEqual(await balances(store), before);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  const attestAt = ui.indexOf('async function attestPayment');
  assert.ok(attestAt > 0);
  assert.ok(ui.indexOf('findReferencePayment', attestAt) < ui.indexOf('attestSolanaTx', attestAt));
  assert.equal(ui.includes('https://solscan.io/tx/'), true);
  assert.equal(ui.includes('refuseSolanaTx'), true);
});

test('Zelle and cash stay pending until the payee attests and a proof cannot be reused', async () => {
  const store = await books();
  const online = { onLine: true };
  for (const [id, phone] of [['alice', '+12025550121'], ['bob', '+12025550122']]) {
    const peer = await store.get(id);
    peer.kyc = { status: 'VERIFIED', displayName: peer.name, phone, salt: `salt-${id}` };
    await store.set(id, peer);
  }
  const invoice = await sim.createInvoice(store, 'bob', {
    payerId: 'alice',
    amount: 1.5,
    dueAt: '2026-12-01T00:00:00.000Z',
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(invoice.ok, true, invoice.error);
  const before = await balances(store);
  const proof = 'ab'.repeat(32);
  const recorded = await sim.recordOffchainPayment(store, 'alice', {
    method: 'zelle',
    amount: 1.5,
    paidAt: '2026-11-07',
    confirmation: 'ZELLE 99',
    proofHash: proof,
    invoiceId: invoice.invoiceId,
    otherId: 'bob',
    navigator: online,
    at: '2026-11-07T01:00:00.000Z'
  });
  assert.equal(recorded.ok, true, recorded.error);
  assert.equal(recorded.status, 'pending-attestation');
  assert.equal(recorded.unchanged, true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'OFFCHAIN_TX'), false);
  assert.notEqual(sim.readInvoices(await store.get('bob'), '2026-11-07T01:00:00.000Z').find((row) => row.invoiceId === invoice.invoiceId).status, 'paid');
  assert.equal(JSON.stringify((await store.get('alice')).tape).includes('screenshot-bytes'), false);
  const duplicate = await sim.recordOffchainPayment(store, 'alice', {
    method: 'zelle',
    amount: 2,
    paidAt: '2026-11-08',
    confirmation: 'zelle99',
    invoiceId: 'invoice-two',
    otherId: 'bob',
    navigator: online
  });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.error, /Flagged double-spend/);
  const sameFile = await sim.recordOffchainPayment(store, 'alice', {
    method: 'cash',
    amount: 2,
    paidAt: '2026-11-08',
    note: 'handed over',
    proofHash: proof,
    invoiceId: 'invoice-three',
    otherId: 'bob',
    navigator: online
  });
  assert.equal(sameFile.ok, false);
  assert.match(sameFile.error, /Flagged double-spend/);
  const attested = await sim.attestOffchainPayment(store, 'bob', {
    paymentId: recorded.payload.paymentId,
    payerId: 'alice',
    invoiceId: invoice.invoiceId,
    navigator: online,
    at: '2026-11-07T02:00:00.000Z'
  });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.status, 'settled');
  assert.equal(attested.penalty, false);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'OFFCHAIN_FINAL'), true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'OFFCHAIN_FINAL'), true);
  assert.equal(sim.readInvoices(await store.get('bob'), '2026-11-07T02:00:00.000Z').find((row) => row.invoiceId === invoice.invoiceId).status, 'paid');
  const receipt = sim.offchainReceipt([await store.get('alice'), await store.get('bob')], recorded.payload.paymentId);
  assert.equal(receipt.ok, true, receipt.error);
  assert.equal(receipt.proofHash, proof);
  assert.equal(receipt.thanks, 'THANK YOU FOR YOUR SUPPORT.');
  assert.equal(receipt.statutoryFees, '');
  assert.equal(sim.FIAT_FEE_NOTE, 'Fiat payments (cash, Zelle) may incur additional statutory fees. Details are reviewed per transaction.');
  assert.ok(receipt.payerSig && receipt.payeeSig);
  const cash = await sim.recordOffchainPayment(store, 'alice', {
    method: 'cash',
    amount: 4,
    paidAt: '2026-11-09',
    note: 'in person at the door',
    otherId: 'bob',
    navigator: online
  });
  assert.equal(cash.ok, true, cash.error);
  const refusal = await sim.refuseOffchainPayment(store, 'bob', { paymentId: cash.payload.paymentId, payerId: 'alice', navigator: online }, 'REFUSAL');
  assert.equal(refusal.ok, true, refusal.error);
  assert.equal(refusal.status, 'refused');
  assert.equal(refusal.penalty, false);
  assert.equal(sim.offchainStatus([await store.get('alice'), await store.get('bob')], cash.payload.paymentId), 'refused');
  assert.deepEqual(await balances(store), before);
  const methods = JSON.parse(readFileSync(join(root, 'data/payment-methods.json'), 'utf8'));
  assert.equal(methods.zelle.recipient, '');
  const coin = readFileSync(join(root, 'lgme-coin.html'), 'utf8');
  const grants = readFileSync(join(root, 'grants.html'), 'utf8');
  assert.equal(coin.includes('Option C. Zelle'), true);
  assert.equal(coin.includes('Option D. Cash'), true);
  assert.equal(coin.includes('Zelle details: ask the recipient in chat / provided on request'), true);
  assert.equal(coin.includes('Do not mail cash.'), true);
  assert.equal(coin.includes(sim.FIAT_FEE_NOTE), true);
  assert.equal(grants.includes('Do not mail cash.'), true);
  assert.equal(grants.includes(sim.FIAT_FEE_NOTE), true);
  assert.equal(readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes('FIAT_FEE_NOTE'), true);
  assert.equal(readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes('Statutory fees / notes'), true);
  assert.equal(coin.includes('$Trust') || grants.includes('$Trust'), false);
});

test('an $lgme loyalty discount needs both signatures and the floor rebate follows final payment', async () => {
  const store = await books();
  const online = { onLine: true };
  for (const [id, phone] of [['alice', '+12025550131'], ['bob', '+12025550132']]) {
    const peer = await store.get(id);
    peer.kyc = { status: 'VERIFIED', displayName: peer.name, phone, salt: `salt-${id}` };
    await store.set(id, peer);
  }
  const listed = await sim.createListing(store, 'bob', {
    title: 'Bench hour',
    category: 'Services',
    condition: 'Good',
    pickup: 'Meet',
    circle: 'soBeIT',
    amount: 10,
    photoHash: 'cd'.repeat(32),
    kind: 'IprovIT',
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(listed.ok, true, listed.error);
  const proposed = await sim.signOffer(store, 'alice', {
    listingId: listed.listing.id,
    cashMode: 'lgme',
    loyaltyPercent: 5,
    amount: 10,
    navigator: online
  });
  assert.equal(proposed.ok, true, proposed.error);
  assert.equal(proposed.offer.loyalty.percent, 5);
  assert.equal(sim.loyaltyStanding(proposed.offer).agreed, false);
  const declined = await sim.countersignOffer(store, 'bob', proposed.offer.id, { declineLoyalty: true, navigator: online });
  assert.equal(declined.ok, true, declined.error);
  assert.equal(sim.loyaltyStanding(declined.offer).agreed, false);
  assert.equal(sim.loyaltyStanding(declined.offer).declined, true);
  const invoice = await sim.createInvoice(store, 'bob', {
    payerId: 'alice',
    amount: 10,
    dueAt: '2026-12-01T00:00:00.000Z',
    at: '2026-11-07T00:00:00.000Z'
  });
  assert.equal(invoice.ok, true, invoice.error);
  const rules = { defaultPercent: 5, maxPercentPerDeal: 15, capAmountPerPeriod: 25, periodDays: 30, reserve: 100 };
  await sim.consentLoyalty(store, 'alice', { invoiceId: invoice.invoiceId, percent: 5, rules, payerWallet: '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY', navigator: online });
  const spec = {
    signature: 'sig-loyalty',
    reference: 'ref-loyalty',
    mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump',
    amount: 10,
    recipient: '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY',
    invoiceId: invoice.invoiceId,
    otherId: 'bob',
    cluster: 'devnet',
    navigator: online
  };
  await readyCoin(store, 'alice', 'bob', { amount: 10, invoiceId: invoice.invoiceId, at: new Date().toISOString() });
  const pending = await sim.recordSolanaTx(store, 'alice', spec);
  assert.equal(pending.ok, true, pending.error);
  const halfway = await sim.attestSolanaTx(store, 'bob', { ...spec, payerId: 'alice', navigator: online });
  assert.equal(halfway.ok, true, halfway.error);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'FLOOR_REBATE_DUE'), false);
  await sim.consentLoyalty(store, 'bob', { invoiceId: invoice.invoiceId, percent: 5, rules, navigator: online });
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'FLOOR_REBATE_DUE' && entry.payload.amount === 0.5), true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'FLOOR_REBATE_DUE'), true);
  assert.equal(sim.readInvoices(await store.get('alice'), '2026-11-07T03:00:00.000Z').find((row) => row.invoiceId === invoice.invoiceId).paid, 10);
  const low = await sim.reviewFloorRebate(store, 'alice', { invoiceId: invoice.invoiceId, balance: 10, navigator: online });
  assert.equal(low.ok, true, low.error);
  assert.equal(low.status, 'deferred');
  assert.equal(low.penalty, false);
  const paid = await sim.recordFloorRebate(store, 'alice', { signature: 'rebate-sig', reference: 'rebate-ref', invoiceId: invoice.invoiceId, navigator: online });
  assert.equal(paid.ok, true, paid.error);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'FLOOR_REBATE_PAID' && entry.payload.signature === 'rebate-sig'), true);
  const reuse = await sim.recordFloorRebate(store, 'alice', { signature: 'rebate-sig', reference: 'rebate-ref', invoiceId: invoice.invoiceId, navigator: online });
  assert.equal(reuse.ok, false);
  assert.match(reuse.error, /already used/);
  const settlementReuse = await sim.recordFloorRebate(store, 'alice', { signature: 'sig-loyalty', invoiceId: invoice.invoiceId, navigator: online });
  assert.equal(settlementReuse.ok, false);
});

test('a price lock lasts 15 seconds, a mismatch is rejected, and no price offers terms or barter', async () => {
  const store = await books();
  const online = { onLine: true };
  const start = Date.parse('2026-11-07T12:00:00.000Z');
  const day = 86400000;
  const candles = [
    { t: start - 30 * day, close: 1 },
    { t: start - 7 * day, close: 1 },
    { t: start - 2 * day, close: 1 },
    { t: start - day, close: 1 }
  ];
  const first = await sim.openQuote(store, 'alice', {
    usdAmount: 10,
    price: 1.08,
    priceSource: 'geckoterminal',
    invoiceId: 'deal-1',
    otherId: 'bob',
    candles,
    history: 'ok',
    at: new Date(start).toISOString(),
    navigator: online
  });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.lock.price, 1.05);
  assert.equal(first.lock.rawPrice, 1.08);
  assert.equal(first.lock.bounded.includes('24h'), true);
  const aliceClamp = (await store.get('alice')).tape.find((entry) => entry.type === 'PRICE_CLAMP');
  const bobClamp = (await store.get('bob')).tape.find((entry) => entry.type === 'PRICE_CLAMP');
  assert.equal(aliceClamp.payload.rawPrice, 1.08);
  assert.equal(aliceClamp.payload.effectivePrice, 1.05);
  assert.equal(bobClamp.payload.effectivePrice, 1.05);
  assert.equal(bobClamp.payload.anchors.day, 1);
  const seenAt = new Date(start + 1000).toISOString();
  await sim.acknowledgeQuote(store, 'alice', { lockId: first.lock.lockId, at: seenAt, navigator: online });
  await sim.acknowledgeQuote(store, 'bob', { lockId: first.lock.lockId, at: seenAt, navigator: online });
  const late = await sim.issueSolanaRequest(store, 'alice', { lockId: first.lock.lockId, at: new Date(start + 16000).toISOString(), navigator: online });
  assert.equal(late.ok, false);
  assert.equal(late.expired, true);
  assert.equal(late.requote, true);
  const second = await sim.openQuote(store, 'alice', {
    usdAmount: 10,
    price: 1.03,
    priceSource: 'geckoterminal',
    invoiceId: 'deal-1',
    otherId: 'bob',
    history: 'history unavailable',
    at: new Date(start + 16000).toISOString(),
    navigator: online
  });
  assert.equal(second.ok, true, second.error);
  assert.notEqual(second.lock.lgmeAmount, first.lock.lgmeAmount);
  const againAt = new Date(start + 17000).toISOString();
  await sim.acknowledgeQuote(store, 'alice', { lockId: second.lock.lockId, at: againAt, navigator: online });
  await sim.acknowledgeQuote(store, 'bob', { lockId: second.lock.lockId, at: againAt, navigator: online });
  const issued = await sim.issueSolanaRequest(store, 'alice', { lockId: second.lock.lockId, at: new Date(start + 18000).toISOString(), navigator: online });
  assert.equal(issued.ok, true, issued.error);
  const mismatch = await sim.recordSolanaTx(store, 'alice', {
    signature: 'sig-old',
    reference: 'ref-old',
    mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump',
    amount: first.lock.lgmeAmount,
    recipient: '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY',
    invoiceId: 'deal-1',
    otherId: 'bob',
    at: new Date(start + 120000).toISOString(),
    navigator: online
  });
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /does not match the price lock/);
  const paid = await sim.recordSolanaTx(store, 'alice', {
    signature: 'sig-new',
    reference: 'ref-new',
    mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump',
    amount: second.lock.lgmeAmount,
    recipient: '6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY',
    invoiceId: 'deal-1',
    otherId: 'bob',
    at: new Date(start + 120000).toISOString(),
    navigator: online
  });
  assert.equal(paid.ok, true, paid.error);
  assert.equal(paid.status, 'pending-attestation');
  const blocked = await sim.openQuote(store, 'alice', { usdAmount: 10, price: 0, priceSource: 'geckoterminal', invoiceId: 'deal-2', otherId: 'bob', navigator: online });
  assert.equal(blocked.ok, false);
  assert.deepEqual(blocked.alternatives, ['terms', 'barter']);
  const terms = await sim.proposeAltSettlement(store, 'alice', { choice: 'terms', months: 4, usdAmount: 10, invoiceId: 'deal-2', otherId: 'bob', navigator: online });
  assert.equal(terms.ok, true, terms.error);
  assert.equal(terms.consented, false);
  const alone = await sim.consentAltSettlement(store, 'alice', { altId: terms.altId, navigator: online });
  assert.equal(alone.consented, false);
  const agreed = await sim.consentAltSettlement(store, 'bob', { altId: terms.altId, navigator: online });
  assert.equal(agreed.ok, true, agreed.error);
  assert.equal(agreed.choice, 'terms');
  assert.equal(agreed.consented, true);
  const barter = await sim.proposeAltSettlement(store, 'alice', { choice: 'barter', usdAmount: 10, invoiceId: 'deal-3', otherId: 'bob', navigator: online });
  const traded = await sim.consentAltSettlement(store, 'bob', { altId: barter.altId, navigator: online });
  assert.equal(traded.choice, 'barter');
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'SOLANA_TX' && entry.payload?.invoiceId === 'deal-2'), false);
  assert.equal(sim.PEG_NOTE.includes('never moves more than 5%'), true);
});

test('the named third seat can veto, and the co-sign threshold stays', async () => {
  const store = await books();
  const before = await balances(store);
  const proposed = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    thirdSeatId: 'charlie',
    amount: 10,
    reference: 'Soil credits',
    at: '2026-11-06T00:01:00.000Z'
  });
  assert.equal(proposed.ok, true, proposed.error);
  const empty = await sim.thirdSeatVeto(store, 'charlie', proposed.exchangeId, '   ', '2026-11-06T00:02:00.000Z');
  assert.equal(empty.ok, false);
  assert.match(empty.error, /reason/);
  const party = await sim.thirdSeatVeto(store, 'bob', proposed.exchangeId, 'Not my seat', '2026-11-06T00:02:00.000Z');
  assert.equal(party.ok, false);
  const vetoed = await sim.thirdSeatVeto(store, 'charlie', proposed.exchangeId, 'The line skipped the floor.', '2026-11-06T00:02:00.000Z');
  assert.equal(vetoed.ok, true, vetoed.error);
  assert.equal(vetoed.status, 'vetoed');
  assert.equal(vetoed.unchanged, true);
  assert.equal(vetoed.vetoCount, 1);
  assert.deepEqual(await balances(store), before);
  for (const id of ['alice', 'bob']) {
    assert.equal((await store.get(id)).tape.some((entry) => entry.type === 'THIRD_SEAT_VETO' && entry.payload.reason === 'The line skipped the floor.'), true);
  }
  assert.equal(sim.peerProfile(await store.get('charlie')).vetoCount, 1);
  assert.equal(sim.peerProfile(await store.get('alice')).vetoCount, 0);
  const settled = await sim.settle(store, 'alice', proposed.exchangeId, '2026-11-06T00:03:00.000Z');
  assert.equal(settled.ok, false);
  assert.match(settled.error, /Vetoed/);
  assert.equal(guard.coSignReason(60, ''), 'Amounts above 50 $lgme need a third-seat co-sign.');
  assert.equal(guard.coSignReason(60, 'signed'), '');
});

test('a clearing window nets, locks one price, or rolls and terms the remainder', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'bob', name: 'Bob', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  const rules = { windowDays: 7, epoch: '2026-01-01T00:00:00.000Z' };
  const at = '2026-11-06T12:00:00.000Z';
  const window = sim.clearingWindow(at, rules);
  assert.equal(window.windowDays, 7);
  const methods = JSON.parse(readFileSync(join(root, 'data/payment-methods.json'), 'utf8'));
  assert.equal(methods.clearing.windowDays, methods.peg.holdDays);
  const first = await sim.recordIou(store, 'alice', { debtorId: 'alice', creditorId: 'bob', amount: 10, reference: 'Soil', at, rules });
  const second = await sim.recordIou(store, 'bob', { debtorId: 'bob', creditorId: 'alice', amount: 4, reference: 'Tools', at, rules });
  assert.equal((await sim.attestIou(store, 'bob', first.iouId, at)).ok, true);
  assert.equal((await sim.attestIou(store, 'alice', second.iouId, at)).ok, true);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'WINDOW_OPEN' && entry.payload.windowId === window.windowId), true);
  const early = await sim.closeClearingWindow(store, 'alice', { at, rules, navigator: { onLine: true } });
  assert.equal(early.ok, false);
  assert.match(early.error, /still open/);
  const online = { onLine: true };
  const priced = await sim.closeClearingWindow(store, 'alice', {
    at: window.closesAt,
    rules,
    price: 1,
    priceSource: 'geckoterminal',
    history: 'history unavailable',
    disposition: 'roll',
    navigator: online
  });
  assert.equal(priced.ok, true, priced.error);
  assert.equal(priced.nets[0].offset, 4);
  assert.equal(priced.nets[0].residual, 6);
  assert.equal(priced.locks.length, 1);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'PRICE_LOCK' && entry.payload.usdAmount === 6), true);
  const aliceClose = (await store.get('alice')).tape.find((entry) => entry.type === 'WINDOW_CLOSE');
  const bobClose = (await store.get('bob')).tape.find((entry) => entry.type === 'WINDOW_CLOSE');
  assert.equal(aliceClose.payload.merkleRoot, priced.merkleRoot);
  assert.equal(bobClose.payload.merkleRoot.length, 64);
  const rollStore = sim.createMemoryStore();
  await sim.registerPeer(rollStore, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  await sim.registerPeer(rollStore, { id: 'bob', name: 'Bob', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  const lone = await sim.recordIou(rollStore, 'alice', { debtorId: 'alice', creditorId: 'bob', amount: 5, reference: 'Carry', at, rules });
  await sim.attestIou(rollStore, 'bob', lone.iouId, at);
  const rolled = await sim.closeClearingWindow(rollStore, 'alice', { at: window.closesAt, rules, disposition: 'roll', navigator: online });
  assert.equal(rolled.ok, true, rolled.error);
  assert.equal(rolled.rolled.length, 1);
  assert.equal((await rollStore.get('alice')).ious[lone.iouId].windowId, rolled.nextWindowId);
  const termStore = sim.createMemoryStore();
  await sim.registerPeer(termStore, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  await sim.registerPeer(termStore, { id: 'bob', name: 'Bob', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  const due = await sim.recordIou(termStore, 'alice', { debtorId: 'alice', creditorId: 'bob', amount: 9, reference: 'Terms', at, rules });
  await sim.attestIou(termStore, 'bob', due.iouId, at);
  const termed = await sim.closeClearingWindow(termStore, 'alice', { at: window.closesAt, rules, disposition: 'terms', months: 3, navigator: online });
  assert.equal(termed.ok, true, termed.error);
  assert.equal(termed.termed.length, 1);
  assert.equal((await termStore.get('alice')).tape.some((entry) => entry.type === 'ALT_SETTLEMENT'), true);
  assert.equal((await termStore.get('alice')).ious[due.iouId].closed, 'terms');
});

test('a Merkle proof shows an entry in the day root and rejects a tampered path', async () => {
  const leaves = ['aa', 'bb', 'cc'];
  const proof = await sim.merkleProofFor(leaves, 2);
  assert.equal(proof.root, await sim.merkleRootOf(leaves));
  assert.equal(await sim.verifyMerkleProof(proof), true);
  const tampered = structuredClone(proof);
  tampered.path[0].hash = 'ff';
  assert.equal(await sim.verifyMerkleProof(tampered), false);
  const store = await books();
  const peer = await store.get('alice');
  const entry = peer.tape[0];
  const proved = await sim.proveEntry(peer, { hash: entry.hash, day: entry.at.slice(0, 10) });
  assert.equal(proved.ok, true, proved.error);
  assert.equal((await sim.verifyInclusion(proved.proof)).valid, true);
  proved.proof.path.push({ hash: '00', side: 'right' });
  assert.equal((await sim.verifyInclusion(proved.proof)).valid, false);
  const exported = await sim.exportRecords(peer);
  assert.equal(exported.roots.days[entry.at.slice(0, 10)], proved.proof.root);
  assert.equal(typeof exported.roots.windows, 'object');
});

test('net out offsets both directions after two codes, and a cycle stays a stub', async () => {
  const store = sim.createMemoryStore();
  await sim.registerPeer(store, { id: 'alice', name: 'Alice', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  await sim.registerPeer(store, { id: 'bob', name: 'Bob', floor: 0, at: '2026-11-01T00:00:00.000Z' });
  const at = '2026-11-06T12:00:00.000Z';
  const forth = await sim.recordIou(store, 'alice', { debtorId: 'alice', creditorId: 'bob', amount: 10, reference: 'One way', at });
  const back = await sim.recordIou(store, 'bob', { debtorId: 'bob', creditorId: 'alice', amount: 4, reference: 'Other way', at });
  await sim.attestIou(store, 'bob', forth.iouId, at);
  await sim.attestIou(store, 'alice', back.iouId, at);
  const before = sim.replay(await store.get('alice')).balance;
  const unix = 1700000000;
  const aliceSetup = await sim.setupWallet(store, 'alice', 'correct horse', { iterations: 2000 });
  const aliceCode = await sim.totp(sim.base32Decode(aliceSetup.secretBase32), unix, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const proposed = await sim.proposeNetting(store, 'alice', { otherId: 'bob', passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at });
  assert.equal(proposed.ok, true, proposed.error);
  assert.equal(proposed.offset, 4);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'NETTING'), true);
  const bobSetup = await sim.setupWallet(store, 'bob', 'correct horse', { iterations: 2000 });
  const bobCode = await sim.totp(sim.base32Decode(bobSetup.secretBase32), unix, { digits: 6, period: 30, algorithm: 'SHA-1' });
  const wrong = await sim.attestNetting(store, 'bob', proposed.nettingId, { passphrase: 'correct horse', code: '000000', unixSeconds: unix, at });
  assert.equal(wrong.ok, false);
  const alice = await store.get('alice');
  alice.privateKeyJwk = (await sim.unlockWallet(alice, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', alice);
  const attested = await sim.attestNetting(store, 'bob', proposed.nettingId, { passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.status, 'attested');
  assert.equal(attested.unchanged, true);
  assert.equal(sim.replay(await store.get('alice')).balance, before);
  assert.equal((await store.get('alice')).tape.some((entry) => entry.type === 'NETTING' && entry.payload.status === 'attested'), true);
  assert.equal((await store.get('bob')).tape.some((entry) => entry.type === 'NETTING' && entry.payload.status === 'attested'), true);
  const aliceAgain = await store.get('alice');
  aliceAgain.privateKeyJwk = (await sim.unlockWallet(aliceAgain, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', aliceAgain);
  const bobOpen = await store.get('bob');
  bobOpen.privateKeyJwk = (await sim.unlockWallet(bobOpen, 'correct horse', bobCode, unix)).privateKeyJwk;
  await store.set('bob', bobOpen);
  const later = await sim.recordIou(store, 'alice', { debtorId: 'alice', creditorId: 'bob', amount: 8, reference: 'Later', at });
  const reply = await sim.recordIou(store, 'bob', { debtorId: 'bob', creditorId: 'alice', amount: 3, reference: 'Later back', at });
  assert.equal((await sim.attestIou(store, 'bob', later.iouId, at)).ok, true);
  assert.equal((await sim.attestIou(store, 'alice', reply.iouId, at)).ok, true);
  const afterSecond = sim.replay(await store.get('alice')).balance;
  const second = await sim.proposeNetting(store, 'alice', { otherId: 'bob', passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at });
  assert.equal(second.ok, true, second.error);
  const bobAgain = await store.get('bob');
  bobAgain.privateKeyJwk = (await sim.unlockWallet(bobAgain, 'correct horse', bobCode, unix)).privateKeyJwk;
  await store.set('bob', bobAgain);
  const refused = await sim.refuseNetting(store, 'bob', second.nettingId, { passphrase: 'correct horse', code: bobCode, unixSeconds: unix, statement: 'REFUSAL', at });
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.status, 'refused');
  assert.equal(refused.unchanged, true);
  const cycle = sim.cycleNetStub([
    { debtorId: 'alice', creditorId: 'bob', amount: 10 },
    { debtorId: 'bob', creditorId: 'charlie', amount: 10 },
    { debtorId: 'charlie', creditorId: 'alice', amount: 10 }
  ]);
  assert.equal(cycle.ready, false);
  assert.equal(cycle.appliesAt, 'window-close');
  assert.equal(cycle.parties.length, 3);
  assert.equal(sim.replay(await store.get('alice')).balance, afterSecond);
});
