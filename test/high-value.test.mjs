import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { ATTESTATION_NOTE, ATTESTATION_THRESHOLD, addAttestation, attestationChainHash, evaluateHold, suggestThird } from '../js/high-value.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-11-10T15:00:00.000Z';

function entry(amount, kind, extra = {}) {
  return { id: extra.id || 'one', fromId: 'ada', toId: 'bo', kind, amount, price: extra.price || 0, at: extra.at || at };
}

test('the $100 line is one constant and a split across 24 hours still waits', () => {
  assert.equal(ATTESTATION_THRESHOLD, 100);
  const under = evaluateHold([], entry(100, 'credit'));
  assert.equal(under.pending, false);
  const over = evaluateHold([], entry(100.01, 'usd'));
  assert.equal(over.pending, true);
  assert.equal(over.note, ATTESTATION_NOTE);
  const priced = evaluateHold([], entry(50, 'lgme', { price: 3 }));
  assert.equal(priced.pending, true);
  assert.equal(priced.usd, 150);
  const first = { id: 'a', pair: 'ada|bo', fromId: 'ada', toId: 'bo', usd: 60, at, status: 'cleared' };
  const second = evaluateHold([first], entry(50, 'usd', { id: 'b', at: '2026-11-10T20:00:00.000Z' }));
  assert.equal(second.pending, true);
  const later = evaluateHold([first], entry(50, 'usd', { id: 'c', at: '2026-11-12T15:00:00.000Z' }));
  assert.equal(later.pending, false);
  assert.equal(evaluateHold([], entry(10, 'lgme')).ok, false);
});

test('three device signatures clear it, and the third name is only a suggestion', async () => {
  const group = (id, role, trainerAt) => ({
    id,
    clubGroups: { dawn: { role, creator: 'cy', trainerAt, admin: role === 'admin' } }
  });
  const members = [group('ada', 'member'), group('bo', 'member'), group('cy', 'admin', '2026-11-01'), group('dee', 'trainer', '2026-11-02'), group('ef', 'trainer', '2026-11-03')];
  const picked = suggestThird(members, members[0], members[1]);
  assert.equal(picked.role, 'group administrator');
  assert.equal(picked.text, 'Suggested third attester: group administrator');
  const noAdmin = suggestThird(members.filter((peer) => peer.id !== 'cy'), members[0], members[1]);
  assert.equal(noAdmin.role, 'trainer');
  assert.equal(noAdmin.handle, 'dee');
  const parties = suggestThird([group('ada', 'admin'), group('bo', 'trainer', '2026-11-01'), group('cy', 'member')], members[0], members[1]);
  assert.equal(parties.role, 'group creator');
  let record = evaluateHold([], entry(150, 'credit')).record;
  const keys = await Promise.all(['cy', 'dee', 'ef'].map(async (handle) => ({ handle, ...(await generateDeviceKey()) })));
  for (const key of keys) {
    const payload = { action: 'attest', entryId: record.id, at };
    const sig = await signDevice(key.privateJwk, payload);
    const added = await addAttestation(record, { handle: key.handle, publicJwk: key.publicJwk, sig, at });
    assert.equal(added.ok, true, added.error);
    record = added.record;
    assert.equal(added.hash.includes(key.handle), false);
    assert.equal(await attestationChainHash(record.id, sig), added.hash);
  }
  assert.equal(record.status, 'ready');
  const party = await generateDeviceKey();
  const refused = await addAttestation(record, { handle: 'ada', publicJwk: party.publicJwk, sig: await signDevice(party.privateJwk, { action: 'attest', entryId: record.id, at }), at });
  assert.equal(refused.ok, false);
  const page = readFileSync(join(root, 'help.html'), 'utf8');
  assert.equal(page.includes('Needs 3 attestations (over $100)'), true);
  assert.equal(page.includes('Suggested third attester'), true);
  assert.equal(readFileSync(join(root, 'glossary.html'), 'utf8').includes('Needs 3 attestations (over $100)'), true);
  assert.equal(readFileSync(join(root, 'js/covenant.mjs'), 'utf8').includes('This clarification is a draft'), true);
  assert.equal(readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes('Suggested third attester: group administrator'), true);
});
