import { deedCreditSplit } from './commons-split.mjs';
import { VIEW_ONLY_MESSAGE } from './view-only-api.mjs';

export const LISTINGS_TOPIC = '0.0.11397293';
export const LISTINGS_OPERATOR = '0.0.11281203';
export const UNCLAIMED = 'Test item - unclaimed';
export const AUTHOR_STATUS = 'Test author - unclaimed';
export const EXAMPLE_STATUS = 'Example transaction - test, until claimed';
export const HOUR_LIMIT = 10;

const BANNED = /@|https?:|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\blatitude\b|\blongitude\b/i;
const HANDLE = /^[a-z0-9-]{1,32}$/;

const HOURLY = {
  strength: 23.43,
  cardio: 18.52,
  mobility: 18.52,
  plan: 23.43,
  mental: 23.43,
  bike: 18.52,
  gear: 12,
  repair: 45,
  walk: 18.52
};

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function serviceRate(service, minutes) {
  const span = Math.min(240, Math.max(15, Math.round(Number(minutes) || 15)));
  const hourly = HOURLY[service] || 20;
  const gross = round((span / 60) * hourly);
  const split = deedCreditSplit(gross);
  return {
    hourly,
    minutes: span,
    amount: split.ok ? split.amount : gross,
    skim: split.ok ? split.skim : 0,
    author: split.ok ? split.author : gross,
    note: 'Suggested credit. Both sides confirm before it is recorded. Over $100 still needs 3 attestations.'
  };
}

export const SEED_LISTINGS = Object.freeze([
  { id: 'ex-strength', title: 'Beginner strength coaching session', service: 'strength', durationMin: 45, tags: ['strength', 'beginner'] },
  { id: 'ex-running', title: 'Running form check', service: 'cardio', durationMin: 30, tags: ['running', 'form'] },
  { id: 'ex-yoga', title: 'Yoga and stretch class', service: 'mobility', durationMin: 60, tags: ['yoga', 'stretch'] },
  { id: 'ex-plan', title: 'Home workout plan', service: 'plan', durationMin: 20, tags: ['home', 'plan'] },
  { id: 'ex-motivation', title: 'Motivation and accountability chat', service: 'mental', durationMin: 25, tags: ['mental', 'motivation'] },
  { id: 'ex-seniors', title: 'Mobility for seniors', service: 'mobility', durationMin: 40, tags: ['mobility', 'seniors'] },
  { id: 'ex-bike', title: 'Bike tune-up for fitness rides', service: 'bike', durationMin: 45, tags: ['bike', 'tune-up'] },
  { id: 'ex-loan', title: 'Equipment loan, dumbbells and bands', service: 'gear', durationMin: 15, tags: ['loan', 'gear'] },
  { id: 'ex-walk', title: 'Group walk leader', service: 'walk', durationMin: 40, tags: ['walk', 'group'] },
  { id: 'ex-repair', title: 'The Repair Extraordinaire equipment repair', service: 'repair', durationMin: 60, tags: ['repair', 'equipment'], standing: true }
]);

export function claimedStatus(handle) {
  return `Claimed by ${handle}`;
}

