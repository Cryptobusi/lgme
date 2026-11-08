import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { DEFAULT_SUBFLOOR_RULES, floatedUnit, lockDeedUnit, planDeedPost, projectSubfloors, rankCategories } from '../js/subfloor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-11-08T15:00:00.000Z';
const unix = 1700000000;

async function people() {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'alice', name: 'Alice', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'bob', name: 'Bob', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'charlie', name: 'Charlie', balance: 100, floor: 40, creditLimit: -200, at });
  return store;
}

async function codeFor(store, id) {
  const setup = await sim.setupWallet(store, id, 'correct horse', { iterations: 2000 });
  return sim.totp(sim.base32Decode(setup.secretBase32), unix, { digits: 6, period: 30, algorithm: 'SHA-1' });
}

async function reopen(store, id, code) {
  const peer = await store.get(id);
  peer.privateKeyJwk = (await sim.unlockWallet(peer, 'correct horse', code, unix)).privateKeyJwk;
  await store.set(id, peer);
}

test('a deed unit locks the US$ value at commitment', () => {
  const locked = lockDeedUnit({ priceUsdPerLgme: 2, valueUsd: 10, at });
  assert.equal(locked.ok, true);
  assert.equal(locked.valueUsd, 10);
  assert.equal(locked.valueLgme, 5);
  const later = floatedUnit(locked, 4);
  assert.equal(later.lockedUsd, 10);
  assert.equal(later.lockedLgme, 5);
  assert.equal(later.floatedLgme, 2.5);
  const file = JSON.parse(readFileSync(join(root, 'data/subfloor.json'), 'utf8'));
  assert.equal(file.skimRate, DEFAULT_SUBFLOOR_RULES.skimRate);
  assert.equal(file.deedCapShare, 0.5);
  assert.equal(file.dailyCapLgme, 20);
  assert.deepEqual(file.postTypes, ['IwantIT', 'IhavIT', 'IselIT', 'soBeIT']);
});

test('the plan takes a 1% skim, pauses an empty discount, and caps a deed at half the pool', () => {
  const full = planDeedPost({
    postType: 'IselIT', category: 'tutoring', listUsd: 100, priceUsdPerLgme: 1, at
  }, { available: 0 });
  assert.equal(full.payLgme, 100);
  assert.equal(full.providerLgme, 99);
  assert.equal(full.skimLgme, 1);
  const paused = planDeedPost({
    postType: 'IselIT', category: 'tutoring', listUsd: 10, priceUsdPerLgme: 1, discountUsd: 4, at
  }, { available: 0 });
  assert.equal(paused.discountPaused, true);
  assert.equal(paused.coverLgme, 0);
  assert.equal(paused.payLgme, 10);
  const capped = planDeedPost({
    postType: 'IselIT', category: 'tutoring', listUsd: 10, priceUsdPerLgme: 1, discountUsd: 8, at
  }, { available: 10 });
  assert.equal(capped.coverLgme, 5);
  assert.equal(capped.payLgme, 5);
  const daily = planDeedPost({
    postType: 'IselIT', category: 'repair', listUsd: 10, priceUsdPerLgme: 1, discountUsd: 4, at, paidToday: 0, heldToday: 0
  }, { available: 100 }, { ...DEFAULT_SUBFLOOR_RULES, dailyCapLgme: 3 });
  assert.equal(daily.coverLgme, 3);
  const zero = planDeedPost({
    postType: 'IselIT', category: 'cleanup', priceUsd: 0, unitValueUsd: 10, priceUsdPerLgme: 1, at
  }, { available: 0 });
  assert.equal(zero.postType, 'soBeIT');
  assert.equal(zero.donationRequest, true);
  assert.equal(zero.askLgme, 10);
});

