import { progressRows } from './gym-progress.mjs';

function sees(owner, viewer, share) {
  if (share === 'board') return true;
  if (share !== 'groups') return false;
  const mine = new Set(Object.keys(viewer?.clubGroups || {}));
  return Object.keys(owner?.clubGroups || {}).some((code) => mine.has(code));
}

function groupName(peer) {
  const groups = Object.values(peer?.clubGroups || {});
  return groups[0]?.name || 'Club';
}

export function communityFeed({ peers, viewer, remoteCards = [], now = new Date() } = {}) {
  const items = [];
  for (const peer of peers || []) {
    if (!peer || peer.id === viewer?.id) continue;
    const rows = progressRows(peer, now);
    for (const row of rows) {
      if (!sees(peer, viewer, row.share)) continue;
      items.push({
        at: `${row.week}T00:00:00.000Z`,
        handle: peer.name || 'Member',
        group: groupName(peer),
        example: Boolean(peer.example),
        text: `${peer.name} logged ${row.current} ${row.unit}. ${row.label}.`,
        kind: 'progress'
      });
    }
    if (sees(peer, viewer, peer.gymProgress?.share?.verified)) {
      for (const session of Object.values(peer.exerciseSessions || {})) {
        if (!String(session.evidence || '').includes('verified by')) continue;
        items.push({
          at: session.day ? `${session.day}T12:00:00.000Z` : '',
          handle: peer.name || 'Member',
          group: groupName(peer),
          example: Boolean(peer.example),
          text: `${peer.name} has a verified session.`,
          kind: 'verified'
        });
      }
    }
    for (const wisdom of Object.values(peer.wisdomSubmissions || {})) {
      if (wisdom.status !== 'published') continue;
      items.push({
        at: wisdom.at || '',
        handle: wisdom.anonymous ? 'anonymous' : (wisdom.handle || peer.name || 'Member'),
        group: groupName(peer),
        example: Boolean(peer.example),
        text: `Wisdom concurred: ${wisdom.theme || 'a line'}.`,
        kind: 'wisdom'
      });
    }
    if (sees(peer, viewer, peer.gymProgress?.share?.['credits-earned'])) {
      for (const entry of peer.tape || []) {
        const payload = entry.payload || {};
        if (payload.toId !== peer.id) continue;
        if (!['transfer', 'EXERCISE_CREDIT', 'WISDOM_SUPPORT'].includes(entry.type)) continue;
        items.push({
          at: entry.at || '',
          handle: peer.name || 'Member',
          group: groupName(peer),
          example: Boolean(peer.example),
          text: `${peer.name} received support.`,
          kind: 'support'
        });
      }
    }
  }
  for (const card of remoteCards || []) {
    if (!card?.handle || card.number == null) continue;
    items.push({
      at: card.week ? `${card.week}T00:00:00.000Z` : '',
      handle: card.handle,
      group: 'Shared board',
      example: Boolean(card.example),
      text: card.line || `${card.handle} logged ${card.number} ${card.unit}.`,
      kind: 'progress'
    });
  }
  return items.filter((item) => item.text).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
