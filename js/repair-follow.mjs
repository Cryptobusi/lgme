import { canonicalDevice, sha256Hex, verifyDevice } from './device-sign.mjs';
import { check, repairConfirmSchema, repairConfirmsSchema, repairDetailsSchema, repairRequestSchema, repairStatusSchema, repairSuggestionSchema } from './input-schema.mjs';
import { deedCreditSplit } from './commons-split.mjs';
import { ATTESTATION_NOTE, evaluateHold } from './high-value.mjs';
import { VIEW_ONLY_MESSAGE } from './view-only-api.mjs';

export const OFFER_ID = 'repair-extraordinaire';
export const OFFER_TITLE = 'The Repair Extraordinaire: equipment repair, phone/online support (tcare4me@gmail.com) or in-person via Thumbtack';
export const REPAIR_STATUSES = Object.freeze(['requested', 'contacted', 'scheduled', 'done', 'confirmed']);
export const REPAIR_HOURLY = 45;
export const ALLOWED_ACTIONS = new Set(['repair-request', 'repair-status', 'repair-confirm']);

function fail(status, error) {
  return { ok: false, status, error };
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function suggestRepairRate(minutes = 60) {
  const span = Math.min(240, Math.max(15, Math.round(Number(minutes) || 60)));
  const gross = Math.round((span / 60) * REPAIR_HOURLY * 100) / 100;
  const split = deedCreditSplit(gross);
  return {
    hourly: REPAIR_HOURLY,
    minutes: span,
    amount: split.ok ? split.amount : gross,
    skim: split.ok ? split.skim : 0,
    author: split.ok ? split.author : gross,
    note: `Suggested rate ${split.ok ? split.author : gross} for ${span} minutes at ${REPAIR_HOURLY} an hour. The 1% Health and fitness portion is ${split.ok ? split.skim : 0}. Both sides confirm before anything is recorded. Over $100 still needs 3 attestations. This is a recommendation, not a price.`
  };
}

export function publicRepairDetails(spec = {}) {
  if (spec.share !== true) return { ok: false, error: 'Choose to share the details first. Nothing was sent.' };
  const allowed = new Set(['share', 'item', 'brandModel', 'symptom', 'tried', 'photo', 'image', 'photos', 'handle', 'action', 'origin', 'offerId', 'at', 'durationMin']);
  for (const key of Object.keys(spec)) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown field ${key}.` };
  }
  if (spec.photo || spec.image || spec.photos) return { ok: false, error: 'Photos stay on this phone.' };
  const details = {
    item: clean(spec.item, 80),
    brandModel: clean(spec.brandModel, 80),
    symptom: clean(spec.symptom, 200),
    tried: clean(spec.tried, 160)
  };
  const parsed = check(details, repairDetailsSchema, 'details');
  if (!parsed.ok) return parsed;
  if (/https?:|data:image/i.test(`${details.item} ${details.brandModel} ${details.symptom} ${details.tried}`)) {
    return { ok: false, error: 'Photos and links stay out of the shared details.' };
  }
  return { ok: true, details };
}

export async function repairWrite(state, envelope) {
  const handle = String(envelope?.handle || '').trim();
  const payload = envelope?.payload;
  const action = String(payload?.action || '');
  if (!ALLOWED_ACTIONS.has(action)) return fail(403, VIEW_ONLY_MESSAGE);
  if (payload?.origin !== 'health' && action === 'repair-request') return fail(403, VIEW_ONLY_MESSAGE);
  if (!handle || !payload || payload.handle !== handle || !envelope?.sig || !envelope?.publicJwk?.x) {
    return fail(401, 'A device signature is required.');
  }
  state.members = state.members || {};
  state.repairs = state.repairs || [];
  const known = state.members[handle];
  const key = known?.publicJwk || envelope.publicJwk;
  if (known && (known.publicJwk.x !== envelope.publicJwk.x || known.publicJwk.y !== envelope.publicJwk.y)) {
    return fail(403, 'This handle already has a device key. The signature was refused.');
  }
  const signed = await verifyDevice(key, payload, envelope.sig);
  if (!signed) return fail(401, 'The device signature was refused.');
  if (!known) state.members[handle] = { publicJwk: { kty: 'EC', crv: 'P-256', x: envelope.publicJwk.x, y: envelope.publicJwk.y } };
  if (action === 'repair-request') return createRequest(state, handle, payload);
  if (action === 'repair-status') return updateStatus(state, handle, payload);
  return confirmRate(state, handle, payload);
}

async function createRequest(state, handle, payload) {
  const parsed = check(payload, repairRequestSchema, 'repair');
  if (!parsed.ok) return { ...parsed, status: 400 };
  if (payload.offerId !== OFFER_ID) return fail(400, 'That offer is not the standing repair service.');
  const details = publicRepairDetails(payload);
  if (!details.ok) return { ...details, status: 400 };
  const at = String(payload.at || new Date().toISOString());
  const id = await sha256Hex(canonicalDevice({ handle, offerId: OFFER_ID, details: details.details, at }));
  if (state.repairs.some((row) => row.id === id)) return { ok: true, item: state.repairs.find((row) => row.id === id), duplicate: true };
  const suggestion = suggestRepairRate(payload.durationMin);
  const suggested = check(suggestion, repairSuggestionSchema, 'suggestion');
  if (!suggested.ok) return { ...suggested, status: 400 };
  const item = {
    id,
    offerId: OFFER_ID,
    offerTitle: OFFER_TITLE,
    handle,
    origin: 'health',
    status: 'requested',
    details: details.details,
    suggestion,
    confirms: {},
    settlement: '',
    hedera: false,
    at
  };
  state.repairs = [...state.repairs, item].slice(-80);
  return { ok: true, item, sent: false };
}

function updateStatus(state, handle, payload) {
  const parsed = check(payload, repairStatusSchema, 'repair');
  if (!parsed.ok) return { ...parsed, status: 400 };
  const item = state.repairs.find((row) => row.id === payload.id);
  if (!item || item.origin !== 'health') return fail(404, 'No Health repair request on this book.');
  if (item.handle !== handle) return fail(403, 'Only the member who asked can update this request.');
  const status = String(payload.status || '');
  if (!REPAIR_STATUSES.includes(status)) return fail(400, 'Use requested, contacted, scheduled, done, or confirmed.');
  item.status = status;
  return { ok: true, item };
}

function confirmRate(state, handle, payload) {
  const parsed = check(payload, repairConfirmSchema, 'repair');
  if (!parsed.ok) return { ...parsed, status: 400 };
  const item = state.repairs.find((row) => row.id === payload.id);
  if (!item || item.origin !== 'health') return fail(404, 'No Health repair request on this book.');
  if (payload.confirmed !== true) return fail(400, 'Tap confirm. Nothing is recorded for you.');
  const side = payload.side === 'provider' ? 'provider' : 'member';
  if (side === 'member' && item.handle !== handle) return fail(403, 'The member who asked confirms their side.');
  const amount = Math.round(Number(payload.amount) * 100) / 100;
  if (!(amount > 0)) return fail(400, 'Enter the amount you confirm.');
  const sideBody = { handle, amount };
  const sideCheck = check(sideBody, repairConfirmsSchema.keys[side], side);
  if (!sideCheck.ok) return { ...sideCheck, status: 400 };
  item.confirms = { ...(item.confirms || {}), [side]: sideBody };
  const member = item.confirms.member;
  const provider = item.confirms.provider;
  if (!member || !provider) return { ok: true, item, waiting: true, recorded: false };
  if (member.amount !== provider.amount) return { ok: true, item, waiting: true, recorded: false, note: 'The amounts differ. Nothing was recorded.' };
  const hold = evaluateHold(state.highValue || [], {
    id: item.id,
    fromId: member.handle,
    toId: provider.handle,
    kind: 'credit',
    amount,
    at: payload.at || item.at
  });
  if (!hold.ok) return { ...hold, status: 400 };
  if (hold.pending) {
    item.settlement = 'pending';
    item.note = ATTESTATION_NOTE;
    const record = hold.record;
    state.highValue = [...(state.highValue || []).filter((row) => row.id !== record.id), record];
    return { ok: true, item, pending: true, recorded: false, note: ATTESTATION_NOTE };
  }
  const split = deedCreditSplit(amount);
  item.settlement = 'recorded';
  item.amount = amount;
  item.author = split.author;
  item.skim = split.skim;
  item.note = 'Both sides confirmed. The entry is recorded. Credit is the suggested deed amount, not $lgme moved by itself.';
  return { ok: true, item, recorded: true, pending: false };
}

export function publicRepairFeed(state) {
  return {
    ok: true,
    viewOnly: true,
    hedera: false,
    offer: { id: OFFER_ID, title: OFFER_TITLE, pinned: true, kind: 'ihavIT' },
    items: (state?.repairs || []).map((row) => ({
      id: row.id,
      offerId: row.offerId,
      offerTitle: row.offerTitle,
      handle: row.handle,
      origin: row.origin,
      status: row.status,
      details: row.details,
      suggestion: row.suggestion,
      settlement: row.settlement || '',
      note: row.note || '',
      hedera: false,
      at: row.at
    }))
  };
}
