import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merkleRootOf } from '../js/clearing.mjs';
import { FORBIDDEN_TOPIC, HEDERA_COMING, anchorMessage, hederaReadiness, topicAllowed } from '../js/hedera-anchor-core.mjs';
import { testnetOperatorKey } from '../js/hedera-operator.mjs';

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
  assert.equal(source.includes('fromStringECDSA') || readFileSync(join(root, 'js/hedera-operator.mjs'), 'utf8').includes('fromStringECDSA'), true);
  assert.equal(readFileSync(join(root, 'help.html'), 'utf8').includes('No mainnet write.'), true);
  assert.equal(readFileSync(join(root, 'help.html'), 'utf8').includes('HEDERA_TESTNET_OPERATOR_ID'), false);
  assert.equal(readFileSync(join(root, 'help.html'), 'utf8').includes('GYM_CHAT_SYNC'), false);
  assert.equal(readFileSync(join(root, 'index.html'), 'utf8').includes('not written to Hedera today'), false);
  assert.equal(readFileSync(join(root, 'examine.html'), 'utf8').includes('not written to Hedera today'), false);
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

test('an ECDSA testnet account uses the ECDSA parser and the secret stays out of the error', async () => {
  const secret = 'sample-operator-secret';
  const sdk = {
    PrivateKey: {
      fromStringECDSA(value) {
        if (value !== secret) throw new Error('unexpected');
        return { publicKey: { toStringRaw: () => '02dd49cb' } };
      },
      fromString() {
        return { publicKey: { toStringRaw: () => 'ed25519-other' } };
      }
    }
  };
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ key: { _type: 'ECDSA_SECP256K1', key: '02dd49cb' } })
  });
  const key = await testnetOperatorKey(sdk, {
    HEDERA_TESTNET_OPERATOR_ID: '0.0.11281203',
    HEDERA_TESTNET_OPERATOR_KEY: secret
  }, fetchImpl);
  assert.equal(key.publicKey.toStringRaw(), '02dd49cb');
  const mismatch = {
    PrivateKey: {
      fromStringECDSA() { return { publicKey: { toStringRaw: () => 'ffff' } }; },
      fromStringDer() { throw new Error('not der'); },
      fromString() { return { publicKey: { toStringRaw: () => 'eeee' } }; }
    }
  };
  await assert.rejects(
    () => testnetOperatorKey(mismatch, { HEDERA_TESTNET_OPERATOR_ID: '0.0.1', HEDERA_TESTNET_OPERATOR_KEY: secret }, fetchImpl),
    (error) => error.public === true && !error.message.includes(secret)
  );
});
