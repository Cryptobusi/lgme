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

test('a new member is announced once in the owner inbox and a repeat is quiet', async () => {
  const store = memory();
  const spec = {
    email: 'ada@example.com',
    phone: '2025550100',
    memberId: 'abc123hash',
    ua: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit Chrome/120.0.0.0 Mobile',
    region: 'US-VA',
    method: 'device',
    category: 'health',
    source: 'invite',
    passkey: true,
    ip: '203.0.113.4'
  };
  const first = await notifyNewMember(store, spec, { now: Date.parse('2026-11-18T15:00:00Z') });
  assert.equal(first.inbox, true);
  assert.equal(first.sent, false);
  const notices = await store.get('owner:signups');
  assert.match(notices[0].detail, /ada@example.com/);
  assert.match(notices[0].detail, /2025550100/);
  assert.match(notices[0].detail, /Android, Chrome, phone, passkey yes/);
  assert.match(notices[0].detail, /America\/New_York/);
  assert.match(notices[0].detail, /UTC/);
  const again = await notifyNewMember(store, spec, {});
  assert.equal(again.duplicate, true);
  assert.equal((await store.get('owner:signups')).length, 1);
  const down = memory();
  const quiet = await notifyNewMember(down, { ...spec, memberId: 'def456hash' }, {});
  assert.equal(quiet.ok, true);
  assert.equal(quiet.sent, false);
  assert.equal(quiet.inbox, true);
  assert.equal(parseDevice(spec.ua).os, 'Android');
  assert.match(signupText(spec), /health/);
  assert.equal(OWNER_COPY_DEFAULT, 'egonomist@mail.grokbot.com');
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /The administrator sees new sign-ups in the owner inbox \(email, phone, device, time\)\. No email is sent\./);
  const source = readFileSync(new URL('../js/owner-alert.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('hedera'), false);
  assert.equal(source.includes('gps'), false);
  assert.equal(source.includes('api.resend.com'), false);
});
