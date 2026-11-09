/**
 * My Picture prototype.
 * Sample data only. This module never fetches, never publishes, and never calls a wallet.
 */

export const STORAGE_KEY = 'lgme.my-picture.demo.v2';

export const CONSENT_COPY = 'Allow on-device AI to learn your patterns and suggest unexpected matches? Your data never leaves this device.';

export const GUARDRAILS = [
  'AI suggests, you decide',
  'Nothing is published without your tap',
  'No personal data on the public Tape'
];

export const PILLARS = [
  { id: 'want', name: 'WANT', detail: 'Needs & Supplies Sought', tone: 'want' },
  { id: 'did', name: 'DID', detail: 'Verified Work Proofs', tone: 'did' },
  { id: 'sell', name: 'SELL', detail: 'Active Surplus & Skills', tone: 'sell' },
  { id: 'wish', name: 'WISH', detail: 'Aspirational & Civic Dreams', tone: 'wish' },
  { id: 'duty', name: 'DUTY', detail: 'Mutual Clearing & Pledges', tone: 'duty' }
];

export const QUICK_FILL = {
  want: { title: 'Log a need', partner: 'Who would you like?' },
  did: { title: 'Attest verified work', partner: 'Who was with you?' },
  sell: { title: 'List surplus', partner: 'Who is this for?' },
  wish: { title: 'Name a wish', partner: 'Who shares it?' },
  duty: { title: 'Pledge a duty', partner: 'Who is it owed to?' }
};

const SAMPLE = {
  version: 2,
  label: 'sample',
  consent: null,
  serendipity: false,
  learned: [],
  forgottenIds: [],
  dismissedIds: [],
  acceptedIds: [],
  localSeq: 1,
  profile: {
    name: 'Kaelen Vance',
    role: 'Sovereign Node',
    initials: 'LG',
    peer: 'sample:0x8f2a…d31c'
  },
  summary: {
    balance: 142.5,
    cycleDelta: 14.5,
    trust: 99.4,
    proofs: 38,
    openLoops: 3,
    dualSigns: 1,
    dutyPledgesComplete: 2,
    campusCredit: 12,
    creditLimit: 40,
    debitLimit: -20,
    weeklyCap: 10
  },
  history: {
    lastCategory: 'Garden',
    usualHours: 2,
    location: 'Oak Ridge commons',
    partners: ['Elena Voss', 'Marcus Hale', 'Clara Shepherd', 'Civic Commons']
  },
  categories: ['Garden', 'Timber', 'Surplus', 'Civic', 'Tools'],
  hoursOptions: [1, 1.5, 2, 3],
  locations: ['Oak Ridge commons', 'Oak Ridge trail', 'Solar shed', 'Mill shed'],
  didGoal: 5,
  did: [
    { id: 'did-timber', title: 'Timber Framing for Greenhouse', category: 'Timber', hours: 2, partner: 'Clara Shepherd', location: 'Oak Ridge commons', when: 'Today, 08:30', hash: 'sample:0x7d2f' },
    { id: 'did-garden', title: 'Garden bed prep', category: 'Garden', hours: 2, partner: 'Elena Voss', location: 'Oak Ridge commons', when: 'Yesterday', hash: 'sample:0x11aa' },
    { id: 'did-tool', title: 'Tool bench hour', category: 'Tools', hours: 1.5, partner: 'Devon Miller', location: 'Mill shed', when: 'Nov 5', hash: 'sample:0x4a8c' }
  ],
  wants: [
    { id: 'want-cedar', title: 'Cedar boards', category: 'Timber', hours: 2, partner: null, location: 'Mill shed', status: 'open', hash: 'sample:0xa101' },
    { id: 'want-glass', title: 'Glazing sheets', category: 'Garden', hours: 1, partner: null, location: 'Oak Ridge commons', status: 'open', hash: 'sample:0xa102' },
    { id: 'want-gloves', title: 'Work gloves', category: 'Tools', hours: 1, partner: null, location: 'Mill shed', status: 'open', hash: 'sample:0xa103' },
    { id: 'want-gravel', title: 'Trail gravel', category: 'Civic', hours: 2, partner: null, location: 'Oak Ridge trail', status: 'open', hash: 'sample:0xa104' }
  ],
  sells: [
    { id: 'sell-seeds', title: 'Surplus Heirloom Seeds ⇄ Solar kWh', category: 'Garden', hours: 2, partner: 'Marcus Hale', location: 'Solar shed', status: 'new', expiresInDays: 1, hash: 'sample:0xb201' },
    { id: 'sell-mallet', title: 'Hand-turned oak mallet', category: 'Tools', hours: 1, partner: null, location: 'Mill shed', status: 'viewed', expiresInDays: 2, hash: 'sample:0xb202' },
    { id: 'sell-offcut', title: 'Greenhouse framing offcut', category: 'Timber', hours: 2, partner: null, location: 'Oak Ridge commons', status: 'new', expiresInDays: 8, hash: 'sample:0xb203' },
    { id: 'sell-compost', title: 'Compost crates', category: 'Garden', hours: 1.5, partner: null, location: 'Oak Ridge commons', status: 'matched', expiresInDays: 6, hash: 'sample:0xb204' },
    { id: 'sell-battery', title: 'Battery bank hour', category: 'Surplus', hours: 2, partner: 'Marcus Hale', location: 'Solar shed', status: 'new', expiresInDays: 9, hash: 'sample:0xb205' },
    { id: 'sell-markers', title: 'Trail marker kit', category: 'Civic', hours: 1, partner: null, location: 'Oak Ridge trail', status: 'viewed', expiresInDays: 5, hash: 'sample:0xb206' },
    { id: 'sell-trays', title: 'Seedling trays', category: 'Garden', hours: 2, partner: 'Elena Voss', location: 'Oak Ridge commons', status: 'new', expiresInDays: 4, hash: 'sample:0xb207' }
  ],
  wishes: [
    { id: 'wish-glass', title: 'Community greenhouse glass', category: 'Garden', hours: 2, partner: null, location: 'Oak Ridge commons', status: 'open', hash: 'sample:0xc301' },
    { id: 'wish-shade', title: 'Civic shade pavilion', category: 'Civic', hours: 2, partner: 'Clara Shepherd', location: 'Oak Ridge commons', status: 'matched', hash: 'sample:0xc302' },
    { id: 'wish-market', title: 'Night market stall', category: 'Surplus', hours: 1, partner: null, location: 'Solar shed', status: 'open', hash: 'sample:0xc303' }
  ],
  duties: [
    { id: 'duty-terrace', title: 'Elena needs Garden Bed Terracing', category: 'Garden', hours: 2, partner: 'Elena Voss', location: 'Oak Ridge commons', dueInDays: 1, hash: 'sample:0xd401' },
    { id: 'duty-culvert', title: 'Oak Ridge Trail Culvert Clearing', category: 'Civic', hours: 2, partner: 'Civic Commons', location: 'Oak Ridge trail', dueInDays: 3, hash: 'sample:0x3c5d' }
  ],
  feed: [
    { id: 'feed-timber', title: 'Timber Framing for Greenhouse', who: 'clara_shepherd', when: 'Today, 08:30', amount: '+3.50 HRS', hash: 'sample:0x7d2f', tone: 'did' },
    { id: 'feed-culvert', title: 'Oak Ridge Trail Culvert Clearing', who: 'civic_commons', when: 'Yesterday', amount: '2.00 HRS PLEDGE', hash: 'sample:0x3c5d', tone: 'duty' },
    { id: 'feed-tool', title: 'Sold: Hand-Turned Oak Tool', who: 'devon_miller', when: 'Nov 5', amount: '+1.80 HRS', hash: 'sample:0x4a8c', tone: 'sell' }
  ],
  ledgerHistory: [
    { id: 'hist-open', title: 'Sample opening balance', when: 'Sample', delta: '+142.50 HRS' },
    { id: 'hist-timber', title: 'Timber Framing for Greenhouse', when: 'Today, 08:30', delta: '+3.50 HRS' },
    { id: 'hist-tool', title: 'Sold: Hand-Turned Oak Tool', when: 'Nov 5', delta: '+1.80 HRS' }
  ],
  notifications: {
    urgent: [],
    digest: [{ day: 'Today', items: [{ id: 'n0', text: 'Sample feed is on this device. Nothing was published.' }] }]
  }
};

