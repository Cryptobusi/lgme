/**
 * My Picture prototype.
 * Sample data only. This module never fetches, never publishes, and never calls a wallet.
 */

export const STORAGE_KEY = 'lgme.my-picture.demo.v1';

export const CONSENT_COPY = 'Allow on-device AI to learn your patterns and suggest unexpected matches? Your data never leaves this device.';

export const GUARDRAILS = [
  'AI suggests, you decide',
  'Nothing is published without your tap',
  'No personal data on the public Tape'
];

export const TIMELINE_STEPS = [
  { id: 'offered', label: 'Offered' },
  { id: 'matched', label: 'Matched' },
  { id: 'done', label: 'Done' },
  { id: 'confirmed', label: 'IdidIt confirmed' }
];

export const QUICK_FILL = {
  did: { title: 'Add a confirmed deed', partner: 'Who was with you?' },
  offer: { title: 'Add a listing', partner: 'Who is this for?' },
  wish: { title: 'Add a request', partner: 'Who would you like?' },
  duty: { title: 'Add a commitment', partner: 'Who is it owed to?' }
};

const SAMPLE = {
  label: 'sample',
  consent: null,
  serendipity: false,
  learned: [],
  forgottenIds: [],
  dismissedIds: [],
  acceptedIds: [],
  localSeq: 1,
  summary: {
    campusCredit: 12,
    creditLimit: 40,
    debitLimit: -20,
    weeklyCap: 10,
    wallet: 'not-connected'
  },
  history: {
    lastCategory: 'Tutoring',
    usualHours: 2,
    location: 'Campus tool library',
    partners: ['Jordan', 'Priya', 'Alex', 'Campus desk']
  },
  categories: ['Tutoring', 'Repair', 'Garden', 'Desk shift', 'Bookshelf'],
  hoursOptions: [1, 1.5, 2, 3],
  locations: ['Campus tool library', 'Garden beds', 'Study hall', 'North dorm'],
  didGoal: 5,
  did: [
    { id: 'did-calc', title: 'Tutored calculus', category: 'Tutoring', hours: 2, partner: 'Jordan', location: 'Study hall', when: 'Monday', hash: 'sample:9f3ac21e' },
    { id: 'did-tools', title: 'Tool library shift', category: 'Desk shift', hours: 1.5, partner: 'Campus desk', location: 'Campus tool library', when: 'Wednesday', hash: 'sample:14ab88d0' },
    { id: 'did-garden', title: 'Garden beds', category: 'Garden', hours: 3, partner: 'Priya', location: 'Garden beds', when: 'Friday', hash: 'sample:c77e01aa' }
  ],
  offers: [
    { id: 'off-bike', title: 'Bike repair clinic', category: 'Repair', hours: 2, partner: 'Alex', location: 'Campus tool library', status: 'matched', expiresInDays: 2, hash: 'sample:b10e44aa' },
    { id: 'off-drill', title: 'Spare drill', category: 'Repair', hours: 1, partner: null, location: 'North dorm', status: 'viewed', expiresInDays: 6, hash: 'sample:88d21f03' },
    { id: 'off-notes', title: 'Calculus notes', category: 'Tutoring', hours: 2, partner: null, location: 'Study hall', status: 'new', expiresInDays: 9, hash: 'sample:01cc9e77' },
    { id: 'off-compost', title: 'Weekend compost pickup', category: 'Garden', hours: 1.5, partner: null, location: 'Garden beds', status: 'new', expiresInDays: 1, hash: 'sample:e4a019c2' }
  ],
  wishes: [
    { id: 'wish-ride', title: 'Ride to the tool library', category: 'Desk shift', hours: 1, partner: null, location: 'Campus tool library', status: 'open', hash: 'sample:77aa10b3' },
    { id: 'wish-spanish', title: 'Spanish conversation partner', category: 'Tutoring', hours: 2, partner: 'Alex', location: 'Study hall', status: 'matched', hash: 'sample:d90c55e1' },
    { id: 'wish-shelf', title: 'Help moving a bookshelf', category: 'Repair', hours: 2, partner: null, location: 'North dorm', status: 'open', hash: 'sample:ab3310de' }
  ],
  duties: [
    { id: 'duty-drill', title: 'Return the drill to Jordan', category: 'Repair', hours: 0.5, partner: 'Jordan', location: 'North dorm', dueInDays: 1, hash: 'sample:55f0c18a' },
    { id: 'duty-desk', title: 'Cover the Saturday desk shift', category: 'Desk shift', hours: 2, partner: 'Campus desk', location: 'Campus tool library', dueInDays: 3, hash: 'sample:c0ffee01' },
    { id: 'duty-garden', title: 'Garden-bed follow-up', category: 'Garden', hours: 1, partner: 'Priya', location: 'Garden beds', dueInDays: 6, hash: 'sample:0a11b22c' }
  ],
  timeline: [
    { id: 'tl-calc', title: 'Tutored calculus', stage: 'confirmed', hash: 'sample:9f3ac21e' },
    { id: 'tl-bike', title: 'Bike repair clinic', stage: 'matched', hash: 'sample:b10e44aa' }
  ],
  notifications: {
    urgent: [
      { id: 'n-duty', title: 'Return the drill to Jordan', detail: 'Due in 1 day' },
      { id: 'n-expire', title: 'Weekend compost pickup expires tomorrow', detail: 'This listing leaves the board in 1 day' }
    ],
    digest: [
      {
        day: 'Today',
        items: [
          { id: 'n-view', text: 'Jordan viewed your spare drill listing.' },
          { id: 'n-match', text: 'Alex matched your Spanish conversation request.' }
        ]
      },
      {
        day: 'Yesterday',
        items: [
          { id: 'n-garden', text: 'Priya confirmed the garden-beds deed.' },
          { id: 'n-shift', text: 'Campus desk marked your shift done.' }
        ]
      }
    ]
  }
};

