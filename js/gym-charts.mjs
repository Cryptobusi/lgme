const PRIVATE_KEYS = ['healthNote', 'health', 'photos', 'points', 'bundle'];

export function memberStats(peer) {
  const sessions = Object.values(peer?.exerciseSessions || {});
  const weeks = [0, 0, 0, 0];
  let minutes = 0;
  let verified = 0;
  let unverified = 0;
  const maxims = {};
  for (const session of sessions) {
    const day = Date.parse(`${session.day || ''}T00:00:00Z`);
    const index = Number.isFinite(day) ? Math.min(3, Math.max(0, Math.floor((Date.now() - day) / 604800000))) : 0;
    weeks[3 - index] += 1;
    minutes += Math.max(0, Math.round(Number(session.durationSec || 0) / 60));
    if (String(session.evidence || '').includes('verified by')) verified += 1;
    else unverified += 1;
    if (session.intent) maxims[session.intent] = (maxims[session.intent] || 0) + 1;
  }
  let given = 0;
  let received = 0;
  let deedCredits = 0;
  for (const entry of peer?.tape || []) {
    const payload = entry.payload || {};
    if (entry.type === 'EXERCISE_CREDIT' && payload.toId === peer.id) deedCredits += Number(payload.authorShare || payload.amount || 0);
    if (payload.fromId === peer.id) given += 1;
    if (payload.toId === peer.id) received += 1;
  }
  return { weeks, minutes, verified, unverified, maxims, given, received, deedCredits: Math.round(deedCredits * 100) / 100, sessions: sessions.length };
}

export function barsSvg(values, label) {
  const nums = (values || []).map((value) => Number(value) || 0);
  const peak = Math.max(1, ...nums);
  const width = 280;
  const height = 120;
  const gap = 8;
  const barWidth = (width - gap * (nums.length + 1)) / Math.max(1, nums.length);
  const bars = nums.map((value, index) => {
    const h = Math.round((value / peak) * 80);
    const x = gap + index * (barWidth + gap);
    const y = 96 - h;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="6" fill="#c6a15b"></rect>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}" width="100%" height="120">${bars}</svg>`;
}

export function publicCard(peer) {
  const profile = peer?.gymProfile || {};
  const shown = profile.public || {};
  const stats = memberStats(peer);
  const card = {
    handle: peer?.name || 'Member',
    role: peer?.gymRole || 'member',
    example: Boolean(peer?.example)
  };
  if (shown.journey) card.journey = String(profile.journey || '');
  if (shown.sessions) card.sessions = stats.sessions;
  if (shown.minutes) card.minutes = stats.minutes;
  if (shown.supports) card.supports = { given: stats.given, received: stats.received };
  if (shown.credits) card.credits = stats.deedCredits;
  for (const key of PRIVATE_KEYS) delete card[key];
  return card;
}
