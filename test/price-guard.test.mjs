import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINT,
  PAY_LOCK_MS,
  PRICE_UNAVAILABLE,
  PRICE_UNSETTLED,
  clearSpotMemory,
  fetchSpotBoard,
  lockOpen,
  lockPayQuote,
  pegQuote,
  withinPeg
} from '../js/lgme-price.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function tape(now, { base, lastPrice, span = 300000 }) {
  const rows = [];
  for (let t = now - span; t <= now; t += 1000) {
    const price = t >= now - 2000 ? lastPrice : base;
    rows.push({
      t,
      price,
      source: 'geckoterminal',
      quotes: [
        { source: 'geckoterminal', price },
        { source: 'jupiter', price }
      ]
    });
  }
  return rows;
}

test('a thin spike, disagreeing sources, and a normal one-dollar payment follow the safeguards', async () => {
  const now = 400000;
  const agree = [{ source: 'geckoterminal', price: 0.00001 }, { source: 'jupiter', price: 0.0000102 }];
  const spike = tape(now, { base: 0.00001, lastPrice: 0.0000108 });
  const small = pegQuote({ usd: 1, samples: spike, quotes: agree, now });
  assert.equal(small.ok, true, small.error);
  assert.equal(small.rule, '3-second average');
  assert.equal(small.plain, 'Up to $20 uses the 3-second average.');
  assert.equal(small.price, 0.0000108);
  const large = pegQuote({ usd: 25, samples: spike, quotes: agree, now });
  assert.equal(large.ok, true, large.error);
  assert.equal(large.rule, '5-minute average');
  assert.match(large.plain, /5-minute average asked for more \$lgme/);
  assert.equal(large.lgmeAmount > small.lgmeAmount * 25, true);
  const dip = tape(now, { base: 0.00001, lastPrice: 0.0000092 });
  const dipped = pegQuote({ usd: 25, samples: dip, quotes: agree, now });
  assert.equal(dipped.ok, true, dipped.error);
  assert.equal(dipped.rule, '3-second average');
  assert.match(dipped.plain, /3-second average asked for more \$lgme/);
  const jump = tape(now, { base: 0.00001, lastPrice: 0.000012 });
  const unsettledMove = pegQuote({ usd: 25, samples: jump, quotes: agree, now });
  assert.equal(unsettledMove.ok, false);
  assert.equal(unsettledMove.error, PRICE_UNSETTLED);
  const disagree = pegQuote({
    usd: 1,
    samples: spike,
    quotes: [{ source: 'geckoterminal', price: 0.00001 }, { source: 'jupiter', price: 0.0000106 }],
    now
  });
  assert.equal(disagree.ok, false);
  assert.equal(disagree.unsettled, true);
  assert.equal(disagree.error, PRICE_UNSETTLED);
  const steady = tape(now, { base: 0.02, lastPrice: 0.02, span: 3000 });
  const dollar = pegQuote({
    usd: 1,
    samples: steady,
    quotes: [{ source: 'geckoterminal', price: 0.02 }, { source: 'jupiter', price: 0.0201 }],
    now
  });
  assert.equal(dollar.ok, true, dollar.error);
  assert.equal(dollar.lgmeAmount, 50);
  assert.equal(dollar.plain, 'Up to $20 uses the 3-second average.');
  const locked = lockPayQuote(dollar, 1, now);
  assert.equal(locked.ok, true, locked.error);
  assert.equal(locked.plain, dollar.plain);
  assert.equal(lockOpen(locked, now + PAY_LOCK_MS), true);
  assert.equal(lockOpen(locked, now + PAY_LOCK_MS + 1), false);
  assert.equal(withinPeg(locked.lgmeAmount * 1.02, locked.lgmeAmount), true);
  assert.equal(withinPeg(locked.lgmeAmount * 1.03, locked.lgmeAmount), false);
  const early = pegQuote({ usd: 21, samples: steady, quotes: agree, now });
  assert.equal(early.ok, false);
  assert.equal(early.error, PRICE_UNAVAILABLE);
  const board = await fetchSpotBoard({
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes('geckoterminal')) {
        return { ok: true, json: async () => ({ data: [{ attributes: { token_price_usd: '0.0000100', reserve_in_usd: '3000' } }] }) };
      }
      if (href.includes('jup.ag')) return { ok: true, json: async () => ({ data: { [MINT]: { price: '0.0000107' } } }) };
      return { ok: false, json: async () => ({}) };
    }
  });
  assert.equal(board.ok, false);
  assert.equal(board.error, PRICE_UNSETTLED);
  const page = readFileSync(join(root, 'js/setup-fee-page.mjs'), 'utf8');
  const pool = readFileSync(join(root, 'js/membership-pool-page.mjs'), 'utf8');
  const coin = readFileSync(join(root, 'js/lgme-coin-page.js'), 'utf8');
  assert.equal(page.includes('pegQuote'), true);
  assert.equal(pool.includes('pegQuote'), true);
  assert.equal(coin.includes('pegQuote'), true);
  assert.equal(page.includes('Up to $20 uses the 3-second average.'), true);
});

test('one live source still quotes a dollar and a cached 304 keeps that price', async () => {
  const now = 400000;
  const alone = pegQuote({
    usd: 1,
    samples: [{ t: now, price: 0.000004, source: 'geckoterminal' }],
    quotes: [{ source: 'geckoterminal', price: 0.000004 }],
    now
  });
  assert.equal(alone.ok, true, alone.error);
  assert.equal(alone.rule, 'single source');
  assert.match(alone.plain, /single source/);
  assert.equal(alone.lgmeAmount, 250000);
  const over = pegQuote({
    usd: 25,
    samples: [{ t: now, price: 0.000004, source: 'geckoterminal' }],
    quotes: [{ source: 'geckoterminal', price: 0.000004 }],
    now
  });
  assert.equal(over.ok, false);
  assert.equal(over.error, PRICE_UNAVAILABLE);
  clearSpotMemory();
  let geckoCalls = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (!href.includes('geckoterminal')) return { ok: false, status: 401, json: async () => ({}) };
    geckoCalls += 1;
    if (geckoCalls === 1) {
      return { ok: true, status: 200, json: async () => ({ data: [{ attributes: { token_price_usd: '0.000004', reserve_in_usd: '3000' } }] }) };
    }
    return { ok: false, status: 304, json: async () => ({}) };
  };
  const first = await fetchSpotBoard({ fetchImpl });
  assert.equal(first.ok, true, first.error);
  assert.equal(first.quotes.length, 1);
  assert.equal(first.source, 'geckoterminal');
  const second = await fetchSpotBoard({ fetchImpl });
  assert.equal(second.ok, true, second.error);
  assert.equal(second.price, 0.000004);
  assert.equal(second.quotes.length, 1);
  clearSpotMemory();
});
