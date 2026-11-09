import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as hedera from '../js/hedera-exchange.mjs';
import * as sim from '../js/p2p-exchange-sim.mjs';
import statusHandler from '../api/exchange/status.mjs';
import historyHandler from '../api/exchange/history.mjs';
import submitHandler from '../api/exchange/submit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    dump() { return data; }
  };
}

function responseMock() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key] = value; },
    end(payload) {
      this.body = payload;
      this.json = JSON.parse(payload);
    }
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function guardedEnv(values) {
  return new Proxy(values, {
    get(target, prop) {
      const name = String(prop);
      if (name !== 'HEDERA_NETWORK' && name !== 'HEDERA_TOPIC_ID' && name !== 'HEDERA_PUBLIC_SUBMISSIONS' && name !== 'HEDERA_OPERATOR_ID') {
        throw new Error(`unexpected env read ${name}`);
      }
      return target[prop];
    }
  });
}

test('public submissions stay off with empty infrastructure', () => {
  const status = hedera.publicStatus({});
  assert.equal(status.submissions, 'off');
  assert.equal(status.network, 'unconfigured');
  assert.equal(status.history, 'unconfigured');
  assert.equal(status.topic, null);
  assert.equal(status.mainnet, false);
  assert.equal(status.signing, false);
  assert.equal(status.funds, false);
  assert.equal(status.solanaWallet, false);
  assert.equal(status.activationFlag, false);
  assert.match(status.reasons.join(' '), /Durable authentication is not configured/);
});

test('an activation flag and a testnet topic still do not open writes or read a key', () => {
  const env = guardedEnv({
    HEDERA_PUBLIC_SUBMISSIONS: 'true',
    HEDERA_NETWORK: 'testnet',
    HEDERA_TOPIC_ID: '0.0.42',
    HEDERA_OPERATOR_ID: '0.0.99',
    HEDERA_OPERATOR_KEY: 'do-not-read'
  });
  const decision = hedera.submissionDecision(env);
  assert.equal(decision.ok, false);
  assert.equal(decision.status, 403);
  assert.equal(decision.signed, false);
  assert.equal(decision.submitted, false);
  assert.equal(decision.reserved, false);
  assert.equal(decision.activationFlag, true);
  assert.equal(decision.missing.find((row) => row.name === 'submission-client').state, 'not-loaded');
  assert.equal(decision.missing.find((row) => row.name === 'durable-auth').state, 'unconfigured');
  assert.equal(decision.missing.find((row) => row.name === 'database').state, 'unconfigured');
  assert.equal(JSON.stringify(decision).includes('do-not-read'), false);
  assert.equal(JSON.stringify(decision).includes('0.0.99'), false);
});

test('mainnet is rejected and the mirror is not called', async () => {
  let called = false;
  const result = await hedera.readPublicHistory({ HEDERA_NETWORK: 'mainnet', HEDERA_TOPIC_ID: '0.0.42' }, async () => {
    called = true;
    return { ok: true, json: async () => ({ messages: [] }) };
  });
  assert.equal(called, false);
  assert.equal(result.status, 'unconfigured');
  assert.equal(result.messages.length, 0);
  assert.match(hedera.publicStatus({ HEDERA_NETWORK: 'mainnet' }).reasons.join(' '), /Mainnet was rejected/);
});

