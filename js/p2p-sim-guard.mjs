export const ACK_MS = 10 * 60 * 1000;
export const CHAIN_CAP = 8;
export const CO_SIGN_ABOVE = 50;
export const OFFLINE_SPEND = 'Offline is read-only. Open the books, but do not spend, until this browser is online.';
export const STALE_ACK = 'This acknowledgement is stale.';
export const REPLAY = 'Replay rejected.';
export const FORK = 'Fork. The same serial has two next owners.';
export const PASSKEY_WORDING = 'fingerprint / face / device PIN (your phone decides)';

export function assertOnline(nav = globalThis.navigator) {
  if (nav && nav.onLine === false) return { ok: false, error: OFFLINE_SPEND };
  return { ok: true };
}

export function expiryFrom(at, ms = ACK_MS) {
  return new Date(new Date(at).getTime() + ms).toISOString();
}

export function ackFresh(exp, at) {
  if (!exp) return false;
  return new Date(at).getTime() <= new Date(exp).getTime();
}

export function coSignReason(amount, thirdSeatSig) {
  if (Number(amount) > CO_SIGN_ABOVE && !thirdSeatSig) {
    return `Amounts above ${CO_SIGN_ABOVE} $lgme need a third-seat co-sign.`;
  }
  return '';
}

export function passphraseReason(passphrase) {
  const text = String(passphrase || '');
  if (text.length < 8) return 'Use a passphrase of at least 8 characters.';
  if (/^\d+$/.test(text)) return 'Use a passphrase, not a short PIN.';
  return '';
}

export function passkeyCreationOptions(userId, userName, challenge) {
  const bytes = new TextEncoder().encode(String(userId || 'member'));
  return {
    publicKey: {
      rp: { id: 'lgme.app', name: 'lgme' },
      user: { id: bytes, name: userName || 'member', displayName: userName || 'member' },
      challenge,
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred'
      },
      attestation: 'none',
      extensions: { prf: { eval: { first: new Uint8Array(32).fill(1) } } }
    }
  };
}

export async function wrapDekWithPrf(prfBytes) {
  const dek = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey('raw', new Uint8Array(prfBytes), 'HKDF', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('lgme-wallet-dek') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dek);
  return {
    dek,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    wrapped: bytesToHex(new Uint8Array(wrapped))
  };
}

export async function openDekWithPrf(prfBytes, sealed) {
  const base = await crypto.subtle.importKey('raw', new Uint8Array(prfBytes), 'HKDF', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: hexToBytes(sealed.salt), info: new TextEncoder().encode('lgme-wallet-dek') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(sealed.iv) }, kek, hexToBytes(sealed.wrapped));
  return new Uint8Array(clear);
}

export async function recoveryCodes() {
  const codes = [];
  const hashes = [];
  for (let i = 0; i < 8; i++) {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    const code = bytesToHex(bytes);
    codes.push(code);
    hashes.push(await sha256Hex(code));
  }
  return { codes, hashes };
}

export async function redeemRecovery(hashes, code) {
  const hash = await sha256Hex(String(code || '').trim());
  const index = (hashes || []).indexOf(hash);
  if (index < 0) return { ok: false, error: 'That recovery code is not valid.' };
  const next = hashes.slice();
  next.splice(index, 1);
  return { ok: true, hashes: next };
}

export async function sealJson(rawKey, value) {
  const key = rawKey instanceof CryptoKey
    ? rawKey
    : await crypto.subtle.importKey('raw', new Uint8Array(rawKey), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return { iv: bytesToHex(iv), ciphertext: bytesToHex(new Uint8Array(cipher)) };
}

export async function openJson(rawKey, sealed) {
  const key = rawKey instanceof CryptoKey
    ? rawKey
    : await crypto.subtle.importKey('raw', new Uint8Array(rawKey), 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(sealed.iv) }, key, hexToBytes(sealed.ciphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}

export async function importNonExtractable(privateKeyJwk) {
  return crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

export function createMemoryVault() {
  const keys = new Map();
  const meta = new Map();
  return {
    async put(id, key) { keys.set(id, key); },
    async get(id) { return keys.get(id) || null; },
    async putMeta(id, key) { meta.set(id, key); },
    async getMeta(id) { return meta.get(id) || null; }
  };
}

export function createIndexedDbVault() {
  const open = () => new Promise((resolve, reject) => {
    const request = indexedDB.open('lgme-sim-vault', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('keys')) db.createObjectStore('keys');
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const run = async (storeName, mode, fn) => {
    const db = await open();
    try {
      const tx = db.transaction(storeName, mode);
      const finished = new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error('The vault transaction failed.'));
        tx.onabort = () => reject(tx.error || new Error('The vault transaction aborted.'));
      });
      const result = await fn(tx.objectStore(storeName));
      await finished;
      return result;
    } finally {
      db.close();
    }
  };
  return {
    async put(id, key) { await run('keys', 'readwrite', (store) => requestOf(store.put(key, id))); },
    async get(id) { return run('keys', 'readonly', (store) => requestOf(store.get(id))); },
    async putMeta(id, key) { await run('meta', 'readwrite', (store) => requestOf(store.put(key, id))); },
    async getMeta(id) { return run('meta', 'readonly', (store) => requestOf(store.get(id))); }
  };
}

function requestOf(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result === undefined ? null : request.result);
    request.onerror = () => reject(request.error);
  });
}

export function fraudPenalty(peer) {
  return (peer?.tape || []).filter((entry) => entry.type === 'FRAUD_PROOF' && entry.payload?.cheaterId === peer.id).length;
}

export function handoffToken(nonce) {
  return `lgme1q.${String(nonce || '').slice(0, 22)}`;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}
