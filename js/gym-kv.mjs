import { acceptsCovenant, signSponsor } from './covenant.mjs';
import { acceptableInvite, sameDeviceKey, verifyDevice } from './device-sign.mjs';
import { publicProgressCard } from './gym-progress.mjs';
import { publicChatMessage } from './gym-sync.mjs';
import { publicIntake } from './intake.mjs';

export function emptyGymKv() {
  return { members: {}, progress: [], chats: {}, covenants: {}, intakes: {} };
}

export function allowRate(hits, ip, now = Date.now(), limit = 30) {
  const recent = (hits.get(ip) || []).filter((time) => now - time < 60000);
  if (recent.length >= limit) return { ok: false, status: 429, error: 'Too many requests. Try again in a minute.' };
  recent.push(now);
  hits.set(ip, recent);
  return { ok: true };
}

function fail(status, error) {
  return { ok: false, status, error };
}

export async function authorizeDevice(state, envelope) {
  const handle = String(envelope?.handle || '').trim();
  const payload = envelope?.payload;
  const sig = String(envelope?.sig || '');
  const presented = envelope?.publicJwk;
  if (!handle || !payload || payload.handle !== handle || !sig || !presented?.x) {
    return fail(401, 'A device signature is required.');
  }
  const known = state.members[handle];
  const key = known?.publicJwk || presented;
  if (known && !sameDeviceKey(known.publicJwk, presented)) {
    return fail(403, 'This handle already has a device key. The signature was refused.');
  }
  const ok = await verifyDevice(key, payload, sig);
  if (!ok) return fail(401, 'The device signature was refused.');
  if (!known) state.members[handle] = { publicJwk: { kty: 'EC', crv: 'P-256', x: presented.x, y: presented.y } };
  return { ok: true, handle, payload };
}

function namesAllowed(payload) {
  if (payload.legalName) return fail(400, 'A legal name stays on the phone.');
  if (payload.share === true) return { ok: true };
  return { ok: true, redact: true };
}

export async function gymMutate(state, envelope) {
  const auth = await authorizeDevice(state, envelope);
  if (!auth.ok) return auth;
  const payload = auth.payload;
  if (payload.action === 'progress') return writeProgress(state, auth.handle, payload);
  if (payload.action === 'chat') return writeChat(state, auth.handle, payload);
  if (payload.action === 'request') return writeCovenant(state, auth.handle, payload);
  if (payload.action === 'sign') return signCovenant(state, auth.handle, payload);
  if (payload.action === 'share' || payload.action === 'public') return writeIntake(state, auth.handle, payload);
  if (payload.action === 'read') return readIntake(state, auth.handle, payload);
  return fail(400, 'That gym action is not available.');
}

function writeProgress(state, handle, payload) {
  const card = { ...(payload.card || {}), handle };
  const built = publicProgressCard(card);
  if (!built.ok) return { ...built, status: 400 };
  if (built.card.handle !== handle) return fail(403, 'A member signs only their own card.');
  const rest = state.progress.filter((row) => !(row.handle === handle && row.week === built.card.week && row.category === built.card.category));
  if (payload.op === 'delete') {
    state.progress = rest;
    return { ok: true, cards: state.progress };
  }
  state.progress = [...rest, built.card].slice(-100);
  return { ok: true, cards: state.progress };
}

function writeChat(state, handle, payload) {
  const code = String(payload.code || '').trim().toLowerCase();
  if (!acceptableInvite(code, { example: true })) return fail(400, 'That invite code is not usable.');
  const key = code;
  const prior = state.chats[key] || [];
  if (payload.op === 'delete') {
    state.chats[key] = prior.filter((message) => !(message.handle === handle && message.text === payload.text));
    return { ok: true, messages: state.chats[key] };
  }
  const built = publicChatMessage({ text: payload.text, handle, code, at: payload.at });
  if (!built.ok) return { ...built, status: 400 };
  state.chats[key] = [...prior, built.message].slice(-50);
  return { ok: true, messages: state.chats[key] };
}

function writeCovenant(state, handle, payload) {
  if (payload.legalName || payload.applicantName || payload.trackRecord) return fail(400, 'Names stay on the phone.');
  const built = acceptsCovenant({ ...payload, handle });
  if (!built.ok) return { ...built, status: 400 };
  const prior = state.covenants[built.record.token];
  if (prior && prior.handle !== handle) return fail(403, 'That sponsor record belongs to another member.');
  state.covenants[built.record.token] = { ...built.record, sponsors: prior?.sponsors || [] };
  return { ok: true, record: state.covenants[built.record.token] };
}

function signCovenant(state, handle, payload) {
  if (payload.legalName || payload.applicantName || payload.trackRecord) return fail(400, 'Names stay on the phone.');
  const token = String(payload.token || '');
  const current = state.covenants[token];
  if (!current) return fail(404, 'That sponsor link is not here.');
  const signed = signSponsor(current, handle, { at: payload.at, inGroup: payload.inGroup === true });
  if (!signed.ok) return { ...signed, status: 400 };
  state.covenants[token] = signed.record;
  return { ok: true, record: signed.record };
}

function writeIntake(state, handle, payload) {
  const token = String(payload.token || '');
  if (!/^[0-9a-f-]{16,80}$/i.test(token)) return fail(400, 'That intake link is not usable.');
  const names = namesAllowed(payload);
  if (!names.ok) return names;
  const prior = state.intakes[token] || { public: {}, private: {} };
  if (prior.private?.applicantHandle && prior.private.applicantHandle !== handle) {
    return fail(403, 'That intake belongs to another member.');
  }
  if (payload.action === 'public') {
    prior.public = publicIntake(payload.intake || {});
    state.intakes[token] = prior;
    return { ok: true, record: prior.public };
  }
  prior.private = {
    applicantHandle: handle,
    steward: String(payload.steward || prior.private?.steward || ''),
    nameHash: String(payload.nameHash || ''),
    trackHash: String(payload.trackHash || ''),
    sponsors: Array.isArray(payload.sponsors) ? payload.sponsors.map((item) => String(item || '').trim()).filter(Boolean) : [],
    share: payload.share === true
  };
  if (payload.share === true) {
    prior.private.applicantName = String(payload.applicantName || '');
    prior.private.trackRecord = String(payload.trackRecord || '');
  }
  state.intakes[token] = prior;
  return { ok: true };
}

function readIntake(state, handle, payload) {
  const row = state.intakes[String(payload.token || '')];
  if (!row) return { ok: true, record: null, private: null };
  const who = row.private || {};
  const allowed = handle === who.applicantHandle || (who.steward && handle === who.steward);
  if (!allowed) return fail(403, 'That record stays with the applicant or the steward.');
  const hidden = {
    applicantHandle: who.applicantHandle || '',
    nameHash: who.nameHash || '',
    trackHash: who.trackHash || ''
  };
  const visible = who.share === true ? { applicantName: who.applicantName || '', trackRecord: who.trackRecord || '' } : hidden;
  return { ok: true, record: publicIntake(row.public || {}), private: visible };
}