test('a configured testnet topic can be read, and failures stay empty', async () => {
  const plan = hedera.historyRequest({ HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' });
  assert.equal(plan.ok, true);
  assert.equal(plan.url, 'https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.42/messages?limit=25&order=desc');
  const empty = await hedera.readPublicHistory({ HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' }, async (url) => {
    assert.equal(url, plan.url);
    return { ok: true, status: 200, json: async () => ({ messages: [] }) };
  });
  assert.equal(empty.status, 'empty');
  assert.deepEqual(empty.messages, []);
  const broken = await hedera.readPublicHistory({ HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' }, async () => {
    throw new Error('offline');
  });
  assert.equal(broken.status, 'error');
  assert.equal(broken.messages.length, 0);
  assert.match(broken.error, /could not be reached/);
});

test('a digest is not proposal history, and a public message omits private fields', () => {
  const digest = hedera.labelMirrorMessage({
    sequence_number: 4,
    consensus_timestamp: '1700000000.000000000',
    payer_account_id: '0.0.10',
    message: encode({ digest: 'abc', pointer: 'hcs://1/0.0.42' })
  });
  assert.equal(digest.capability, 'digest-or-pointer');
  assert.equal(digest.sharedProposalHistory, false);
  assert.equal(digest.hederaConfirmationOfSolana, false);
  const message = hedera.labelMirrorMessage({
    sequence_number: 5,
    consensus_timestamp: '1700000001.000000000',
    payer_account_id: '0.0.10',
    message: encode({
      kind: 'lgme-public-proposal',
      title: 'Clear one-story gutters',
      amount: 55,
      unit: 'USD',
      consent: true,
      notes: 'call 202-555-0100'
    })
  });
  assert.equal(message.capability, 'public-topic-message');
  assert.equal(message.sharedProposalHistory, true);
  assert.equal(message.title, 'Clear one-story gutters');
  assert.equal(message.withheld, true);
  assert.equal(JSON.stringify(message).includes('202-555-0100'), false);
  assert.equal(message.hederaConfirmationOfSolana, false);
});

test('starter examples are labeled and local proposals stay on their own key', () => {
  const counts = hedera.exampleCounts();
  assert.deepEqual(counts, { college: 12, utility: 12, goods: 12 });
  assert.equal(hedera.EXCHANGE_EXAMPLES.every((row) => row.label === hedera.EXAMPLE_LABEL && row.consensus === false), true);
  const storage = memoryStorage({ 'lgme-sim:peer:alice': '{"tape":[]}', 'lgme.passkey': 'keep' });
  const rejected = hedera.saveLocalProposal(storage, { title: 'Lawn', amount: 40, unit: 'USD', consent: true, notes: 'private' });
  assert.equal(rejected.ok, false);
  const missing = hedera.saveLocalProposal(storage, { title: 'Lawn', amount: 40, unit: 'USD', consent: 'true' });
  assert.equal(missing.ok, false);
  const saved = hedera.saveLocalProposal(storage, { title: 'Clear one-story gutters', amount: 55, unit: 'USD', consent: true }, '2026-11-09T00:00:00.000Z');
  assert.equal(saved.ok, true, saved.error);
  assert.equal(saved.proposal.consensus, false);
  assert.equal(saved.proposal.stored, 'this-device');
  assert.equal(storage.dump()['lgme-sim:peer:alice'], '{"tape":[]}');
  assert.equal(storage.dump()['lgme.passkey'], 'keep');
  assert.equal(Object.keys(storage.dump()).includes(hedera.LOCAL_PROPOSAL_KEY), true);
  const searches = hedera.recommendedSearches(saved.proposal.title);
  assert.match(searches.label, /not Hedera records/i);
  assert.equal(searches.queries[0].includes('gutters'), true);
  assert.equal(hedera.matchByQuery(hedera.EXCHANGE_EXAMPLES, searches.queries[0]).some((row) => row.title === 'Clear one-story gutters'), true);
  storage.setItem(hedera.LOCAL_PROPOSAL_KEY, JSON.stringify([{ title: 'No consent' }, saved.proposal]));
  assert.equal(hedera.readLocalProposals(storage).length, 1);
});

test('an old Solana tape line is not relabeled as Hedera, and new Solana submits do not touch the book', async () => {
  const labeled = hedera.labelLocalChainRecord({ type: 'SOLANA_FINAL', payload: { signature: 'old' } });
  assert.equal(labeled.hederaConfirmation, false);
  assert.match(labeled.text, /Not a Hedera confirmation/);
  const store = { get() { throw new Error('store read'); }, set() { throw new Error('store write'); } };
  assert.equal((await sim.issueSolanaRequest(store)).closed, true);
  assert.equal((await sim.recordSolanaTx(store)).closed, true);
});

test('exchange handlers stay closed and do not call the network when unconfigured', async () => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('network');
  };
  try {
    const status = responseMock();
    await statusHandler({ method: 'GET' }, status);
    assert.equal(status.statusCode, 200);
    assert.equal(status.json.submissions, 'off');
    assert.equal(status.json.signing, false);
    const history = responseMock();
    await historyHandler({ method: 'GET' }, history);
    assert.equal(history.json.messages.length, 0);
    assert.equal(history.json.status === 'unconfigured' || history.json.status === 'error' || history.json.status === 'empty', true);
    const submit = responseMock();
    await submitHandler({ method: 'POST' }, submit);
    assert.equal(submit.statusCode, 403);
    assert.equal(submit.json.submitted, false);
    assert.equal(submit.json.signed, false);
  } finally {
    globalThis.fetch = original;
  }
  if (!process.env.HEDERA_TOPIC_ID) assert.equal(called, false);
});

test('the exchange page does not keep a Solana submission path or another app topic', () => {
  const files = [
    'exchange.html',
    'js/hedera-exchange.mjs',
    'js/hedera-desk.mjs',
    'js/p2p-exchange-sim-ui.mjs',
    'api/exchange/status.mjs',
    'api/exchange/history.mjs',
    'api/exchange/submit.mjs'
  ];
  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    assert.equal(text.includes('0.0.11373116'), false, file);
    assert.equal(text.includes('0.0.11281203'), false, file);
    assert.equal(text.includes('mainnet.mirrornode.hedera.com'), false, file);
    assert.equal(text.includes('phantom'), false, file);
    assert.equal(text.includes('showSolanaPay'), false, file);
  }
  const page = readFileSync(join(root, 'exchange.html'), 'utf8');
  assert.equal(page.includes('id="hedera-desk"'), true);
  assert.equal(page.includes('/js/hedera-desk.mjs'), true);
  assert.equal(page.includes('id="passkey"') || readFileSync(join(root, 'js/p2p-exchange-sim-ui.mjs'), 'utf8').includes("id: 'passkey'"), true);
  assert.match(page, /Public submissions are off/);
  assert.equal(page.includes('your own Solana wallet'), false);
});
