const KINDS = new Set(['phone', 'facetime', 'whatsapp', 'signal']);

function b64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

function fromB64(text) {
  const raw = atob(String(text || ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function contactLinks(kind, value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[^\d+]/g, '');
  if (!KINDS.has(kind) || !raw) return null;
  if (kind === 'phone') return { call: `tel:${digits}`, video: `facetime:${encodeURIComponent(raw)}` };
  if (kind === 'facetime') return { call: `facetime-audio:${raw}`, video: `facetime:${raw}` };
  if (kind === 'whatsapp') return { call: `whatsapp://send?phone=${digits.replace(/^\+/, '')}`, video: `whatsapp://send?phone=${digits.replace(/^\+/, '')}` };
  return { call: `https://signal.me/#p/${encodeURIComponent(digits || raw)}`, video: `https://signal.me/#p/${encodeURIComponent(digits || raw)}` };
}

export async function makeContactKey() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicJwk: { kty: 'EC', crv: 'P-256', x: publicJwk.x, y: publicJwk.y }, privateJwk };
}

async function aesKey(privateJwk, publicJwk, usages) {
  const mine = await crypto.subtle.importKey('jwk', privateJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  const theirs = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: publicJwk.x, y: publicJwk.y }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return crypto.subtle.deriveKey({ name: 'ECDH', public: theirs }, mine, { name: 'AES-GCM', length: 256 }, false, usages);
}

export async function sealContact(privateJwk, theirPublic, contact) {
  const key = await aesKey(privateJwk, theirPublic, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(contact)));
  return { iv: b64(iv), cipher: b64(new Uint8Array(cipher)) };
}

export async function openContact(privateJwk, theirPublic, packed) {
  const key = await aesKey(privateJwk, theirPublic, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(packed.iv) }, key, fromB64(packed.cipher));
  return JSON.parse(new TextDecoder().decode(clear));
}

export function publicDirect(spec, from) {
  const to = String(spec.to || '').trim().slice(0, 40);
  if (!from || !to || from === to) return { ok: false, error: 'Choose one member.' };
  const kind = spec.direct;
  if (kind === 'ask' || kind === 'revoke') return { ok: true, row: { kind, from, to, at: String(spec.at || ''), hedera: false } };
  if (kind !== 'share') return { ok: false, error: 'That contact update is not available.' };
  const iv = String(spec.iv || '');
  const cipher = String(spec.cipher || '');
  if (!/^[A-Za-z0-9+/=]+$/.test(iv) || !/^[A-Za-z0-9+/=]+$/.test(cipher)) return { ok: false, error: 'The contact must stay sealed.' };
  if (/tel:|facetime:|whatsapp:|signal\.me|\d{7,}/.test(cipher)) return { ok: false, error: 'The contact must stay sealed.' };
  return { ok: true, row: { kind: 'share', from, to, iv, cipher, at: String(spec.at || ''), hedera: false } };
}

export const CONTACT_NOTICE = 'This contact is not end-to-end encrypted yet, so it stays on this phone.';
