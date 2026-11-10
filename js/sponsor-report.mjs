import { merkleProofFor, merkleRootOf, verifyMerkleProof } from './clearing.mjs';
import { sponsorInGroup } from './covenant.mjs';
import { replay } from './p2p-exchange-sim.mjs';

export const TESTNET_TOPIC = '0.0.11397291';
export const MEMBER_LIMITS = Object.freeze({ initial: -50, maximum: -200 });
const DAY = 24 * 60 * 60 * 1000;

const CREDIT_TYPES = new Set([
  'genesis', 'transfer', 'settlement', 'attested',
  'SUBFLOOR_SKIM', 'SUBFLOOR_DONATION', 'SUBFLOOR_PAYOUT', 'SUBFLOOR_HOLD', 'SUBFLOOR_RELEASE',
  'COMMONS_WITHHOLD', 'ZERO_PRICE_SPLIT', 'DEED_ATTESTED', 'DEED_POST'
]);

const HEALTH_TYPES = /EXERCISE|WISDOM|health|workout/i;

export function sponsorCount(record) {
  return (record?.sponsors || []).length;
}

export function sponsorCountText(record) {
  return `Sponsors: ${sponsorCount(record)}.`;
}

export function inMemberGroup(member, sponsor) {
  return sponsorInGroup(member, sponsor);
}

export function sponsorshipReady(member, sponsors = member?.covenant?.sponsors || []) {
  const count = (sponsors || []).length;
  const group = (sponsors || []).some((sponsor) => inMemberGroup(member, sponsor));
  if (count < 2) return { ok: false, count, error: `Sponsors: ${count}. At least 2 sponsors, including one from your group.` };
  if (!group) return { ok: false, count, error: `Sponsors: ${count}. One sponsor must be from your group. The group creator may sponsor you.` };
  return { ok: true, count, error: '' };
}

function healthEntry(entry) {
  if (HEALTH_TYPES.test(entry?.type || '')) return true;
  const blob = JSON.stringify(entry?.payload || {});
  return /health|workout|mood|sleep|latitude|longitude|gps|photo/i.test(blob);
}

function floorAmount(entry) {
  if (entry.type === 'SUBFLOOR_DONATION' || entry.type === 'COMMONS_WITHHOLD') return Number(entry.payload?.amount) || 0;
  if (entry.type === 'ZERO_PRICE_SPLIT') return Number(entry.payload?.floor) || 0;
  return 0;
}

export function memberVelocity(peer, now = Date.now()) {
  const cutoff = now - 90 * DAY;
  let net = 0;
  const played = replay(peer);
  const rows = played.rows || [];
  for (let index = 0; index < rows.length; index += 1) {
    const entry = (peer.tape || [])[index] || {};
    const row = rows[index];
    if (healthEntry(entry)) continue;
    const at = Date.parse(entry.at || row.at || '');
    if (!Number.isFinite(at) || at < cutoff) continue;
    net += (row.credit || 0) - (row.debit || 0);
  }
  return { days: 90, net: Math.round(net * 100) / 100, acrossGroups: true };
}

export async function creditReport(peer, { authorizeHealth = false, now = Date.now() } = {}) {
  if (peer?.covenant?.reportAccess === false) return { ok: false, error: 'This member revoked sponsor reports.' };
  const tape = peer?.tape || [];
  const leaves = tape.map((entry) => String(entry.hash || ''));
  const played = replay(peer);
  const rows = [];
  for (let index = 0; index < tape.length; index += 1) {
    const entry = tape[index];
    const health = healthEntry(entry);
    if (health && !authorizeHealth) continue;
    if (!health && !CREDIT_TYPES.has(entry.type)) continue;
    if (!entry.hash) continue;
    const proof = await merkleProofFor(leaves, index);
    const view = (played.rows || [])[index] || {};
    rows.push({
      index,
      type: health ? 'health-authorized' : entry.type,
      hash: entry.hash,
      at: entry.at || '',
      debit: view.debit || 0,
      credit: view.credit || 0,
      floor: health ? 0 : floorAmount(entry),
      proof,
      included: proof ? await verifyMerkleProof(proof) : false
    });
  }
  const root = leaves.some(Boolean) ? await merkleRootOf(leaves) : '';
  return {
    ok: true,
    handle: peer.id,
    balance: played.balance,
    limits: { ...MEMBER_LIMITS, balance: played.balance, acrossGroups: true },
    velocity: memberVelocity(peer, now),
    floor: Math.round(rows.reduce((sum, row) => sum + row.floor, 0) * 100) / 100,
    root,
    rows,
    healthIncluded: authorizeHealth === true
  };
}

export function mirrorMatch(root, messages = []) {
  const needle = String(root || '');
  if (!needle) return false;
  return messages.some((message) => message?.root === needle || String(message?.contents || '').includes(needle));
}
