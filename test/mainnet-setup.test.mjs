import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../api/hedera/mainnet-setup.mjs';
import { submitLeaves } from '../js/hedera-submit.mjs';
import { adminTokenOk, healthSetupMessage, runHealthMainnetSetup, submitHealthMainnetHash, TOPIC_MEMO } from '../js/mainnet-health-setup.mjs';
import { chainPayloadSafe, mainnetPayloadAllowed } from '../js/hedera-network.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = 'not-a-real-operator-key';

function memory() {
  const bag = new Map();
  return {
    async get(key) { return bag.has(key) ? bag.get(key) : null; },
    async set(key, value) { bag.set(key, value); }
  };
}

function response() {
  return {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(text) { this.body = text; }
  };
}

function sdkFor(calls) {
  const key = { publicKey: { toStringRaw: () => 'abc' } };
  return {
    Client: { forMainnet: () => ({ setOperator() {}, setMaxTransactionFee() {}, close() {} }) },
    AccountId: { fromString: (id) => id },
    Hbar: class { constructor(value) { this.value = value; } },
    PrivateKey: {
      fromStringED25519: () => key,
      fromStringECDSA() { throw new Error('ecdsa'); },
      fromString() { throw new Error('raw'); },
      fromStringDer() { throw new Error('der'); }
    },
    TopicCreateTransaction: class {
      setTopicMemo(memo) { calls.memo = memo; return this; }
      setAdminKey() { return this; }
      setSubmitKey() { return this; }
      setMaxTransactionFee(fee) { calls.createMax = fee.value; return this; }
      async execute() {
        calls.actions.push('create');
        return {
          transactionId: { toString: () => '0.0.1273453@1700000000.000000000' },
          getReceipt: async () => ({ topicId: { toString: () => '0.0.555001' } }),
          getRecord: async () => ({ transactionFee: { toTinybars: () => 1_000_000 } })
        };
      }
    },
    TopicMessageSubmitTransaction: class {
      constructor(spec) { calls.message = spec.message; calls.topicId = spec.topicId; }
      setMaxTransactionFee(fee) { calls.messageMax = fee.value; return this; }
      async execute() {
        calls.actions.push('message');
        return {
          transactionId: { toString: () => '0.0.1273453@1700000001.000000000' },
          getRecord: async () => ({
            transactionFee: { toTinybars: () => 50_000 },
            receipt: { topicSequenceNumber: { toString: () => '1' } },
            transactionId: { toString: () => '0.0.1273453@1700000001.000000000' }
          })
        };
      }
    }
  };
}

function fetchImpl(url) {
  if (String(url).includes('/accounts/')) {
    return Promise.resolve({ ok: true, json: async () => ({ key: { _type: 'ED25519', key: 'abc' } }) });
  }
  return Promise.resolve({ ok: true, json: async () => ({ transactions: [] }) });
}

const env = {
  VERCEL_ENV: 'production',
  HEDERA_MAINNET_OPERATOR_ID: '0.0.1273453',
  HEDERA_MAINNET_OPERATOR_KEY: SECRET,
  OWNER_INBOX_TOKEN: 'inbox-token'
};

test('the setup route stays closed without the owner token', async () => {
  assert.equal(adminTokenOk('', env), false);
  assert.equal(adminTokenOk('other', env), false);
  assert.equal(adminTokenOk('inbox-token', env), true);
  const res = response();
  await handler({ method: 'POST', headers: {} }, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.includes(SECRET), false);
});

test('the Health setup writes one hash to a keyed topic and stays under the cap', async () => {
  const built = await healthSetupMessage('2026-11-11');
  assert.equal(built.ok, true);
  assert.equal(mainnetPayloadAllowed(built.body).ok, true);
  assert.equal(chainPayloadSafe(built.body).ok, true);
  assert.equal(JSON.stringify(built.body).includes('diagnosis'), false);
  const calls = { actions: [] };
  const store = memory();
  const first = await runHealthMainnetSetup(env, { store, sdk: sdkFor(calls), fetchImpl, now: new Date('2026-11-11T12:00:00.000Z') });
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(first.topicId, '0.0.555001');
  assert.equal(first.transactionId, '0.0.1273453@1700000001.000000000');
  assert.equal(calls.memo, TOPIC_MEMO);
  assert.equal(calls.createMax, 0.5);
  assert.equal(calls.messageMax, 0.05);
  assert.deepEqual(calls.actions, ['create', 'message']);
  assert.equal(first.hbarSpent, 0.0105);
  assert.equal(JSON.stringify(first).includes(SECRET), false);
  const again = await runHealthMainnetSetup(env, { store, sdk: sdkFor({ actions: [] }), fetchImpl, now: new Date('2026-11-11T13:00:00.000Z') });
  assert.equal(again.already, true);
  assert.equal(again.hbarSpent, 0);
  const blocked = memory();
  await blocked.set('hedera:mainnet:spent:2026-11-11', 100_000_000);
  const refused = await runHealthMainnetSetup(env, { store: blocked, sdk: sdkFor({ actions: [] }), fetchImpl, now: new Date('2026-11-11T12:00:00.000Z') });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /cap/);
});

