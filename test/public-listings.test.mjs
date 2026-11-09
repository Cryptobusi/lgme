import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as listings from '../js/public-listings.mjs';
import * as sim from '../js/p2p-exchange-sim.mjs';
import catalogHandler from '../api/listings/catalog.mjs';
import submitHandler from '../api/listings/submit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');

function encode(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function mirror(sequence, body, payer = '0.0.10') {
  return { sequence_number: sequence, consensus_timestamp: `170000${String(sequence).padStart(4, '0')}.000000000`, payer_account_id: payer, message: encode(body) };
}

function listing(sequence, fields) {
  return mirror(sequence, {
    v: 1,
    kind: 'lgme-public-listing',
    network: 'hedera:testnet',
    consent: true,
    revision: 1,
    action: 'publish',
    category: 'goods',
    unit: 'lgme',
    amount: 10,
    expiresAt: null,
    ...fields
  });
}

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
    end(payload) { this.body = payload; this.json = JSON.parse(payload); }
  };
}

test('submission stays closed and does not read an operator key', async () => {
  const env = new Proxy({
    HEDERA_PUBLIC_SUBMISSIONS: 'true',
    HEDERA_NETWORK: 'testnet',
    HEDERA_TOPIC_ID: '0.0.42',
    HEDERA_OPERATOR_ID: '0.0.99',
    HEDERA_OPERATOR_KEY: 'do-not-read'
  }, {
    get(target, prop) {
      const name = String(prop);
      if (!['HEDERA_PUBLIC_SUBMISSIONS', 'HEDERA_NETWORK', 'HEDERA_TOPIC_ID', 'HEDERA_OPERATOR_ID'].includes(name)) {
        throw new Error(`unexpected env read ${name}`);
      }
      return target[name];
    }
  });
  let called = false;
  const signer = { loaded: true, readsPrivateKey: false, networkVerified: true, submit() { called = true; } };
  const decision = await listings.executeSubmission(env, {
    auth: { durable: true, kind: 'session' },
    approvedUsers: { durable: true, kind: 'admin-list' },
    db: { durable: true, memory: false, reserve() { return { ok: true }; } },
    signer,
    topicInfo: {
      network: 'testnet',
      topicId: '0.0.42',
      adminKey: 'admin-pub',
      submitKey: 'op-pub',
      operatorAccountId: '0.0.99',
      operatorPublicKey: 'op-pub',
      accountPublicKey: 'op-pub'
    }
  }, { title: 'Desk', amount: 10, unit: 'lgme', consent: true });
  assert.equal(decision.submitted, false);
  assert.equal(decision.signed, false);
  assert.equal(decision.hederaVerified, false);
  assert.equal(called, false);
  assert.equal(JSON.stringify(decision).includes('do-not-read'), false);
  assert.equal(listings.publicStatus({}).submissions, 'off');
  assert.equal(listings.publicStatus({ HEDERA_NETWORK: 'mainnet' }).network, 'unconfigured');
});

