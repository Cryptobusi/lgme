import { acceptableInvite, randomInvite } from './device-sign.mjs';

export const JOIN_ORIGIN = 'https://lgme.app/join';
export const INVITE_SUBJECT = 'Join Health on lgme';
export const INVITE_KEY = 'lgme.join.invite';

const HANDLE = /^[a-z0-9-]{1,32}$/;
const FEES = new Set(['pool', 'sponsor', 'self']);

function cleanHandle(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32);
}

export function inviteAsk(question) {
  const text = String(question || '').trim();
  return /\b(send|share|draft|write|make|create)\b[\s\S]{0,48}\binvite\b|\binvite (someone|a friend|a member|them|people)\b/i.test(text);
}

export function feeFromAsk(question) {
  const text = String(question || '');
  if (/\bpool\b/i.test(text)) return 'pool';
  if (/\b(sponsor|cover|my credit|i(?:'|’)ll pay)\b/i.test(text)) return 'sponsor';
  return 'self';
}

export function parseJoinSearch(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  const invite = String(params.get('invite') || '').trim().toLowerCase();
  if (!acceptableInvite(invite)) return { ok: false, error: 'That invite code is not usable.' };
  const requested = String(params.get('fee') || 'self').trim().toLowerCase();
  const fee = FEES.has(requested) ? requested : 'self';
  const from = cleanHandle(params.get('from'));
  return { ok: true, invite, fee, from: HANDLE.test(from) ? from : '' };
}

export function joinUrl({ invite, fee, from }) {
  const params = new URLSearchParams();
  params.set('invite', invite);
  params.set('fee', fee);
  if (from) params.set('from', from);
  return `${JOIN_ORIGIN}?${params.toString()}`;
}

export function draftHealthInvite({ question, inviter, code, poolCovers = 0, credit = 0 } = {}) {
  if (!inviteAsk(question)) return { ok: false, error: 'Ask to send an invite.' };
  const invite = String(code || randomInvite()).trim().toLowerCase();
  if (!acceptableInvite(invite) || invite.length < 10) return { ok: false, error: 'The invite code comes from this phone.' };
  const from = cleanHandle(inviter);
  let fee = feeFromAsk(question);
  let note = 'This invite leaves the fee with them. They can pay now or pay later.';
  if (fee === 'pool' && !(Number(poolCovers) >= 1)) {
    fee = 'self';
    note = 'The pool cannot cover a setup fee right now. This invite leaves the fee with them.';
  } else if (fee === 'pool') {
    note = 'This invite uses the pool.';
  }
  if (fee === 'sponsor') {
    if (!HANDLE.test(from)) return { ok: false, error: 'Choose who is inviting before covering the fee.' };
    if (!(Number(credit) >= 1)) return { ok: false, error: 'Credit on this phone does not cover the next fee.' };
    note = `Sponsored by ${from}.`;
  }
  const url = joinUrl({ invite, fee, from: HANDLE.test(from) ? from : '' });
  const body = [
    'Join Health on lgme. Open the link, verify your email, confirm you are 18 or older, and the setup fee step is ready.',
    url,
    note,
    'Your own email or text app sends this. Nothing is sent from here.'
  ].join('\n');
  return {
    ok: true,
    sent: false,
    contacts: false,
    invite,
    fee,
    from: HANDLE.test(from) ? from : '',
    url,
    subject: INVITE_SUBJECT,
    body,
    note,
    reserve: fee === 'sponsor'
  };
}

export function inviteShares(draft) {
  const subject = encodeURIComponent(draft.subject || INVITE_SUBJECT);
  const body = encodeURIComponent(draft.body || draft.url || '');
  return {
    email: `mailto:?subject=${subject}&body=${body}`,
    text: `sms:?&body=${body}`,
    share: { title: draft.subject || INVITE_SUBJECT, text: draft.body || '', url: draft.url },
    copy: draft.url
  };
}

export function rememberJoin(storage, join) {
  if (!join?.ok && !join?.invite) return null;
  const record = { invite: join.invite, fee: join.fee || 'self', from: join.from || '' };
  storage.setItem(INVITE_KEY, JSON.stringify(record));
  return record;
}

export function readJoin(storage) {
  try {
    const saved = JSON.parse(storage.getItem(INVITE_KEY) || 'null');
    if (!saved?.invite || !acceptableInvite(saved.invite)) return null;
    const fee = FEES.has(saved.fee) ? saved.fee : 'self';
    return { invite: saved.invite, fee, from: cleanHandle(saved.from) };
  } catch {
    return null;
  }
}

export function feePreset(join, pool = {}) {
  if (join?.fee === 'pool' && Number(pool.covers) >= 1) {
    return { fee: 'pool', selected: 'use-pool', label: 'Use the pool', note: 'This invite uses the pool.' };
  }
  if (join?.fee === 'sponsor' && join.from) {
    return { fee: 'sponsor', selected: 'accept-cover', label: `Sponsored by ${join.from}`, note: `Sponsored by ${join.from}.` };
  }
  if (join?.fee === 'pool') {
    return { fee: 'pool', selected: 'pay-now', label: 'Pay now', note: 'The pool cannot cover a setup fee right now.' };
  }
  return { fee: 'self', selected: 'pay-now', label: 'Pay now', note: join ? 'This invite leaves the fee with you.' : '' };
}

export function inviteEnrollment({ emailVerified, adult, collect, feePaid } = {}) {
  if (emailVerified !== true) return { step: 'email', done: false };
  if (adult !== true || collect !== true) return { step: 'consents', done: false };
  if (feePaid !== true) return { step: 'fee', done: false };
  return { step: 'in', done: true, next: '/personalize' };
}
