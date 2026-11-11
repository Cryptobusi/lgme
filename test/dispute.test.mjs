import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { emptyGymKv, gymMutate } from '../js/gym-kv.mjs';
import {
  DISCLAIMER,
  DRAFT_MARK,
  FORUM,
  LATER_MIN,
  NO_COVERAGE,
  NOT_A_COURT,
  REHEARSAL_COPY,
  SANDBOX_LABEL,
  TESTNET_MIN,
  VOLUNTARY,
  bytesToBase64,
  completedExchanges,
  confirmOutcome,
  disputeSteward,
  drawPanel,
  failMediation,
  indexFromRand,
  openDispute,
  publicDispute,
  rehearsalMembers,
  requestPanel,
  runningHashSeed,
  runningHashV3,
  setShareConsent,
  signVerdict
} from '../js/dispute.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const message1 = JSON.parse(text('data/topic-0.0.11399829-message-1.json'));

function group(role, extra = {}) {
  return { morning: { role, creator: 'sam', trainerAt: extra.trainerAt || '', admin: role === 'admin', name: 'Morning Club' } };
}

function person(id, role, extra = {}) {
  return { id, name: id, clubGroups: group(role, extra), gymRole: role === 'trainer' ? 'trainer' : 'member', trainerAt: extra.trainerAt || '', tape: extra.tape || [], deedPosts: {} };
}

test('message 1 on topic 0.0.11399829 is a version 3 SHA-384 running hash', async () => {
  const seed = runningHashSeed(message1);
  assert.equal(seed.ok, true);
  assert.equal(seed.bytes.length, 48);
  assert.equal(message1.running_hash_version, 3);
  assert.equal(message1.topic_id, '0.0.11399829');
  assert.equal(message1.sequence_number, 1);
  const [seconds, nanos] = message1.consensus_timestamp.split('.');
  const payer = message1.payer_account_id.split('.');
  const topic = message1.topic_id.split('.');
  const again = await runningHashV3({
    previous: new Uint8Array(48),
    version: 3,
    payer: { shard: payer[0], realm: payer[1], num: payer[2] },
    topic: { shard: topic[0], realm: topic[1], num: topic[2] },
    seconds,
    nanos,
    sequence: message1.sequence_number,
    message: Uint8Array.from(Buffer.from(message1.message, 'base64'))
  });
  assert.equal(again.length, 48);
  const repeat = await runningHashV3({
    previous: new Uint8Array(48),
    version: 3,
    payer: { shard: payer[0], realm: payer[1], num: payer[2] },
    topic: { shard: topic[0], realm: topic[1], num: topic[2] },
    seconds,
    nanos,
    sequence: message1.sequence_number,
    message: Uint8Array.from(Buffer.from(message1.message, 'base64'))
  });
  assert.equal(bytesToBase64(again), bytesToBase64(repeat));
  const decoded = JSON.parse(Buffer.from(message1.message, 'base64').toString('utf8'));
  assert.equal(decoded.root, '137f18191bf9e0ee2d0be5b8e496565d82005388ededd8870a5ed62e1622a4e8');
  assert.equal(decoded.leafCount, 1);
  const notice = JSON.parse(text('data/dispute-notice.schema.json'));
  const verdict = JSON.parse(text('data/arbiter-verdict.schema.json'));
  assert.equal(notice.$schema.includes('2020-12'), true);
  assert.equal(verdict.$schema.includes('2020-12'), true);
  assert.equal(notice.description.includes('not JSON-LD'), true);
  assert.equal(verdict.description.includes('not JSON-LD'), true);
  assert.equal(JSON.stringify(notice).includes('@context'), false);
  assert.equal(JSON.stringify(verdict).includes('@context'), false);
  assert.equal(verdict.properties.choice.enum.includes('write-down'), true);
  assert.equal(verdict.properties.faultPubkey, undefined);
  assert.equal(verdict.properties.choice.enum.includes('SOVEREIGN_PROVENANCE_FAULT'), false);
});

test('the panel index rejects the biased tail and does not use modulo', () => {
  const bucket = (1n << 64n) / 3n;
  assert.equal(indexFromRand(bucket, 3).index, 1);
  assert.notEqual(indexFromRand(bucket, 3).index, Number(bucket % 3n));
  const limit = bucket * 3n;
  assert.equal(indexFromRand(limit, 3).rejected, true);
  assert.equal(indexFromRand(limit - 1n, 3).index, 2);
});