test('a refused topic create returns the Hedera status and the charged fee', async () => {
  const calls = { actions: [] };
  const failing = sdkFor(calls);
  failing.TopicCreateTransaction = class extends failing.TopicCreateTransaction {
    async execute() {
      calls.actions.push('create');
      return {
        transactionId: { toString: () => '0.0.1273453@1794412456.080385961' },
        getReceipt: async () => {
          const error = new Error('receipt status');
          error.status = { toString: () => 'INSUFFICIENT_TX_FEE' };
          error.transactionId = { toString: () => '0.0.1273453@1794412456.080385961' };
          error.record = { transactionFee: { toTinybars: () => 151018 } };
          throw error;
        }
      };
    }
  };
  const store = memory();
  const result = await runHealthMainnetSetup(env, { store, sdk: failing, fetchImpl, now: new Date('2026-11-11T12:00:00.000Z') });
  assert.equal(result.ok, false);
  assert.equal(result.hederaStatus, 'INSUFFICIENT_TX_FEE');
  assert.equal(result.hbarSpent, 0.00151018);
  assert.equal(calls.actions.includes('message'), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

test('a Health app hash uses the mainnet topic and the charged fee', async () => {
  const calls = { actions: [] };
  const store = memory();
  await store.set('hedera:mainnet:spent:2026-11-11', 45_513_121);
  const healthEnv = { ...env, HEDERA_NETWORK: 'mainnet', HEDERA_MAINNET_HEALTH_TOPIC_ID: '0.0.10955014' };
  const deps = { store, sdk: sdkFor(calls), fetchImpl, now: new Date('2026-11-11T16:30:00.000Z') };
  const result = await submitLeaves(healthEnv, ['ab'.repeat(32)], '2026-11-11', deps);
  assert.equal(result.ok, true);
  assert.equal(result.network, 'mainnet');
  assert.equal(result.topicId, '0.0.10955014');
  assert.equal(calls.topicId, '0.0.10955014');
  assert.equal(calls.messageMax, 0.05);
  assert.equal(calls.actions.includes('create'), false);
  assert.equal(result.hbarSpent, 0.0005);
  assert.equal(await store.get('hedera:mainnet:spent:2026-11-11'), 45_563_121);
  const message = JSON.parse(calls.message);
  assert.equal(message.root, 'ab'.repeat(32));
  assert.equal(message.network, 'mainnet');
  assert.equal(JSON.stringify(message).includes('diagnosis'), false);
  assert.equal(JSON.stringify(result).includes(SECRET), false);
  await store.set('hedera:mainnet:spent:2026-11-11', 100_000_000);
  const refused = await submitHealthMainnetHash(healthEnv, ['ab'.repeat(32)], '2026-11-11', { ...deps, sdk: sdkFor({ actions: [] }) });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /cap/);
});

test('the setup source does not print the operator key', () => {
  const source = readFileSync(join(root, 'api/hedera/mainnet-setup.mjs'), 'utf8') + readFileSync(join(root, 'js/mainnet-health-setup.mjs'), 'utf8');
  assert.equal(source.includes('console.log'), false);
  assert.equal(source.includes('forTestnet'), false);
  const submit = readFileSync(join(root, 'js/hedera-submit.mjs'), 'utf8');
  assert.equal(submit.includes('HEDERA_MAINNET_OPERATOR_KEY'), false);
  assert.equal(submit.includes('forMainnet'), false);
  assert.equal(readFileSync(join(root, 'api/develop/want.mjs'), 'utf8').includes('Mainnet writes are closed'), false);
});
