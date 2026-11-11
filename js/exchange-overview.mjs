const HEALTH_SERVICES = new Set(['strength', 'cardio', 'mobility', 'plan', 'mental', 'bike', 'gear', 'repair', 'walk', 'health']);

export const OVERVIEW_KEY = 'lgme.exchange.overview';

export function emptyHealth() {
  return {
    testOffers: 0,
    realOffers: 0,
    testRequests: 0,
    realRequests: 0,
    testClaimed: 0,
    realClaimed: 0,
    testFinished: 0,
    realFinished: 0
  };
}

export function isHealthListing(item = {}) {
  if (item.service === 'author' || item.service === 'example') return false;
  if (item.kind && item.kind !== 'listing' && item.kind !== 'update') return false;
  if (String(item.status || '').startsWith('Example transaction')) return false;
  if (item.group && item.group !== 'health') return false;
  return item.group === 'health' || HEALTH_SERVICES.has(item.service) || String(item.id || '').startsWith('ex-');
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

function isFinished(item, status) {
  return /finished|completed|\bdone\b|ididit/i.test(`${status} ${item.summary || ''}`);
}

export function tallyExchange(payload = {}) {
  const listings = Array.isArray(payload.listings) ? payload.listings : [];
  const health = emptyHealth();
  const flow = { listed: 0, matched: 0, confirmed: 0, receipt: 0 };
  let latest = null;
  for (const row of listings) {
    const sequence = Number(row?.sequenceNumber);
    if (Number.isFinite(sequence) && (!latest || sequence > latest.sequence)) {
      latest = { sequence, time: row.consensusTimestamp || '' };
    }
  }
  for (const row of currentRows(listings)) {
    const item = row?.item || {};
    if (!isHealthListing(item)) continue;
    const status = String(item.status || '');
    const claimed = status.startsWith('Claimed by');
    const finished = isFinished(item, status);
    const test = !claimed && (/test|unclaimed/i.test(status) || item.test === true);
    const request = item.side === 'request';
    if (request) {
      if (test) health.testRequests += 1;
      else health.realRequests += 1;
    } else if (test) health.testOffers += 1;
    else health.realOffers += 1;
    if (claimed) {
      if (test) health.testClaimed += 1;
      else health.realClaimed += 1;
      flow.matched += 1;
    }
    if (finished) {
      if (test) health.testFinished += 1;
      else health.realFinished += 1;
      flow.receipt += 1;
    }
    if (/confirmed/i.test(`${status} ${item.summary || ''}`)) flow.confirmed += 1;
    flow.listed += 1;
  }
  return {
    network: payload.network || '',
    topicId: payload.topicId || '',
    latest,
    health,
    flow
  };
}
