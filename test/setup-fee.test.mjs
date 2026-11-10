import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETUP_ADDRESS } from '../js/setup-fee.mjs';
import {
  SETUP_COPY,
  SETUP_TITLE,
  confirmSetupTransfer,
  lgmeForUsd,
  markReceivablePaid,
  optOutReminder,
  payNowQuote,
  publicSetupReceivable,
  receivableRecord,
  reminderDue
} from '../js/setup-fee.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFileSync(join(root, path), 'utf8');
const SIGNATURE = '5'.repeat(64);

function txFor(amount, recipient = SETUP_ADDRESS) {
  const raw = String(Math.round(amount * 1e6));
  return {
    meta: {
      err: null,
      preTokenBalances: [{ accountIndex: 1, mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump', owner: recipient, uiTokenAmount: { amount: '0', decimals: 6 } }],
      postTokenBalances: [{ accountIndex: 1, mint: '7kqfsEWpiuf3wKJbXkUWpV7RrxpGEbrSTKraRMrppump', owner: recipient, uiTokenAmount: { amount: raw, decimals: 6 } }]
    },
    transaction: { signatures: [SIGNATURE], message: { accountKeys: ['payer', recipient] } }
  };
}

test('pay now quotes one dollar and pay later settles only a verified transfer', () => {
  const quote = payNowQuote(0.02, SETUP_ADDRESS);
  assert.equal(quote.ok, true, quote.error);
  assert.equal(quote.amount, 50);
  assert.equal(quote.custodial, false);
  assert.equal(quote.recipient, SETUP_ADDRESS);
  assert.match(quote.url, /^solana:6SYznXBadAVkWeAGYKqVDRbiXv5EN1gbJKnf1eT5okLY\?/);
  assert.match(quote.url, /amount=50/);
  assert.match(quote.pump, /pump\.fun/);
  assert.equal(lgmeForUsd(1, 0).ok, false);
  const due = receivableRecord({ handle: 'mina', price: 0.02, at: '2026-11-10T21:00:00.000Z' });
  assert.equal(due.item.title, SETUP_TITLE);
  assert.equal(due.item.owedTo, 'EgonAnon');
  assert.equal(due.item.status, 'due');
  assert.equal(due.item.lgmeAmount, 50);
  const opened = publicSetupReceivable({ handle: 'mina', action: 'receivable', category: 'exchange', lgmeAmount: 50 });
  assert.equal(opened.ok, true, opened.error);
  assert.equal(opened.body.status, 'due');
  const other = publicSetupReceivable({ handle: 'mina', action: 'receivable', category: 'campus' });
  assert.equal(other.ok, false);
  assert.equal(other.status, 403);
  const verified = confirmSetupTransfer(txFor(50), { amount: 50, signature: SIGNATURE });
  assert.equal(verified.ok, true, verified.error);
  const near = confirmSetupTransfer(txFor(50.8), { amount: 50, tolerance: 0.02, signature: SIGNATURE });
  assert.equal(near.ok, true, near.error);
  const far = confirmSetupTransfer(txFor(52), { amount: 50, tolerance: 0.02, signature: SIGNATURE });
  assert.equal(far.ok, false);
  assert.equal(verified.cluster, 'mainnet-beta');
  const wrong = confirmSetupTransfer(txFor(50, '11111111111111111111111111111111'), { amount: 50, recipient: SETUP_ADDRESS });
  assert.equal(wrong.ok, false);
  const paid = markReceivablePaid(due.item, verified);
  assert.equal(paid.item.status, 'paid');
  assert.equal(paid.item.signature, SIGNATURE);
  const closed = publicSetupReceivable({ handle: 'mina', action: 'receivable-paid', category: 'exchange', lgmeAmount: 50, signature: SIGNATURE });
  assert.equal(closed.body.status, 'paid');
  const early = reminderDue(due.item, Date.parse('2026-11-11T21:00:00.000Z'));
  assert.equal(early, false);
  const later = reminderDue({ ...due.item, remindedAt: '2026-10-01T21:00:00.000Z' }, Date.parse('2026-12-20T21:00:00.000Z'));
  assert.equal(later, true);
  assert.equal(reminderDue(optOutReminder(due.item), Date.parse('2026-12-20T21:00:00.000Z')), false);
  assert.match(SETUP_COPY, /100% voluntary/);
  assert.match(SETUP_COPY, /never blocks/);
  assert.match(SETUP_COPY, /not an investment/);
  const help = text('help.html');
  assert.equal(help.includes('id="setup-fee-help"'), true);
  assert.match(help, /Get a Solana wallet/);
  assert.match(help, /pump\.fun/);
  assert.match(help, /paste the transaction signature/i);
  assert.equal(text('js/gym-app.mjs').includes("go('/setup')"), true);
  assert.equal(text('api/hedera/listings.mjs').includes('publicSetupReceivable'), true);
  assert.equal(text('api/hedera/listings.mjs').includes("rpc('mainnet-beta'"), true);
});
