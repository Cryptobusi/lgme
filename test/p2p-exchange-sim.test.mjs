import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';

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

test('IdidIt receipt does not move a balance, and export withholds the private key', async () => {
  const store = await books();
  const before = (await balances(store)).alice;
  const receipt = await sim.recordIdidIt(store, 'alice', { work: 'Walkway clearing', scope: 'path', hours: 2 });
  assert.equal(receipt.ok, true, receipt.error);
  assert.equal(receipt.balance, before);
  const alice = await store.get('alice');
  const exported = sim.toExport(alice);
  assert.equal(exported.privateKeyJwk, undefined);
  assert.equal(exported.tape.some((entry) => entry.type === 'ididit'), true);
  assert.equal(sim.toCsv(alice).includes('Walkway clearing'), true);
  const cited = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'alice',
    creditorId: 'bob',
    amount: 5,
    reference: 'Walkway clearing',
    ididitId: receipt.receiptId
  });
  assert.equal(cited.ok, false);
  assert.match(cited.error, /worker's tape/);
  const owned = await sim.proposeBilateral(store, {
    proposerId: 'alice',
    debtorId: 'bob',
    creditorId: 'alice',
    amount: 5,
    reference: 'Walkway clearing',
    ididitId: receipt.receiptId
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
    'Mutual credit simulator',
    'Deployment manifest',
    'The third seat',
    'The broken car',
    'SPP_Overview.pptx'
  ]) {
    assert.equal(text.includes(phrase), true, phrase);
  }
});

test('pages stay simulation-only', () => {
  const files = [
    'js/p2p-exchange-sim.mjs',
    'js/p2p-exchange-sim-ui.mjs',
    'js/p2p-resources.mjs',
    'p2p-exchange-sim.html',
    'manifest.webmanifest'
  ];
  const banned = ['0.0.489104', 'hederica.com', 'lgme.hederica.com', '$Trust', 'XMLHttpRequest', 'WebSocket'];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const word of banned) assert.equal(text.includes(word), false, `${file} contains ${word}`);
  }
  const engine = readFileSync(join(root, 'js/p2p-exchange-sim.mjs'), 'utf8');
  assert.equal(engine.includes('fetch('), false);
  const ui = readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8');
  assert.equal(ui.includes("fetch('/data/dc-reference-values-v0.json')"), true);
  assert.equal((ui.match(/fetch\(/g) || []).length, 1);
});
