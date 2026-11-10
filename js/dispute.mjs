// Corrected, non-enforcing dispute rehearsal.
// The seed is the Hedera running hash: SHA-384, 48 bytes, version 3, from the
// post-consensus record. Version 3 is SHA-384 of, in order: the previous running
// hash (48), the version as a big-endian uint64, the payer shard, realm, and
// number (three uint64), the topic shard, realm, and number (three uint64),
// consensus seconds (uint64), consensus nanos (uint32), the sequence (uint64),
// and SHA-384 of the message (48). A panel index uses rejection sampling.
// It does not use SHA-256 or modulo. The records are JSON Schema, not JSON-LD.
// A dispute does not freeze the Floor, halt clearing, or move credit.

import { canonicalDevice, verifyDevice } from './device-sign.mjs';
import { suggestThird } from './high-value.mjs';

export const RECEIPT = 'IdidIt (verified receipt)';
export const TESTNET_MIN = 1;
export const LATER_MIN = 10;
export const SANDBOX_LABEL = 'Rehearsal, nothing binding.';
export const NOT_A_COURT = 'The Third Seat does not replace a court.';
export const REHEARSAL_COPY = 'This is a testnet rehearsal. Testnet can reset.';
export const VOLUNTARY = 'Use of lgme.app is 100% voluntary.';
export const NO_COVERAGE = 'No liability coverage of any kind is provided by the app, its authors, stewards, trainers, sponsors, attesters, or panelists.';
export const FORUM = 'The Third Seat arbitration is the members\' agreed means of resolving disputes within the app, except where local laws in the member\'s jurisdiction govern or cover civil duties and responsibilities. Where those laws govern, they apply.';
export const DRAFT_MARK = 'Not legal advice. Draft pending counsel review.';
export const VERDICT_CHOICES = Object.freeze(['write-down', 'nullification', 'no-change']);
export const DISCLAIMER = Object.freeze([VOLUNTARY, NO_COVERAGE, FORUM, NOT_A_COURT, REHEARSAL_COPY]);

const SPAN = 1n << 64n;

export const REHEARSAL_POOL = Object.freeze([
  { id: 'otis', name: 'Otis', role: 'admin', completed: 4, counterparties: [] },
  { id: 'noor', name: 'Noor', role: 'trainer', trainerAt: '2026-01-02T00:00:00.000Z', completed: 3, counterparties: [] },
  { id: 'sam', name: 'Sam', role: 'member', completed: 5, counterparties: [] },
  { id: 'kit', name: 'Kit', role: 'member', completed: 2, counterparties: [] },
  { id: 'cy', name: 'Cy', role: 'member', completed: 6, counterparties: ['claimant'], workouts: 0 },
  { id: 'wren', name: 'Wren', role: 'member', completed: 0, counterparties: [], workouts: 9 }
]);

function hex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u64(value) {
  const out = new Uint8Array(8);
  let rest = BigInt(value);
  for (let i = 7; i >= 0; i -= 1) {
    out[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  const rest = Number(value) >>> 0;
  out[0] = (rest >>> 24) & 255;
  out[1] = (rest >>> 16) & 255;
  out[2] = (rest >>> 8) & 255;
  out[3] = rest & 255;
  return out;
}

function readU64(bytes) {
  let value = 0n;
  for (const byte of bytes.subarray(0, 8)) value = (value << 8n) + BigInt(byte);
  return value;
}

export function bytesFromBase64(text) {
  const raw = atob(String(text || ''));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalDevice(value)));
  return hex(new Uint8Array(digest));
}

export async function sha384(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-384', bytes));
}

function account(id) {
  const [shard, realm, num] = String(id || '0.0.0').split('.').map((part) => part || '0');
  return { shard, realm, num };
}

export async function runningHashV3({ previous, version = 3, payer, topic, seconds, nanos, sequence, message }) {
  const messageHash = await sha384(message);
  return sha384(concat([
    previous || new Uint8Array(48),
    u64(version),
    u64(payer.shard), u64(payer.realm), u64(payer.num),
    u64(topic.shard), u64(topic.realm), u64(topic.num),
    u64(seconds),
    u32(nanos),
    u64(sequence),
    messageHash
  ]));
}

export function runningHashSeed(record = {}) {
  const version = Number(record.running_hash_version ?? record.runningHashVersion);
  if (version !== 3) return { ok: false, error: 'The running hash version must be 3.' };
  const raw = record.running_hash || record.runningHash || '';
  let bytes;
  try { bytes = /^[0-9a-f]{96}$/i.test(raw) ? Uint8Array.from(raw.match(/../g).map((pair) => parseInt(pair, 16))) : bytesFromBase64(raw); }
  catch { return { ok: false, error: 'The running hash is not readable.' }; }
  if (bytes.length !== 48) return { ok: false, error: 'The running hash must be 48 bytes from SHA-384.' };
  return { ok: true, bytes, hex: hex(bytes), version: 3 };
}

