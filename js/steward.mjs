import { replay } from './p2p-exchange-sim.mjs';

export function clearedOnce(peer) {
  let nonzero = false;
  for (const row of replay(peer).rows || []) {
    if (Math.abs(Number(row.balance) || 0) > 0.001) nonzero = true;
    else if (nonzero) return true;
  }
  return false;
}

export function stewardEligible(peer) {
  return peer?.intake?.status === 'Tier-1' && clearedOnce(peer);
}

export function isTrainer(peer) {
  return peer?.gymRole === 'trainer' || peer?.trainer === true;
}

export function setTrainer(peer, on, at = new Date().toISOString()) {
  const next = { ...peer, gymRole: on ? 'trainer' : 'member', trainer: on === true, clubGroups: { ...(peer.clubGroups || {}) } };
  if (on) next.trainerAt = peer.trainerAt || at;
  for (const code of Object.keys(next.clubGroups)) {
    const group = { ...next.clubGroups[code] };
    if (on) group.trainerAt = group.trainerAt || next.trainerAt;
    next.clubGroups[code] = group;
  }
  return next;
}

export function trainingOffer(peer, spec = {}) {
  if (!isTrainer(peer)) return { ok: false, error: 'Turn on the trainer badge first.' };
  const kind = spec.kind === 'IselIT' ? 'IselIT' : 'IhavIT';
  const credit = spec.credit === true;
  const offer = { kind, title: 'Training', credit };
  if (credit && peer.intake?.status !== 'Tier-1') {
    return { ok: true, creditOpen: false, offer: { ...offer, gates: 'pending' }, note: 'Credit waits on the same 5-gate intake check.' };
  }
  return { ok: true, creditOpen: credit, offer: { ...offer, gates: credit ? 'passed' : 'none' }, note: credit ? 'The 5 gates are passed. A session still mints no credit by itself.' : 'Listed. No credit is drawn.' };
}

export function isGroupAdmin(peer, code) {
  const group = peer?.clubGroups?.[code];
  if (!group) return false;
  return group.creator === peer.id || group.role === 'trainer';
}

function trainerStamp(peer, code) {
  return peer.clubGroups?.[code]?.trainerAt || peer.trainerAt || '';
}

export function groupSteward(members, code) {
  const rows = (members || []).filter((peer) => peer.clubGroups?.[code]);
  const assigned = rows.find((peer) => peer.clubGroups[code].stewardSet === 'assigned' && peer.clubGroups[code].steward);
  if (assigned) return assigned.clubGroups[code].steward;
  const trainers = rows.filter((peer) => isTrainer(peer)).sort((a, b) => {
    const at = trainerStamp(a, code);
    const bt = trainerStamp(b, code);
    if (at && bt && at !== bt) return at < bt ? -1 : 1;
    if (at && !bt) return -1;
    if (!at && bt) return 1;
    return a.id.localeCompare(b.id);
  });
  if (trainers.length) return trainers[0].id;
  return rows.map((peer) => peer.clubGroups[code].creator).find(Boolean) || '';
}

export function sponsorIds(peer) {
  const reviews = (peer?.intake?.reviews || []).map((row) => row.handle);
  const signed = (peer?.covenant?.sponsors || []).map((row) => row.handle || row);
  return [...new Set([...reviews, ...signed].filter(Boolean))];
}

export function routeSteward({ steward, members, sponsors, requested }) {
  const conflict = Boolean(requested) || (sponsors || []).includes(steward);
  if (!conflict) return { steward, conflict: false, alternate: '' };
  const alternate = (members || []).find((peer) => stewardEligible(peer) && peer.id !== steward && !(sponsors || []).includes(peer.id));
  return { steward: alternate?.id || '', conflict: true, alternate: alternate?.id || '' };
}

export function changeSteward(members, code, candidateId, actorId) {
  const actor = (members || []).find((peer) => peer.id === actorId);
  const candidate = (members || []).find((peer) => peer.id === candidateId);
  if (!actor || !candidate || !actor.clubGroups?.[code] || !candidate.clubGroups?.[code]) {
    return { ok: false, error: 'Choose a member of the group.' };
  }
  if (!isGroupAdmin(actor, code)) return { ok: false, error: 'A club admin can change the steward. Other members can vote.' };
  if (!stewardEligible(candidate)) return { ok: false, error: 'A steward is a Tier-1 member who has cleared a balance once.' };
  return { ok: true, steward: candidateId };
}

export function majoritySteward(votes, memberCount) {
  const tally = {};
  for (const candidate of Object.values(votes || {})) {
    if (!candidate) continue;
    tally[candidate] = (tally[candidate] || 0) + 1;
  }
  const winner = Object.entries(tally).find(([, count]) => count > memberCount / 2);
  return winner ? winner[0] : '';
}

export function queueFor(stewardId, members, code) {
  const group = groupSteward(members, code);
  const rows = [];
  for (const peer of members || []) {
    if (!peer.clubGroups?.[code] || !peer.intake) continue;
    const sponsors = sponsorIds(peer);
    if (sponsors.includes(stewardId)) {
      rows.push({ id: peer.id, name: peer.name, kind: 'conflict', text: `${peer.name} was routed away. A steward does not review someone they sponsored.` });
      continue;
    }
    const route = routeSteward({ steward: group, members, sponsors, requested: peer.intake.stewardRequest === true });
    if (route.steward !== stewardId) continue;
    if (peer.intake.status === 'Split') rows.push({ id: peer.id, name: peer.name, kind: 'split', text: `${peer.name}: the sponsors disagree.` });
    if (peer.intake.limitRequest && !peer.intake.limitRequest.approved) rows.push({ id: peer.id, name: peer.name, kind: 'raise', text: `${peer.name} asked for a limit of ${peer.intake.limitRequest.to}.` });
    for (const note of peer.intake.mediation || []) rows.push({ id: peer.id, name: peer.name, kind: 'mediation', text: `${peer.name} asked for mediation. ${note}` });
  }
  return rows;
}