test('opening a dispute starts mediation and moves no credit or Floor', async () => {
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'mina', name: 'Mina', balance: 40, floor: 12, creditLimit: -50 });
  await sim.createPeer(store, { id: 'riley', name: 'Riley', balance: 18, floor: 9, creditLimit: -50 });
  await sim.createPeer(store, { id: 'noor', name: 'Noor', balance: 7, floor: 4, creditLimit: -50 });
  const mina = await store.get('mina');
  const riley = await store.get('riley');
  const noor = await store.get('noor');
  mina.clubGroups = group('member');
  riley.clubGroups = group('member');
  noor.clubGroups = group('trainer', { trainerAt: '2026-01-01T00:00:00.000Z' });
  noor.gymRole = 'trainer';
  const pending = { id: 'row-1', status: 'pending' };
  const before = {
    mina: sim.replay(mina).balance,
    riley: sim.replay(riley).balance,
    floor: mina.opening.floor,
    tape: mina.tape.length
  };
  const refused = await openDispute({ claimant: mina, respondent: riley, members: [mina, riley, noor], pending });
  assert.equal(refused.ok, false);
  const opened = await openDispute({ claimant: mina, respondent: riley, members: [mina, riley, noor], statement: 'The hours do not match.', pending, acknowledged: true });
  assert.equal(opened.ok, true);
  assert.equal(opened.dispute.status, 'mediation');
  assert.equal(opened.dispute.stewardId, 'noor');
  assert.equal(opened.dispute.stewardRole, 'trainer');
  assert.equal(opened.creditMoved, false);
  assert.equal(opened.floorMoved, false);
  assert.equal(opened.pendingStatus, 'pending');
  assert.equal(pending.status, 'pending');
  assert.equal(sim.replay(mina).balance, before.mina);
  assert.equal(sim.replay(riley).balance, before.riley);
  assert.equal(mina.opening.floor, before.floor);
  assert.equal(mina.tape.length, before.tape);
  assert.equal(opened.dispute.hash.length, 64);
  assert.equal(JSON.stringify(opened.dispute.hash).includes('The hours'), false);
  const early = await requestPanel(opened.dispute, 'mina', message1, { members: [mina, riley, noor] });
  assert.equal(early.ok, false);
  const stranger = failMediation(opened.dispute, 'mina');
  assert.equal(stranger.ok, false);
  const failed = failMediation(opened.dispute, 'noor');
  assert.equal(failed.ok, true);
  assert.equal(failed.creditMoved, false);
  assert.equal(sim.replay(mina).balance, before.mina);
});