export function indexFromRand(rand, size) {
  const n = BigInt(size);
  if (n <= 0n) return { ok: false };
  const bucket = SPAN / n;
  const limit = bucket * n;
  if (rand >= limit) return { ok: false, rejected: true };
  return { ok: true, index: Number(rand / bucket) };
}

export async function rejectionIndex(seed, size, step) {
  if (!(size > 0)) return { ok: false, error: 'The pool is empty.' };
  let state = seed;
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const digest = await sha384(concat([state, u32(step), u32(attempt)]));
    const picked = indexFromRand(readU64(digest), size);
    if (picked.ok) return { ...picked, state: digest };
    state = digest;
  }
  return { ok: false, error: 'The draw did not settle.' };
}

export function completedExchanges(peer) {
  if (peer?.rehearsal === true) return Array.from({ length: Number(peer.completed) || 0 }, (_, index) => ({ id: `rehearsal-${index}`, other: '' }));
  const seen = new Set();
  const rows = [];
  for (const entry of peer?.tape || []) {
    if (entry?.type === 'EXERCISE_SESSION') continue;
    const payload = entry?.payload || {};
    if (payload.receiptName !== RECEIPT) continue;
    let other = '';
    let id = '';
    if (entry.type === 'DEED_ATTESTED') {
      other = payload.buyerId === peer.id ? payload.providerId : payload.buyerId;
      id = String(payload.postId || payload.entryId || '');
    } else if (entry.type === 'CAMPUS_DEED' && payload.status === 'verified') {
      other = payload.giverId === peer.id ? payload.receiverId : payload.giverId;
      id = String(payload.deedId || '');
    }
    if (!id || !other || other === peer.id || seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, other });
  }
  return rows;
}

export function directCounterparties(peer) {
  if (peer?.rehearsal === true) return new Set(peer.counterparties || []);
  const names = new Set(completedExchanges(peer).map((row) => row.other));
  for (const entry of peer?.tape || []) {
    if (entry?.type === 'EXERCISE_SESSION') continue;
    const payload = entry?.payload || {};
    if (entry?.type === 'CAMPUS_DEED') {
      const other = payload.giverId === peer.id ? payload.receiverId : payload.giverId;
      if (other) names.add(other);
    }
  }
  for (const post of Object.values(peer?.deedPosts || {})) {
    const other = post?.posterId === peer.id ? post.counterpartyId : post?.posterId;
    if (other) names.add(other);
  }
  return names;
}

function sharedCode(claimant, respondent) {
  return Object.keys(claimant?.clubGroups || {}).find((code) => respondent?.clubGroups?.[code]) || '';
}

function trainerStamp(peer, code) {
  return peer?.clubGroups?.[code]?.trainerAt || peer?.trainerAt || '';
}

function isTrainer(peer, code) {
  return peer?.gymRole === 'trainer' || peer?.trainer === true || peer?.clubGroups?.[code]?.role === 'trainer';
}

export function disputeSteward(members, claimant, respondent) {
  const code = sharedCode(claimant, respondent);
  if (!code) return { id: '', role: '' };
  const parties = new Set([claimant?.id, respondent?.id]);
  const rows = (members || []).filter((peer) => peer?.clubGroups?.[code] && !parties.has(peer.id));
  const trainers = rows.filter((peer) => isTrainer(peer, code)).sort((a, b) => {
    const at = trainerStamp(a, code);
    const bt = trainerStamp(b, code);
    if (at && bt && at !== bt) return at < bt ? -1 : 1;
    if (at && !bt) return -1;
    if (!at && bt) return 1;
    return String(a.id).localeCompare(String(b.id));
  });
  if (trainers[0]) return { id: trainers[0].id, role: 'trainer' };
  const admin = rows.find((peer) => peer.clubGroups[code].role === 'admin' || peer.clubGroups[code].admin === true);
  if (admin) return { id: admin.id, role: 'administrator' };
  const author = claimant.clubGroups[code].creator || respondent.clubGroups[code].creator || '';
  if (author && !parties.has(author)) return { id: author, role: 'group author' };
  return { id: '', role: '' };
}