test('a category sale skims 1% and a discount is paid only after both attest', async () => {
  const store = await people();
  const seeded = await sim.donateToSubfloor(store, 'bob', { category: 'tutoring', amount: 10, at });
  assert.equal(seeded.ok, true, seeded.error);
  assert.equal(seeded.floorReserve, 0);
  const aliceCode = await codeFor(store, 'alice');
  const posted = await sim.postDeed(store, 'alice', {
    category: 'tutoring',
    postType: 'IselIT',
    title: 'Tutoring class',
    listUsd: 10,
    priceUsdPerLgme: 1,
    discountUsd: 4,
    counterpartyId: 'bob',
    thirdSeatId: 'charlie',
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(posted.ok, true, posted.error);
  assert.equal(posted.discountPaused, false);
  assert.equal(posted.post.coverLgme, 4);
  assert.equal(sim.replay(await store.get('bob')).balance, 90);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const attested = await sim.attestDeedReceipt(store, 'bob', posted.postId, {
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.receiptName, 'IdidIt (verified receipt)');
  assert.equal(attested.skimLgme, 0.06);
  assert.equal(attested.coverLgme, 4);
  assert.equal(attested.buyerBalance, 84);
  assert.equal(attested.providerBalance, 109.94);
  const view = projectSubfloors([await store.get('alice'), await store.get('bob')]);
  assert.equal(view.categories.tutoring.balance, 6.06);
  assert.equal(view.floorReserve, 0);
  const types = (await store.get('alice')).tape.map((entry) => entry.type);
  assert.equal(types.includes('SUBFLOOR_SKIM'), true);
  assert.equal(types.includes('SUBFLOOR_PAYOUT'), true);
  assert.equal(types.some((type) => type.startsWith('FLOOR_REBATE')), false);
  const skim = (await store.get('alice')).tape.find((entry) => entry.type === 'SUBFLOOR_SKIM');
  const proof = await sim.proveEntry(await store.get('alice'), { hash: skim.hash, at });
  assert.equal(proof.ok, true, proof.error);
  assert.equal(proof.proof.root.length, 64);
});

test('an empty subfloor pauses the discount and does not borrow from the main floor', async () => {
  const store = await people();
  const aliceCode = await codeFor(store, 'alice');
  const posted = await sim.postDeed(store, 'alice', {
    category: 'repair',
    postType: 'IselIT',
    listUsd: 10,
    priceUsdPerLgme: 1,
    discountUsd: 4,
    counterpartyId: 'bob',
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(posted.discountPaused, true);
  assert.equal(posted.post.coverLgme, 0);
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const attested = await sim.attestDeedReceipt(store, 'bob', posted.postId, {
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.payLgme, 10);
  assert.equal(attested.providerLgme, 9.9);
  assert.equal(attested.coverLgme, 0);
  assert.equal(attested.buyerBalance, 90);
  assert.equal(attested.providerBalance, 109.9);
  const view = projectSubfloors([await store.get('alice'), await store.get('bob')]);
  assert.equal(view.categories.repair.balance, 0.1);
  assert.equal(view.floorReserve, 0);
});

test('the floor blocks a deed payment, a zero price splits 50/50, and demand ranks the request', async () => {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'alice', name: 'Alice', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'bob', name: 'Bob', balance: 40, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'charlie', name: 'Charlie', balance: 100, floor: 40, creditLimit: -200, at });
  const aliceCode = await codeFor(store, 'alice');
  const posted = await sim.postDeed(store, 'alice', {
    category: 'cleanup',
    postType: 'IselIT',
    listUsd: 10,
    priceUsdPerLgme: 1,
    counterpartyId: 'bob',
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const blocked = await sim.attestDeedReceipt(store, 'bob', posted.postId, {
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /Floor/);
  assert.equal(sim.replay(await store.get('bob')).balance, 40);

  const free = await sim.postDeed(store, 'alice', {
    category: 'tutoring',
    postType: 'IselIT',
    priceUsd: 0,
    unitValueUsd: 10,
    priceUsdPerLgme: 1,
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(free.ok, true, free.error);
  assert.equal(free.donationRequest, true);
  await reopen(store, 'alice', aliceCode);
  const funded = await sim.fundZeroPrice(store, 'charlie', free.postId, { at });
  assert.equal(funded.ok, true, funded.error);
  assert.deepEqual(funded.split, { subfloor: 5, floor: 5 });
  assert.equal(funded.floorReserve, 5);
  assert.equal(funded.subfloor, 5);
  assert.equal(sim.replay(await store.get('charlie')).balance, 90);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);

  await sim.postDeed(store, 'alice', {
    category: 'tutoring', postType: 'IwantIT', listUsd: 5, priceUsdPerLgme: 1,
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at: '2026-11-08T16:00:00.000Z'
  });
  await sim.postDeed(store, 'alice', {
    category: 'tutoring', postType: 'IwantIT', listUsd: 5, priceUsdPerLgme: 1,
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at: '2026-11-08T16:30:00.000Z'
  });
  await sim.postDeed(store, 'alice', {
    category: 'repair', postType: 'IwantIT', listUsd: 5, priceUsdPerLgme: 1,
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at: '2026-11-08T17:00:00.000Z'
  });
  const peers = [await store.get('alice'), await store.get('bob'), await store.get('charlie')];
  const ranked = rankCategories(projectSubfloors(peers));
  assert.equal(ranked[0].category, 'tutoring');
  const routed = await sim.donateToSubfloor(store, 'charlie', { amount: 2, at: '2026-11-08T18:00:00.000Z' });
  assert.equal(routed.category, 'tutoring');
});

test('a named third seat can veto a deed before the subfloor pays', async () => {
  const store = await people();
  const seeded = await sim.donateToSubfloor(store, 'bob', { category: 'gear', amount: 10, at });
  assert.equal(seeded.ok, true, seeded.error);
  const aliceCode = await codeFor(store, 'alice');
  const posted = await sim.postDeed(store, 'alice', {
    category: 'gear',
    postType: 'IselIT',
    listUsd: 8,
    priceUsdPerLgme: 1,
    discountUsd: 2,
    counterpartyId: 'bob',
    thirdSeatId: 'charlie',
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(posted.ok, true, posted.error);
  const charlieCode = await codeFor(store, 'charlie');
  const vetoed = await sim.vetoDeedPost(store, 'charlie', posted.postId, 'Skipped the order', {
    passphrase: 'correct horse', code: charlieCode, unixSeconds: unix, at
  });
  assert.equal(vetoed.ok, true, vetoed.error);
  assert.equal(vetoed.unchanged, true);
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const attested = await sim.attestDeedReceipt(store, 'bob', posted.postId, {
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(attested.ok, false);
  assert.match(attested.error, /Vetoed/);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
  const view = projectSubfloors([await store.get('alice'), await store.get('bob'), await store.get('charlie')]);
  assert.equal(view.categories.gear.available, 10);
  assert.equal(view.categories.gear.payouts, 0);
});