test('the rehearsal panel uses message 1, skips workouts and counterparties, and stays advisory', async () => {
  const mina = person('mina', 'member');
  const riley = person('riley', 'member');
  const noor = person('noor', 'trainer', { trainerAt: '2026-01-01T00:00:00.000Z' });
  const admin = person('ada', 'admin');
  assert.equal(disputeSteward([mina, riley, admin], mina, riley).role, 'administrator');
  assert.equal(disputeSteward([mina, riley, noor, admin], mina, riley).id, 'noor');
  mina.tape = [
    { type: 'EXERCISE_SESSION', payload: { receiptName: 'IdidIt (verified receipt)' } },
    { type: 'DEED_ATTESTED', payload: { receiptName: 'IdidIt (verified receipt)', postId: 'p1', buyerId: 'mina', providerId: 'riley' } }
  ];
  assert.equal(completedExchanges(mina).length, 1);
  assert.equal(TESTNET_MIN, 1);
  assert.equal(LATER_MIN, 10);
  const opened = await openDispute({ claimant: mina, respondent: riley, members: [mina, riley, noor], acknowledged: true, statement: 'Local note' });
  const failed = failMediation(opened.dispute, 'noor').dispute;
  const pool = rehearsalMembers(mina, riley);
  assert.equal(pool.find((row) => row.id === 'wren').workouts, 9);
  assert.equal(completedExchanges(pool.find((row) => row.id === 'wren')).length, 0);
  const first = await requestPanel(failed, 'riley', message1, { members: [...pool, mina, riley], rehearsal: true });
  const second = await requestPanel(failed, 'mina', message1, { members: [...pool, mina, riley], rehearsal: true });
  assert.equal(first.ok, true, first.error);
  assert.deepEqual(first.dispute.panel.ids, second.dispute.panel.ids);
  assert.equal(first.dispute.panel.ids.includes('mina'), false);
  assert.equal(first.dispute.panel.ids.includes('riley'), false);
  assert.equal(first.dispute.panel.ids.includes('cy'), false);
  assert.equal(first.dispute.panel.ids.includes('wren'), false);
  assert.equal(first.dispute.panel.ids[0], 'otis');
  assert.equal(first.dispute.panel.label, SANDBOX_LABEL);
  assert.equal(first.creditMoved, false);
  assert.equal(first.floorMoved, false);
  const keys = {};
  for (const id of first.dispute.panel.ids) keys[id] = await generateDeviceKey();
  let dispute = first.dispute;
  for (const [index, id] of first.dispute.panel.ids.entries()) {
    const choice = index === 2 ? 'no-change' : 'write-down';
    const payload = { action: 'verdict', disputeId: dispute.id, choice, handle: id };
    const signed = await signVerdict(dispute, { handle: id, choice, publicJwk: keys[id].publicJwk, sig: await signDevice(keys[id].privateJwk, payload), findings: 'Keep this on the phone.' });
    assert.equal(signed.ok, true, signed.error);
    assert.equal(signed.creditMoved, false);
    dispute = signed.dispute;
  }
  assert.equal(dispute.verdict.ready, true);
  assert.equal(dispute.verdict.choice, 'write-down');
  assert.equal(dispute.verdict.advisory, true);
  assert.equal(dispute.verdict.hash.length, 64);
  const one = await confirmOutcome(dispute, { handle: 'mina', publicJwk: (await generateDeviceKey()).publicJwk, sig: 'nope' });
  assert.equal(one.ok, false);
  const minaKey = await generateDeviceKey();
  const rileyKey = await generateDeviceKey();
  const minaPayload = { action: 'confirm', disputeId: dispute.id, choice: 'write-down', handle: 'mina' };
  const notedOnce = await confirmOutcome(dispute, { handle: 'mina', publicJwk: minaKey.publicJwk, sig: await signDevice(minaKey.privateJwk, minaPayload) });
  assert.equal(notedOnce.noted, false);
  assert.equal(notedOnce.changed, false);
  assert.equal(notedOnce.creditMoved, false);
  const rileyPayload = { action: 'confirm', disputeId: dispute.id, choice: 'write-down', handle: 'riley' };
  const noted = await confirmOutcome(notedOnce.dispute, { handle: 'riley', publicJwk: rileyKey.publicJwk, sig: await signDevice(rileyKey.privateJwk, rileyPayload) });
  assert.equal(noted.noted, true);
  assert.equal(noted.changed, false);
  assert.equal(noted.creditMoved, false);
  assert.equal(noted.floorMoved, false);
  assert.equal(noted.dispute.status, 'noted');
  const hidden = publicDispute(noted.dispute);
  assert.equal(hidden.statement, undefined);
  assert.equal(hidden.findings, undefined);
  const shared = publicDispute(setShareConsent(setShareConsent(noted.dispute, 'mina', true).dispute, 'riley', true).dispute);
  assert.equal(shared.statement, 'Local note');
  assert.equal(shared.findings, 'Keep this on the phone.');
  const state = emptyGymKv();
  const key = await generateDeviceKey();
  const refused = await gymMutate(state, { handle: 'mina', publicJwk: key.publicJwk, payload: { handle: 'mina', action: 'dispute', hash: noted.dispute.hash, statement: 'Local note' }, sig: await signDevice(key.privateJwk, { handle: 'mina', action: 'dispute', hash: noted.dispute.hash, statement: 'Local note' }) });
  assert.equal(refused.ok, false);
});

test('the disclaimer is on the dispute page, help, the glossary, and sign-up', () => {
  const page = text('disclaimer.html');
  const help = text('help.html');
  const glossary = text('glossary.html');
  const gym = text('js/gym-app.mjs');
  const home = text('index.html');
  for (const line of [VOLUNTARY, NO_COVERAGE, FORUM, NOT_A_COURT, REHEARSAL_COPY, DRAFT_MARK, ...DISCLAIMER]) {
    assert.equal(page.includes(line), true, line);
  }
  assert.equal(help.includes(VOLUNTARY), true);
  assert.equal(help.includes(NOT_A_COURT), true);
  assert.equal(glossary.includes('100% voluntary'), true);
  assert.equal(glossary.includes('IdidIt (verified receipt)'), true);
  assert.equal(glossary.includes('>Did<'), false);
  assert.equal(gym.includes('signup-disclaimer'), true);
  assert.equal(gym.includes('dispute-disclaimer'), true);
  assert.equal(home.includes('href="/disclaimer"'), true);
  assert.equal(text('gym.html').includes('href="/disclaimer"'), true);
  assert.equal(text('sw.js').includes('lgme-v140'), true);
  assert.equal(page.includes('$Trust'), false);
});
