import { isHealthListing } from './exchange-overview.mjs';
import { HEALTH_EXAMPLES } from './health-examples.mjs';
import { tradeTypeOf, typeCounts } from './trade-types.mjs';

const ACTIVITY = new Map(HEALTH_EXAMPLES.map((row) => [row.id, row.title]));
const SERVICE_LABEL = {
  walk: 'Walking',
  strength: 'Strength',
  mobility: 'Mobility',
  cardio: 'Cardio',
  bike: 'Cycling',
  plan: 'Planning',
  health: 'Health session',
  mental: 'Mental exercise',
  repair: 'Repair'
};

export function messageTime(value) {
  const seconds = Number(String(value || '').split('.')[0]);
  if (!Number.isFinite(seconds) || seconds < 1_000_000_000) return 0;
  return seconds > 1e12 ? seconds : seconds * 1000;
}

export function stageOf(item = {}) {
  const status = String(item.status || '');
  if (/receipt|ididit|finished|completed|\bdone\b/i.test(`${status} ${item.summary || ''}`)) return 'receipt';
  if (/confirmed/i.test(status)) return 'confirmed';
  if (/matched|partial/i.test(status) || status.startsWith('Claimed by')) return 'matched';
  return 'listed';
}

export function isTestItem(item = {}) {
  const status = String(item.status || '');
  if (status.startsWith('Claimed by')) return false;
  return /test|unclaimed|declined|cancelled|open|partial|repeat|matched|confirmed|receipt/i.test(status) || item.test === true;
}

function activityOf(item) {
  return ACTIVITY.get(item.id) || SERVICE_LABEL[item.service] || 'Health';
}

export function healthEvents(listings = []) {
  const events = [];
  for (const row of listings) {
    const item = row?.item || {};
    if (!isHealthListing(item)) continue;
    events.push({
      id: String(item.id || ''),
      time: messageTime(row.consensusTimestamp),
      sequence: Number(row.sequenceNumber) || 0,
      stage: stageOf(item),
      test: isTestItem(item),
      side: item.side === 'request' ? 'request' : 'offer',
      minutes: Number(item.durationMin) > 0 ? Number(item.durationMin) : 0,
      usd: Number(item.usd) > 0 ? Number(item.usd) : 0,
      activity: activityOf(item),
      trade: tradeTypeOf(item),
      closed: /declined|cancelled|expired|^Test item - open$/i.test(`${item.status || ''} ${item.type || ''}`) || /declined|cancelled|expired|disputed/.test(tradeTypeOf(item))
    });
  }
  return events;
}

function latestEvents(events) {
  const byId = new Map();
  const loose = [];
  for (const event of events) {
    if (!event.id) { loose.push(event); continue; }
    const prior = byId.get(event.id);
    if (!prior || event.sequence >= prior.sequence) byId.set(event.id, event);
  }
  return [...byId.values(), ...loose];
}

function spanMs(span) {
  if (span === 'week') return 7 * 86400000;
  if (span === 'month') return 30 * 86400000;
  return 86400000;
}

function bucketCount(span) {
  if (span === 'week') return 16;
  if (span === 'month') return 12;
  return 14;
}

export function timeBuckets(events, span = 'day', now = Date.now()) {
  const size = spanMs(span);
  const count = bucketCount(span);
  const end = now - (now % size) + size;
  const buckets = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = end - (i + 1) * size;
    buckets.push({
      start,
      label: new Date(start).toISOString().slice(0, span === 'month' ? 7 : 10),
      test: { listed: 0, matched: 0, confirmed: 0, receipt: 0 },
      real: { listed: 0, matched: 0, confirmed: 0, receipt: 0 }
    });
  }
  for (const event of events) {
    if (!event.time) continue;
    const bucket = buckets.find((row) => event.time >= row.start && event.time < row.start + size);
    if (!bucket) continue;
    const bag = event.test ? bucket.test : bucket.real;
    bag[event.stage] += 1;
  }
  return buckets;
}

function sumStage(buckets, key, stage) {
  return buckets.reduce((sum, row) => sum + row[key][stage], 0);
}

