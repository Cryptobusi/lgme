const HEALTH = new Set(['strength', 'cardio', 'mobility', 'plan', 'mental', 'bike', 'gear', 'repair', 'walk', 'health']);

export const OVERVIEW_KEY = 'lgme.exchange.overview';

function emptyBucket() {
  return { offers: 0, requests: 0, testUnclaimed: 0, claimed: 0, real: 0 };
}

function groupOf(item) {
  if (item.group) return item.group;
  if (item.service === 'mental') return 'mental';
  if (HEALTH.has(item.service) || String(item.id || '').startsWith('ex-')) return 'health';
  return 'other';
}

function currentRows(listings) {
  const latest = new Map();
  const loose = [];
  for (const row of listings) {
    const id = row?.item?.id;
    if (!id) { loose.push(row); continue; }
    const prior = latest.get(id);
    if (!prior || Number(row.sequenceNumber) >= Number(prior.sequenceNumber)) latest.set(id, row);
  }
  return [...latest.values(), ...loose];
}

export function tallyExchange(payload = {}) {
  const listings = Array.isArray(payload.listings) ? payload.listings : [];
  const current = currentRows(listings);
  const groups = {};
  const flow = { listed: 0, matched: 0, confirmed: 0, receipt: 0 };
  const examples = [];
  let developers = 0;
  let hosts = 0;
  let setupDue = 0;
  let setupPaid = 0;
  let latest = null;
  for (const row of listings) {
    const sequence = Number(row?.sequenceNumber);
    if (Number.isFinite(sequence) && (!latest || sequence > latest.sequence)) {
      latest = { sequence, time: row.consensusTimestamp || '' };
    }
  }
  let setupUsd = 0;
  for (const row of current) {
    const item = row?.item || {};
    const status = String(item.status || '');
    if (item.kind === 'interest') {
      if (item.offer === 'Developer team' && /pending review/i.test(status)) developers += 1;
      if (item.offer === 'Host a community' && /pending review/i.test(status)) hosts += 1;
      continue;
    }
    if (item.kind === 'receivable') { setupDue += 1; setupUsd += Number(item.usd) || 0; continue; }
    if (item.kind === 'receivable-paid') { setupPaid += 1; continue; }
    if (item.kind === 'pool' || item.service === 'author') continue;
    if (item.service === 'example' || status.startsWith('Example transaction')) {
      examples.push({
        id: item.id,
        title: item.title || item.id,
        summary: item.summary || '',
        sequence: row.sequenceNumber,
        status
      });
      if (/confirmed/i.test(`${status} ${item.summary || ''}`)) flow.confirmed += 1;
      if (/IdidIt/i.test(`${item.title || ''} ${item.summary || ''}`)) flow.receipt += 1;
      continue;
    }
    if (item.kind !== 'listing' && item.kind !== 'update') continue;
    const name = groupOf(item);
    const bucket = groups[name] || (groups[name] = emptyBucket());
    if (item.side === 'request') bucket.requests += 1;
    else bucket.offers += 1;
    if (status.startsWith('Claimed by')) {
      bucket.claimed += 1;
      flow.matched += 1;
    } else if (/test|unclaimed|pending review/i.test(status) || item.test === true) {
      bucket.testUnclaimed += 1;
    } else {
      bucket.real += 1;
    }
    flow.listed += 1;
    if (/IdidIt/i.test(`${item.title || ''} ${item.summary || ''}`)) flow.receipt += 1;
  }
  return {
    network: payload.network || '',
    topicId: payload.topicId || '',
    latest,
    groups,
    flow,
    examples,
    developers,
    hosts,
    pool: payload.pool || null,
    setup: { due: setupDue, paid: setupPaid, usd: Math.round(setupUsd * 100) / 100 }
  };
}

export function rowsFor(payload, key) {
  const all = Array.isArray(payload?.listings) ? payload.listings : [];
  const listings = (key === 'pool' || key === 'setup' ? all : currentRows(all))
    .slice()
    .sort((a, b) => Number(a.sequenceNumber) - Number(b.sequenceNumber));
  if (key === 'flow-listed') return listings.filter((row) => row.item?.kind === 'listing' && row.item?.service !== 'author' && row.item?.service !== 'example');
  if (key === 'flow-matched') return listings.filter((row) => String(row.item?.status || '').startsWith('Claimed by'));
  if (key === 'flow-confirmed') return listings.filter((row) => /confirmed/i.test(`${row.item?.status || ''} ${row.item?.summary || ''}`));
  if (key === 'flow-receipt') return listings.filter((row) => /IdidIt/i.test(`${row.item?.title || ''} ${row.item?.summary || ''}`));
  if (key === 'developers') return listings.filter((row) => row.item?.kind === 'interest' && row.item?.offer === 'Developer team');
  if (key === 'hosts-interest') return listings.filter((row) => row.item?.kind === 'interest' && row.item?.offer === 'Host a community');
  if (key === 'examples') return listings.filter((row) => row.item?.service === 'example' || String(row.item?.status || '').startsWith('Example transaction'));
  if (key === 'pool') return listings.filter((row) => row.item?.kind === 'pool');
  if (key === 'setup') return listings.filter((row) => row.item?.kind === 'receivable' || row.item?.kind === 'receivable-paid');
  return listings.filter((row) => groupOf(row.item || {}) === key && row.item?.service !== 'author' && row.item?.service !== 'example');
}