export function createSampleState() {
  return structuredClone(SAMPLE);
}

export function normalizeState(parsed) {
  const base = createSampleState();
  if (!parsed || parsed.label !== 'sample') return base;
  return {
    ...base,
    ...parsed,
    summary: { ...base.summary, ...(parsed.summary || {}) },
    history: {
      ...base.history,
      ...(parsed.history || {}),
      partners: parsed.history && Array.isArray(parsed.history.partners) ? parsed.history.partners : base.history.partners
    },
    did: Array.isArray(parsed.did) ? parsed.did : base.did,
    offers: Array.isArray(parsed.offers) ? parsed.offers : base.offers,
    wishes: Array.isArray(parsed.wishes) ? parsed.wishes : base.wishes,
    duties: Array.isArray(parsed.duties) ? parsed.duties : base.duties,
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline : base.timeline,
    notifications: parsed.notifications && Array.isArray(parsed.notifications.urgent) ? parsed.notifications : base.notifications,
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
  return {
    min,
    max,
    value,
    ratio: clamp(ratio, 0, 1),
    zero: clamp(zero, 0, 1)
  };
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
  return {
    id: `duty:${duty.id}`,
    kind: 'duty',
    essential: true,
    title: duty.title,
    detail: `Due in ${dayLabel(duty.dueInDays)} · Duty · Sample`,
    why: primary && duty.dueInDays <= 2
      ? 'Duties due come first. This commitment is inside two days, so it is an essential.'
      : 'Another duty is still due this week. Duties stay ahead of open wishes.'
  };
}

function expiringSuggestion(offer) {
  return {
    id: `expiring:${offer.id}`,
    kind: 'expiring',
    essential: true,
    title: offer.title,
    detail: `Expires in ${dayLabel(offer.expiresInDays)} · ${offer.status} listing · Sample`,
    why: 'Expiring listings are next. This offer leaves the board within two days.'
  };
}

export function ruleSuggestions(state) {
  const duties = [...state.duties]
    .filter((duty) => duty.dueInDays <= 7 && !hidden(state, `duty:${duty.id}`))
    .sort((a, b) => a.dueInDays - b.dueInDays || a.title.localeCompare(b.title));
  const expiring = [...state.offers]
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
      essential: false,
      title: wish.title,
      detail: 'Open request · Sample',
      why: 'This request has no match yet. It waits until duties and expiring listings are covered.'
    });
  }
  if (state.did.length < state.didGoal) {
    const remaining = state.didGoal - state.did.length;
    push({
      id: 'did:gap',
      kind: 'did',
      essential: false,
      title: `Confirm ${remaining} more deed${remaining === 1 ? '' : 's'} this week`,
      detail: `${state.did.length} of ${state.didGoal} confirmed deeds are on the ring · Sample`,
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
  const records = [...state.did, ...state.offers, ...state.wishes, ...state.duties];
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
      source: `Most frequent partner in the sample`
    },
    {
      id: 'learn-place',
      label: `${location.value} is a home base`,
      source: `${location.count} sample records are at ${location.value}`
    }
  ];
  if (crossWish) {
    const duty = state.duties.find((item) => item.partner === partner.value && item.location === crossWish.location);
    items.push({
      id: 'learn-cross',
      label: `Bookshelf wish lines up with ${partner.value}`,
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
      essential: false,
      title: cross.title,
      detail: cross.detail,
      why: 'On-device pattern only: the same person, the same kind of help, and the same place show up together in the sample. This was not on the essential list. AI suggests, you decide.'
    };
  }
  const category = learned.find((item) => item.id === 'learn-category');
  if (category && !hidden(state, 'serendipity:category')) {
    const name = category.label.replace('You keep coming back to ', '');
    return {
      id: 'serendipity:category',
      kind: 'serendipity',
      essential: false,
      title: `Leave room for another ${name} block`,
      detail: 'Serendipity · Sample pattern',
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
  if (!items.length) {
    return '<p class="empty">No sample suggestions left. Reset demo to restore them.</p>';
  }
  return items.map((item, index) => {
    const rank = item.kind === 'serendipity' ? 'Serendipity' : (item.essential ? 'Essential' : 'Next');
    const whyId = `why-${item.id.replace(/[^a-z0-9-]/gi, '')}`;
    return `<article class="suggestion${item.kind === 'serendipity' ? ' is-serendipity' : ''}" data-suggestion="${escapeHtml(item.id)}">
      <p class="rank"><span class="num">${index + 1}</span> ${escapeHtml(rank)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="fine">${escapeHtml(item.detail)}</p>
      <button type="button" class="quiet why" data-why aria-expanded="false" aria-controls="${whyId}">Why this?</button>
      <p class="why-panel" id="${whyId}" hidden>${escapeHtml(item.why)}</p>
      <div class="suggestion-actions">
        <button type="button" class="primary" data-accept="${escapeHtml(item.id)}">Accept</button>
        <button type="button" data-dismiss="${escapeHtml(item.id)}">Dismiss</button>
      </div>
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
    status: draft.kind === 'wish' ? 'open' : 'new',
    dueInDays: 7,
    expiresInDays: 7,
    when: 'Added on this device',
    hash: `sample:local${seq}`,
    addedOnDevice: true,
    sample: true
  };
  if (draft.kind === 'did') next.did.push(record);
  if (draft.kind === 'offer') next.offers.push(record);
  if (draft.kind === 'wish') next.wishes.push(record);
  if (draft.kind === 'duty') next.duties.push(record);
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
  if (kind === 'offer') return `${draft.category} offer for ${draft.partner}`;
  if (kind === 'wish') return `${draft.category} request with ${draft.partner}`;
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

function statusLabel(status) {
  if (status === 'new') return 'New';
  if (status === 'viewed') return 'Viewed';
  if (status === 'matched') return 'Matched';
  if (status === 'open') return 'Open';
  return status;
}

function ringMarkup(ratio, label, valueText, tone) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp(ratio, 0, 1));
  return `<div class="ring tone-${tone}" role="img" aria-label="${escapeHtml(label)}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="ring-track" cx="60" cy="60" r="${radius}"></circle>
      <circle class="ring-value" cx="60" cy="60" r="${radius}" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
    </svg>
    <span class="ring-figure" aria-hidden="true">${valueText}</span>
  </div>`;
}

function tapeButton(record) {
  return `<button type="button" class="tape" data-tape="${escapeHtml(record.hash)}" data-tape-title="${escapeHtml(record.title)}" aria-label="Public proof for ${escapeHtml(record.title)}, sample hash">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.6"></circle><circle cx="16" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.6"></circle></svg>
    <span>Tape</span>
  </button>`;
}

function plusButton(kind, label) {
  return `<button type="button" class="plus" data-add="${kind}" aria-label="${escapeHtml(label)}">+</button>`;
}

export function summaryMarkup(state) {
  const gauge = creditGauge(state.summary);
  const hours = weeklyHours(state);
  const cap = state.summary.weeklyCap;
  const hourRatio = cap === 0 ? 0 : Math.min(1, hours / cap);
  const creditText = `${gauge.value} Campus Credit, sample, between debit limit ${gauge.min} and credit limit ${gauge.max}`;
  return `<section class="tile tile-credit" aria-labelledby="credit-heading">
      <p class="kicker">Sample</p>
      <h2 id="credit-heading">Campus Credit</h2>
      <p class="big"><span class="figure">+${escapeHtml(gauge.value)}</span> balance</p>
      <div class="gauge" role="meter" aria-label="Campus Credit balance, sample" aria-valuemin="${gauge.min}" aria-valuemax="${gauge.max}" aria-valuenow="${gauge.value}" aria-valuetext="${escapeHtml(creditText)}">
        <div class="gauge-track" aria-hidden="true">
          <span class="gauge-zero" style="left:${(gauge.zero * 100).toFixed(2)}%"></span>
          <span class="gauge-fill" style="width:${(gauge.ratio * 100).toFixed(2)}%"></span>
          <span class="gauge-marker" style="left:${(gauge.ratio * 100).toFixed(2)}%"></span>
        </div>
        <div class="gauge-ends" aria-hidden="true"><span>Debit limit ${gauge.min}</span><span>Credit limit +${gauge.max}</span></div>
      </div>
    </section>
    <section class="tile" aria-labelledby="wallet-heading">
      <p class="kicker">Sample</p>
      <h2 id="wallet-heading">$lgme wallet</h2>
      <p class="big">Not connected</p>
      <button type="button" class="soon" data-soon="wallet" aria-disabled="true">Wallet placeholder</button>
      <p class="fine">This prototype does not connect a wallet.</p>
    </section>
    <section class="tile" aria-labelledby="hours-heading">
      <p class="kicker">Sample</p>
      <h2 id="hours-heading">Weekly hours</h2>
      <p class="big"><span class="figure">${escapeHtml(hours)}</span> of ${escapeHtml(cap)}</p>
      <div class="hours" role="meter" aria-label="Weekly hours versus cap, sample" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${Math.min(hours, cap)}" aria-valuetext="${hours} of ${cap} weekly hours, sample">
        <span class="hours-fill" style="width:${(hourRatio * 100).toFixed(2)}%"></span>
      </div>
      <p class="fine">Hours versus the sample weekly cap.</p>
    </section>`;
}

export function cardsMarkup(state) {
  const did = didProgress(state);
  const matchedOffers = state.offers.filter((offer) => offer.status === 'matched').length;
  const matchedWishes = state.wishes.filter((wish) => wish.status === 'matched').length;
  const soonDuties = state.duties.filter((duty) => duty.dueInDays <= 2).length;
  const duties = [...state.duties].sort((a, b) => a.dueInDays - b.dueInDays);
  const didRows = state.did.map((deed) => `<li class="record">
      <div><p class="item-title">${escapeHtml(deed.title)}</p><p class="fine">${escapeHtml(deed.when)} · ${escapeHtml(deed.hours)}h · ${escapeHtml(deed.partner)} · ${escapeHtml(deed.location)} · Sample</p></div>
      ${tapeButton(deed)}
    </li>`).join('');
  const offerRows = state.offers.map((offer) => `<li class="record">
      <div><p class="item-title">${escapeHtml(offer.title)}</p><p class="fine">Expires in ${escapeHtml(dayLabel(offer.expiresInDays))} · ${escapeHtml(offer.location)} · Sample</p></div>
      <span class="status status-${escapeHtml(offer.status)}">${escapeHtml(statusLabel(offer.status))}</span>
      ${tapeButton(offer)}
    </li>`).join('');
  const wishRows = state.wishes.map((wish) => `<li class="record">
      <div><p class="item-title">${escapeHtml(wish.title)}</p><p class="fine">${escapeHtml(wish.partner || 'No partner yet')} · ${escapeHtml(wish.location)} · Sample</p></div>
      <span class="status status-${escapeHtml(wish.status)}">${escapeHtml(statusLabel(wish.status))}</span>
      ${tapeButton(wish)}
    </li>`).join('');
  const dutyRows = duties.map((duty) => `<li class="countdown-item">
      <div class="record">
        <div><p class="item-title">${escapeHtml(duty.title)}</p><p class="fine">Due in ${escapeHtml(dayLabel(duty.dueInDays))} · ${escapeHtml(duty.partner)} · ${escapeHtml(duty.location)} · Sample</p></div>
        ${tapeButton(duty)}
      </div>
    </li>`).join('');
  return `<article class="card" aria-labelledby="did-heading">
      <div class="card-head">
        <div><p class="kicker">Confirmed this week · Sample</p><h2 id="did-heading">Did</h2></div>
        ${ringMarkup(did.ratio, `${did.done} of ${did.goal} confirmed deeds this week, sample`, `${did.done}/${did.goal}`, 'gold')}
        ${plusButton('did', 'Add a confirmed deed')}
      </div>
      <ul class="records">${didRows}</ul>
    </article>
    <article class="card" aria-labelledby="offer-heading">
      <div class="card-head">
        <div><p class="kicker">Active listings · Sample</p><h2 id="offer-heading">Sell/Offer</h2></div>
        ${ringMarkup(state.offers.length ? matchedOffers / state.offers.length : 0, `${matchedOffers} of ${state.offers.length} sample listings matched`, `${matchedOffers}/${state.offers.length}`, 'cream')}
        ${plusButton('offer', 'Add a listing')}
      </div>
      <ul class="records">${offerRows}</ul>
    </article>
    <article class="card" aria-labelledby="wish-heading">
      <div class="card-head">
        <div><p class="kicker">Open requests · Sample</p><h2 id="wish-heading">Wish/Need</h2></div>
        ${ringMarkup(state.wishes.length ? matchedWishes / state.wishes.length : 0, `${matchedWishes} of ${state.wishes.length} sample requests matched`, `${matchedWishes}/${state.wishes.length}`, 'green')}
        ${plusButton('wish', 'Add a request')}
      </div>
      <ul class="records">${wishRows}</ul>
    </article>
    <article class="card" aria-labelledby="duty-heading">
      <div class="card-head">
        <div><p class="kicker">Upcoming · Sample</p><h2 id="duty-heading">Duty/Owe</h2></div>
        ${ringMarkup(state.duties.length ? soonDuties / state.duties.length : 0, `${soonDuties} of ${state.duties.length} sample commitments due inside two days`, `${soonDuties}/${state.duties.length}`, 'gold')}
        ${plusButton('duty', 'Add a commitment')}
      </div>
      <ol class="countdown">${dutyRows}</ol>
    </article>`;
}

export function timelineMarkup(state) {
  return state.timeline.map((deed) => {
    const index = TIMELINE_STEPS.findIndex((step) => step.id === deed.stage);
    const steps = TIMELINE_STEPS.map((step, stepIndex) => {
      const current = stepIndex === index;
      const done = stepIndex < index;
      return `<li class="${done ? 'done' : ''}"${current ? ' aria-current="step"' : ''}><span class="dot" aria-hidden="true"></span><span>${escapeHtml(step.label)}${current ? ' <span class="now">Current</span>' : ''}</span></li>`;
    }).join('');
    return `<article class="deed" aria-labelledby="tl-${escapeHtml(deed.id)}">
      <div class="record">
        <div><p class="kicker">Sample</p><h3 id="tl-${escapeHtml(deed.id)}">${escapeHtml(deed.title)}</h3></div>
        ${tapeButton(deed)}
      </div>
      <ol class="stages" aria-label="Progress for ${escapeHtml(deed.title)}">${steps}</ol>
    </article>`;
  }).join('');
}

export function noticesMarkup(state) {
  const urgent = state.notifications.urgent.map((item) => `<li><p class="item-title">${escapeHtml(item.title)}</p><p class="fine">${escapeHtml(item.detail)} · Sample</p></li>`).join('');
  const digest = state.notifications.digest.map((group) => `<section aria-labelledby="day-${escapeHtml(group.day)}"><h4 id="day-${escapeHtml(group.day)}">${escapeHtml(group.day)}</h4><ul>${group.items.map((item) => `<li>${escapeHtml(item.text)}</li>`).join('')}</ul></section>`).join('');
  return `<section aria-labelledby="urgent-heading"><h3 id="urgent-heading">Urgent</h3><ul class="urgent-list">${urgent}</ul></section>
    <section aria-labelledby="digest-heading"><h3 id="digest-heading">Daily digest</h3>${digest}</section>`;
}

export function learnedMarkup(state) {
  if (!state.learned.length) {
    return '<p class="empty">Nothing learned yet. Turn serendipity on and this device will list patterns it can describe from the sample.</p>';
  }
  return `<ul class="learned-list">${state.learned.map((item) => `<li>
      <div class="learned-row">
        <p class="item-title">${escapeHtml(item.label)}</p>
        <button type="button" data-forget="${escapeHtml(item.id)}" aria-label="Forget: ${escapeHtml(item.label)}">Forget</button>
      </div>
      <p class="fine">${escapeHtml(item.source)}. Sample, on this device.</p>
    </li>`).join('')}</ul>`;
}

export function learnedNote(state) {
  if (state.serendipity) return 'Derived on this device from the sample. Forget a line, or turn serendipity off. Your data never leaves this device.';
  if (state.learned.length) return 'Serendipity suggestions are off. These learned items stay on this device until you forget them. Your data never leaves this device.';
  return 'Serendipity is off. Turn it on to let this device describe patterns in the sample. Your data never leaves this device.';
}

export function noticeCount(state) {
  const digest = state.notifications.digest.reduce((sum, group) => sum + group.items.length, 0);
  return state.notifications.urgent.length + digest;
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
  let draft = null;
  const $ = (id) => doc.getElementById(id);

  function announce(message) {
    const live = $('status-live');
    if (live) live.textContent = message;
  }

  function persist() {
    try {
      saveState(storage, state);
    } catch {
      announce('Could not save on this device.');
    }
  }

  function render() {
    $('summary').innerHTML = summaryMarkup(state);
    $('suggestions').innerHTML = suggestionsMarkup(state);
    $('cards').innerHTML = cardsMarkup(state);
    $('timeline').innerHTML = timelineMarkup(state);
    $('notice-body').innerHTML = noticesMarkup(state);
    $('learned-list').innerHTML = learnedMarkup(state);
    $('learned-note').textContent = learnedNote(state);
    const master = $('serendipity-master');
    master.checked = Boolean(state.serendipity);
    const count = noticeCount(state);
    $('bell-count').textContent = String(count);
    $('bell').setAttribute('aria-label', `Notifications, ${count} sample items`);
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
      const chips = step.options.map((option, index) => {
        const checked = option === selected;
        return `<button type="button" role="radio" aria-checked="${checked ? 'true' : 'false'}" tabindex="${checked ? '0' : '-1'}" data-option="${escapeHtml(option)}" ${index === 0 ? 'id="stepper-first-chip"' : ''}>${escapeHtml(step.label(option))}</button>`;
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
      const kind = soon.dataset.soon;
      if (kind === 'wallet') announce('This prototype does not connect a wallet.');
      else if (kind === 'voice') announce('Voice is coming soon.');
      else announce('Photo is coming soon.');
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
      panel.hidden = open;
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
      const next = $('suggestions').querySelector('[data-accept]');
      if (next) next.focus();
      return;
    }
    const dismiss = target.closest('[data-dismiss]');
    if (dismiss) {
      const id = dismiss.dataset.dismiss;
      const item = suggestionsFor(state).find((suggestion) => suggestion.id === id);
      state = dismissSuggestion(state, id);
      persist();
      render();
      announce(item ? `Dismissed “${item.title}”.` : 'Dismissed.');
      const next = $('suggestions').querySelector('[data-dismiss]') || $('suggestions-heading');
      if (next) next.focus();
      return;
    }
    const forget = target.closest('[data-forget]');
    if (forget) {
      state = forgetLearned(state, forget.dataset.forget);
      persist();
      render();
      announce('Forgot that pattern on this device.');
      const next = $('learned-dialog').querySelector('[data-forget]') || $('serendipity-master');
      if (next) next.focus();
    }
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
    state = commitQuickFill(state, { kind: draft.kind, ...draft.answers });
    if (state.serendipity) state.learned = learnPatterns(state);
    persist();
    draft = null;
    $('stepper-dialog').close();
    render();
    announce('Saved on this device. Nothing was published.');
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
    const focusTarget = $('stepper-dialog').querySelector('[role="radio"][aria-checked="true"]') || $('stepper-back');
    focusTarget.focus();
  });

  $('stepper-dialog').addEventListener('close', () => {
    draft = null;
  });

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

  $('serendipity-master').addEventListener('change', () => {
    const on = $('serendipity-master').checked;
    state = setSerendipity(state, on);
    persist();
    render();
    announce(on
      ? 'Serendipity is on. Patterns stay on this device.'
      : 'Serendipity is off. Learned items stay until you forget them.');
  });

  $('learned-open').addEventListener('click', () => {
    render();
    const dialog = $('learned-dialog');
    if (!dialog.open) dialog.showModal();
  });
  $('learned-close').addEventListener('click', () => $('learned-dialog').close());

  $('bell').addEventListener('click', () => {
    const dialog = $('notice-dialog');
    if (!dialog.open) dialog.showModal();
  });
  $('notice-close').addEventListener('click', () => $('notice-dialog').close());

  $('tape-close').addEventListener('click', () => $('tape-dialog').close());

  $('reset-open').addEventListener('click', () => {
    const dialog = $('reset-dialog');
    if (!dialog.open) dialog.showModal();
  });
  $('reset-cancel').addEventListener('click', () => $('reset-dialog').close());
  $('reset-confirm').addEventListener('click', () => {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* reload still restores the sample */
    }
    globalThis.location.reload();
  });

  render();
  if (state.consent == null && !$('consent-dialog').open) $('consent-dialog').showModal();
}

if (typeof document !== 'undefined' && document.getElementById && document.getElementById('my-picture-app')) {
  boot();
}
