import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OWNER_COPY_DEFAULT, notifyNewMember, parseDevice, signupText } from '../js/owner-alert.mjs';

function memory() {
  const bag = new Map();
  return {
    async get(key) { return bag.has(key) ? bag.get(key) : null; },
    async set(key, value) { bag.set(key, value); }
  };
}

test('a new member is announced once and a repeat is quiet', async () => {
  const store = memory();
  const sent = [];
  const env = { OWNER_NOTIFY_EMAIL: 'owner@example.test', OWNER_COPY_EMAIL: 'copy@example.test', RESEND_API_KEY: 'secret-key', EMAIL_FROM: 'desk@lgme.app' };
  const fetchImpl = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true };
  };
  const spec = {
    email: 'ada@example.com',
    phone: '2025550100',
    memberId: 'abc123hash',
    ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120.0.0.0 Mobile',
    region: 'US-VA',
    method: 'email',
    category: 'health',
    source: 'invite',
    passkey: true,
    ip: '203.0.113.4'
  };
  const first = await notifyNewMember(store, spec, { env, fetchImpl, now: Date.parse('2026-11-18T15:00:00Z') });
  assert.equal(first.sent, true);
  assert.equal(sent[0].to, 'owner@example.test');
  assert.equal(sent[0].cc, 'copy@example.test');
  assert.match(sent[0].text, /ada@example.com/);
  assert.match(sent[0].text, /Android, Chrome, phone, passkey yes/);
  assert.match(sent[0].text, /America\/New_York/);
  assert.match(sent[0].text, /UTC/);
  assert.equal(JSON.stringify(first).includes('secret-key'), false);
  const again = await notifyNewMember(store, spec, { env, fetchImpl });
  assert.equal(again.duplicate, true);
  assert.equal(sent.length, 1);
  const down = memory();
  const quiet = await notifyNewMember(down, { ...spec, memberId: 'def456hash' }, { env, fetchImpl: async () => { throw new Error('down'); } });
  assert.equal(quiet.ok, true);
  assert.equal(quiet.sent, false);
  assert.equal(parseDevice(spec.ua).os, 'Android');
  assert.match(signupText(spec), /health/);
  assert.equal(OWNER_COPY_DEFAULT, 'egonomist@mail.grokbot.com');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /The administrator is notified of new sign-ups \(email, phone, device, time\)\./);
  const source = readFileSync(new URL('../js/owner-alert.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('hedera'), false);
  assert.equal(source.includes('gps'), false);
});
