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
  matchesPeg,
  parseBirdeyePrice,
  parseJupiterPrice,
  parsePumpCoin,
  purchaseQuote,
  withinPeg
} from '../js/lgme-price.mjs';

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
  let live = { ok: false, error: PRICE_UNAVAILABLE };
  for (let attempt = 0; attempt < 3 && !live.ok; attempt += 1) live = await fetchSpotPrice({ timeoutMs: 8000 });
  assert.equal(live.ok, true, live.error);
  assert.equal(live.price > 0, true);
  assert.equal(parsePumpCoin({ usd_market_cap: 4150 }), 0.00000415);
  assert.equal(parseJupiterPrice({ data: { [MINT]: { price: '0.0000042' } } }, MINT), 0.0000042);
  assert.equal(parseBirdeyePrice({ data: { value: 0.0000041 } }), 0.0000041);
  const csp = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers
    .flatMap((block) => block.headers).find((header) => header.key === 'Content-Security-Policy').value;
  assert.equal(csp.includes('https://frontend-api-v3.pump.fun'), true);
  assert.equal(csp.includes('https://lite-api.jup.ag'), true);
  assert.equal(csp.includes('https://public-api.birdeye.so'), true);
  const buy = {
    meta: {
      err: null,
      fee: 5000,
      preBalances: [2_000_000_000],
      postBalances: [999_995_000],
      preTokenBalances: [{ accountIndex: 1, mint: MINT, uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: MINT, uiTokenAmount: { amount: '150000000', decimals: 6 } }]
    }
  };
  const bought = purchaseQuote(buy, { solUsd: 150 });
  assert.equal(bought.ok, true, bought.error);
  assert.equal(bought.basis, 'sol');
  assert.equal(bought.price, 1);
  assert.equal(bought.lgmeAmount, 1);
  const current = 200000;
  assert.equal(matchesPeg(1.01, [current, bought.lgmeAmount]), true);
  assert.equal(matchesPeg(current * 1.03, [current, bought.lgmeAmount]), false);
  const atPurchase = evaluateHold([], {
    id: 'buy', fromId: 'mina', toId: 'ria', kind: 'lgme', amount: 1, basis: 'purchase', purchasePrice: bought.price,
    at: '2026-11-10T21:00:00.000Z'
  });
  assert.equal(atPurchase.usd, 1);
  assert.equal(atPurchase.pending, false);
});
