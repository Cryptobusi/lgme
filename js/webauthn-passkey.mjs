import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server';

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

export async function passkeyRequest({ store, action, body = {}, host }) {
  if (!store) return { status: 500, body: { ok: false, error: 'The passkey store is not open.' } };
  const party = relyingParty(host);
  const userId = userIdOf(body);
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
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' }
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
      userVerification: 'required'
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
      verified = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: expected,
        expectedOrigin: party.origin,
        expectedRPID: party.rpID,
        requireUserVerification: true,
        credential: { id: record.id, publicKey: bytes(record.publicKey), counter: record.counter, transports: record.transports }
      });
    } catch {
      return { status: 400, body: { ok: false, error: 'The fingerprint was not accepted. Use the email code.' } };
    }
    if (!verified.verified || verified.authenticationInfo.userVerified !== true) {
      return { status: 400, body: { ok: false, error: 'The fingerprint was not accepted. Use the email code.' } };
    }
    record.counter = verified.authenticationInfo.newCounter;
    await store.set(`webauthn:cred:${record.id}`, record);
    return { status: 200, body: { ok: true, userId: record.userId } };
  }
  if (action === 'remove') {
    const credentialId = await store.get(`webauthn:user:${userId}`);
    if (credentialId) await store.set(`webauthn:cred:${credentialId}`, null);
    await store.set(`webauthn:user:${userId}`, '');
    return { status: 200, body: { ok: true } };
  }
  return { status: 400, body: { ok: false, error: 'Use register, login, or remove.' } };
}
