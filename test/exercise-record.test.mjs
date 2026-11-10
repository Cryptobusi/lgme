import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { listingMessage, sharedListingsEnabled, withinRate } from '../js/shared-listings.mjs';
import { EVIDENCE_UNVERIFIED, evidenceHash, locationMatched } from '../js/exercise-record.mjs';

const at = '2026-11-10T15:00:00.000Z';
const unix = 1700000000;

async function people() {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'alice', name: 'Alice', balance: 100, floor: 40, creditLimit: -200, at });
  await sim.createPeer(store, { id: 'bob', name: 'Bob', balance: 50, floor: 40, creditLimit: -200, at });
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

test('a workout records an IdidIt listing and mints no credit', async () => {
  const store = await people();
  const aliceCode = await codeFor(store, 'alice');
  const bundle = { startedAt: at, finishedAt: '2026-11-10T15:20:00.000Z', points: [{ lat: 38.9, lon: -77.0, acc: 5, t: at }], photos: [], samples: 2 };
  const hash = await evidenceHash(bundle);
  const recorded = await sim.recordExerciseSession(store, 'alice', {
    day: '2026-11-10',
    category: 'strength',
    evidence: EVIDENCE_UNVERIFIED,
    terms: 'Contribution or barter',
    durationSec: 1200,
    sensors: ['gps', 'motion'],
    locationMatched: locationMatched(bundle.points, { lat: 38.9, lon: -77.0, radiusM: 150 }),
    privateNote: 'knee felt fine',
    intent: 'End morning hygiene with 90–120 seconds of unheated water. No transitional warming.',
    evidenceHash: hash,
    bundle,
    passphrase: 'correct horse',
    code: aliceCode,
    unixSeconds: unix,
    at
  });
  assert.equal(recorded.ok, true, recorded.error);
  assert.equal(recorded.creditMinted, false);
  assert.equal(recorded.unchanged, true);
  const alice = await store.get('alice');
  const tape = JSON.stringify(alice.tape);
  assert.equal(tape.includes('knee felt fine'), false);
  assert.equal(tape.includes('38.9'), false);
  assert.equal(tape.includes('unheated water'), false);
  assert.equal(recorded.publicItem.intent, undefined);
  assert.equal(recorded.publicItem.locationMatched, 'yes');
  assert.equal(recorded.publicItem.evidence, EVIDENCE_UNVERIFIED);
  assert.equal(alice.exercisePrivate[recorded.sessionId].note, 'knee felt fine');
  assert.equal(alice.tape.some((entry) => entry.type === 'CAMPUS_CREDIT'), false);
  const shared = await sim.exerciseShareBody(store, 'alice', recorded.sessionId);
  assert.equal(shared.ok, false);
  await reopen(store, 'alice', aliceCode);
  const opened = await sim.exerciseShareBody(store, 'alice', recorded.sessionId);
  assert.equal(opened.ok, true, opened.error);
  assert.deepEqual(Object.keys(opened.message.item).sort(), ['category', 'completed', 'day', 'evidence', 'terms']);
  assert.equal(opened.published, false);
});

test('support cannot spend the floor, and a no moves nothing', async () => {
  const store = await people();
  const aliceCode = await codeFor(store, 'alice');
  const recorded = await sim.recordExerciseSession(store, 'alice', {
    day: '2026-11-10', category: 'cardio', evidence: EVIDENCE_UNVERIFIED, terms: 'Contribution or barter', durationSec: 60, sensors: [], locationMatched: 'no', evidenceHash: 'cd'.repeat(32),
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at
  });
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const tooMuch = await sim.offerExerciseSupport(store, 'bob', recorded.sessionId, {
    authorId: 'alice', kind: 'contribute-lgme', amount: 20,
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(tooMuch.ok, false);
  assert.match(tooMuch.error, /Floor/);
  assert.equal(sim.replay(await store.get('bob')).balance, 50);
  const offer = await sim.offerExerciseSupport(store, 'bob', recorded.sessionId, {
    authorId: 'alice', kind: 'contribute-lgme', amount: 5,
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  assert.equal(offer.ok, true, offer.error);
  assert.equal(sim.replay(await store.get('bob')).balance, 50);
  const refused = await sim.refuseExerciseSupport(store, 'alice', offer.supportId, {
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at
  });
  assert.equal(refused.ok, true, refused.error);
  assert.equal(refused.unchanged, true);
  assert.equal(sim.replay(await store.get('alice')).balance, 100);
});

test('an accepted $lgme contribution withholds 5 percent for the Floor and 5 percent for the app fund', async () => {
  const store = await people();
  const aliceCode = await codeFor(store, 'alice');
  const recorded = await sim.recordExerciseSession(store, 'alice', {
    day: '2026-11-10', category: 'mobility', evidence: EVIDENCE_UNVERIFIED, terms: 'Contribution or barter', durationSec: 60, sensors: [], locationMatched: 'no', evidenceHash: 'ef'.repeat(32),
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at
  });
  await reopen(store, 'alice', aliceCode);
  const bobCode = await codeFor(store, 'bob');
  const offer = await sim.offerExerciseSupport(store, 'bob', recorded.sessionId, {
    authorId: 'alice', kind: 'contribute-lgme', amount: 5,
    passphrase: 'correct horse', code: bobCode, unixSeconds: unix, at
  });
  await reopen(store, 'bob', bobCode);
  const accepted = await sim.acceptExerciseSupport(store, 'alice', offer.supportId, {
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at
  });
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.creditMinted, false);
  assert.equal(accepted.giverBalance, 45);
  assert.equal(accepted.authorBalance, 104.5);
  assert.equal(sim.replay(await store.get('bob')).balance >= 40, true);
});

test('shared listings stay off and reject personal fields', () => {
  assert.equal(sharedListingsEnabled({}), false);
  assert.equal(sharedListingsEnabled({ SHARED_LISTINGS_TESTNET: 'on' }), false);
  const bad = listingMessage({
    id: 's1',
    author: { kty: 'EC' },
    item: { completed: true, day: '2026-11-10', category: 'strength', evidence: 'self-reported', terms: 'email me at a@b.co' }
  });
  assert.equal(bad.ok, false);
  const good = listingMessage({
    id: 's1',
    author: { kty: 'EC' },
    kind: 'withdrawal',
    status: 'withdrawn',
    prev: 'abc',
    item: { completed: true, day: '2026-11-10', category: 'cardio', evidence: 'witness', terms: 'Contribution or barter' }
  });
  assert.equal(good.ok, true);
  assert.equal(withinRate(Array.from({ length: 10 }, (_, index) => index), 10, 10).ok, false);
});

test('a receipt can carry a maxim title and nothing else from the maxim', async () => {
  const store = await people();
  const aliceCode = await codeFor(store, 'alice');
  const recorded = await sim.recordExerciseSession(store, 'alice', {
    day: '2026-11-10', category: 'mixed', evidence: EVIDENCE_UNVERIFIED, terms: 'Contribution or barter', durationSec: 30, sensors: [], locationMatched: 'no',
    intent: 'Labor anchors the sleep',
    allowedIntents: ['Labor anchors the sleep'],
    evidenceHash: 'ab'.repeat(32),
    passphrase: 'correct horse', code: aliceCode, unixSeconds: unix, at
  });
  assert.equal(recorded.ok, true, recorded.error);
  assert.equal(recorded.publicItem.intent, 'Labor anchors the sleep');
  const tape = JSON.stringify((await store.get('alice')).tape);
  assert.equal(tape.includes('Labor anchors the sleep'), true);
  assert.equal(tape.includes('compound lifts'), false);
  assert.equal(recorded.creditMinted, false);
});
