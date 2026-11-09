import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticationOptions, enrollPasskey, passkeySupported, readCredentialId, registrationOptions, unlockWithPasskey } from '../js/passkey-unlock.mjs';

function memory() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); }
  };
}

test('a passkey enroll stores only the credential id and unlock asks for it', async () => {
  const storage = memory();
  const scope = {
    PublicKeyCredential: function PublicKeyCredential() {},
    crypto: globalThis.crypto,
    location: { hostname: 'lgme.app' },
    navigator: {
      credentials: {
        async create() { return { type: 'public-key', id: 'cred-one' }; },
        async get(options) {
          assert.equal(options.publicKey.rpId, 'lgme.app');
          assert.equal(options.publicKey.allowCredentials.length, 1);
          return { type: 'public-key', id: 'cred-one' };
        }
      }
    }
  };
  assert.equal(passkeySupported(scope), true);
  const saved = await enrollPasskey(scope, storage);
  assert.equal(saved.ok, true);
  assert.equal(readCredentialId(storage), 'cred-one');
  assert.equal(JSON.stringify(registrationOptions(new Uint8Array(32), 'lgme.app')).includes('seed'), false);
  const opened = await unlockWithPasskey(scope, storage);
  assert.equal(opened.ok, true);
  const missing = passkeySupported({});
  assert.equal(missing, false);
  const blocked = await enrollPasskey({}, storage);
  assert.equal(blocked.unsupported, true);
  assert.match(blocked.error, /passphrase/);
});

test('authentication options name PublicKeyCredential inputs without a network', () => {
  const options = authenticationOptions(new Uint8Array([1, 2, 3, 4]), 'lgme.app', 'Y3JlZA');
  assert.equal(options.publicKey.allowCredentials[0].type, 'public-key');
  assert.equal(options.publicKey.allowCredentials[0].id.length > 0, true);
  assert.equal(JSON.stringify(options).includes('http'), false);
});
