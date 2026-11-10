import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { ATTESTATION_NOTE } from '../js/high-value.mjs';
import { lgmeForUsd } from '../js/lgme-price.mjs';
import {
  POOL_ADDRESS,
  POOL_MINT,
  POOL_TITLE,
  acceptSponsor,
  attestPoolDonation,
  donateCredit,
  donateLgme,
  drawPool,
  emptyPool,
  helpNext,
  poolLedgerEntry,
  poolView,
  publicPoolMessage
} from '../js/membership-pool.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = '2026-11-10T21:40:00.000Z';

function txFor(amount, reference) {
  const raw = String(Math.round(amount * 1e6));
  return {
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: POOL_ADDRESS, uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: POOL_MINT, owner: POOL_ADDRESS, uiTokenAmount: { amount: raw, decimals: 6 } }]
    },
    transaction: { signatures: ['5'.repeat(64)], message: { accountKeys: ['payer', reference, POOL_ADDRESS] } }
  };
}

test('credit, a mocked $lgme gift, one draw, and a direct sponsor follow the pool rules', async () => {
  const credit = await donateCredit(emptyPool(), { handle: 'mina', credit: 3, amount: 1, at, nonce: 'credit-1' });
  assert.equal(credit.ok, true, credit.error);
  assert.equal(credit.pending, false);
  assert.equal(credit.view.inUsd, 1);
  assert.equal(credit.view.outUsd, 0);
  assert.equal(credit.view.covers, 1);
  assert.equal(JSON.stringify(credit.view).includes('mina'), false);
  const short = await donateCredit(credit.pool, { handle: 'mina', credit: 3, amount: 5, at, nonce: 'credit-too-much' });
  assert.equal(short.ok, false);

  const price = 0.02;
  const quote = lgmeForUsd(1, price);
  assert.equal(quote, 50);
  const reference = POOL_ADDRESS;
  const paid = await donateLgme(credit.pool, {
    handle: 'guest',
    usd: 1,
    price,
    lgmeAmount: quote,
    reference,
    tx: txFor(quote, reference),
    at,
    nonce: 'lgme-1'
  });
  assert.equal(paid.ok, true, paid.error);
  assert.equal(paid.view.inUsd, 2);
  assert.equal(paid.view.covers, 2);
  const wrong = await donateLgme(paid.pool, {
    handle: 'guest',
    usd: 1,
    price,
    lgmeAmount: quote,
    reference,
    tx: txFor(40, reference),
    at,
    nonce: 'lgme-wrong'
  });
  assert.equal(wrong.ok, false);

  const first = await drawPool(paid.pool, { handle: 'nori', at, nonce: 'draw-1' });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.view.outUsd, 1);
  assert.equal(first.view.covers, 1);
  assert.equal(first.covered, true);
  const again = await drawPool(first.pool, { handle: 'nori', at, nonce: 'draw-2' });
  assert.equal(again.ok, false);
  assert.match(again.error, /already used/);
  const other = await drawPool(first.pool, { handle: 'ada', at, nonce: 'draw-3' });
  assert.equal(other.ok, true, other.error);
  const late = await drawPool(other.pool, { handle: 'willa', at, nonce: 'draw-4' });
  assert.equal(late.ok, false);
  assert.match(late.error, /cannot cover/);

  const sponsor = await helpNext(emptyPool(), { handle: 'mina', credit: 1, at, nonce: 'sponsor-1' });
  assert.equal(sponsor.ok, true, sponsor.error);
  assert.equal(sponsor.label, 'Help the next member');
  assert.equal(sponsor.view.inUsd, 0);
  assert.equal(sponsor.view.offers, 1);
  const repeat = await helpNext(sponsor.pool, { handle: 'mina', credit: 1, at, nonce: 'sponsor-2' });
  assert.equal(repeat.ok, false);
  const accepted = await acceptSponsor(sponsor.pool, { handle: 'nori', at, nonce: 'accept-1' });
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.view.offers, 0);
  const second = await acceptSponsor(accepted.pool, { handle: 'nori', at, nonce: 'accept-2' });
  assert.equal(second.ok, false);
  const nobody = await acceptSponsor(accepted.pool, { handle: 'ada', at, nonce: 'accept-3' });
  assert.equal(nobody.ok, false);

  const big = await donateCredit(emptyPool(), { handle: 'mina', credit: 200, amount: 101, at, nonce: 'big' });
  assert.equal(big.ok, true, big.error);
  assert.equal(big.pending, true);
  assert.equal(big.note, ATTESTATION_NOTE);
  assert.equal(big.view.covers, 0);

  const message = publicPoolMessage(first.pool, first.hash);
  assert.equal(message.title, POOL_TITLE);
  assert.equal(message.pinned, true);
  assert.equal(message.topic, '0.0.11397293');
  assert.equal(message.payer, '0.0.11281203');
  assert.match(message.hash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(message).includes('nori'), false);
  assert.equal(JSON.stringify(poolView(first.pool)).includes('leaderboard'), false);
  const ledger = poolLedgerEntry({ kind: 'draw', usd: 1, hash: first.hash });
  assert.equal(ledger.payload.custodial, false);
  assert.equal(ledger.payload.covered, true);
  assert.equal(ledger.payload.anonymous, true);

  const page = readFileSync(join(root, 'js/membership-pool-page.mjs'), 'utf8');
  const setup = readFileSync(join(root, 'js/setup-fee-page.mjs'), 'utf8');
  const api = readFileSync(join(root, 'api/hedera/listings.mjs'), 'utf8');
  assert.equal(page.includes('Help the next member'), true);
  assert.equal(page.includes('Use the pool'), true);
  assert.equal(POOL_TITLE, 'Membership fee pool: donate or use');
  assert.equal(page.includes('POOL_TITLE'), true);
  assert.equal(page.includes('leaderboard'), false);
  assert.equal(setup.includes('mountPoolUse'), true);
  assert.equal(api.includes('publicPoolMessage'), true);
  assert.equal(api.includes('submitPaidListing'), true);
});

test('a large donation stays out of the pool until three members attest', async () => {
  const big = await donateCredit(emptyPool(), { handle: 'mina', credit: 200, amount: 101, at, nonce: 'attest' });
  let pool = big.pool;
  const when = '2026-11-10T21:45:00.000Z';
  for (const handle of ['ada', 'nori', 'willa']) {
    const key = await generateDeviceKey();
    const payload = { action: 'attest', entryId: big.hash, at: when };
    const added = await attestPoolDonation(pool, {
      handle,
      entryId: big.hash,
      at: when,
      publicJwk: key.publicJwk,
      sig: await signDevice(key.privateJwk, payload)
    });
    assert.equal(added.ok, true, added.error);
    pool = added.pool;
  }
  assert.equal(poolView(pool).inUsd, 101);
  assert.equal(poolView(pool).covers, 101);
});
