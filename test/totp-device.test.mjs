import test from 'node:test';
import assert from 'node:assert/strict';
import { hashEmail, memberKey } from '../js/email-check-core.mjs';
import { ensureDeviceKey, generateDeviceKey, signDevice } from '../js/device-sign.mjs';
import { beginEnrollment, finishEnrollment, issueNonce, resetAuthenticator, signInWithAuthenticator, totpAt } from '../js/totp.mjs';
import { confirmCode } from '../api/lib/email-flow.mjs';

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async set(key, value) { data.set(key, structuredClone(value)); },
    async del(key) { data.delete(key); }
  };
}

const pepper = 'pepper';
const email = 'ada@example.com';

async function enrolled(store, key, now) {
  const emailHash = await hashEmail(email, pepper);
  await store.set(memberKey(emailHash), { emailHash, verifiedAt: new Date(now).toISOString() });
  const started = await beginEnrollment(store, { email, pepper, publicJwk: key.publicJwk, now });
  assert.equal(started.ok, true, started.error);
  const rejected = await finishEnrollment(store, { email, pepper, code: '000000', publicJwk: key.publicJwk, now });
  assert.equal(rejected.ok, false);
  const code = await totpAt(started.secret, now);
  const done = await finishEnrollment(store, { email, pepper, code, publicJwk: key.publicJwk, now });
  assert.equal(done.ok, true, done.error);
  assert.equal(JSON.stringify(done).includes(started.secret), false);
  return started.secret;
}

async function prove(store, key, purpose, now) {
  const nonce = await issueNonce(store, { email, pepper, now });
  const sig = await signDevice(key.privateJwk, { nonce: nonce.nonce, purpose });
  return { nonce: nonce.nonce, sig, publicJwk: key.publicJwk };
}

test('a valid authenticator code is accepted once and a wrong or random code is rejected', async () => {
  const store = memory();
  const key = await generateDeviceKey();
  const now = 1_700_000_000_000;
  const secret = await enrolled(store, key, now);
  const random = await totpAt(secret, now) === '111111' ? '222222' : '111111';
  const later = now + 60_000;
  const proof = await prove(store, key, 'totp-signin', later);
  const bad = await signInWithAuthenticator(store, { email, pepper, code: random, now: later, ip: '203.0.113.5', ...proof });
  assert.equal(bad.ok, false);
  const fresh = await totpAt(secret, later);
  const again = await prove(store, key, 'totp-signin', later);
  const good = await signInWithAuthenticator(store, { email, pepper, code: fresh, now: later, ip: '203.0.113.5', ...again });
  assert.equal(good.ok, true, good.error);
  assert.equal(JSON.stringify(good).includes(secret), false);
  const reusedProof = await prove(store, key, 'totp-signin', later);
  const reused = await signInWithAuthenticator(store, { email, pepper, code: fresh, now: later, ip: '203.0.113.9', ...reusedProof });
  assert.equal(reused.ok, false);
  assert.match(reused.error, /already used/);
});

test('a device mismatch falls back to email and tries are rate limited', async () => {
  const store = memory();
  const key = await generateDeviceKey();
  const other = await generateDeviceKey();
  const now = 1_700_000_030_000;
  const secret = await enrolled(store, key, now);
  const mismatch = await prove(store, other, 'totp-signin', now);
  const refused = await signInWithAuthenticator(store, { email, pepper, code: await totpAt(secret, now), now, ip: '198.51.100.8', ...mismatch });
  assert.equal(refused.ok, false);
  assert.equal(refused.fallback, 'email');
  const limited = memory();
  const limitKey = await generateDeviceKey();
  const limitSecret = await enrolled(limited, limitKey, now);
  for (let i = 0; i < 5; i += 1) {
    const proof = await prove(limited, limitKey, 'totp-signin', now + i);
    const attempt = await signInWithAuthenticator(limited, { email, pepper, code: '000000', now: now + i, ip: '198.51.100.9', ...proof });
    assert.equal(attempt.ok, false);
  }
  const blockedProof = await prove(limited, limitKey, 'totp-signin', now + 6);
  const blocked = await signInWithAuthenticator(limited, { email, pepper, code: await totpAt(limitSecret, now + 6), now: now + 6, ip: '198.51.100.9', ...blockedProof });
  assert.equal(blocked.status, 429);
  const reset = await resetAuthenticator(limited, { email, code: '123456', pepper, now }, async () => ({ ok: true, emailHash: await hashEmail(email, pepper) }));
  assert.equal(reset.ok, true);
  assert.equal(JSON.stringify(reset).includes(limitSecret), false);
  assert.equal(typeof confirmCode, 'function');
  assert.equal(typeof ensureDeviceKey, 'function');
});
