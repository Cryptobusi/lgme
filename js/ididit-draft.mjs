import { ensureDeviceKey, sha256Hex, signDevice } from './device-sign.mjs';

export const IDIDIT_NAME = 'IdidIt (verified receipt)';
export const IDIDIT_CHIPS = Object.freeze(['I did the session', 'I finished a walk', 'I stretched']);

export async function submitIdidIt(title, fetchImpl = globalThis.fetch) {
  const day = new Date().toISOString().slice(0, 10);
  const name = String(title || IDIDIT_CHIPS[0]).trim().slice(0, 80) || IDIDIT_CHIPS[0];
  const hash = await sha256Hex(`lgme ididit ${day} ${name}`);
  const key = await ensureDeviceKey(localStorage);
  const payload = { handle: 'health-phone', action: 'queue', category: 'health', hash, day };
  const sig = await signDevice(key.privateJwk, payload);
  let body = {};
  try {
    const response = await fetchImpl('/api/hedera/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle: payload.handle, publicJwk: key.publicJwk, payload, sig })
    });
    body = await response.json();
  } catch {
    body = { ok: false, error: 'The receipt stayed on this phone.' };
  }
  return { ...body, title: name, day, hash };
}
