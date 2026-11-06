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
  assert.equal(settled.balances.bob, -35);
  assert.equal((await balances(store)).charlie, -75);
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

test('pages stay simulation-only', () => {
  const files = [
    'js/p2p-exchange-sim.mjs',
    'js/p2p-exchange-sim-ui.mjs',
    'p2p-exchange-sim.html'
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