export function createSampleState() {
  return structuredClone(SAMPLE);
}

export function normalizeState(parsed) {
  const base = createSampleState();
  if (!parsed || parsed.label !== 'sample' || parsed.version !== 2) return base;
  return {
    ...base,
    ...parsed,
    profile: { ...base.profile, ...(parsed.profile || {}) },
    summary: { ...base.summary, ...(parsed.summary || {}) },
    history: {
      ...base.history,
      ...(parsed.history || {}),
      partners: parsed.history && Array.isArray(parsed.history.partners) ? parsed.history.partners : base.history.partners
    },
    did: Array.isArray(parsed.did) ? parsed.did : base.did,
    wants: Array.isArray(parsed.wants) ? parsed.wants : base.wants,
    sells: Array.isArray(parsed.sells) ? parsed.sells : base.sells,
    wishes: Array.isArray(parsed.wishes) ? parsed.wishes : base.wishes,
    duties: Array.isArray(parsed.duties) ? parsed.duties : base.duties,
    feed: Array.isArray(parsed.feed) ? parsed.feed : base.feed,
    ledgerHistory: Array.isArray(parsed.ledgerHistory) ? parsed.ledgerHistory : base.ledgerHistory,
    notifications: parsed.notifications && Array.isArray(parsed.notifications.digest) ? parsed.notifications : base.notifications,
    categories: Array.isArray(parsed.categories) ? parsed.categories : base.categories,
    hoursOptions: Array.isArray(parsed.hoursOptions) ? parsed.hoursOptions : base.hoursOptions,
    locations: Array.isArray(parsed.locations) ? parsed.locations : base.locations,
    dismissedIds: Array.isArray(parsed.dismissedIds) ? parsed.dismissedIds : [],
    acceptedIds: Array.isArray(parsed.acceptedIds) ? parsed.acceptedIds : [],
    forgottenIds: Array.isArray(parsed.forgottenIds) ? parsed.forgottenIds : [],
    learned: Array.isArray(parsed.learned) ? parsed.learned : []
  };
}

export function loadState(storage) {
  if (!storage) return createSampleState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createSampleState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return createSampleState();
  }
}

