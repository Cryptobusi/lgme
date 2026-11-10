export const PAIR_KEY = 'lgme.pairing';

export const NEIGHBOR_DEEDS = Object.freeze([
  { id: 'ride', label: 'Ride', unit: 'one ride' },
  { id: 'meal', label: 'Meal or meal drop', unit: 'one meal' },
  { id: 'errand', label: 'Errand', unit: 'one errand' },
  { id: 'yard', label: 'Yard or garden hour', unit: 'one hour' },
  { id: 'repair', label: 'Light repair or DIY', unit: 'one hour' },
  { id: 'companion', label: 'Companion call or visit', unit: 'one call or visit' },
  { id: 'tech', label: 'Tech help', unit: 'one hour' },
  { id: 'dog', label: 'Dog walking', unit: 'one walk' }
]);

export const EXCLUDED_NOTE = 'Not offered: personal care such as bathing, toileting, or medication, and unsupervised work with children.';

export const SENIOR_DEEDS = Object.freeze(['companion', 'meal', 'walk']);

export const HOST_KINDS = Object.freeze([
  ['church', 'Church or faith group'],
  ['library', 'Library'],
  ['center', 'Community center'],
  ['veterans', 'Veterans post'],
  ['senior', 'Senior living'],
  ['club', 'Club']
]);

export function emptyBook() {
  return { deeds: [], hosts: [], circles: [], stories: [] };
}

export function readBook(storage = globalThis.localStorage) {
  try { return { ...emptyBook(), ...JSON.parse(storage.getItem(PAIR_KEY) || '{}') }; } catch { return emptyBook(); }
}

export function writeBook(book, storage = globalThis.localStorage) {
  storage.setItem(PAIR_KEY, JSON.stringify(book));
}

export function catalogFor(host) {
  if (host?.kind === 'senior') {
    return [
      NEIGHBOR_DEEDS.find((row) => row.id === 'companion'),
      NEIGHBOR_DEEDS.find((row) => row.id === 'meal'),
      { id: 'walk', label: 'Escorted walk', unit: 'one walk' }
    ];
  }
  return NEIGHBOR_DEEDS;
}

export function postDeed(book, spec) {
  const deed = catalogFor(spec.host).find((row) => row.id === spec.deedId) || NEIGHBOR_DEEDS.find((row) => row.id === spec.deedId);
  if (!deed) return { ok: false, error: EXCLUDED_NOTE };
  if (spec.host?.kind === 'senior' && !['companion', 'meal', 'walk'].includes(deed.id)) return { ok: false, error: 'A senior-living host keeps to companion calls, meal drops, and escorted walks.' };
  const row = {
    id: `deed-${book.deeds.length + 1}`,
    deedId: deed.id,
    label: deed.label,
    unit: deed.unit,
    side: spec.side === 'IwantIT' ? 'IwantIT' : 'IhavIT',
    by: String(spec.by || 'member'),
    hostId: spec.hostId || '',
    circleId: spec.circleId || '',
    verified: false,
    hedera: false
  };
  book.deeds.push(row);
  return { ok: true, deed: row };
}

export function verifyDeed(book, id, verifier) {
  const deed = book.deeds.find((row) => row.id === id);
  if (!deed) return { ok: false, error: 'No deed.' };
  if (verifier && verifier === deed.by) return { ok: false, error: 'Someone else verifies.' };
  deed.verified = true;
  deed.verifier = verifier || 'neighbor';
  return { ok: true, deed };
}

export function hostSteward(host) {
  const trainers = (host.members || []).filter((member) => member.trainer).sort((a, b) => String(a.trainerAt || '').localeCompare(String(b.trainerAt || '')) || a.id.localeCompare(b.id));
  if (trainers.length) return trainers[0].id;
  return host.creator || '';
}

