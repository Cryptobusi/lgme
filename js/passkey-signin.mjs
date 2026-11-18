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
  const Cred = scope.PublicKeyCredential;
  if (typeof Cred !== 'function' || typeof Cred.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
  if (!browserSupportsWebAuthn()) return false;
  try { return await Cred.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return await platformAuthenticatorIsAvailable(); }
}

function escapeGuide(value) {
  return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

export function fingerprintErrorLine(error) {
  const name = error?.name || error?.cause?.name || '';
  const message = String(error?.message || error?.cause?.message || '');
  if (error?.code === 'missing' || /no passkey|no fingerprint is saved/i.test(message)) return 'No passkey on this phone yet.';
  if (name === 'NotSupportedError' || /not supported/i.test(message)) return 'Fingerprint is not supported on this phone.';
  if (name === 'SecurityError' || /rp id|invalid for this domain|wrong domain/i.test(message)) return 'Wrong domain. Open https://lgme.app and try again.';
  if (name === 'TimeoutError' || name === 'AbortError' || /^timeout/i.test(message)) return 'The fingerprint check timed out.';
  if (name === 'NotAllowedError') return error?.kind === 'get' ? 'No passkey on this phone yet.' : 'Cancelled.';
  if (name === 'InvalidStateError') return 'A fingerprint is already saved on this phone. Try again to unlock.';
  return message || 'The fingerprint prompt did not open.';
}

export function fingerprintGuideHtml(step, detail = '', extra = {}) {
  const labels = [
    'Tap the button',
    'Touch the sensor when your phone asks',
    'Checking',
    step === 'fail' ? (detail || 'The fingerprint prompt did not open.') : 'Signed in'
  ];
  const current = step === 'ok' || step === 'fail' ? 4 : Number(step) || 1;
  const items = labels.map((label, index) => {
    const n = index + 1;
    let cls = '';
    if (n === current && step === 'fail') cls = 'is-failed';
    else if ((n === current && step === 'ok') || (n < current && step !== 'fail')) cls = 'is-done';
    else if (n === current) cls = 'is-current';
    const text = `${n} ${label}`;
    return `<li class="${cls}"><i></i><span>${escapeGuide(text)}</span></li>`;
  }).join('');
  const again = step === 'fail' ? '<button type="button" class="fingerprint-again">Try again</button>' : '';
  const setup = extra.setup ? '<button type="button" class="fingerprint-setup">Set up fingerprint</button>' : '';
  return `<ol class="fingerprint-steps">${items}</ol>${setup}${again}`;
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

function preferredOptions(options, kind) {
  const next = { ...options };
  if (kind === 'get') {
    next.userVerification = 'preferred';
    next.rpId = next.rpId || 'lgme.app';
    return next;
  }
  next.rp = { ...(options.rp || {}), id: options.rp?.id || 'lgme.app', name: options.rp?.name || 'lgme' };
  next.authenticatorSelection = {
    ...(options.authenticatorSelection || {}),
    authenticatorAttachment: 'platform',
    residentKey: options.authenticatorSelection?.residentKey || 'preferred',
    userVerification: 'preferred'
  };
  return next;
}

function domainError(id) {
  if (!id || id === 'lgme.app' || id === 'localhost') return null;
  const error = new Error('Wrong domain. Open https://lgme.app and try again.');
  error.name = 'SecurityError';
  return error;
}

export function startFingerprintPrompt(prepared) {
  if (!prepared?.ok || !prepared.options?.challenge) {
    const error = new Error(prepared?.message || TAP_AGAIN);
    error.code = prepared?.code || (prepared?.unavailable ? 'unavailable' : 'wait');
    throw error;
  }
  const kind = prepared.kind === 'get' ? 'get' : 'create';
  const options = preferredOptions(prepared.options, kind);
  const rpId = kind === 'get' ? options.rpId : options.rp?.id;
  const wrong = domainError(rpId);
  if (wrong) throw wrong;
  if (kind === 'get' && !(options.allowCredentials || []).length) {
    const error = new Error('No passkey on this phone yet.');
    error.code = 'missing';
    error.kind = 'get';
    throw error;
  }
  const run = kind === 'get'
    ? startAuthentication({ optionsJSON: options })
    : startRegistration({ optionsJSON: options });
  return run.then((response) => ({ kind, response, userId: prepared.userId, options })).catch((error) => {
    const failed = error instanceof Error ? error : new Error('The fingerprint prompt did not open.');
    failed.kind = kind;
    if (!failed.name && error?.name) failed.name = error.name;
    throw failed;
  });
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
