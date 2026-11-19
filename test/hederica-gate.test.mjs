import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeCode } from '../js/email-check-core.mjs';
import { gateCors, readGateToken, signGateToken, startGate, verifyGate } from '../js/gate-core.mjs';

function memory() {
  const bag = new Map();
  return {
    async get(key) { return bag.has(key) ? bag.get(key) : null; },
    async set(key, value) { bag.set(key, value); },
    async del(key) { bag.delete(key); }
  };
}

test('the Hederica gate sends one code and a 30 day token', async () => {
  assert.equal(gateCors('https://hederica.com').ok, true);
  assert.equal(gateCors('https://www.hederica.com').ok, true);
  assert.equal(gateCors('https://evil.example').ok, false);
  const store = memory();
  const pepper = 'pepper';
  const code = '123456';
  let mailed = 0;
  const started = await startGate(store, {
    email: 'ada@hederica.com',
    site: 'hederica',
    now: 1_000,
    ip: '203.0.113.8',
    pepper,
    code,
    send: async () => { mailed += 1; return { ok: true }; }
  });
  assert.equal(started.ok, true);
  assert.equal(mailed, 1);
  const env = { OWNER_NOTIFY_EMAIL: 'owner@example.test', RESEND_API_KEY: 'secret-key', EMAIL_FROM: 'desk@lgme.app' };
  const notes = [];
  const verified = await verifyGate(store, { email: 'ada@hederica.com', code, pepper, ip: '203.0.113.8' }, {
    env,
    now: 2_000,
    headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile', 'x-vercel-ip-country': 'US' },
    fetchImpl: async (_url, init) => { notes.push(JSON.parse(init.body)); return { ok: true }; }
  });
  assert.equal(verified.ok, true);
  assert.equal(JSON.stringify(verified).includes('secret-key'), false);
  assert.equal(notes.length, 0);
  const notices = await store.get('owner:signups');
  assert.match(notices[0].detail, /ada@hederica.com/);
  assert.match(notices[0].detail, /hederica.com/);
  const open = await readGateToken(verified.token, pepper, 2_000);
  assert.equal(open.ok, true);
  const later = await readGateToken(verified.token, pepper, 2_000 + 31 * 24 * 60 * 60 * 1000);
  assert.equal(later.ok, false);
  const repeat = await verifyGate(store, { email: 'ada@hederica.com', code: makeCode(), pepper }, { env, now: 3_000, headers: {}, fetchImpl: async () => ({ ok: true }) });
  assert.equal(repeat.ok, false);
  const snippet = readFileSync(new URL('../hederica-gate-snippet.html', import.meta.url), 'utf8');
  assert.match(snippet, /Email is disabled\. The gate is off\./);
  assert.match(snippet, /lgme\.hederica\.gate/);
  assert.equal(readFileSync(new URL('../js/gate-core.mjs', import.meta.url), 'utf8').includes('/api/hedera'), false);
});
