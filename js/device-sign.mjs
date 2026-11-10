const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

export function canonicalDevice(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalDevice(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalDevice(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function publicDeviceJwk(jwk = {}) {
  return { kty: 'EC', crv: 'P-256', x: String(jwk.x || ''), y: String(jwk.y || '') };
}

export function sameDeviceKey(left, right) {
  const a = publicDeviceJwk(left);
  const b = publicDeviceJwk(right);
  return Boolean(a.x && a.y && a.x === b.x && a.y === b.y);
}

function bytesToB64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function b64ToBytes(text) {
  const raw = atob(String(text || ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function generateDeviceKey() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = publicDeviceJwk(await crypto.subtle.exportKey('jwk', pair.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk, privateJwk };
}

export async function ensureDeviceKey(storage) {
  try {
    const saved = JSON.parse(storage.getItem('lgme.device.key') || 'null');
    if (saved?.privateJwk?.d && saved.publicJwk?.x) return saved;
  } catch { /* mint a new device key */ }
  const key = await generateDeviceKey();
  storage.setItem('lgme.device.key', JSON.stringify(key));
  return key;
}

export async function signDevice(privateJwk, payload) {
  const key = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(canonicalDevice(payload)));
  return bytesToB64(new Uint8Array(sig));
}

export async function verifyDevice(publicJwk, payload, sig) {
  try {
    const key = await crypto.subtle.importKey('jwk', publicDeviceJwk(publicJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64ToBytes(sig), new TextEncoder().encode(canonicalDevice(payload)));
  } catch {
    return false;
  }
}

export function randomInvite(bytes = crypto.getRandomValues(new Uint8Array(10))) {
  const source = bytes.length >= 10 ? bytes : crypto.getRandomValues(new Uint8Array(10));
  return [...source].slice(0, 10).map((byte) => ALPHABET[byte % 32]).join('');
}

export function acceptableInvite(code, { example = false } = {}) {
  const value = String(code || '').trim().toLowerCase();
  if (example && value === 'demo-club') return true;
  return /^[a-z2-7]{10,32}$/.test(value);
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function intakeSharePayload(peer, priv = {}, steward = '') {
  const share = peer?.healthConsent?.shareName === true;
  const payload = {
    handle: peer.id,
    action: 'share',
    token: peer?.covenant?.token || '',
    share,
    applicantHandle: peer.id,
    steward: String(steward || ''),
    nameHash: await sha256Hex(priv.applicantName || ''),
    trackHash: await sha256Hex(priv.trackRecord || ''),
    sponsors: (peer?.covenant?.sponsors || []).map((row) => row.handle).filter(Boolean)
  };
  if (share) {
    payload.applicantName = String(priv.applicantName || '');
    payload.trackRecord = String(priv.trackRecord || '');
  }
  return payload;
}
