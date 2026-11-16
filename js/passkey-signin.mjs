import { startAuthentication, startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from './vendor/simplewebauthn-browser/index.js';
import { readCredentialId, writeCredentialId } from './passkey-unlock.mjs';
import { saveDemo } from './demo-onboard.mjs';
import { saveEmailSession } from './health-email.mjs';
import { ensureDeviceKey, signDevice } from './device-sign.mjs';

const USER_KEY = 'lgme.passkey.userId';
export const NO_FINGERPRINT = 'This phone has no fingerprint or screen lock. Use the authenticator code.';
const TAP_AGAIN = 'Tap again to show the fingerprint prompt. Or use the authenticator code.';

export function fingerprintKind(storage) {
  return storage.getItem(USER_KEY) && readCredentialId(storage) ? 'get' : 'create';
}

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

export async function prepareFingerprintPrompt(storage = localStorage) {
  const available = await fingerprintSupported();
  if (!available) return { ok: false, unavailable: true, message: NO_FINGERPRINT };
  const userId = await currentUser();
  const kind = fingerprintKind(storage);
  try {
    const body = await post(kind === 'get' ? 'login-options' : 'register-options', { userId });
    if (!body.options?.challenge) return { ok: false, message: TAP_AGAIN };
    return { ok: true, kind, userId, options: body.options };
  } catch (error) {
    if (kind === 'get') {
      try {
        const body = await post('register-options', { userId });
        if (!body.options?.challenge) return { ok: false, message: TAP_AGAIN };
        return { ok: true, kind: 'create', userId, options: body.options };
      } catch (next) {
        return { ok: false, message: `${next.message} Use the authenticator code.` };
      }
    }
    return { ok: false, message: `${error.message} Use the authenticator code.` };
  }
}

export function startFingerprintPrompt(prepared) {
  if (!prepared?.ok || !prepared.options?.challenge) {
    const error = new Error(prepared?.message || TAP_AGAIN);
    error.code = prepared?.unavailable ? 'unavailable' : 'wait';
    throw error;
  }
  const run = prepared.kind === 'get'
    ? startAuthentication({ optionsJSON: prepared.options })
    : startRegistration({ optionsJSON: prepared.options });
  return run.then((response) => ({ kind: prepared.kind === 'get' ? 'get' : 'create', response, userId: prepared.userId, options: prepared.options }));
}

export async function finishFingerprintPrompt(started, emailHash = '') {
  if (started.kind === 'create') {
    const saved = await post('register', { userId: started.userId, response: started.response });
    writeCredentialId(localStorage, saved.credentialId);
    localStorage.setItem(USER_KEY, started.userId);
    return saved;
  }
  const key = await ensureDeviceKey(localStorage);
  const sig = await signDevice(key.privateJwk, { challenge: started.options.challenge, purpose: 'passkey-signin' });
  return post('login', { response: started.response, emailHash, publicJwk: key.publicJwk, sig });
}

export async function rememberFingerprintUnlock(saved) {
  const key = await ensureDeviceKey(localStorage);
  const hash = String(saved?.userId || '').split(':')[0] || 'phone';
  saveDemo(localStorage, { emailHash: hash, disclaimer: true });
  saveEmailSession(localStorage, { email: '', emailHash: hash, x: key.publicJwk.x, y: key.publicJwk.y });
  localStorage.setItem('lgme-gym.seat', 'demo');
  return saved;
}

export async function registerFingerprint(prepared) {
  const ready = prepared?.kind === 'create' && prepared.options?.challenge
    ? prepared
    : await prepareFingerprintPrompt();
  const started = await startFingerprintPrompt({ ...ready, kind: 'create' });
  return finishFingerprintPrompt(started);
}

export async function confirmFingerprint(emailHash = '') {
  const userId = localStorage.getItem(USER_KEY) || '';
  if (!userId || !readCredentialId(localStorage)) {
    const error = new Error('No fingerprint is saved on this phone.');
    error.code = 'missing';
    throw error;
  }
  const options = await post('login-options', { userId });
  const response = await startAuthentication({ optionsJSON: options.options });
  const key = await ensureDeviceKey(localStorage);
  const sig = await signDevice(key.privateJwk, { challenge: options.options.challenge, purpose: 'passkey-signin' });
  return post('login', { response, emailHash, publicJwk: key.publicJwk, sig });
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