export function saveState(storage, state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function weeklyHours(state) {
  const total = state.did.reduce((sum, deed) => sum + Number(deed.hours || 0), 0);
  return Math.round(total * 10) / 10;
}

export function didProgress(state) {
  const done = state.did.length;
  const goal = state.didGoal || 0;
  return { done, goal, ratio: goal === 0 ? 0 : Math.min(1, done / goal) };
}

export function creditGauge(summary) {
  const min = Number(summary.debitLimit);
  const max = Number(summary.creditLimit);
  const value = Number(summary.campusCredit);
  const span = max - min;
  const ratio = span === 0 ? 0 : (value - min) / span;
  const zero = span === 0 ? 0 : (0 - min) / span;
  return { min, max, value, ratio: clamp(ratio, 0, 1), zero: clamp(zero, 0, 1) };
}

export function pillarMetrics(state) {
  const balance = Number(state.summary.balance).toFixed(2);
  const metrics = {
    want: `${state.wants.length} items active`,
    did: `${balance} verified hrs`,
    sell: `${state.sells.length} offers live`,
    wish: `${state.wishes.length} intentions`,
    duty: `${state.duties.length} commitments`
  };
  return PILLARS.map((pillar) => ({ ...pillar, metric: metrics[pillar.id] }));
}

export function proofToast(hours) {
  return `Proof Committed — Ledger balance updated +${Number(hours).toFixed(2)} HRS`;
}

export function noticeCount(state) {
  return (state.feed || []).length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hidden(state, id) {
  return (state.dismissedIds || []).includes(id) || (state.acceptedIds || []).includes(id);
}

function dayLabel(days) {
  if (days === 0) return 'today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function dutySuggestion(duty, primary) {
  const match = primary && duty.dueInDays <= 2 ? 96 : 90;
  return {
    id: `duty:${duty.id}`,
    kind: 'duty',
    tone: 'duty',
    essential: true,
    match,
    tag: 'DUTY CLEARING',
    tagNote: `${match}% Pair Match`,
    action: 'Claim Pledgework',
    title: duty.title,
    detail: `Due in ${dayLabel(duty.dueInDays)} · Duty · Sample`,
    blurb: duty.id === 'duty-terrace'
      ? 'Matches your 2.0 open duty clearing hours. Location: Oak Ridge commons.'
      : `Due in ${dayLabel(duty.dueInDays)} at ${duty.location}. Sample pledge.`,
    why: primary && duty.dueInDays <= 2
      ? 'Duties due come first. This commitment is inside two days, so it is an essential.'
      : 'Another duty is still due this week. Duties stay ahead of open wishes.'
  };
}

function expiringSuggestion(offer) {
  const triParty = offer.id === 'sell-seeds';
  return {
    id: `expiring:${offer.id}`,
    kind: 'expiring',
    tone: 'sell',
    essential: true,
    match: 91,
    tag: 'SURPLUS EXCHANGE',
    tagNote: triParty ? '91% · Circular Tri-Party' : '91% Pair Match',
    action: 'Open Channel',
    title: offer.title,
    detail: `Expires in ${dayLabel(offer.expiresInDays)} · ${offer.status} listing · Sample`,
    blurb: triParty
      ? 'Trade 500g squash seeds with Marcus Hale for 50 kWh battery exchange credit to clear the sample ledger.'
      : `This ${offer.status} listing expires in ${dayLabel(offer.expiresInDays)}. Sample only.`,
    why: 'Expiring listings are next. This offer leaves the board within two days.'
  };
}

export function ruleSuggestions(state) {
  const duties = [...state.duties]
    .filter((duty) => duty.dueInDays <= 7 && !hidden(state, `duty:${duty.id}`))
    .sort((a, b) => a.dueInDays - b.dueInDays || a.title.localeCompare(b.title));
  const expiring = [...(state.sells || [])]
    .filter((offer) => offer.expiresInDays <= 2 && !hidden(state, `expiring:${offer.id}`))
    .sort((a, b) => a.expiresInDays - b.expiresInDays || a.title.localeCompare(b.title));
  const wishes = state.wishes.filter((wish) => wish.status === 'open');
  const ranked = [];
  const push = (item) => {
    if (!item || hidden(state, item.id) || ranked.some((existing) => existing.id === item.id)) return;
    ranked.push(item);
  };
  if (duties[0]) push(dutySuggestion(duties[0], true));
  if (expiring[0]) push(expiringSuggestion(expiring[0]));
  for (const duty of duties.slice(1)) push(dutySuggestion(duty, false));
  for (const offer of expiring.slice(1)) push(expiringSuggestion(offer));
  for (const wish of wishes) {
    push({
      id: `wish:${wish.id}`,
      kind: 'wish',
      tone: 'wish',
      essential: false,
      match: 80,
      tag: 'OPEN WISH',
      tagNote: '80% Pair Match',
      action: 'Open Channel',
      title: wish.title,
      detail: 'Open request · Sample',
      blurb: `${wish.location}. Sample wish, still unmatched.`,
      why: 'This request has no match yet. It waits until duties and expiring listings are covered.'
    });
  }
  if (state.did.length < state.didGoal) {
    const remaining = state.didGoal - state.did.length;
    push({
      id: 'did:gap',
      kind: 'did',
      tone: 'did',
      essential: false,
      match: 70,
      tag: 'WORK PROOF',
      tagNote: 'Weekly ring',
      action: 'Quick Log',
      title: `Confirm ${remaining} more deed${remaining === 1 ? '' : 's'} this week`,
      detail: `${state.did.length} of ${state.didGoal} confirmed deeds · Sample`,
      blurb: 'The verified-work count is still short of the sample weekly goal.',
      why: 'The Did ring is still short of the sample weekly goal. This sits behind duties and expiring listings.'
    });
  }
  return ranked.slice(0, 3);
}

function topFromMap(map) {
  let best = null;
  for (const [value, count] of map) {
    if (!best || count > best.count || (count === best.count && String(value).localeCompare(String(best.value)) < 0)) {
      best = { value, count };
    }
  }
  return best || { value: 'Unknown', count: 0 };
}

function topCount(values) {
  const map = new Map();
  for (const value of values) {
    if (value == null || value === '') continue;
    const key = String(value);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return topFromMap(map);
}

export function learnPatterns(state) {
  const forgotten = new Set(state.forgottenIds || []);
  const records = [...state.did, ...(state.wants || []), ...(state.sells || []), ...state.wishes, ...state.duties];
  const category = topCount(records.map((record) => record.category));
  const hours = topCount(records.map((record) => String(record.hours)));
  const partnerCounts = new Map();
  for (const record of records) {
    if (!record.partner) continue;
    partnerCounts.set(record.partner, (partnerCounts.get(record.partner) || 0) + 1);
  }
  (state.history.partners || []).forEach((name, index) => {
    partnerCounts.set(name, (partnerCounts.get(name) || 0) + (index === 0 ? 2 : 1));
  });
  const partner = topFromMap(partnerCounts);
  const location = topCount(records.map((record) => record.location));
  const crossWish = state.wishes.find((wish) => {
    if (wish.status !== 'open' || wish.category !== category.value) return false;
    return state.duties.some((duty) => duty.partner === partner.value && duty.location === wish.location);
  });
  const items = [
    {
      id: 'learn-category',
      label: `You keep coming back to ${category.value}`,
      source: `${category.count} sample records use ${category.value}`
    },
    {
      id: 'learn-hours',
      label: `Your usual block is ${hours.value} hours`,
      source: `${hours.count} sample records use ${hours.value} hours`
    },
    {
      id: 'learn-partner',
      label: `${partner.value} shows up often`,
      source: 'Most frequent partner in the sample'
    },
    {
      id: 'learn-place',
      label: `${location.value} is a home base`,
      source: `${location.count} sample records are at ${location.value}`
    }
  ];
  if (crossWish) {
    items.push({
      id: 'learn-cross',
      label: `${crossWish.title} lines up with ${partner.value}`,
      source: `Same place as a duty owed to ${partner.value}`,
      title: `Ask ${partner.value} about “${crossWish.title}” at ${crossWish.location}`,
      detail: `Serendipity · ${crossWish.location} · Sample pattern`
    });
  }
  return items.filter((item) => !forgotten.has(item.id));
}

export function serendipitySuggestion(state) {
  if (!state.serendipity) return null;
  const learned = state.learned || [];
  const cross = learned.find((item) => item.id === 'learn-cross');
  if (cross && !hidden(state, 'serendipity:cross')) {
    return {
      id: 'serendipity:cross',
      kind: 'serendipity',
      tone: 'serendipity',
      essential: false,
      match: 84,
      tag: 'SERENDIPITY',
      tagNote: '84% · On device',
      action: 'Open Channel',
      title: cross.title,
      detail: cross.detail,
      blurb: 'An unexpected sample pairing. It stays off the essential list.',
      why: 'On-device pattern only: the same person, the same kind of help, and the same place show up together in the sample. This was not on the essential list. AI suggests, you decide.'
    };
  }
  const category = learned.find((item) => item.id === 'learn-category');
  if (category && !hidden(state, 'serendipity:category')) {
    const name = category.label.replace('You keep coming back to ', '');
    return {
      id: 'serendipity:category',
      kind: 'serendipity',
      tone: 'serendipity',
      essential: false,
      match: 78,
      tag: 'SERENDIPITY',
      tagNote: '78% · On device',
      action: 'Open Channel',
      title: `Leave room for another ${name} block`,
      detail: 'Serendipity · Sample pattern',
      blurb: `${name} is the category that shows up most in the sample.`,
      why: `On-device pattern only: ${name} is the category that shows up most in the sample. AI suggests, you decide.`
    };
  }
  return null;
}

export function suggestionsFor(state) {
  const rules = ruleSuggestions(state);
  const extra = serendipitySuggestion(state);
  return extra ? [...rules, extra] : rules;
}

export function suggestionsMarkup(state) {
  const items = suggestionsFor(state);
  if (!items.length) return '<p class="empty">No sample moves left. Reset State to restore them.</p>';
  return items.map((item) => {
    const whyId = `why-${item.id.replace(/[^a-z0-9-]/gi, '')}`;
    return `<article class="move" data-suggestion="${escapeHtml(item.id)}" data-tone="${escapeHtml(item.tone || item.kind)}">
      <div class="move-top">
        <p class="tag">${escapeHtml(item.tag || 'NEXT')} <span>${escapeHtml(item.tagNote || '')}</span></p>
        <button type="button" class="claim" data-accept="${escapeHtml(item.id)}">${escapeHtml(item.action || 'Accept')}</button>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="blurb">${escapeHtml(item.blurb || item.detail)}</p>
      <div class="move-actions">
        <button type="button" class="why" data-why aria-expanded="false" aria-controls="${whyId}">Why this?</button>
        <button type="button" class="text-btn" data-dismiss="${escapeHtml(item.id)}">Dismiss</button>
      </div>
      <p class="why-panel" id="${whyId}" hidden>${escapeHtml(item.why)}</p>
    </article>`;
  }).join('');
}

export function commitQuickFill(state, draft) {
  const next = structuredClone(state);
  const seq = next.localSeq || 1;
  next.localSeq = seq + 1;
  const hours = Number(draft.hours);
  const record = {
    id: `local-${seq}`,
    title: draftTitle(draft.kind, draft),
    category: draft.category,
    hours,
    partner: draft.partner,
    location: draft.location,
    status: draft.kind === 'wish' || draft.kind === 'want' ? 'open' : 'new',
    dueInDays: 7,
    expiresInDays: 7,
    when: 'Added on this device',
    hash: `sample:local${seq}`,
    addedOnDevice: true,
    sample: true
  };
  const list = { want: 'wants', did: 'did', sell: 'sells', wish: 'wishes', duty: 'duties' }[draft.kind];
  if (list) next[list].push(record);
  if (draft.kind === 'did') {
    next.summary.balance = Math.round((Number(next.summary.balance) + hours) * 100) / 100;
    next.summary.cycleDelta = Math.round((Number(next.summary.cycleDelta) + hours) * 100) / 100;
    next.summary.proofs += 1;
    const amount = `+${hours.toFixed(2)} HRS`;
    next.feed.unshift({
      id: `feed-local-${seq}`,
      title: record.title,
      who: 'you',
      when: 'Just now',
      amount,
      hash: record.hash,
      tone: 'did'
    });
    next.ledgerHistory.unshift({ id: `hist-local-${seq}`, title: record.title, when: 'Just now', delta: amount });
  }
  next.history.lastCategory = draft.category;
  next.history.usualHours = hours;
  next.history.location = draft.location;
  next.history.partners = [draft.partner, ...next.history.partners.filter((name) => name !== draft.partner)];
  const today = next.notifications.digest.find((group) => group.day === 'Today');
  const note = { id: `n-local-${seq}`, text: `Saved “${record.title}” on this device. Nothing was published.` };
  if (today) today.items.unshift(note);
  else next.notifications.digest.unshift({ day: 'Today', items: [note] });
  return next;
}

function draftTitle(kind, draft) {
  if (kind === 'did') return `${draft.category} with ${draft.partner}`;
  if (kind === 'sell') return `${draft.category} offer for ${draft.partner}`;
  if (kind === 'want') return `${draft.category} need with ${draft.partner}`;
  if (kind === 'wish') return `${draft.category} wish with ${draft.partner}`;
  return `${draft.category} owed to ${draft.partner}`;
}

export function dismissSuggestion(state, id) {
  const next = structuredClone(state);
  if (!next.dismissedIds.includes(id)) next.dismissedIds.push(id);
  return next;
}

export function acceptSuggestion(state, id) {
  const next = structuredClone(state);
  if (!next.acceptedIds.includes(id)) next.acceptedIds.push(id);
  return next;
}

export function forgetLearned(state, id) {
  const next = structuredClone(state);
  if (!next.forgottenIds.includes(id)) next.forgottenIds.push(id);
  next.learned = (next.learned || []).filter((item) => item.id !== id);
  return next;
}

export function setSerendipity(state, on) {
  const next = structuredClone(state);
  if (on) {
    next.consent = 'allow';
    next.serendipity = true;
    next.learned = learnPatterns(next);
    return next;
  }
  next.serendipity = false;
  if (next.consent == null) next.consent = 'later';
  return next;
}

export function declineSerendipity(state) {
  const next = structuredClone(state);
  next.consent = 'later';
  next.serendipity = false;
  return next;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function learnedMarkup(state) {
  if (!state.learned.length) {
    return '<p class="empty">Nothing learned yet. Allow serendipity and this device will list patterns from the sample.</p>';
  }
  return `<ul class="learned-list">${state.learned.map((item) => `<li>
      <div>
        <div class="learned-row">
          <p class="item-title">${escapeHtml(item.label)}</p>
          <button type="button" data-forget="${escapeHtml(item.id)}" aria-label="Forget: ${escapeHtml(item.label)}">Forget</button>
        </div>
        <p class="fine">${escapeHtml(item.source)}. Sample, on this device.</p>
      </div>
    </li>`).join('')}</ul>`;
}

export function learnedNote(state) {
  if (state.serendipity) return 'Derived on this device from the sample. Forget a line, or turn serendipity off. Your data never leaves this device.';
  if (state.learned.length) return 'Serendipity suggestions are off. These learned items stay on this device until you forget them. Your data never leaves this device.';
  return 'Serendipity is off. Turn it on to let this device describe patterns in the sample. Your data never leaves this device.';
}

function pillarButton(pillar, label) {
  return `<button type="button" class="pillar tone-${pillar.tone}" data-add="${pillar.id}" aria-label="${escapeHtml(pillar.name)}, ${escapeHtml(pillar.detail)}, ${escapeHtml(pillar.metric)}. Open pre-filled smart attestation">
    <span class="accent" aria-hidden="true"></span>
    <span><span class="name">${escapeHtml(pillar.name)}</span><span class="sub">${escapeHtml(pillar.detail)}</span></span>
    <span class="metric">${escapeHtml(pillar.metric)}</span>
  </button>`;
}

function feedList(items) {
  return `<ul class="feed">${items.map((item) => `<li>
      <span class="feed-dot tone-${escapeHtml(item.tone || 'did')}" aria-hidden="true"></span>
      <div class="feed-main">
        <p class="feed-title">${escapeHtml(item.title)}</p>
        <p class="fine">${escapeHtml(item.who || 'sample')} · ${escapeHtml(item.when)}</p>
      </div>
      <div class="feed-end">
        <p class="delta${String(item.amount).includes('PLEDGE') ? ' pledge' : ''}">${escapeHtml(item.amount)}</p>
        <button type="button" class="tape" data-tape="${escapeHtml(item.hash)}" data-tape-title="${escapeHtml(item.title)}" aria-label="Public proof for ${escapeHtml(item.title)}, sample hash">${escapeHtml(item.hash)}</button>
      </div>
    </li>`).join('')}</ul>`;
}

function heroMarkup(state) {
  const summary = state.summary;
  return `<section class="card hero" aria-labelledby="ledger-heading">
    <div class="hero-top">
      <p class="mono-label" id="ledger-heading">Sovereign Mutual Credit Ledger</p>
      <p class="trust">Trust Quotient<strong>${Number(summary.trust).toFixed(1)}%</strong><span class="fine">${summary.proofs} Proofs Verified</span></p>
    </div>
    <p class="balance">+${Number(summary.balance).toFixed(2)} <span>HRS / LCU</span></p>
    <p class="cycle">↑ +${Number(summary.cycleDelta).toFixed(1)} this cycle · Zero-debt mutual parity</p>
    <div class="counters">
      <div><p>Open Barter Loops</p><strong class="good">${summary.openLoops} Active</strong></div>
      <div><p>Dual-Signs Req</p><strong class="pending">${summary.dualSigns} Pending</strong></div>
      <div><p>Duty Pledges</p><strong class="ok">${summary.dutyPledgesComplete} Complete</strong></div>
    </div>
  </section>`;
}

function statusMarkup(state) {
  const on = Boolean(state.serendipity);
  return `<div class="status">
      <time id="clock" datetime="">--:--</time>
      <span class="enclave"><span class="enclave-dot" aria-hidden="true"></span> SLM Enclave: Idle</span>
      <span class="signal" aria-hidden="true">▮▮▮ ▭</span>
    </div>
    <div class="identity">
      <span class="avatar" aria-hidden="true">${escapeHtml(state.profile.initials)}</span>
      <div class="who">
        <p class="name">${escapeHtml(state.profile.name)} <span class="badge">${escapeHtml(state.profile.role)}</span></p>
        <p class="peer">peer: ${escapeHtml(state.profile.peer)}</p>
      </div>
      <button type="button" class="edge${on ? ' on' : ''}" data-view="serendipity" aria-pressed="${on ? 'true' : 'false'}">Edge AI: ${on ? 'ON' : 'OFF'}</button>
    </div>`;
}

export function bigMarkup(state) {
  const pillars = pillarMetrics(state).map((pillar) => pillarButton(pillar)).join('');
  const active = state.serendipity ? 'Active' : 'Inactive';
  return `${heroMarkup(state)}
    <section class="card pillars" aria-labelledby="pillars-heading">
      <div class="section-head">
        <h2 id="pillars-heading">5-Pillar Sovereign Balance</h2>
        <button type="button" class="quick-link" data-view="quick">+ Quick Log</button>
      </div>
      <div class="log-list">${pillars}</div>
      <p class="hint">Tap any pillar to open pre-filled smart attestation.</p>
    </section>
    <section class="edge-card" aria-labelledby="edge-heading">
      <h2 id="edge-heading">On-Device Edge Serendipity <span class="privacy">0-Cloud Privacy</span></h2>
      <p>Allow local pairing of surplus and duties with nearby sample peers. Raw ledger data stays on this device.</p>
      <p class="enclave-line">Local Enclave: <strong>${active}</strong></p>
      <button type="button" class="permit" id="configure-permission">Configure Permission</button>
    </section>
    <section class="moves" aria-labelledby="moves-heading">
      <div class="section-head">
        <h2 id="moves-heading">Recommended Next Moves</h2>
      </div>
      <p class="fine">Inferred from ledger parity. Essentials first. Sample.</p>
      ${suggestionsMarkup(state)}
    </section>
    <section class="card feed-card" aria-labelledby="feed-heading">
      <div class="section-head">
        <h2 id="feed-heading">Live Attestation Feed</h2>
        <button type="button" class="linkish" data-view="ledger">View All →</button>
      </div>
      ${feedList(state.feed.slice(0, 3))}
    </section>`;
}

export function quickMarkup(state) {
  const pillars = pillarMetrics(state).map((pillar) => pillarButton(pillar)).join('');
  return `<section class="panel" aria-labelledby="quick-heading">
      <p class="mono-label">Smart attestation</p>
      <h2 id="quick-heading">Quick Log</h2>
      <p class="hint">Tap any pillar to open pre-filled smart attestation. Chips start from the sample history.</p>
      <div class="log-list">${pillars}</div>
      <p class="fine">Live desks, separate from this sample: <a href="/exchange">Exchange</a>, <a href="/campus">Campus</a>, <a href="/mutual-credit">Mutual credit</a>.</p>
    </section>`;
}

export function serendipityMarkup(state) {
  const active = state.serendipity ? 'Active' : 'Inactive';
  return `<section class="edge-card" aria-labelledby="serendipity-heading">
      <h2 id="serendipity-heading">On-Device Edge Serendipity <span class="privacy">0-Cloud Privacy</span></h2>
      <p>Allow local pairing of surplus and duties with nearby sample peers. Raw ledger data stays on this device.</p>
      <p class="enclave-line">Local Enclave: <strong>${active}</strong></p>
      <button type="button" class="permit" id="configure-permission">Configure Permission</button>
      <p class="fine">${escapeHtml(learnedNote(state))}</p>
      <label class="master" for="serendipity-master">
        <input id="serendipity-master" type="checkbox" ${state.serendipity ? 'checked' : ''} />
        <span>Serendipity mode</span>
      </label>
      <div id="learned-list">${learnedMarkup(state)}</div>
    </section>
    <section class="moves" aria-labelledby="edge-moves">
      <h2 id="edge-moves">Moves from this device</h2>
      ${suggestionsMarkup(state)}
    </section>`;
}

export function ledgerMarkup(state) {
  const history = state.ledgerHistory.map((row) => `<li class="history-row">
      <div><p class="item-title">${escapeHtml(row.title)}</p><p class="fine">${escapeHtml(row.when)} · Sample</p></div>
      <p class="delta">${escapeHtml(row.delta)}</p>
    </li>`).join('');
  const balance = Number(state.summary.balance).toFixed(2);
  return `<section class="card hero" aria-labelledby="ledger-balance">
      <p class="mono-label" id="ledger-balance">Sovereign Mutual Credit Ledger</p>
      <p class="balance">+${balance} <span>HRS / LCU</span></p>
      <p class="cycle">Sample book. Nothing here was published.</p>
    </section>
    <section class="card panel" aria-labelledby="history-heading">
      <h2 id="history-heading">Balance history</h2>
      <p class="fine">Offered, matched, done, then IdidIt confirmed. Sample deltas only.</p>
      <ul class="history">${history}</ul>
    </section>
    <section class="card feed-card" aria-labelledby="full-feed">
      <h2 id="full-feed">Live Attestation Feed</h2>
      ${feedList(state.feed)}
      <p class="fine">Live desks, separate from this sample: <a href="/exchange">Exchange</a>, <a href="/campus">Campus</a>, <a href="/mutual-credit">Mutual credit</a>.</p>
    </section>`;
}

function stepDefinitions(state, kind) {
  const spec = QUICK_FILL[kind];
  return [
    { key: 'category', prompt: 'Which category?', options: state.categories.map(String), label: (value) => value },
    { key: 'hours', prompt: 'How many hours?', options: state.hoursOptions.map((hours) => String(hours)), label: (value) => `${value} hours` },
    { key: 'location', prompt: 'Where?', options: state.locations.map(String), label: (value) => value },
    { key: 'partner', prompt: spec.partner, options: state.history.partners.map(String), label: (value) => value }
  ];
}

export function boot(doc = document, storage = globalThis.localStorage) {
  let state = loadState(storage);
  let view = 'big';
  let draft = null;
  let toastTimer = 0;
  const $ = (id) => doc.getElementById(id);

  function announce(message) {
    const live = $('status-live');
    if (live) live.textContent = message;
  }

  function showToast(message) {
    const toast = $('toast');
    if (!toast) return;
    toast.hidden = false;
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function persist() {
    try { saveState(storage, state); }
    catch { announce('Could not save on this device.'); }
  }

  function paintClock() {
    const clock = $('clock');
    if (!clock) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}`;
    clock.dateTime = now.toISOString();
  }

  function render() {
    const mount = $('status-mount');
    const panel = $('view');
    if (!mount || !panel) return;
    mount.innerHTML = statusMarkup(state);
    const pages = { big: bigMarkup, quick: quickMarkup, serendipity: serendipityMarkup, ledger: ledgerMarkup };
    panel.innerHTML = (pages[view] || bigMarkup)(state);
    for (const button of doc.querySelectorAll('.tabbar [data-view]')) {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    paintClock();
  }

  function renderStep() {
    const spec = QUICK_FILL[draft.kind];
    const steps = stepDefinitions(state, draft.kind);
    const confirming = draft.step >= steps.length;
    $('stepper-kicker').textContent = `${spec.title} · Sample`;
    if (confirming) {
      $('stepper-title').textContent = 'Save this on this device?';
      $('stepper-progress').textContent = 'Confirm';
      const answers = draft.answers;
      $('stepper-body').innerHTML = `<dl class="review">
        <dt>Category</dt><dd>${escapeHtml(answers.category)}</dd>
        <dt>Hours</dt><dd>${escapeHtml(answers.hours)} hours</dd>
        <dt>Where</dt><dd>${escapeHtml(answers.location)}</dd>
        <dt>Who</dt><dd>${escapeHtml(answers.partner)}</dd>
      </dl>
      <p class="fine">Nothing is published without your tap. This writes sample data on this device only.</p>`;
      $('stepper-next').textContent = 'Save on this device';
    } else {
      const step = steps[draft.step];
      $('stepper-title').textContent = step.prompt;
      $('stepper-progress').textContent = `Question ${draft.step + 1} of ${steps.length}`;
      const selected = String(draft.answers[step.key]);
      const chips = step.options.map((option) => {
        const checked = option === selected;
        return `<button type="button" role="radio" aria-checked="${checked ? 'true' : 'false'}" tabindex="${checked ? '0' : '-1'}" data-option="${escapeHtml(option)}">${escapeHtml(step.label(option))}</button>`;
      }).join('');
      $('stepper-body').innerHTML = `<p class="fine">Pre-filled from sample history. Change any chip.</p>
        <div class="chips" role="radiogroup" aria-label="${escapeHtml(step.prompt)}">${chips}</div>`;
      $('stepper-next').textContent = 'Next';
    }
    $('stepper-back').textContent = draft.step === 0 ? 'Close' : 'Back';
  }

  function openStepper(kind) {
    if (!QUICK_FILL[kind]) return;
    draft = {
      kind,
      step: 0,
      answers: {
        category: state.history.lastCategory,
        hours: String(state.history.usualHours),
        location: state.history.location,
        partner: state.history.partners[0]
      }
    };
    renderStep();
    const dialog = $('stepper-dialog');
    if (!dialog.open) dialog.showModal();
    const selected = dialog.querySelector('[role="radio"][aria-checked="true"]');
    if (selected) selected.focus();
  }

  function selectOption(button) {
    const group = button.closest('[role="radiogroup"]');
    const step = stepDefinitions(state, draft.kind)[draft.step];
    draft.answers[step.key] = button.dataset.option;
    for (const radio of group.querySelectorAll('[role="radio"]')) {
      const on = radio === button;
      radio.setAttribute('aria-checked', on ? 'true' : 'false');
      radio.tabIndex = on ? 0 : -1;
    }
  }

  doc.body.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const soon = target.closest('[data-soon]');
    if (soon) {
      event.preventDefault();
      announce(soon.dataset.soon === 'voice' ? 'Voice is coming soon.' : soon.dataset.soon === 'photo' ? 'Photo is coming soon.' : 'Coming soon.');
      return;
    }
    if (target.closest('#configure-permission')) {
      const dialog = $('consent-dialog');
      if (!dialog.open) dialog.showModal();
      return;
    }
    const changeView = target.closest('[data-view]');
    if (changeView && !target.closest('dialog')) {
      view = changeView.dataset.view;
      render();
      $('view').focus();
      return;
    }
    const add = target.closest('[data-add]');
    if (add) {
      openStepper(add.dataset.add);
      return;
    }
    const option = target.closest('[data-option]');
    if (option && draft) {
      selectOption(option);
      return;
    }
    const tape = target.closest('[data-tape]');
    if (tape) {
      $('tape-record').textContent = tape.dataset.tapeTitle;
      $('tape-hash').textContent = tape.dataset.tape;
      const dialog = $('tape-dialog');
      if (!dialog.open) dialog.showModal();
      return;
    }
    const why = target.closest('[data-why]');
    if (why) {
      const panel = doc.getElementById(why.getAttribute('aria-controls'));
      const open = why.getAttribute('aria-expanded') === 'true';
      why.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (panel) panel.hidden = open;
      return;
    }
    const accept = target.closest('[data-accept]');
    if (accept) {
      const id = accept.dataset.accept;
      const item = suggestionsFor(state).find((suggestion) => suggestion.id === id);
      state = acceptSuggestion(state, id);
      persist();
      render();
      announce(item ? `Accepted “${item.title}”. Saved on this device. Nothing was published.` : 'Accepted. Nothing was published.');
      return;
    }
    const dismiss = target.closest('[data-dismiss]');
    if (dismiss) {
      const id = dismiss.dataset.dismiss;
      state = dismissSuggestion(state, id);
      persist();
      render();
      announce('Dismissed. Nothing was published.');
      return;
    }
    const forget = target.closest('[data-forget]');
    if (forget) {
      state = forgetLearned(state, forget.dataset.forget);
      persist();
      render();
      announce('Forgot that pattern on this device.');
    }
  });

  doc.body.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target.id !== 'serendipity-master') return;
    const on = target.checked;
    state = setSerendipity(state, on);
    persist();
    render();
    announce(on
      ? 'Serendipity is on. Patterns stay on this device.'
      : 'Serendipity is off. Learned items stay until you forget them.');
  });

  doc.body.addEventListener('keydown', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !draft) return;
    const group = target.closest('[role="radiogroup"]');
    if (!group) return;
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const radios = [...group.querySelectorAll('[role="radio"]')];
    const index = radios.indexOf(doc.activeElement);
    if (index < 0) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = radios.length - 1;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % radios.length;
    else nextIndex = (index - 1 + radios.length) % radios.length;
    selectOption(radios[nextIndex]);
    radios[nextIndex].focus();
  });

  $('stepper-next').addEventListener('click', () => {
    if (!draft) return;
    const steps = stepDefinitions(state, draft.kind);
    if (draft.step < steps.length) {
      draft.step += 1;
      renderStep();
      const focusTarget = $('stepper-dialog').querySelector('[role="radio"][aria-checked="true"]') || $('stepper-next');
      focusTarget.focus();
      return;
    }
    const hours = Number(draft.answers.hours);
    const kind = draft.kind;
    state = commitQuickFill(state, { kind, ...draft.answers });
    if (state.serendipity) state.learned = learnPatterns(state);
    persist();
    draft = null;
    $('stepper-dialog').close();
    render();
    if (kind === 'did') {
      const message = proofToast(hours);
      showToast(message);
      announce(message);
    } else {
      announce('Saved on this device. Nothing was published.');
      showToast('Saved on this device. Nothing was published.');
    }
  });

  $('stepper-back').addEventListener('click', () => {
    if (!draft) return;
    if (draft.step === 0) {
      draft = null;
      $('stepper-dialog').close();
      return;
    }
    draft.step -= 1;
    renderStep();
  });

  $('stepper-dialog').addEventListener('close', () => { draft = null; });

  $('consent-allow').addEventListener('click', () => {
    state = setSerendipity(state, true);
    persist();
    $('consent-dialog').close();
    render();
    announce('Serendipity is on. Patterns stay on this device.');
  });

  $('consent-later').addEventListener('click', () => {
    state = declineSerendipity(state);
    persist();
    $('consent-dialog').close();
    render();
    announce('Serendipity is off. Rule-based suggestions stay available.');
  });

  $('consent-dialog').addEventListener('cancel', (event) => {
    event.preventDefault();
    $('consent-later').click();
  });

  $('tape-close').addEventListener('click', () => $('tape-dialog').close());
  $('reset-open').addEventListener('click', () => {
    const dialog = $('reset-dialog');
    if (!dialog.open) dialog.showModal();
  });
  $('reset-cancel').addEventListener('click', () => $('reset-dialog').close());
  $('reset-confirm').addEventListener('click', () => {
    try { storage.removeItem(STORAGE_KEY); } catch { /* reload restores the sample */ }
    globalThis.location.reload();
  });

  const frame = $('frame-toggle');
  frame.addEventListener('click', () => {
    const compact = frame.getAttribute('aria-pressed') !== 'true';
    frame.setAttribute('aria-pressed', compact ? 'true' : 'false');
    frame.textContent = compact ? 'Compact Phone View' : 'Full Width View';
    $('stage').classList.toggle('is-wide', !compact);
  });

  render();
  setInterval(paintClock, 30000);
  if (state.consent == null && !$('consent-dialog').open) $('consent-dialog').showModal();
}

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('my-picture-app')) {
  boot();
}
