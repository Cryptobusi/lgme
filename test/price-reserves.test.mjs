import test from 'node:test';
import assert from 'node:assert/strict';
import { PUMP_PROGRAM, fetchSpotBoard, parseGeckoPools, parsePumpReserves, sourceGap } from '../js/lgme-price.mjs';

test('USDC pool reserves price the coin without an indexer', () => {
  const bytes = Buffer.alloc(24);
  bytes.writeBigUInt64LE(1054248151818317n, 8);
  bytes.writeBigUInt64LE(4368341564n, 16);
  const price = parsePumpReserves({
    result: { value: { owner: PUMP_PROGRAM, data: [bytes.toString('base64'), 'base64'] } }
  });
  const gecko = 0.000004153716105;
  assert.equal(price > 0, true);
  assert.equal(sourceGap([{ price }, { price: gecko }]).unsettled, false);
  assert.equal(parsePumpReserves({ result: { value: { owner: 'other', data: [bytes.toString('base64')] } } }), 0);
});

test('the live reserve price stays within 5 percent of GeckoTerminal', async () => {
  const board = await fetchSpotBoard({ timeoutMs: 8000 });
  const names = (board.quotes || []).map((row) => row.source).sort();
  assert.equal(board.ok, true, board.error);
  assert.equal(names.includes('geckoterminal'), true);
  assert.equal(names.includes('solana-reserves'), true);
  assert.equal(sourceGap(board.quotes).unsettled, false);
  const gecko = await fetch('https://api.geckoterminal.com/api/v2/networks/solana/tokens/7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump/pools?page=1');
  const listed = parseGeckoPools(await gecko.json());
  const reserves = board.quotes.find((row) => row.source === 'solana-reserves').price;
  assert.equal(Math.abs(reserves - listed) / listed < 0.05, true);
});
