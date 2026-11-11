const HEALTH = {
  ididit: [
    ['I did the session', 'Example. A finished session, kept on this phone.'],
    ['I finished a walk', 'Example. A walk you already did.'],
    ['I stretched', 'Example. A short stretch you finished.'],
    ['Morning mobility', 'Example. A mobility session on this phone.'],
    ['Strength session', 'Example. A strength session you finished.'],
    ['Group walk', 'Example. A walk with the group.'],
    ['Cool down', 'Example. A cool down you finished.']
  ],
  iwantit: [
    ['A ride to the park', 'Example. Asking for a ride.'],
    ['Spotting for a set', 'Example. Asking for a spot.'],
    ['A quiet walk partner', 'Example. Asking for company on a walk.'],
    ['Help setting up a mat', 'Example. Asking for help with the room.'],
    ['A check-in after a session', 'Example. A hello after a session, not a clinic visit.'],
    ['Someone to walk with', 'Example. Asking for a walking partner.'],
    ['A stretch partner', 'Example. Asking someone to stretch with you.']
  ],
  ihavit: [
    ['I can lead a walk', 'Example. An offer to lead a walk.'],
    ['I can spot a set', 'Example. An offer to spot.'],
    ['I can bring a mat', 'Example. An offer to bring a mat.'],
    ['I can host a stretch', 'Example. An offer to host stretching.'],
    ['I can walk this week', 'Example. An offer to walk.'],
    ['I can set up the room', 'Example. An offer to set up.'],
    ['I can join a session', 'Example. An offer to join.']
  ]
};

function dated(rows, prefix) {
  return rows.map((pair, index) => ({
    id: `${prefix}-${index}`,
    title: pair[0],
    line: pair[1],
    example: true,
    at: `2026-11-${String(11 - index).padStart(2, '0')}`
  }));
}

export function listingsFor(categoryId, actionId) {
  const action = String(actionId || '');
  if (categoryId === 'health' && HEALTH[action]) return dated(HEALTH[action], `health-${action}`);
  const samples = HEALTH[action] || HEALTH.ididit;
  return dated(samples.slice(0, 6).map((pair) => [pair[0], `Example. Browse only. ${pair[1]}`]), `${categoryId}-${action}`);
}
