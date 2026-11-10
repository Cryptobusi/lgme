import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merkleRootOf } from '../js/clearing.mjs';
import { FORBIDDEN_TOPIC, HEDERA_COMING, anchorMessage, hederaReadiness, topicAllowed } from '../js/hedera-anchor-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('testnet anchoring stays off without an operator and refuses topic 0.0.489104', () => {
  const ready = hederaReadiness({});
  assert.equal(ready.enabled, false);
  assert.equal(ready.wording, HEDERA_COMING);
  for (const name of ['HEDERA_TESTNET_ANCHOR=on', 'HEDERA_TESTNET_OPERATOR_ID', 'HEDERA_TESTNET_OPERATOR_KEY']) {
    assert.equal(ready.missing.includes(name), true, name);
  }
  assert.equal(topicAllowed(FORBIDDEN_TOPIC).ok, false);
  assert.equal(topicAllowed('').create, true);
  assert.equal(topicAllowed('0.0.1').ok, true);
  const source = readFileSync(join(root, 'api/hedera/anchor.mjs'), 'utf8');
  assert.equal(source.includes('Client.forTestnet'), true);
  assert.equal(source.includes('forMainnet'), false);
  assert.equal(source.includes('0.0.489104'), false);
});

test('the server message is the recomputed root, not a client claim', async () => {
  const leaves = ['a'.repeat(64), 'b'.repeat(64)];
  const rootHash = await merkleRootOf(leaves);
  const message = anchorMessage({ root: rootHash, day: '2026-11-10', leafCount: 2 });
  assert.equal(JSON.parse(message).root, rootHash);
  assert.equal(JSON.parse(message).network, 'testnet');
  assert.equal(message.includes('OPERATOR'), false);
});