function rate(part, whole) {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export function medianHours(events) {
  const byId = new Map();
  for (const event of events) {
    if (!event.id || !event.time) continue;
    const list = byId.get(event.id) || [];
    list.push(event);
    byId.set(event.id, list);
  }
  const toMatch = [];
  const toConfirm = [];
  for (const list of byId.values()) {
    const ordered = list.slice().sort((a, b) => a.time - b.time || a.sequence - b.sequence);
    const listed = ordered.find((row) => row.stage === 'listed');
    const matched = ordered.find((row) => row.stage === 'matched' && (!listed || row.time >= listed.time));
    const confirmed = ordered.find((row) => (row.stage === 'confirmed' || row.stage === 'receipt') && (!matched || row.time >= matched.time));
    if (listed && matched) toMatch.push((matched.time - listed.time) / 3600000);
    if (matched && confirmed) toConfirm.push((confirmed.time - matched.time) / 3600000);
  }
  return { listedToMatched: median(toMatch), matchedToConfirmed: median(toConfirm) };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function categoryReport(listings = [], { span = 'day', now = Date.now() } = {}) {
  const events = healthEvents(listings);
  const current = latestEvents(events);
  const buckets = timeBuckets(events, span, now);
  const half = Math.floor(buckets.length / 2);
  const previous = buckets.slice(0, half);
  const recent = buckets.slice(half);
  const inSpan = (row, buckets) => buckets.some((bucket) => row.time >= bucket.start && row.time < bucket.start + spanMs(span));
  const kpi = (stage) => {
    const nowRows = current.filter((row) => row.stage === stage && inSpan(row, recent));
    const thenRows = current.filter((row) => row.stage === stage && inSpan(row, previous));
    return {
      value: nowRows.length,
      delta: nowRows.length - thenRows.length,
      test: nowRows.filter((row) => row.test).length,
      real: nowRows.filter((row) => !row.test).length
    };
  };
  const listed = current.length;
  const receipts = current.filter((row) => row.stage === 'receipt').length;
  const declined = current.filter((row) => row.closed).length;
  const hours = Math.round(current.reduce((sum, row) => sum + row.minutes, 0) / 60 * 10) / 10;
  const usd = Math.round(current.reduce((sum, row) => sum + row.usd, 0) * 100) / 100;
  const mix = new Map();
  for (const row of current) mix.set(row.activity, (mix.get(row.activity) || 0) + 1);
  const offers = current.filter((row) => row.side === 'offer').length;
  return {
    span,
    buckets,
    offers,
    requests: current.length - offers,
    test: current.filter((row) => row.test).length,
    real: current.filter((row) => !row.test).length,
    hours,
    usd,
    listed: kpi('listed'),
    matched: kpi('matched'),
    confirmed: kpi('confirmed'),
    receipt: kpi('receipt'),
    completion: rate(receipts, listed),
    decline: rate(declined, listed),
    timing: medianHours(events),
    examples: current.filter((row) => row.id.startsWith('hx-')).length,
    types: typeCounts(current),
    mix: [...mix.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, count]) => ({ label, count }))
  };
}

export function personalReport(book, { span = 'day', now = Date.now() } = {}) {
  const sessions = Array.isArray(book?.sessions) ? book.sessions : [];
  const events = sessions.map((row, index) => ({
    id: String(row.id || index),
    time: messageTime(row.at) || Date.parse(row.at) || 0,
    sequence: index + 1,
    stage: stageOf(row),
    test: false,
    side: row.side === 'request' ? 'request' : 'offer',
    minutes: Number(row.minutes) > 0 ? Number(row.minutes) : 0,
    usd: 0,
    activity: String(row.activity || 'Health'),
    closed: false
  }));
  const buckets = timeBuckets(events, span, now);
  const half = Math.floor(buckets.length / 2);
  const count = (rows, stage) => rows.reduce((sum, row) => sum + row.real[stage], 0);
  const kpi = (stage) => {
    const value = count(buckets.slice(half), stage);
    return { value, delta: value - count(buckets.slice(0, half), stage), test: 0, real: value };
  };
  const mix = new Map();
  for (const row of events) mix.set(row.activity, (mix.get(row.activity) || 0) + 1);
  return {
    span,
    buckets,
    offers: events.filter((row) => row.side === 'offer').length,
    requests: events.filter((row) => row.side === 'request').length,
    hours: Math.round(events.reduce((sum, row) => sum + row.minutes, 0) / 60 * 10) / 10,
    receipts: events.filter((row) => row.stage === 'receipt').length,
    attestations: sessions.reduce((sum, row) => sum + (Number(row.attestations) || 0), 0),
    credit: Math.round(sessions.reduce((sum, row) => sum + (Number(row.credit) || 0), 0) * 100) / 100,
    listed: kpi('listed'),
    matched: kpi('matched'),
    confirmed: kpi('confirmed'),
    receipt: kpi('receipt'),
    mix: [...mix.entries()].map(([label, count]) => ({ label, count })),
    private: true
  };
}

export const PERSONAL_KEY = 'lgme.health.book';

export function readPersonalBook(storage) {
  const seat = String(storage?.getItem?.('lgme-gym.seat') || '').trim();
  if (!seat) return null;
  try {
    const book = JSON.parse(storage.getItem(PERSONAL_KEY) || 'null');
    if (!book || book.handle !== seat || !Array.isArray(book.sessions)) return { handle: seat, sessions: [] };
    return { handle: seat, sessions: book.sessions };
  } catch {
    return { handle: seat, sessions: [] };
  }
}
