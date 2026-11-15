import test from 'node:test';
import assert from 'node:assert/strict';
import { passkeyRequest } from '../js/webauthn-passkey.mjs';
import { gateDecision } from '../js/confirm-gate.mjs';
import { deviceThumb } from '../js/email-check-core.mjs';
import { generateDeviceKey, signDevice } from '../js/device-sign.mjs';

function memory() {
  const data = new Map();
  return {
    async get(key) { return data.has(key) ? structuredClone(data.get(key)) : null; },
    async set(key, value) { data.set(key, value); }
  };
}

function seed(store) {
  return store.set('webauthn:cred:cred1', {
    id: 'cred1',
    publicKey: Buffer.from('not-a-key').toString('base64url'),
    counter: 0,
    transports: ['internal'],
    userId: 'abcd'
  }).then(() => store.set('webauthn:challenge:abcd', { challenge: 'challenge-1', exp: Date.now() + 60_000 }));
}

test('a fingerprint tap needs a server-verified assertion', async () => {
  assert.equal(gateDecision({ human: true, method: 'passkey' }).ok, false);
  const store = memory();
  const missing = await passkeyRequest({ store, action: 'login', body: {}, host: 'lgme.app' });
  assert.equal(missing.body.ok, false);

  await seed(store);
  const forged = await passkeyRequest({
    store,
    action: 'login',
    host: 'lgme.app',
    body: { emailHash: 'abc123', response: { id: 'cred1', response: { clientDataJSON: 'aa', authenticatorData: 'aa', signature: 'aa' } } }
  });
  assert.equal(forged.body.ok, false);
  const replay = await passkeyRequest({
    store,
    action: 'login',
    host: 'lgme.app',
    body: { emailHash: 'abc123', response: { id: 'cred1', response: { clientDataJSON: 'aa', authenticatorData: 'aa', signature: 'aa' } } },
    verifyAuthentication: async () => ({ verified: true, authenticationInfo: { userVerified: true, newCounter: 2 } })
  });
  assert.equal(replay.body.ok, false);

  await seed(store);
  const blocked = await passkeyRequest({ store, action: 'register', body: { userId: 'abcd:device' }, host: 'lgme.app' });
  assert.equal(blocked.status, 403);
  const key = await generateDeviceKey();
  const thumb = await deviceThumb(key.publicJwk);
  await store.set('email:member:abcd', { verifiedAt: new Date().toISOString(), deviceThumb: thumb });
  const sig = await signDevice(key.privateJwk, { challenge: 'challenge-1', purpose: 'passkey-signin' });
  const valid = await passkeyRequest({
    store,
    action: 'login',
    host: 'lgme.app',
    body: { emailHash: 'abc123', response: { id: 'cred1' }, publicJwk: key.publicJwk, sig },
    verifyAuthentication: async () => ({ verified: true, authenticationInfo: { userVerified: true, newCounter: 2 } })
  });
  assert.equal(valid.body.ok, true);
  assert.equal(valid.body.verified, true);
  assert.equal(gateDecision({ human: true, method: 'passkey', verified: valid.body.verified }).ok, true);
  const tries = await store.get('totp:try:abc123');
  assert.equal(tries.stamps.length >= 1, true);
});
