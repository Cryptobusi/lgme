import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPegBands, clampMove, fetchLgmePrice, parseDexPairs, parseGeckoOhlcv, parseGeckoPools, PEG_NOTE, QUOTE_MS } from '../js/lgme-price.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MINT = '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump';

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

test('a price move past 5% clamps to the band and a 3% move passes through', () => {
  const up = clampMove(1, 1.08, 0.05);
  assert.equal(up.ok, true, up.error);
  assert.equal(up.clamped, true);
  assert.equal(up.price, 1.05);
  assert.equal(up.raw, 1.08);
  assert.equal(up.band, 0.05);
  const down = clampMove(1, 0.88, 0.05);
  assert.equal(down.clamped, true);
  assert.equal(down.price, 0.95);
  assert.equal(down.raw, 0.88);
  const calm = clampMove(1, 1.03, 0.05);
  assert.equal(calm.clamped, false);
  assert.equal(calm.price, 1.03);
  assert.equal(calm.raw, 1.03);
});

const DAY = 86400000;

test('one 5% band binds every anchor and the tightest edge wins', () => {
  const now = Date.parse('2026-11-07T00:00:00.000Z');
  const quote = applyPegBands({ raw: 1.08, previous: 1, now, history: false, rules: { band: 0.05 } });
  assert.equal(quote.price, 1.05);
  assert.deepEqual(quote.bounded, ['quote']);
  assert.equal(quote.history, 'history unavailable');
  const down = applyPegBands({ raw: 0.88, previous: 1, now, history: false, rules: { band: 0.05 } });
  assert.equal(down.price, 0.95);
  assert.deepEqual(down.bounded, ['quote']);
  const calm = applyPegBands({ raw: 1.03, previous: 1, now, history: false, rules: { band: 0.05 } });
  assert.equal(calm.price, 1.03);
  assert.equal(calm.clamped, false);
  const day = applyPegBands({
    raw: 1.08,
    now,
    candles: [{ t: now - DAY, close: 1 }, { t: now - 2 * DAY, close: 1 }],
    rules: { band: 0.05 }
  });
  assert.equal(day.price, 1.05);
  assert.equal(day.bounded.includes('24h'), true);
  assert.equal(day.anchors.day, 1);
  const week = applyPegBands({
    raw: 1.08,
    now,
    candles: [
      { t: now - 30 * DAY, close: 1.04 },
      { t: now - 7 * DAY, close: 1 },
      { t: now - 2 * DAY, close: 1.04 },
      { t: now - DAY, close: 1.04 }
    ],
    rules: { band: 0.05 }
  });
  assert.equal(week.price, 1.05);
  assert.equal(week.bounded.includes('7d'), true);
  assert.equal(week.bounded.includes('24h'), false);
  const month = applyPegBands({
    raw: 1.08,
    now,
    candles: [
      { t: now - 30 * DAY, close: 1 },
      { t: now - 7 * DAY, close: 1.04 },
      { t: now - 2 * DAY, close: 1.04 },
      { t: now - DAY, close: 1.04 }
    ],
    rules: { band: 0.05 }
  });
  assert.equal(month.price, 1.05);
  assert.equal(month.price === 1.1, false);
  assert.equal(month.bounded.includes('30d'), true);
  assert.equal(month.anchors.month, 1);
  const hold = applyPegBands({
    raw: 1.42,
    now,
    candles: [
      { t: now - 30 * DAY, close: 1.3 },
      { t: now - 7 * DAY, close: 1.3 },
      { t: now - 3 * DAY, close: 1.2 },
      { t: now - 2 * DAY, close: 1.4 },
      { t: now - DAY, close: 1.38 }
    ],
    rules: { band: 0.05, holdDays: 7 }
  });
  assert.equal(hold.anchors.hold, 1.2);
  assert.equal(hold.price, 1.26);
  assert.equal(hold.bounded.includes('hold'), true);
  assert.equal(hold.bounded.includes('24h'), false);
  const expired = applyPegBands({
    raw: 1.08,
    now,
    candles: [
      { t: now - 10 * DAY, close: 1 },
      { t: now - 8 * DAY, close: 1.08 },
      { t: now - 6 * DAY, close: 1.08 },
      { t: now - 2 * DAY, close: 1.08 },
      { t: now - DAY, close: 1.08 }
    ],
    rules: { band: 0.05, holdDays: 7 }
  });
  assert.equal(expired.anchors.hold, null);
  assert.equal(expired.price, 1.08);
  assert.equal(PEG_NOTE, 'Pegged to US$. The price used never moves more than 5% from recent reference prices, for stable value.');
  const methods = JSON.parse(readFileSync(join(root, 'data/payment-methods.json'), 'utf8'));
  assert.equal(methods.peg.band, 0.05);
  assert.equal(methods.peg.holdDays, 7);
  assert.equal(methods.loyalty.capUsdPerPeriod, 25);
  assert.equal(methods.loyalty.reserveUsd, 100);
  assert.equal(parseGeckoOhlcv({ data: { attributes: { ohlcv_list: [[1791676800, 1, 2, 0.5, 1.5, 3]] } } })[0].close, 1.5);
});

test('the price fetch uses GeckoTerminal, then DexScreener, and blocks when neither has a price', async () => {
  const gecko = {
    data: [{ attributes: { token_price_usd: '0.00000415', reserve_in_usd: '3000', base_token_price_usd: '0' } }]
  };
  const seen = [];
  const first = await fetchLgmePrice({
    now: () => '2026-11-07T20:00:00.000Z',
    fetchImpl: async (url) => {
      seen.push(url);
      return jsonResponse(gecko);
    }
  });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.source, 'geckoterminal');
  assert.equal(first.price, 0.00000415);
  assert.equal(first.timestamp, '2026-11-07T20:00:00.000Z');
  assert.equal(seen[0].startsWith('https://api.geckoterminal.com/'), true);
  const fallback = await fetchLgmePrice({
    fetchImpl: async (url) => {
      if (url.includes('geckoterminal')) return jsonResponse({ data: [{ attributes: { token_price_usd: null, reserve_in_usd: '0' } }] });
      return jsonResponse({ pairs: [{ priceUsd: '0.0000042', liquidity: { usd: 1200 } }] });
    }
  });
  assert.equal(fallback.ok, true, fallback.error);
  assert.equal(fallback.source, 'dexscreener');
  assert.equal(fallback.price, 0.0000042);
  const down = await fetchLgmePrice({
    fetchImpl: async () => { throw new Error('down'); }
  });
  assert.equal(down.ok, false);
  assert.deepEqual(down.alternatives, ['terms', 'barter']);
  const thin = await fetchLgmePrice({
    fetchImpl: async () => jsonResponse({ pairs: [{ priceUsd: '0.0000042', liquidity: { usd: 0 } }], data: [] })
  });
  assert.equal(thin.ok, false);
  assert.equal(parseGeckoPools({ data: [] }), 0);
  assert.equal(parseDexPairs({ pairs: null }), 0);
  assert.equal(QUOTE_MS, 15000);
  const blocks = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).headers;
  const headers = blocks.flatMap((block) => block.headers).find((header) => header.key === 'Content-Security-Policy').value;
  assert.equal(headers.includes('https://api.geckoterminal.com'), true);
  assert.equal(headers.includes('https://api.dexscreener.com'), true);
  assert.equal(headers.includes(MINT), false);
});
