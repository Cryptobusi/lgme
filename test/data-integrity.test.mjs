import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { healthChainMessage, healthExamplePosts } from '../js/health-examples.mjs';
import { check, fields, listingTransition, originAllowed, parseStrictJson, ROUTES } from '../js/input-schema.mjs';
import { TRADE_TYPES, tradeMove } from '../js/trade-types.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const attacks = [
  '', null, undefined, 1, 0, -1, 1e309, Number.NaN, true, false, [], {},
  'a'.repeat(5000), '<script>alert(1)</script>', '<svg onload=alert(1)>',
  "'; DROP TABLE users;--", '{"$gt":""}', '$(whoami)', '../etc/passwd',
  '__proto__', 'constructor', 'prototype', '🙂', 'مرحبا', '\u202e', '\u0000',
  '0.0.not', 'not-an-email', '0'.repeat(80)
];

test('strict JSON and field schemas reject hostile input', () => {
  let cases = 0;
  assert.equal(parseStrictJson('{"a":1,"a":2}').ok, false);
  assert.equal(parseStrictJson('{"__proto__":{"admin":true}}').ok, false);
  assert.equal(parseStrictJson('{"ok":true}').ok, true);
  cases += 3;
  for (const name of ['handle', 'email', 'code', 'invite', 'hash', 'hedera', 'day']) {
    for (const attack of attacks) {
      cases += 1;
      const result = check(attack, { ...fields[name], required: true }, name);
      const valid = result.ok === true && fields[name].pattern.test(String(attack || ''));
      if (!valid) assert.equal(result.ok, false, `${name} accepted ${JSON.stringify(attack)}`);
    }
  }
  assert.equal(check('ada-1', fields.handle, 'handle').ok, true);
  assert.equal(check('person@school.edu', fields.email, 'email').ok, true);
  assert.equal(check('0.0.11397293', fields.hedera, 'hedera').ok, true);
  assert.equal(check({ email: 'a@b.co', extra: 1 }, { type: 'object', keys: { email: fields.email }, required: ['email'] }).ok, false);
  cases += 4;
  assert.equal(originAllowed(''), true);
  assert.equal(originAllowed('https://lgme.app'), true);
  assert.equal(originAllowed('https://evil.example'), false);
  cases += 3;
  assert.equal(cases > 150, true);
});

test('listing transitions reject illegal moves and allow a claim', () => {
  const stages = ['Test item - unclaimed', 'Test item - matched', 'Test item - confirmed', 'Test item - receipt', 'Test item - declined', 'Test item - cancelled', 'Test item - open', 'Claimed by mina-vale'];
  let cases = 0;
  for (const from of stages) {
    for (const to of stages) {
      cases += 1;
      const result = listingTransition(from, to);
      const backward = rank(to) > 0 && rank(from) > rank(to) && !to.startsWith('Claimed by');
      const closed = /declined|cancelled/.test(from) && from !== to && !to.startsWith('Claimed by');
      const claimed = from.startsWith('Claimed by') && from !== to;
      if (backward || closed || claimed) assert.equal(result.ok, false, `${from} -> ${to}`);
      if (from === to) assert.equal(result.ok, true, from);
    }
  }
  for (const from of TRADE_TYPES) {
    for (const to of TRADE_TYPES) {
      cases += 1;
      const result = tradeMove(from, to);
      if (from === to) assert.equal(result.ok, true, `${from} -> ${to}`);
      if (from === 'declined' && to !== 'declined') assert.equal(result.ok, false);
      if (from === 'disputed-open' && to !== 'disputed-open' && to !== 'disputed-resolved') assert.equal(result.ok, false);
      if (to === 'pool-sponsored' && !['confirmed', 'receipt', 'pool-sponsored'].includes(from)) assert.equal(result.ok, false, `${from} -> pool`);
    }
  }
  assert.equal(tradeMove('listed', 'circle-rsvp').ok, true);
  assert.equal(tradeMove('circle-rsvp', 'circle-checkin').ok, true);
  assert.equal(tradeMove('circle-checkin', 'attester-suggest').ok, true);
  assert.equal(tradeMove('confirmed', 'self-paid').ok, true);
  assert.equal(tradeMove('receipt', 'pool-sponsored').ok, true);
  assert.equal(tradeMove('partial', 'receipt').ok, true);
  assert.equal(tradeMove('repeat', 'listed').ok, true);
  assert.equal(tradeMove('cancelled', 'expired').ok, true);
  assert.equal(tradeMove('disputed-resolved', 'listed').ok, false);
  assert.equal(listingTransition('Test item - unclaimed', 'Claimed by mina-vale').ok, true);
  assert.equal(listingTransition('', 'Test item - unclaimed').ok, true);
  assert.equal(listingTransition('Test item - declined', 'Test item - declined').ok, true);
  assert.equal(cases, stages.length * stages.length + TRADE_TYPES.length * TRADE_TYPES.length);
});

test('chain payloads, email codes, and headers do not leak personal data', async () => {
  const posts = await healthExamplePosts();
  for (const row of posts) {
    const text = JSON.stringify(row.chain);
    assert.equal(text.includes('@'), false);
    assert.equal(text.includes(row.title), false);
    assert.equal(/name|email|symptom|diagnosis/i.test(text), false);
    const again = healthChainMessage(row.chain);
    assert.equal(again.ok, true);
    assert.equal(again.body.receiptHash, row.chain.receiptHash);
  }
  const flow = readFileSync(join(root, 'api/lib/email-flow.mjs'), 'utf8');
  assert.equal(flow.includes('hashCode'), true);
  assert.equal(flow.includes('store.set(codeKey'), true);
  const headers = readFileSync(join(root, 'vercel.json'), 'utf8');
  assert.equal(headers.includes("script-src 'self' 'wasm-unsafe-eval'"), true);
  assert.equal(headers.includes('max-age=31536000'), true);
  assert.equal(headers.includes('nosniff'), true);
  assert.equal(headers.includes("frame-ancestors 'none'"), true);
  assert.equal(headers.includes('strict-origin-when-cross-origin'), true);
  const personal = readFileSync(join(root, 'js/health-dashboard.mjs'), 'utf8');
  assert.equal(personal.includes('fetch('), false);
  assert.equal(ROUTES.length >= 17, true);
});

function rank(status) {
  if (status.startsWith('Claimed by')) return 9;
  if (/receipt/.test(status)) return 4;
  if (/confirmed/.test(status)) return 3;
  if (/matched/.test(status)) return 2;
  if (/unclaimed|open/.test(status)) return 1;
  return 0;
}