test('a passkey, an email list, and a memory budget cannot open submission', () => {
  const env = { HEDERA_PUBLIC_SUBMISSIONS: 'true', HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' };
  const topicInfo = { network: 'testnet', topicId: '0.0.42', adminKey: 'a', submitKey: 'k', operatorAccountId: '0.0.9', operatorPublicKey: 'k' };
  assert.equal(listings.writeDecision(env, { auth: { durable: true, browserPasskey: true }, approvedUsers: { durable: true }, db: { durable: true, reserve() {} }, signer: { loaded: true, networkVerified: true }, topicInfo }).missing.includes('durable-auth'), true);
  assert.equal(listings.writeDecision(env, { auth: { durable: true }, approvedUsers: { durable: true, kind: 'email-allowlist' }, db: { durable: true, reserve() {} }, signer: { loaded: true, networkVerified: true }, topicInfo }).missing.includes('approved-user-ids'), true);
  assert.equal(listings.writeDecision(env, { auth: { durable: true }, approvedUsers: { durable: true }, db: listings.createBudgetStore(), signer: { loaded: true, networkVerified: true }, topicInfo }).missing.includes('durable-database'), true);
  const topic = listings.validateTopicPermissions({ network: 'testnet', topicId: '0.0.42', adminKey: 'a', submitKey: 'k', operatorAccountId: '0.0.9', operatorPublicKey: 'other', privateKey: 'no' });
  assert.equal(topic.ok, false);
});

test('attempt reservations are atomic and an uncertain receipt keeps its transaction id', async () => {
  const db = listings.createBudgetStore();
  const day = '2026-11-09';
  const first = db.reserve({ userId: 'ada', operatorId: 'op', draftId: 'draft-1', day });
  const retry = db.reserve({ userId: 'ada', operatorId: 'op', draftId: 'draft-1', day });
  const [opened, recovered] = await Promise.all([first, retry]);
  assert.equal(opened.ok, true);
  assert.equal(recovered.recover, true);
  assert.equal(recovered.transactionId, opened.transactionId);
  await db.mark('draft-1', 'unknown-receipt');
  const again = await db.reserve({ userId: 'ada', operatorId: 'op', draftId: 'draft-1', day });
  assert.equal(again.transactionId, opened.transactionId);
  assert.equal(again.recover, true);
  for (let n = 2; n <= 5; n += 1) {
    const row = await db.reserve({ userId: 'ada', operatorId: 'op', draftId: `draft-${n}`, day });
    assert.equal(row.ok, true, row.error);
  }
  const blocked = await db.reserve({ userId: 'ada', operatorId: 'op', draftId: 'draft-6', day });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.rejected, true);
  assert.equal(blocked.user.rejected >= 1, true);
});

