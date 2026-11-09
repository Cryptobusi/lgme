const STORAGE_KEY = 'lgme.passkey.credentialId';

export function passkeySupported(scope = globalThis) {
  return typeof scope.PublicKeyCredential === 'function'
    && !!scope.navigator?.credentials?.create
    && !!scope.navigator?.credentials?.get;
}

export function readCredentialId(storage) {
  try { return storage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

export function writeCredentialId(storage, id) {
  storage.setItem(STORAGE_KEY, String(id || ''));
}

function bytesToBase64Url(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function registrationOptions(challenge, hostname) {
  return {
    publicKey: {
      rp: { id: hostname, name: 'lgme' },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: 'member',
        displayName: 'lgme member'
      },
      challenge,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required'
      },
      timeout: 60000,
      attestation: 'none'
    }
  };
}

export function authenticationOptions(challenge, hostname, credentialId) {
  return {
    publicKey: {
      challenge,
      rpId: hostname,
      allowCredentials: credentialId ? [{ type: 'public-key', id: base64UrlToBytes(credentialId) }] : [],
      userVerification: 'required',
      timeout: 60000
    }
  };
}

export const PASSKEY_FALLBACK = 'This browser has no passkey. Use the passphrase and the 6-digit code. Google and email: later.';
export const PASSKEY_COPY = 'A passkey shows this is your device. The phone asks for fingerprint, face, or its PIN. This browser stores only the credential id. It does not hold a key or a seed, and it sends nothing. The passphrase still locks the book. Google and email: later.';

export async function enrollPasskey(scope = globalThis, storage = scope.localStorage) {
  if (!passkeySupported(scope)) return { ok: false, unsupported: true, error: PASSKEY_FALLBACK };
  const challenge = scope.crypto.getRandomValues(new Uint8Array(32));
  const hostname = scope.location?.hostname || 'localhost';
  let created;
  try {
    created = await scope.navigator.credentials.create(registrationOptions(challenge, hostname));
  } catch (error) {
    return { ok: false, error: 'The device did not save a passkey. Use the passphrase and the 6-digit code.' };
  }
  if (!created || created.type !== 'public-key' || !created.id) {
    return { ok: false, error: 'The device did not save a passkey. Use the passphrase and the 6-digit code.' };
  }
  writeCredentialId(storage, created.id);
  return { ok: true, credentialId: created.id };
}

export async function unlockWithPasskey(scope = globalThis, storage = scope.localStorage) {
  if (!passkeySupported(scope)) return { ok: false, unsupported: true, error: PASSKEY_FALLBACK };
  const credentialId = readCredentialId(storage);
  if (!credentialId) return { ok: false, missing: true, error: 'Save a passkey on this device first.' };
  const challenge = scope.crypto.getRandomValues(new Uint8Array(32));
  const hostname = scope.location?.hostname || 'localhost';
  let got;
  try {
    got = await scope.navigator.credentials.get(authenticationOptions(challenge, hostname, credentialId));
  } catch (error) {
    return { ok: false, error: 'The device did not unlock. Use the passphrase and the 6-digit code.' };
  }
  if (!got || got.type !== 'public-key') {
    return { ok: false, error: 'The device did not unlock. Use the passphrase and the 6-digit code.' };
  }
  return { ok: true, credentialId: got.id || credentialId };
}
