import test from 'node:test';
import assert from 'node:assert/strict';
import { emailReadiness, hashCode, isCampusEmail, makeCode, normalizeEmail } from '../js/email-check-core.mjs';
import { confirmCode, requestCode } from '../api/lib/email-flow.mjs';

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async set(key, value) { data.set(key, structuredClone(value)); },
    async del(key) { data.delete(key); }
  };
}

test('the email check stays off until the provider and store are named', () => {
  const ready = emailReadiness({});
  assert.equal(ready.enabled, false);
  for (const name of ['EMAIL_CHECK=on', 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_CODE_PEPPER', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    assert.equal(ready.missing.includes(name), true, name);
  }
  assert.equal(emailReadiness({
    EMAIL_CHECK: 'on',
    RESEND_API_KEY: 'k',
    EMAIL_FROM: 'desk@lgme.app',
    EMAIL_CODE_PEPPER: 'pepper',
    UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
    UPSTASH_REDIS_REST_TOKEN: 't'
  }).enabled, true);
});

test('a campus address is marked once and the code is stored only as a hash', async () => {
  assert.equal(normalizeEmail('  Ada@School.EDU '), 'ada@school.edu');
  assert.equal(normalizeEmail('not an email'), '');
  assert.equal(isCampusEmail('ada@school.edu', []), true);
  assert.equal(isCampusEmail('ada@coop.test', ['coop.test']), true);
  assert.equal(isCampusEmail('ada@gmail.com', []), false);
  const code = makeCode(new Uint8Array([0, 0, 0, 42]));
  assert.match(code, /^\d{6}$/);
  const hash = await hashCode(code, 'pepper');
  assert.notEqual(hash, code);
  const store = memory();
  const sent = [];
  const first = await requestCode(store, {
    email: 'Ada@School.EDU',
    now: 1_000,
    pepper: 'pepper',
    code: '123456',
    send: async (email, value) => { sent.push([email, value]); return { ok: true }; }
  });
  assert.equal(first.ok, true);
  assert.deepEqual(sent, [['ada@school.edu', '123456']]);
  const saved = await store.get('email:code:ada@school.edu');
  assert.equal(saved.hash, await hashCode('123456', 'pepper'));
  assert.equal(JSON.stringify(saved).includes('123456'), false);
  const verified = await confirmCode(store, { email: 'ada@school.edu', code: '123456', now: 2_000, pepper: 'pepper' });
  assert.equal(verified.ok, true);
  assert.equal(verified.member, 'new');
  assert.equal(verified.campusVerified, true);
  const again = await requestCode(store, {
    email: 'ada@school.edu', now: 80_000, pepper: 'pepper', code: '654321', send: async () => ({ ok: true })
  });
  assert.equal(again.ok, true);
  const second = await confirmCode(store, { email: 'ada@school.edu', code: '654321', now: 81_000, pepper: 'pepper' });
  assert.equal(second.member, 'existing');
  assert.equal(second.campusVerified, true);
  const member = await store.get('email:member:ada@school.edu');
  assert.deepEqual(Object.keys(member).sort(), ['campusVerified', 'clubVerified', 'email', 'verifiedAt']);
  assert.equal(member.clubVerified, false);
});

test('a code expires, a wrong code does not verify, and sends are rate limited', async () => {
  const store = memory();
  await requestCode(store, { email: 'a@b.co', now: 0, pepper: 'pepper', code: '111111', send: async () => ({ ok: true }) });
  const expired = await confirmCode(store, { email: 'a@b.co', code: '111111', now: 11 * 60 * 1000, pepper: 'pepper' });
  assert.match(expired.error, /expired/);
  const again = memory();
  await requestCode(again, { email: 'a@b.co', now: 0, pepper: 'pepper', code: '111111', send: async () => ({ ok: true }) });
  const wrong = await confirmCode(again, { email: 'a@b.co', code: '222222', now: 1000, pepper: 'pepper' });
  assert.equal(wrong.ok, false);
  const soon = await requestCode(again, { email: 'a@b.co', now: 2000, pepper: 'pepper', code: '333333', send: async () => ({ ok: true }) });
  assert.equal(soon.status, 429);
});