export function eligibleMembers(members, claimant, respondent, min = TESTNET_MIN) {
  const blocked = new Set([claimant?.id, respondent?.id].filter(Boolean));
  for (const id of directCounterparties(claimant)) blocked.add(id);
  for (const id of directCounterparties(respondent)) blocked.add(id);
  return (members || []).filter((peer) => peer?.id && !blocked.has(peer.id) && completedExchanges(peer).length >= min)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function rehearsalMembers(claimant, respondent) {
  const code = sharedCode(claimant, respondent) || 'rehearsal';
  const creator = claimant?.clubGroups?.[code]?.creator || respondent?.clubGroups?.[code]?.creator || 'sam';
  return REHEARSAL_POOL.map((row) => ({
    id: row.id,
    name: row.name,
    rehearsal: true,
    completed: row.completed,
    workouts: row.workouts || 0,
    counterparties: (row.counterparties || []).map((id) => (id === 'claimant' ? claimant.id : id === 'respondent' ? respondent.id : id)),
    clubGroups: {
      [code]: {
        role: row.role,
        creator,
        trainerAt: row.trainerAt || '',
        name: 'Rehearsal'
      }
    }
  }));
}

function firstSuggestion(members, claimant, respondent, eligibleIds) {
  let pool = members;
  const seen = new Set();
  for (let step = 0; step < 4; step += 1) {
    const next = suggestThird(pool, claimant, respondent);
    if (!next.handle || seen.has(next.handle)) break;
    if (eligibleIds.has(next.handle)) return next;
    seen.add(next.handle);
    pool = pool.filter((peer) => peer.id !== next.handle);
  }
  return { handle: '', role: '', text: 'Suggested third attester: any other member' };
}

export async function drawPanel({ seed, members, claimant, respondent, rehearsal = false, min = TESTNET_MIN }) {
  if (seed?.length !== 48) return { ok: false, error: 'The running hash must be 48 bytes from SHA-384.' };
  const eligible = eligibleMembers(members, claimant, respondent, min);
  if (eligible.length < 3) return { ok: false, error: `Not enough eligible members for a panel of 3. ${eligible.length} can serve. The later target is ${LATER_MIN} completed IdidIt (verified receipt) exchanges.` };
  const suggestion = firstSuggestion(members, claimant, respondent, new Set(eligible.map((peer) => peer.id)));
  const ids = [];
  if (suggestion.handle) ids.push(suggestion.handle);
  let state = seed;
  let step = 0;
  const rest = eligible.filter((peer) => !ids.includes(peer.id));
  while (ids.length < 3) {
    const picked = await rejectionIndex(state, rest.length, step);
    if (!picked.ok) return picked;
    const chosen = rest.splice(picked.index, 1)[0];
    if (!chosen) return { ok: false, error: `Draw missed ${picked.index} of ${rest.length + 1}.` };
    ids.push(chosen.id);
    state = picked.state;
    step += 1;
  }
  return {
    ok: true,
    ids,
    suggestion: suggestion.text,
    label: rehearsal ? SANDBOX_LABEL : REHEARSAL_COPY,
    rehearsal: rehearsal === true,
    creditMoved: false,
    floorMoved: false
  };
}

export async function openDispute({ claimant, respondent, members, statement = '', pending = null, acknowledged = false, at = '' }) {
  if (acknowledged !== true) return { ok: false, error: 'Acknowledge the disclaimer before you open a dispute.' };
  if (!claimant?.id || !respondent?.id || claimant.id === respondent.id) return { ok: false, error: 'Choose the other member.' };
  const steward = disputeSteward(members, claimant, respondent);
  if (!steward.id) return { ok: false, error: 'A trainer, administrator, or group author has to mediate first.' };
  const day = String(at || new Date().toISOString()).slice(0, 10);
  const statementHash = await sha256(String(statement || ''));
  const agreementHash = pending?.id ? await sha256(String(pending.id)) : '';
  const disputeId = await sha256({ claimant: claimant.id, respondent: respondent.id, statementHash, day, pending: pending?.id || '' });
  const hash = await sha256({ v: 1, disputeId, claimant: claimant.id, respondent: respondent.id, steward: steward.id, agreementHash, statementHash, day });
  return {
    ok: true,
    creditMoved: false,
    floorMoved: false,
    pendingStatus: pending?.status || '',
    dispute: {
      id: disputeId,
      status: 'mediation',
      claimantId: claimant.id,
      respondentId: respondent.id,
      stewardId: steward.id,
      stewardRole: steward.role,
      agreementHash,
      statement: String(statement || ''),
      findings: '',
      statementHash,
      day,
      hash,
      pendingEntryId: pending?.id || '',
      shareConsent: { [claimant.id]: false, [respondent.id]: false },
      mediation: { result: '' },
      panel: null,
      verdict: null,
      creditMoved: false,
      floorMoved: false
    }
  };
}

export function failMediation(dispute, actorId) {
  if (!dispute || dispute.status !== 'mediation') return { ok: false, error: 'Mediation is not open.' };
  if (actorId !== dispute.stewardId) return { ok: false, error: 'The steward records that mediation failed.' };
  return { ok: true, dispute: { ...dispute, status: 'mediation-failed', mediation: { result: 'failed' }, creditMoved: false, floorMoved: false }, creditMoved: false, floorMoved: false };
}

export async function requestPanel(dispute, actorId, message, { members, rehearsal = false, min = TESTNET_MIN } = {}) {
  if (!dispute || dispute.status !== 'mediation-failed') return { ok: false, error: 'Ask for a panel only after mediation fails.' };
  if (actorId !== dispute.claimantId && actorId !== dispute.respondentId) return { ok: false, error: 'Either party can ask for the panel.' };
  const seed = runningHashSeed(message);
  if (!seed.ok) return seed;
  const claimant = (members || []).find((peer) => peer.id === dispute.claimantId);
  const respondent = (members || []).find((peer) => peer.id === dispute.respondentId);
  const drawn = await drawPanel({ seed: seed.bytes, members, claimant, respondent, rehearsal, min });
  if (!drawn.ok) return drawn;
  return {
    ok: true,
    creditMoved: false,
    floorMoved: false,
    dispute: {
      ...dispute,
      status: 'panel',
      panel: { ids: drawn.ids, suggestion: drawn.suggestion, label: drawn.label, rehearsal: drawn.rehearsal, seed: seed.hex }
    }
  };
}

export async function signVerdict(dispute, { handle, choice, publicJwk, sig, findings = '' }) {
  if (!dispute?.panel?.ids?.includes(handle)) return { ok: false, error: 'Only a panelist can sign.' };
  if (!VERDICT_CHOICES.includes(choice)) return { ok: false, error: 'Choose a write-down, mutual nullification, or no change.' };
  const payload = { action: 'verdict', disputeId: dispute.id, choice, handle };
  if (!await verifyDevice(publicJwk, payload, sig)) return { ok: false, error: 'The device signature was refused.' };
  const prior = dispute.verdict?.signatures || [];
  const signatures = [...prior.filter((row) => row.handle !== handle), { handle, choice, sig }];
  const counts = {};
  for (const row of signatures) counts[row.choice] = (counts[row.choice] || 0) + 1;
  const agreed = VERDICT_CHOICES.find((item) => counts[item] >= 2) || '';
  const signers = signatures.filter((row) => row.choice === agreed).map((row) => row.handle).sort();
  const hash = agreed ? await sha256({ v: 1, disputeId: dispute.id, choice: agreed, signers }) : '';
  return {
    ok: true,
    creditMoved: false,
    floorMoved: false,
    dispute: {
      ...dispute,
      findings: findings || dispute.findings || '',
      verdict: { signatures, choice: agreed, hash, ready: Boolean(agreed), advisory: true, confirmed: dispute.verdict?.confirmed || {} }
    }
  };
}

export async function confirmOutcome(dispute, { handle, publicJwk, sig }) {
  if (handle !== dispute?.claimantId && handle !== dispute?.respondentId) return { ok: false, error: 'Both parties confirm.' };
  if (!dispute?.verdict?.ready) return { ok: false, error: 'The panel has not reached 2 of 3.' };
  const payload = { action: 'confirm', disputeId: dispute.id, choice: dispute.verdict.choice, handle };
  if (!await verifyDevice(publicJwk, payload, sig)) return { ok: false, error: 'The device signature was refused.' };
  const confirmed = { ...(dispute.verdict.confirmed || {}), [handle]: true };
  const both = confirmed[dispute.claimantId] === true && confirmed[dispute.respondentId] === true;
  return {
    ok: true,
    noted: both,
    changed: false,
    creditMoved: false,
    floorMoved: false,
    dispute: {
      ...dispute,
      status: both ? 'noted' : dispute.status,
      creditMoved: false,
      floorMoved: false,
      verdict: { ...dispute.verdict, confirmed, advisory: true }
    }
  };
}

export function setShareConsent(dispute, handle, on) {
  if (handle !== dispute?.claimantId && handle !== dispute?.respondentId) return { ok: false, error: 'A party chooses what leaves the phone.' };
  return { ok: true, dispute: { ...dispute, shareConsent: { ...dispute.shareConsent, [handle]: on === true } } };
}

export function publicDispute(dispute) {
  const both = dispute?.shareConsent?.[dispute.claimantId] === true && dispute?.shareConsent?.[dispute.respondentId] === true;
  const row = {
    hash: dispute.hash,
    day: dispute.day,
    status: dispute.status,
    verdictHash: dispute.verdict?.hash || ''
  };
  if (both) {
    row.bothConsent = true;
    row.statement = dispute.statement || '';
    row.findings = dispute.findings || '';
  }
  return row;
}

export function messageFromMirror(row = {}) {
  return {
    running_hash: row.runningHash || row.running_hash || '',
    running_hash_version: row.runningHashVersion || row.running_hash_version,
    sequence_number: row.sequence || row.sequence_number,
    consensus_timestamp: row.consensus || row.consensus_timestamp,
    contents: row.contents || ''
  };
}