export function createHost(book, spec) {
  const name = String(spec.name || '').trim().slice(0, 60);
  const kind = HOST_KINDS.some(([id]) => id === spec.kind) ? spec.kind : 'club';
  if (name.length < 2) return { ok: false, error: 'Name the host.' };
  const invite = String(spec.invite || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
  const host = {
    id: invite || `host-${book.hosts.length + 1}`,
    name,
    kind,
    invite,
    creator: spec.by || 'member',
    members: [{ id: spec.by || 'member', name: spec.byName || spec.by || 'member', trainer: false, trainerAt: '' }],
    events: []
  };
  book.hosts.push(host);
  return { ok: true, host };
}

export function joinHost(book, invite, member) {
  const host = book.hosts.find((row) => row.invite === invite);
  if (!host) return { ok: false, error: 'No host is using that invite code on this phone.' };
  if (!host.members.some((row) => row.id === member.id)) host.members.push({ id: member.id, name: member.name, trainer: false, trainerAt: '' });
  return { ok: true, host };
}

export function addMatchingHour(book, hostId, spec) {
  const host = book.hosts.find((row) => row.id === hostId);
  if (!host) return { ok: false, error: 'No host.' };
  const event = { id: `hour-${host.events.length + 1}`, date: spec.date || '', time: spec.time || '', place: spec.place || '', rsvps: [], reminders: [] };
  host.events.push(event);
  return { ok: true, event };
}

export function checkIn(event, memberId) {
  event.reminders = [...new Set([...(event.reminders || []), memberId])];
  return { ok: true, reminder: true, attendance: null };
}

export function createCircle(book, spec) {
  const name = String(spec.name || '').trim().slice(0, 60);
  const privacy = spec.privacy === 'high' ? 'high' : 'open';
  if (name.length < 2) return { ok: false, error: 'Name the circle.' };
  const circle = {
    id: `circle-${book.circles.length + 1}`,
    name,
    privacy,
    condition: privacy === 'high' ? String(spec.condition || '').slice(0, 40) : '',
    creator: spec.by || 'member'
  };
  book.circles.push(circle);
  return { ok: true, circle };
}

export function draftStory(deed) {
  const unit = String(deed.unit || 'a hand').replace(/^one /, 'a ');
  return deed.side === 'IwantIT' ? `I received ${unit}.` : `I gave ${unit}.`;
}

export function publishStory(book, spec) {
  const circle = book.circles.find((row) => row.id === spec.circleId);
  if (circle?.privacy === 'high' && spec.audience !== 'circle') return { ok: false, error: 'A high-privacy circle stays off public pages.' };
  const text = String(spec.text || '').trim().slice(0, 280);
  if (!spec.consent) return { ok: false, error: 'Consent before a story is shown.' };
  if (/@\w+/.test(text) && !spec.otherConsent) return { ok: false, error: 'Leave out the other person unless they consent.' };
  const story = {
    id: `story-${book.stories.length + 1}`,
    text,
    audience: spec.audience || 'public',
    circleId: spec.circleId || '',
    hostId: spec.hostId || '',
    consented: true,
    otherConsent: spec.otherConsent === true,
    withdrawn: false,
    hedera: false
  };
  book.stories.push(story);
  return { ok: true, story };
}

export function withdrawStory(book, id) {
  const story = book.stories.find((row) => row.id === id);
  if (!story) return { ok: false, error: 'No story.' };
  story.withdrawn = true;
  return { ok: true, story };
}

export function publicStories(book) {
  return book.stories.filter((story) => story.consented && !story.withdrawn && story.audience === 'public' && story.hedera === false);
}

export function publicCounts(book) {
  const byCategory = {};
  const byHost = {};
  let privateReceipts = 0;
  for (const deed of book.deeds) {
    if (!deed.verified) continue;
    const circle = book.circles.find((row) => row.id === deed.circleId);
    if (circle?.privacy === 'high') { privateReceipts += 1; continue; }
    byCategory[deed.label] = (byCategory[deed.label] || 0) + 1;
    const host = book.hosts.find((row) => row.id === deed.hostId);
    if (host) byHost[host.name] = (byHost[host.name] || 0) + 1;
  }
  return { byCategory, byHost, privateReceipts };
}
