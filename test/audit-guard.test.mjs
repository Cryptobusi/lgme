import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sim from '../js/p2p-exchange-sim.mjs';
import { acceptableInvite, generateDeviceKey, intakeSharePayload, randomInvite, signDevice } from '../js/device-sign.mjs';
import { emptyGymKv, gymMutate } from '../js/gym-kv.mjs';
import { cronAllowed, protectedTopicTransaction, readableTopic, topicAdminReady } from '../js/hedera-topic.mjs';
import { publicWisdom } from '../js/wisdom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function envelope(key, payload) {
  return { handle: payload.handle, publicJwk: key.publicJwk, payload, sig: await signDevice(key.privateJwk, payload) };
}

test('a handle cannot overwrite another member card or read a name without consent', async () => {
  const ada = await generateDeviceKey();
  const bo = await generateDeviceKey();
  const state = emptyGymKv();
  const card = { handle: 'ada', category: 'miles', number: 3, unit: 'mi', week: '2026-11-09', line: 'Three miles' };
  const put = await gymMutate(state, await envelope(ada, { handle: 'ada', action: 'progress', op: 'put', card }));
  assert.equal(put.ok, true);
  const unsigned = await gymMutate(state, { handle: 'ada', payload: { handle: 'ada', action: 'progress', op: 'delete', card } });
  assert.equal(unsigned.ok, false);
  const stolen = await gymMutate(state, await envelope(bo, { handle: 'ada', action: 'progress', op: 'delete', card }));
  assert.equal(stolen.status, 403);
  assert.equal(state.progress.length, 1);
  const peer = { id: 'ada', healthConsent: { share: false }, covenant: { token: '1234567890abcdef', sponsors: [] } };
  const shared = await intakeSharePayload(peer, { applicantName: 'Ada Lovelace', trackRecord: 'Ten coached hours', legalName: 'Ada Lovelace' });
  assert.equal(shared.applicantName, undefined);
  assert.equal(shared.legalName, undefined);
  assert.equal(shared.nameHash.length, 64);
  const saved = await gymMutate(state, await envelope(ada, shared));
  assert.equal(saved.ok, true);
  assert.equal(state.intakes[peer.covenant.token].private.applicantName, undefined);
  const named = await gymMutate(state, await envelope(ada, { ...shared, legalName: 'Ada Lovelace' }));
  assert.equal(named.ok, false);
  const peeked = await gymMutate(state, await envelope(bo, { handle: 'bo', action: 'read', token: peer.covenant.token }));
  assert.equal(peeked.status, 403);
  const own = await gymMutate(state, await envelope(ada, { handle: 'ada', action: 'read', token: peer.covenant.token }));
  assert.equal(own.private.applicantName, undefined);
  assert.equal(own.private.nameHash, shared.nameHash);
});

test('invite codes are 10 base32 characters and the anchor stays closed', async () => {
  const code = randomInvite();
  assert.equal(code.length, 10);
  assert.equal(acceptableInvite(code), true);
  assert.equal(acceptableInvite('room'), false);
  assert.equal(acceptableInvite('demo-club', { example: true }), true);
  const store = sim.createMemoryStore();
  await sim.createPeer(store, { id: 'ada', name: 'Ada', balance: 0, floor: 0, creditLimit: 0, at: '2026-11-10T00:00:00.000Z' });
  const rejected = await sim.createClubGroup(store, 'ada', { name: 'Dawn', invite: 'room' });
  assert.equal(rejected.ok, false);
  assert.equal(cronAllowed({}, {}), false);
  assert.equal(cronAllowed({ 'x-lgme-cron': 'secret' }, { CRON_SECRET: 'secret' }), true);
  assert.equal(topicAdminReady({}).ok, false);
  assert.equal(readableTopic('0.0.11397291', {}), true);
  assert.equal(readableTopic('0.0.5', { HEDERA_TESTNET_TOPIC_ID: '0.0.5' }), true);
  const calls = [];
  const sdk = {
    TopicCreateTransaction: class {
      setTopicMemo() { calls.push('memo'); return this; }
      setAdminKey(key) { calls.push(['admin', key]); return this; }
      setSubmitKey(key) { calls.push(['submit', key]); return this; }
    }
  };
  protectedTopicTransaction(sdk, { publicKey: 'operator' });
  assert.deepEqual(calls[1], ['admin', 'operator']);
  assert.deepEqual(calls[2], ['submit', 'operator']);
  const wisdom = publicWisdom({ text: 'A calm walk', theme: 'care', kind: 'original' });
  assert.equal(wisdom.ok, true);
  const banned = publicWisdom({ text: 'Pay with $Trust', theme: 'care', kind: 'original' });
  assert.equal(banned.ok, false);
  assert.equal(banned.error.includes('$Trust'), false);
  const page = readFileSync(join(root, 'js/wisdom-page.mjs'), 'utf8');
  assert.equal(page.includes('10% of the deed'), false);
  assert.equal(page.includes('1% Health and fitness skim'), true);
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8');
  assert.equal(ignore.includes('docs'), true);
  assert.equal(ignore.includes('test'), true);
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  assert.equal(sitemap.includes('/docs'), false);
  assert.equal(sitemap.includes('https://lgme.app/test'), false);
  const anchor = readFileSync(join(root, 'api/hedera/anchor.mjs'), 'utf8');
  assert.equal(anchor.includes('cronAllowed'), true);
  assert.equal(anchor.includes('forMainnet'), false);
});
