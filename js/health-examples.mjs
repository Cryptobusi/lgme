import { LISTINGS_OPERATOR, LISTINGS_TOPIC } from './exchange-listing.mjs';
import { canonicalDevice, sha256Hex } from './device-sign.mjs';
import { chainPayloadSafe } from './hedera-network.mjs';

export const HEALTH_AUTHORS = Object.freeze(['mina-vale', 'otto-park', 'lila-brook', 'nico-fern', 'sage-holm', 'remy-cole']);

export const HEALTH_EXAMPLES = Object.freeze([
  { id: 'hx-walk', title: 'Walking group', service: 'walk', side: 'offer', status: 'Test item - unclaimed', path: 'offer-listed', author: 'mina-vale', stage: 'listed', support: 'listing' },
  { id: 'hx-strength', title: 'Strength session', service: 'strength', side: 'request', status: 'Test item - unclaimed', path: 'request-listed', author: 'otto-park', stage: 'listed', support: 'listing' },
  { id: 'hx-yoga', title: 'Yoga hour', service: 'mobility', side: 'offer', status: 'Test item - matched', path: 'hour-trade', author: 'lila-brook', stage: 'matched', support: 'listing' },
  { id: 'hx-swim', title: 'Swimming session', service: 'cardio', side: 'offer', status: 'Test item - confirmed', path: 'usd-trade', author: 'nico-fern', stage: 'confirmed', support: 'listing' },
  { id: 'hx-cycle', title: 'Cycling session', service: 'bike', side: 'offer', status: 'Test item - confirmed', path: 'mental-rate', author: 'sage-holm', stage: 'confirmed', support: 'arbiter' },
  { id: 'hx-stretch', title: 'Stretching and mobility', service: 'mobility', side: 'offer', status: 'Test item - matched', path: 'trainer-confirm', author: 'remy-cole', stage: 'matched', support: 'trainer' },
  { id: 'hx-nutrition', title: 'Nutrition coaching', service: 'plan', side: 'offer', status: 'Test item - receipt', path: 'ididit', author: 'mina-vale', stage: 'receipt', support: 'receipt' },
  { id: 'hx-meal', title: 'Meal prep', service: 'health', side: 'offer', status: 'Test item - receipt', path: 'pool-sponsor', author: 'otto-park', stage: 'receipt', support: 'pool-separate' },
  { id: 'hx-sleep', title: 'Sleep routine check-in', service: 'health', side: 'request', status: 'Test item - confirmed', path: 'self-paid', author: 'lila-brook', stage: 'confirmed', support: 'pool-separate' },
  { id: 'hx-breath', title: 'Meditation and breathwork', service: 'mental', side: 'offer', status: 'Test item - declined', path: 'declined', author: 'nico-fern', stage: 'listed', support: 'not-on-topic' },
  { id: 'hx-physio', title: 'Rehab exercise session', service: 'mobility', side: 'request', status: 'Test item - cancelled', path: 'cancelled-expired', author: 'sage-holm', stage: 'listed', support: 'not-on-topic' },
  { id: 'hx-dance', title: 'Dance fitness', service: 'cardio', side: 'offer', status: 'Test item - open', path: 'disputed-open', author: 'remy-cole', stage: 'listed', support: 'not-on-topic' },
  { id: 'hx-hike', title: 'Hiking session', service: 'walk', side: 'offer', status: 'Test item - partial', path: 'partial', author: 'mina-vale', stage: 'matched', support: 'not-on-topic' },
  { id: 'hx-balance', title: 'Balance and fall prevention', service: 'mobility', side: 'request', status: 'Test item - repeat', path: 'repeat', author: 'otto-park', stage: 'listed', support: 'not-on-topic' },
  { id: 'hx-checkin', title: 'Group check-in buddy', service: 'health', side: 'offer', status: 'Test item - receipt', path: 'circle-attest', author: 'lila-brook', stage: 'receipt', support: 'hash-only' }
]);

const BY_ID = new Map(HEALTH_EXAMPLES.map((row) => [row.id, row]));

export function healthChainMessage(spec) {
  const body = {
    v: 1,
    network: 'testnet',
    kind: 'listing',
    id: spec.id,
    category: 'exchange',
    group: 'health',
    service: spec.service,
    side: spec.side,
    status: spec.status,
    path: spec.path,
    receiptHash: spec.receiptHash,
    topic: LISTINGS_TOPIC,
    payer: LISTINGS_OPERATOR
  };
  const privacy = chainPayloadSafe(body);
  if (!privacy.ok) return privacy;
  if (JSON.stringify(body).includes('@')) return { ok: false, error: 'Email does not go on chain.' };
  return { ok: true, body };
}

export async function healthExamplePosts() {
  const posts = [];
  for (const row of HEALTH_EXAMPLES) {
    const receiptHash = await sha256Hex(canonicalDevice({ id: row.id, path: row.path, receipt: 'IdidIt' }));
    const chain = healthChainMessage({ ...row, receiptHash });
    posts.push({
      handle: row.author,
      action: 'listing',
      category: 'exchange',
      hashOnly: true,
      id: row.id,
      title: row.title,
      service: row.service,
      side: row.side,
      status: row.status,
      path: row.path,
      group: 'health',
      durationMin: 45,
      tags: ['health', row.path],
      authorHandle: row.author,
      receiptHash,
      chain: chain.body
    });
  }
  return posts;
}

export function presentHealthExample(item = {}) {
  const extra = BY_ID.get(item.id);
  if (!extra) return item;
  return {
    ...item,
    title: extra.title,
    group: 'health',
    service: item.service || extra.service,
    side: item.side || extra.side,
    durationMin: item.durationMin || 45,
    status: item.status || extra.status,
    path: item.path || extra.path,
    authorHandle: extra.author,
    test: true,
    standing: true,
    summary: 'Test example until a real claim replaces it.'
  };
}

export function healthExampleMirrorRows() {
  return HEALTH_EXAMPLES.map((row) => ({
    sequenceNumber: 0,
    consensusTimestamp: '',
    item: {
      kind: 'listing',
      id: row.id,
      group: 'health',
      service: row.service,
      side: row.side,
      status: row.status,
      path: row.path,
      test: true
    }
  }));
}

export function mergeHealthExamples(listings = []) {
  const ids = new Set(listings.map((row) => row?.item?.id).filter(Boolean));
  return [...listings, ...healthExampleMirrorRows().filter((row) => !ids.has(row.item.id))];
}