test('two isolated readers replay one topic into the same catalog', async () => {
  const pages = [
    listing(4, { listingId: 'desk', ownerId: 'ada', title: 'Used desk', amount: 40, revision: 2, action: 'revise' }),
    listing(2, { listingId: 'desk', ownerId: 'bea', title: 'Stolen edit', amount: 1, revision: 2, action: 'revise' }),
    listing(1, { listingId: 'desk', ownerId: 'ada', title: 'Used desk', amount: 30, revision: 1 }),
    listing(3, { listingId: 'tutor', ownerId: 'bea', title: 'Tutoring hour', amount: 1, unit: 'campus-credit', category: 'college' }),
    listing(5, { listingId: 'tutor', ownerId: 'bea', title: 'Tutoring hour', amount: 1, unit: 'campus-credit', category: 'college', revision: 2, action: 'unpublish' }),
    mirror(6, { type: 'SOLANA_TX', signature: 'sig-old' }),
    mirror(7, { digest: 'abc', pointer: 'hcs://1/0.0.42' }),
    listing(8, { listingId: 'old', ownerId: 'ada', title: 'Soup', amount: 8, category: 'goods', expiresAt: '2020-01-01T00:00:00.000Z' })
  ];
  const read = async (rows) => listings.readSharedCatalog(
    { HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' },
    async () => ({ ok: true, status: 200, json: async () => ({ messages: rows }) }),
    { live: false, now: '2026-11-09T00:00:00.000Z' }
  );
  const left = await read(pages);
  const right = await read([...pages].reverse());
  assert.equal(left.hederaVerified, false);
  assert.equal(left.source, 'fixture');
  assert.deepEqual(left.active.map((row) => [row.listingId, row.ownerId, row.amount, row.revision]), right.active.map((row) => [row.listingId, row.ownerId, row.amount, row.revision]));
  assert.deepEqual(left.active.map((row) => row.listingId), ['desk']);
  assert.equal(left.active[0].amount, 40);
  assert.equal(left.active[0].ownerId, 'ada');
  assert.equal(left.history.some((row) => row.listingId === 'tutor' && row.action === 'unpublish'), true);
  assert.equal(left.rejected.some((row) => row.reason === 'owner-mismatch'), true);
  assert.equal(left.active.some((row) => row.listingId === 'old'), false);
  assert.equal(JSON.stringify(left).includes('sig-old'), false);
});

test('catalog pages stay on the testnet mirror and an unconfigured host does not fetch', async () => {
  let urls = [];
  const paged = await listings.readSharedCatalog(
    { HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' },
    async (url) => {
      urls.push(url);
      if (urls.length === 1) {
        return { ok: true, json: async () => ({ messages: [listing(1, { listingId: 'desk', ownerId: 'ada', title: 'Used desk', amount: 40 })], links: { next: '/api/v1/topics/0.0.42/messages?timestamp=gt:1' } }) };
      }
      return { ok: true, json: async () => ({ messages: [listing(2, { listingId: 'bread', ownerId: 'bea', title: 'Loaf of bread', amount: 6, category: 'goods' })] }) };
    },
    { live: false }
  );
  assert.equal(paged.active.length, 2);
  assert.equal(urls.every((url) => url.startsWith('https://testnet.mirrornode.hedera.com/')), true);
  let called = false;
  const idle = await listings.readSharedCatalog({}, async () => { called = true; throw new Error('network'); }, { live: true });
  assert.equal(called, false);
  assert.equal(idle.status, 'unconfigured');
  assert.equal(idle.hederaVerified, false);
  const escaped = await listings.readSharedCatalog(
    { HEDERA_NETWORK: 'testnet', HEDERA_TOPIC_ID: '0.0.42' },
    async () => ({ ok: true, json: async () => ({ messages: [], links: { next: 'https://mainnet.mirrornode.hedera.com/api/v1/topics/0.0.42/messages' } }) }),
    { live: false }
  );
  assert.equal(escaped.status, 'error');
  assert.equal(escaped.active.length, 0);
});

test('a public draft excludes private fields and does not touch a local book', () => {
  const storage = memoryStorage({ 'lgme-sim:peer:alice': '{"listings":{}}' });
  const rejected = listings.saveListingDraft(storage, { title: 'Used desk', amount: 40, unit: 'lgme', consent: true, notes: 'call me', photo: 'data' });
  assert.equal(rejected.ok, false);
  const saved = listings.saveListingDraft(storage, { title: 'Used desk', amount: 40, unit: 'lgme', category: 'goods', consent: true });
  assert.equal(saved.ok, true, saved.error);
  assert.equal(saved.draft.shared, false);
  assert.equal(storage.dump()['lgme-sim:peer:alice'], '{"listings":{}}');
  assert.equal(Object.keys(storage.dump()).includes(listings.DRAFT_KEY), true);
  const message = listings.messageForListing({ ownerId: 'ada', draft: { ...saved.draft, action: 'publish' }, revision: 1 });
  assert.equal(message.title, 'Used desk');
  assert.equal(message.amount, 40);
  assert.equal(message.kind, 'lgme-public-listing');
  assert.equal(listings.exampleCounts().college, 12);
  assert.equal(listings.LISTING_EXAMPLES.length, 36);
  assert.equal(listings.LISTING_EXAMPLES.every((row) => row.shared === false), true);
});

test('the exchange keeps Solana payments and does not treat the catalog as already verified', async () => {
  const ui = text('js/p2p-exchange-sim-ui.mjs');
  const page = text('exchange.html');
  assert.equal(ui.includes('showSolanaPay'), true);
  assert.equal(ui.includes('Settle in $lgme'), true);
  assert.equal(typeof sim.issueSolanaRequest, 'function');
  assert.equal(typeof sim.recordSolanaTx, 'function');
  assert.equal(page.includes('id="public-catalog"'), true);
  assert.equal(page.includes('7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump'), true);
  assert.match(ui, /not convertible to \$lgme/);
  assert.match(ui, /Not a public Hedera listing/);
  for (const file of ['js/public-listings.mjs', 'js/public-catalog-desk.mjs', 'exchange.html', 'api/listings/submit.mjs']) {
    const source = text(file);
    assert.equal(source.includes('0.0.11373116'), false, file);
    assert.equal(source.includes('0.0.11281203'), false, file);
  }
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { called = true; throw new Error('network'); };
  try {
    const catalog = responseMock();
    await catalogHandler({ method: 'GET' }, catalog);
    assert.equal(catalog.json.hederaVerified, false);
    assert.equal(catalog.json.active.length, 0);
    const submit = responseMock();
    await submitHandler({ method: 'POST' }, submit);
    assert.equal(submit.statusCode, 403);
    assert.equal(submit.json.submitted, false);
  } finally {
    globalThis.fetch = original;
  }
  if (!process.env.HEDERA_TOPIC_ID) assert.equal(called, false);
});
