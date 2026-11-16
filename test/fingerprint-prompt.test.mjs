import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprintKind, startFingerprintPrompt } from '../js/passkey-signin.mjs';
import { relyingParty } from '../js/webauthn-passkey.mjs';

const root = new URL('..', import.meta.url);

function options(kind) {
  if (kind === 'get') {
    return { challenge: 'AAAA', rpId: 'lgme.app', allowCredentials: [], userVerification: 'required' };
  }
  return {
    challenge: 'AAAA',
    rp: { id: 'lgme.app', name: 'lgme' },
    user: { id: 'AAAA', name: 'member', displayName: 'lgme member' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' }
  };
}

test('a fingerprint tap opens the prompt before any await', async () => {
  const seen = [];
  globalThis.PublicKeyCredential = function PublicKeyCredential() {};
  const credentials = {
    create(value) { seen.push(['create', value]); return Promise.resolve(null); },
    get(value) { seen.push(['get', value]); return Promise.resolve(null); }
  };
  Object.defineProperty(globalThis.navigator, 'credentials', { configurable: true, value: credentials });
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) || '' };
  assert.equal(fingerprintKind(storage), 'create');
  const pending = startFingerprintPrompt({ ok: true, kind: 'create', userId: 'phone', options: options('create') });
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 'create');
  assert.equal(seen[0][1].publicKey.rp.id, 'lgme.app');
  assert.equal(seen[0][1].publicKey.authenticatorSelection.authenticatorAttachment, 'platform');
  assert.equal(seen[0][1].publicKey.authenticatorSelection.userVerification, 'required');
  await pending.catch(() => {});
  storage.setItem = (key, value) => memory.set(key, value);
  memory.set('lgme.passkey.userId', 'phone:device');
  memory.set('lgme.passkey.credentialId', 'cred');
  assert.equal(fingerprintKind(storage), 'get');
  const again = startFingerprintPrompt({ ok: true, kind: 'get', userId: 'phone:device', options: options('get') });
  assert.equal(seen.at(-1)[0], 'get');
  assert.equal(seen.at(-1)[1].publicKey.rpId, 'lgme.app');
  assert.equal(seen.at(-1)[1].publicKey.userVerification, 'required');
  await again.catch(() => {});
  assert.throws(() => startFingerprintPrompt({ ok: false, unavailable: true, message: 'This phone has no fingerprint or screen lock. Use the authenticator code.' }), /authenticator code/);
  assert.equal(relyingParty('lgme.app').rpID, 'lgme.app');
  const home = readFileSync(new URL('js/thumb-home.mjs', root), 'utf8');
  const tap = home.slice(home.indexOf('const tapFingerprint'), home.indexOf('tapFingerprint(board'));
  assert.equal(tap.includes("addEventListener('click', async"), false);
  assert.equal(tap.indexOf('startFingerprintPrompt(ready)') < tap.indexOf('await '), true);
  const gate = home.slice(home.indexOf("gate-passkey').onclick"), home.indexOf("gate-totp-go').onclick"));
  assert.match(gate, /onclick = \(\) =>/);
  assert.equal(gate.indexOf('startFingerprintPrompt(ready)') < gate.indexOf('await '), true);
  const policy = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8'));
  const headers = policy.headers.flatMap((block) => block.headers);
  const permissions = headers.find((header) => header.key === 'Permissions-Policy').value;
  const csp = headers.find((header) => header.key === 'Content-Security-Policy').value;
  assert.match(permissions, /publickey-credentials-get=\(self\)/);
  assert.match(permissions, /publickey-credentials-create=\(self\)/);
  assert.match(csp, /default-src 'self'/);
  assert.equal(csp.includes('publickey-credentials'), false);
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
  assert.equal(manifest.display, 'standalone');
});
