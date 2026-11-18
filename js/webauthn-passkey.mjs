import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';
import { deviceThumb } from './email-check-core.mjs';
import { verifyDevice } from './device-sign.mjs';

export const RP_ID = 'lgme.app';
export const RP_NAME = 'lgme';

function b64(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

function bytes(value) {
  return new Uint8Array(Buffer.from(String(value || ''), 'base64url'));
}

export function relyingParty(hostHeader) {
  const host = String(hostHeader || 'lgme.app');
  const name = host.split(':')[0];
  if (name === '127.0.0.1' || name === 'localhost') return { rpID: 'localhost', origin: `http://${name === '127.0.0.1' ? 'localhost' : host}` };
  return { rpID: RP_ID, origin: 'https://lgme.app' };
}

function userIdOf(body) {
  const id = String(body?.userId || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);
  return id.length >= 4 ? id : '';
}

async function challenge(store, userId, value) {
  const key = `webauthn:challenge:${userId}`;
  if (value) {
    await store.set(key, { challenge: value, exp: Date.now() + 5 * 60 * 1000 });
    return value;
  }
  const saved = await store.get(key);
  if (!saved || saved.exp < Date.now()) return '';
  return saved.challenge;
}

async function notePasskeyFailure(store, emailHash) {
  const id = String(emailHash || '').replace(/[^a-f0-9]/gi, '').slice(0, 64);
  if (!id) return 0;
  const now = Date.now();
  const key = `totp:try:${id}`;
  const row = (await store.get(key)) || { stamps: [] };
  const stamps = [...(row.stamps || []).filter((stamp) => now - stamp < 10 * 60 * 1000), now];
  await store.set(key, { stamps });
  return stamps.length;
}

export async function passkeyRequest({ store, action, body = {}, host, verifyAuthentication = verifyAuthenticationResponse }) {
  if (!store) return { status: 500, body: { ok: false, error: 'The passkey store is not open.' } };
  const party = relyingParty(host);
  const userId = userIdOf(body);
  if (action === 'register-options' || action === 'register') {
    const emailHash = userId.split(':')[0];
    const member = emailHash ? await store.get(`email:member:${emailHash}`) : null;
    if (!member?.verifiedAt) return { status: 403, body: { ok: false, error: 'Verify email or the authenticator before saving a fingerprint.' } };
  }
  if (action === 'register-options' || action === 'login-options' || action === 'remove') {
    if (!userId) return { status: 400, body: { ok: false, error: 'Sign in on this phone first.' } };
  }
  if (action === 'register-options') {
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: party.rpID,
      userName: userId,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'preferred' }
    });
    await challenge(store, userId, options.challenge);
    return { status: 200, body: { ok: true, options } };
  }
  if (action === 'register') {
    const expected = await challenge(store, userId, '');
    if (!expected) return { status: 400, body: { ok: false, error: 'The fingerprint prompt expired. Try again.' } };
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: expected,
        expectedOrigin: party.origin,
        expectedRPID: party.rpID,
        requireUserVerification: true
      });
    } catch {
      return { status: 400, body: { ok: false, error: 'The device did not save a passkey.' } };
    }
    if (!verified.verified) return { status: 400, body: { ok: false, error: 'The device did not save a passkey.' } };
    const cred = verified.registrationInfo.credential;
    const record = { id: cred.id, publicKey: b64(cred.publicKey), counter: cred.counter, transports: cred.transports || [], userId };
    await store.set(`webauthn:cred:${cred.id}`, record);
    await store.set(`webauthn:user:${userId}`, cred.id);
    return { status: 200, body: { ok: true, credentialId: cred.id } };
  }
  if (action === 'login-options') {
    const credentialId = await store.get(`webauthn:user:${userId}`);
    if (!credentialId) return { status: 404, body: { ok: false, error: 'No fingerprint is saved for this phone.' } };
    const options = await generateAuthenticationOptions({
      rpID: party.rpID,
      allowCredentials: [{ id: credentialId, transports: ['internal'] }],
      userVerification: 'preferred'
    });
    await challenge(store, userId, options.challenge);
    return { status: 200, body: { ok: true, options } };
  }
  if (action === 'login') {
    const id = body.response?.id;
    const record = id ? await store.get(`webauthn:cred:${id}`) : null;
    if (!record) return { status: 404, body: { ok: false, error: 'No fingerprint is saved for this phone.' } };
    const expected = await challenge(store, record.userId, '');
    if (!expected) return { status: 400, body: { ok: false, error: 'The fingerprint prompt expired. Try again.' } };
    let verified;
    try {
      verified = await verifyAuthentication({
        response: body.response,
        expectedChallenge: expected,
        expectedOrigin: party.origin,
        expectedRPID: party.rpID,
        requireUserVerification: true,
        credential: { id: record.id, publicKey: bytes(record.publicKey), counter: record.counter, transports: record.transports }
      });
    } catch {
      await store.set(`webauthn:challenge:${record.userId}`, null);
      const tries = await notePasskeyFailure(store, body.emailHash);
      if (tries >= 5) return { status: 429, body: { ok: false, error: 'Too many fingerprint tries. Wait and try again.' } };
      return { status: 400, body: { ok: false, error: 'The fingerprint was not accepted. Use the email code.' } };
    }
    await store.set(`webauthn:challenge:${record.userId}`, null);
    if (!verified.verified || verified.authenticationInfo.userVerified !== true) {
      const tries = await notePasskeyFailure(store, body.emailHash);
      if (tries >= 5) return { status: 429, body: { ok: false, error: 'Too many fingerprint tries. Wait and try again.' } };
      return { status: 400, body: { ok: false, error: 'The fingerprint was not accepted. Use the email code.' } };
    }
    const emailHash = String(record.userId || '').split(':')[0];
    const member = emailHash ? await store.get(`email:member:${emailHash}`) : null;
    const thumb = body.publicJwk?.x ? await deviceThumb(body.publicJwk) : '';
    const deviceOk = Boolean(member?.deviceThumb) && thumb === member.deviceThumb && await verifyDevice(body.publicJwk, { challenge: expected, purpose: 'passkey-signin' }, body.sig);
    if (!deviceOk) {
      const tries = await notePasskeyFailure(store, body.emailHash || emailHash);
      if (tries >= 5) return { status: 429, body: { ok: false, verified: false, error: 'Too many fingerprint tries. Wait and try again.' } };
      return { status: 400, body: { ok: false, verified: false, fallback: 'email', error: 'This device does not match. Use the email code.' } };
    }
    record.counter = verified.authenticationInfo.newCounter;
    await store.set(`webauthn:cred:${record.id}`, record);
    return { status: 200, body: { ok: true, verified: true, userId: record.userId } };
  }
  if (action === 'remove') {
    const credentialId = await store.get(`webauthn:user:${userId}`);
    if (credentialId) await store.set(`webauthn:cred:${credentialId}`, null);
    await store.set(`webauthn:user:${userId}`, '');
    return { status: 200, body: { ok: true } };
  }
  return { status: 400, body: { ok: false, error: 'Use register, login, or remove.' } };
}
