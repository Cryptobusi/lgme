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

export function isGroupAdmin(peer, code) {
  const group = peer?.clubGroups?.[code];
  if (!group) return false;
  return group.role === 'trainer' || peer.gymRole === 'trainer' || group.creator === peer.id;
}

export function groupSteward(members, code) {
  const rows = (members || []).filter((peer) => peer.clubGroups?.[code]);
  const assigned = rows.find((peer) => peer.clubGroups[code].stewardSet === 'assigned' && peer.clubGroups[code].steward);
  if (assigned) return assigned.clubGroups[code].steward;
  const trainer = rows.find((peer) => peer.gymRole === 'trainer' || peer.clubGroups[code].role === 'trainer');
  if (trainer) return trainer.id;
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
