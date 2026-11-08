import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-11-08T12:00:00.000Z';
const unix = 1700000000;

async function pair() {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'alice', name: 'Alice', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'bob', name: 'Bob', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'charlie', name: 'Charlie', balance: 100, floor: 40, creditLimit: -200, at });
  return store;
}

async function codeFor(store, id) {
  const setup = await sim.setupWallet(store, id, 'correct horse', { iterations: 2000 });
  const code = await sim.totp(sim.base32Decode(setup.secretBase32), unix, { digits: 6, period: 30, algorithm: 'SHA-1' });
  return code;
}

test('a campus deed becomes one IdidIt credit and cannot be redeemed twice', async () => {
  const store = await pair();
  const aliceCode = await codeFor(store, 'alice');
  const logged = await sim.logCampusDeed(store, 'alice', {
    kind: 'tutoring',
    receiverId: 'bob',
    hours: 3,
    thirdSeatId: 'charlie',
    capMax: 100,
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(logged.ok, true, logged.error);
  assert.equal(logged.credit, 0);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
  const giver = await store.get('alice');
  giver.privateKeyJwk = (await sim.unlockWallet(giver, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', giver);
  const bobCode = await codeFor(store, 'bob');
  const attested = await sim.attestCampusDeed(store, 'bob', logged.deedId, {
    passphrase: 'correct horse',
    code: bobCode,
    unixSeconds: unix,
    at
  });
  assert.equal(attested.ok, true, attested.error);
  assert.equal(attested.credit, 1);
  assert.equal(attested.receiptName, 'IdidIt (verified receipt)');
  assert.equal(attested.unchanged, true);
  assert.equal((attested.merkleRoot || '').length, 64);
  const credit = (await store.get('alice')).campusCredits[attested.creditId];
  assert.equal(credit.amount, 1);
  assert.equal(credit.lgme, false);
  assert.equal(credit.hedera, false);
  const aliceAgain = await store.get('alice');
  aliceAgain.privateKeyJwk = (await sim.unlockWallet(aliceAgain, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', aliceAgain);
  const spent = await sim.redeemCampusCredit(store, 'alice', attested.creditId, {
    offerId: 'tutoring',
    offers: ['tutoring', 'cleanup', 'gear'],
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(spent.ok, true, spent.error);
  assert.equal(spent.unchanged, true);
  const aliceThird = await store.get('alice');
  aliceThird.privateKeyJwk = (await sim.unlockWallet(aliceThird, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', aliceThird);
  const again = await sim.redeemCampusCredit(store, 'alice', attested.creditId, {
    offerId: 'gear',
    offers: ['tutoring', 'cleanup', 'gear'],
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(again.ok, false);
  assert.match(again.error, /Already redeemed/);
  const report = sim.campusReport([await store.get('alice')]);
  assert.equal(report[0].verified, 1);
  assert.equal(report[0].hours, 3);
  const closed = await sim.recordIdidIt(store, 'alice', { work: 'Tutoring' });
  assert.equal(closed.ok, false);
});

test('the campus cap refuses a member past the configured maximum', async () => {
  const pilot = JSON.parse(readFileSync(join(root, 'data/campus-pilot.json'), 'utf8'));
  assert.equal(pilot.capMin, 50);
  assert.equal(pilot.capMax, 100);
  const store = await pair();
  const aliceCode = await codeFor(store, 'alice');
  const full = await sim.logCampusDeed(store, 'alice', {
    kind: 'cleanup',
    receiverId: 'bob',
    hours: 1,
    capMax: 1,
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(full.ok, false);
  assert.match(full.error, /full/);
  const charlieCode = await codeFor(store, 'charlie');
  const room = await sim.logCampusDeed(store, 'charlie', {
    kind: 'gear',
    receiverId: 'bob',
    hours: 1,
    capMax: 2,
    passphrase: 'correct horse',
    code: charlieCode,
    unixSeconds: unix,
    at
  });
  assert.equal(room.ok, true, room.error);
});

test('a named third seat can veto a campus deed before it is redeemed', async () => {
  const store = await pair();
  const aliceCode = await codeFor(store, 'alice');
  const logged = await sim.logCampusDeed(store, 'alice', {
    kind: 'gear',
    receiverId: 'bob',
    hours: 1,
    thirdSeatId: 'charlie',
    capMax: 100,
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(logged.ok, true, logged.error);
  const charlieCode = await codeFor(store, 'charlie');
  const vetoed = await sim.vetoCampusDeed(store, 'charlie', logged.deedId, 'Skipped the order', {
    passphrase: 'correct horse',
    code: charlieCode,
    unixSeconds: unix,
    at
  });
  assert.equal(vetoed.ok, true, vetoed.error);
  assert.equal(vetoed.unchanged, true);
  const giver = await store.get('alice');
  giver.privateKeyJwk = (await sim.unlockWallet(giver, 'correct horse', aliceCode, unix)).privateKeyJwk;
  await store.set('alice', giver);
  const bobCode = await codeFor(store, 'bob');
  const attested = await sim.attestCampusDeed(store, 'bob', logged.deedId, {
    passphrase: 'correct horse',
    code: bobCode,
    unixSeconds: unix,
    at
  });
  assert.equal(attested.ok, false);
  assert.match(attested.error, /Vetoed/);
});