export function publicExchangeListing(spec = {}) {
  if (String(spec.category || '').trim().toLowerCase() !== 'exchange') {
    return { ok: false, status: 403, viewOnly: true, error: VIEW_ONLY_MESSAGE };
  }
  const action = spec.action === 'update' ? 'update' : spec.action === 'listing' ? 'listing' : '';
  if (!action) return { ok: false, status: 400, error: 'Use listing or update.' };
  const id = String(spec.id || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{4,40}$/.test(id)) return { ok: false, status: 400, error: 'The listing id is not usable.' };
  const title = clean(spec.title, 80);
  if (!title) return { ok: false, status: 400, error: 'Name the listing.' };
  const handle = String(spec.handle || '').trim().toLowerCase();
  if (!HANDLE.test(handle)) return { ok: false, status: 400, error: 'Use a short handle.' };
  const provider = String(spec.provider || '').trim().toLowerCase();
  if (provider && !HANDLE.test(provider)) return { ok: false, status: 400, error: 'The provider id stays a short handle.' };
  const durationMin = Math.min(240, Math.max(0, Math.round(Number(spec.durationMin) || 0)));
  const service = clean(spec.service, 24).toLowerCase().replace(/[^a-z0-9-]/g, '') || 'health';
  const tags = [...new Set((Array.isArray(spec.tags) ? spec.tags : []).map((tag) => String(tag).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24)).filter(Boolean))].slice(0, 4);
  const photoHash = String(spec.photoHash || '').toLowerCase();
  if (photoHash && !/^[0-9a-f]{64}$/.test(photoHash)) return { ok: false, status: 400, error: 'Send the photo hash only. The photo stays on the phone.' };
  const receiptHash = String(spec.receiptHash || '').toLowerCase();
  if (receiptHash && !/^[0-9a-f]{64}$/.test(receiptHash)) return { ok: false, status: 400, error: 'Send the receipt hash only.' };
  const authorHandle = String(spec.authorHandle || '').trim().toLowerCase();
  if (authorHandle && !HANDLE.test(authorHandle)) return { ok: false, status: 400, error: 'The test author handle is not usable.' };
  const summary = clean(spec.summary, 140);
  const place = clean(spec.place, 40);
  const side = spec.side === 'request' ? 'request' : spec.side === 'offer' ? 'offer' : '';
  const group = clean(spec.group, 24).toLowerCase().replace(/[^a-z0-9-]/g, '');
  let status = clean(spec.status, 80);
  if (action === 'update') {
    if (spec.role !== 'trainer' && spec.role !== 'author') {
      return { ok: false, status: 403, error: 'A trainer or the group author claims a listing.' };
    }
    status = claimedStatus(provider || handle);
  } else if (id === 'ex-repair' && spec.standing === true) {
    status = claimedStatus('repair-extraordinaire');
  } else if (!status) {
    status = UNCLAIMED;
  }
  const allowed = status === UNCLAIMED || status === AUTHOR_STATUS || status === EXAMPLE_STATUS || status === claimedStatus('repair-extraordinaire') || /^Claimed by [a-z0-9-]{1,32}$/.test(status);
  if (!allowed) return { ok: false, status: 400, error: 'Use the test status or a claim.' };
  const given = spec.rate && typeof spec.rate === 'object' ? spec.rate : null;
  const rate = given
    ? { hourly: round(given.hourly), minutes: durationMin, amount: round(given.amount), skim: round(given.skim), author: round(given.author), note: serviceRate(service, durationMin).note }
    : serviceRate(service, durationMin || 15);
  const body = {
    v: 1,
    network: 'testnet',
    kind: action,
    id,
    category: 'exchange',
    title,
    service,
    durationMin: durationMin || rate.minutes,
    rate: { hourly: rate.hourly, amount: rate.amount, skim: rate.skim, author: rate.author },
    tags,
    status,
    provider: action === 'update' ? (provider || handle) : (status.startsWith('Claimed by ') ? status.slice('Claimed by '.length) : ''),
    photoHash,
    ...(receiptHash ? { receiptHash } : {}),
    ...(authorHandle ? { authorHandle } : {}),
    ...(summary ? { summary } : {}),
    ...(place ? { place } : {}),
    ...(side ? { side } : {}),
    ...(group ? { group } : {}),
    topic: LISTINGS_TOPIC,
    payer: LISTINGS_OPERATOR
  };
  if (BANNED.test(JSON.stringify(body))) return { ok: false, status: 400, error: 'A listing cannot carry personal data.' };
  return { ok: true, body };
}

export function draftExchangeListing(text) {
  const note = clean(text, 280);
  const mental = /motivat|accountab|advice|chat/i.test(note);
  const repair = /repair|broken|tune|maintenance|treadmill|rack/i.test(note);
  const yoga = /yoga|stretch/i.test(note);
  const run = /run|jog/i.test(note);
  const walk = /walk/i.test(note);
  const service = repair ? 'repair' : mental ? 'mental' : yoga ? 'mobility' : run ? 'cardio' : walk ? 'walk' : 'strength';
  const minutes = Number(note.match(/(\d{2,3})\s*(?:min|minute)/i)?.[1]) || (service === 'repair' ? 60 : 45);
  const title = clean(note.split(/[.!?]/)[0], 80) || 'Exercise session';
  const tags = [service, mental ? 'mental' : 'physical'].filter((tag, index, list) => list.indexOf(tag) === index);
  return {
    ok: Boolean(note),
    sent: false,
    engine: 'rules',
    label: 'Deterministic draft. The on-device model was not running.',
    title,
    service,
    durationMin: minutes,
    tags,
    rate: serviceRate(service, minutes),
    category: 'exchange',
    status: UNCLAIMED,
    error: note ? '' : 'Describe the session first.'
  };
}

export function seedPayload(row, handle = 'exchange-seed') {
  return {
    handle,
    action: 'listing',
    category: 'exchange',
    id: row.id,
    title: row.title,
    service: row.service,
    durationMin: row.durationMin,
    tags: row.tags,
    standing: row.standing === true,
    status: row.standing ? claimedStatus('repair-extraordinaire') : UNCLAIMED,
    provider: row.standing ? 'repair-extraordinaire' : '',
    at: '2026-11-10T21:00:00.000Z'
  };
}
