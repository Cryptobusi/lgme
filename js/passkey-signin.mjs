import { startAuthentication, startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from './vendor/simplewebauthn-browser/index.js';
import { readCredentialId, writeCredentialId } from './passkey-unlock.mjs';
import { saveDemo } from './demo-onboard.mjs';
import { saveEmailSession } from './health-email.mjs';
import { ensureDeviceKey } from './device-sign.mjs';

const USER_KEY = 'lgme.passkey.userId';

export async function fingerprintSupported(scope = globalThis) {
  if (!browserSupportsWebAuthn()) return false;
  try { return await platformAuthenticatorIsAvailable(); } catch { return false; }
}

export function passkeyUserId(emailHash, x) {
  const hash = String(emailHash || 'phone').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'phone';
  const device = String(x || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
  return device ? `${hash}:${device}` : hash;
}

async function post(action, extra) {
  const response = await fetch('/api/webauthn', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, ...extra })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) throw new Error(body.error || 'The fingerprint was not accepted.');
  return body;
}

async function currentUser() {
  const key = await ensureDeviceKey(localStorage);
  let emailHash = 'phone';
  try { emailHash = JSON.parse(localStorage.getItem('lgme.demo.member') || '{}').emailHash || 'phone'; } catch { /* phone */ }
  return passkeyUserId(emailHash, key.publicJwk.x);
}

export async function registerFingerprint() {
  const userId = await currentUser();
  const options = await post('register-options', { userId });
  const response = await startRegistration({ optionsJSON: options.options });
  const saved = await post('register', { userId, response });
  writeCredentialId(localStorage, saved.credentialId);
  localStorage.setItem(USER_KEY, userId);
  return saved;
}

export async function unlockFingerprint() {
  const userId = localStorage.getItem(USER_KEY) || '';
  if (!userId || !readCredentialId(localStorage)) throw new Error('No fingerprint is saved on this phone.');
  const options = await post('login-options', { userId });
  const response = await startAuthentication({ optionsJSON: options.options });
  const saved = await post('login', { response });
  const key = await ensureDeviceKey(localStorage);
  const hash = saved.userId.split(':')[0] || 'phone';
  saveDemo(localStorage, { emailHash: hash, disclaimer: true });
  saveEmailSession(localStorage, { email: '', emailHash: hash, x: key.publicJwk.x, y: key.publicJwk.y });
  localStorage.setItem('lgme-gym.seat', 'demo');
  return saved;
}

export async function removeFingerprint() {
  const userId = localStorage.getItem(USER_KEY) || await currentUser();
  await post('remove', { userId });
  writeCredentialId(localStorage, '');
  localStorage.removeItem(USER_KEY);
}
