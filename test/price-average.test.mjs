import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateHold } from '../js/high-value.mjs';
import {
  AVERAGE_COUNT,
  MINT,
  PAY_LOCK_MS,
  PRICE_UNAVAILABLE,
  SAMPLE_MS,
  averagePrice,
  fetchSpotPrice,
  lockOpen,
  lockPayQuote,
  parseBirdeyePrice,
  parseJupiterPrice,
  parseGeckoPools,
  parsePumpCoin,
  withinPeg
} from '../js/lgme-price.mjs';
import { SETUP_ADDRESS, confirmSetupTransfer } from '../js/setup-fee.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('a 3-second average converts the peg and a stale feed is not guessed', async () => {
  assert.equal(AVERAGE_COUNT, 3);
  assert.equal(SAMPLE_MS, 1000);
  assert.equal(PAY_LOCK_MS, 60000);
  const now = 5_000;
  const fresh = averagePrice([
    { t: now - 2000, price: 0.000004, source: 'pump' },
    { t: now - 1000, price: 0.000005, source: 'dexscreener' },
    { t: now, price: 0.000006, source: 'geckoterminal' }
  ], now);
  assert.equal(fresh.ok, true, fresh.error);
  assert.equal(fresh.price, 0.000005);
  assert.equal(fresh.samples, 3);
  assert.equal(fresh.source, 'geckoterminal');
  const short = averagePrice(fresh && [
    { t: now - 1000, price: 0.000005, source: 'dexscreener' },
    { t: now, price: 0.000006, source: 'geckoterminal' }
  ], now);
  assert.equal(short.ok, false);
  assert.equal(short.error, PRICE_UNAVAILABLE);
  const stale = averagePrice([
    { t: 0, price: 1, source: 'pump' },
    { t: 1000, price: 1, source: 'pump' },
    { t: 2000, price: 1, source: 'pump' }
  ], 10_000);
  assert.equal(stale.ok, false);
  assert.equal(stale.error, PRICE_UNAVAILABLE);
  const locked = lockPayQuote(fresh, 1, now);
  assert.equal(locked.ok, true, locked.error);
  assert.equal(locked.usdAmount, 1);
  assert.equal(lockOpen(locked, now + 59_000), true);
  assert.equal(lockOpen(locked, now + PAY_LOCK_MS + 1), false);
  assert.equal(withinPeg(locked.lgmeAmount * 1.019, locked.lgmeAmount), true);
  assert.equal(withinPeg(locked.lgmeAmount * 1.03, locked.lgmeAmount), false);
  const samples = [
    { t: now - 2000, price: 0.1, source: 'geckoterminal' },
    { t: now - 1000, price: 0.1, source: 'geckoterminal' },
    { t: now, price: 0.1, source: 'geckoterminal' }
  ];
  const over = evaluateHold([], {
    id: 'row', fromId: 'mina', toId: 'ria', kind: 'lgme', amount: 1001, samples, now, at: new Date(now).toISOString()
  });
  assert.equal(over.pending, true);
  assert.equal(over.usd, 100.1);
  const missing = evaluateHold([], {
    id: 'row', fromId: 'mina', toId: 'ria', kind: 'lgme', amount: 10,
    samples: [{ t: 0, price: 0.1, source: 'pump' }], now, at: new Date(now).toISOString()
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, PRICE_UNAVAILABLE);
  const mocked = await fetchSpotPrice({
    fetchImpl: async (url) => {
      if (String(url).includes('pump.fun')) return { ok: false, json: async () => ({}) };
      if (String(url).includes('dexscreener')) return { ok: true, json: async () => ({ pairs: [] }) };
      if (String(url).includes('jup.ag')) return { ok: true, json: async () => ({}) };
      if (String(url).includes('birdeye')) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => ({ data: [{ attributes: { token_price_usd: '0.00000415', reserve_in_usd: '3000' } }] }) };
    }
  });
  assert.equal(mocked.ok, true, mocked.error);
  assert.equal(mocked.source, 'geckoterminal');
  assert.equal(mocked.price, 0.00000415);
  assert.equal(parsePumpCoin({ usd_market_cap: 4150 }), 0.00000415);
  assert.equal(parseJupiterPrice({ data: { [MINT]: { price: '0.0000042' } } }, MINT), 0.0000042);
  assert.equal(parseBirdeyePrice({ data: { value: 0.0000041 } }), 0.0000041);
  const csp = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers
    .flatMap((block) => block.headers).find((header) => header.key === 'Content-Security-Policy').value;
  assert.equal(csp.includes('https://frontend-api-v3.pump.fun'), true);
  assert.equal(csp.includes('https://lite-api.jup.ag'), true);
  assert.equal(csp.includes('https://public-api.birdeye.so'), true);
  const reference = SETUP_ADDRESS;
  const raw = String(Math.round(50.5 * 1e6));
  const tx = {
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 1, mint: MINT, owner: SETUP_ADDRESS, uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, owner: SETUP_ADDRESS, uiTokenAmount: { amount: raw, decimals: 6 } }]
    },
    transaction: { signatures: ['5'.repeat(64)], message: { accountKeys: ['payer', reference] } }
  };
  const matched = confirmSetupTransfer(tx, { amount: 50, tolerance: 0.02, reference, signature: '5'.repeat(64) });
  assert.equal(matched.ok, true, matched.error);
  const off = confirmSetupTransfer(tx, { amount: 40, tolerance: 0.02, reference });
  assert.equal(off.ok, false);
  const page = readFileSync(join(root, 'js/setup-fee-page.mjs'), 'utf8');
  assert.equal(page.includes('At my purchase price'), false);
  assert.equal(page.includes('buy-signature'), false);
  const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${MINT}/pools?page=1`);
  const body = await response.json();
  const livePrice = parseGeckoPools(body);
  assert.equal(response.ok, true);
  assert.equal(livePrice > 0, true);
});
