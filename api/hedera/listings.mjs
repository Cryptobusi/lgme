import { OPERATOR_RULES, sharedListingsEnabled, withinRate } from '../../js/shared-listings.mjs';
import { json, readBody, readEnv } from '../lib/http.mjs';
import { VIEW_ONLY_MESSAGE } from '../../js/view-only-api.mjs';
import { verifyDevice } from '../../js/device-sign.mjs';
import { HOUR_LIMIT, LISTINGS_OPERATOR, LISTINGS_TOPIC, publicExchangeListing } from '../../js/exchange-listing.mjs';
import { submitPaidListing } from '../../js/hedera-submit.mjs';
import { SETUP_ADDRESS, SETUP_MINT, confirmSetupTransfer, findSetupPayment, publicSetupReceivable } from '../../js/setup-fee.mjs';
import { applyPoolAction, emptyPool, poolView, publicPoolMessage } from '../../js/membership-pool.mjs';
import { rpc } from '../../js/solana-pay.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { allowRate } from '../../js/gym-kv.mjs';

const hits = new Map();
const memoryStamps = new Map();
const BOOK = 'listings:book';
const POOL_KEY = 'membership:pool';
const POOL_ACTIONS = new Set(['pool-credit', 'pool-lgme', 'pool-sponsor', 'pool-draw', 'pool-accept', 'pool-attest']);
let memoryPool = emptyPool();

function decodeMessage(message) {
  try {
    const text = Buffer.from(String(message || ''), 'base64').toString('utf8');
    const body = JSON.parse(text);
    return body?.category === 'exchange' ? body : null;
  } catch {
    return null;
  }
}

async function bookOf(store) {
  const saved = store ? ((await store.get(BOOK)) || { stamps: {}, posted: [] }) : { stamps: {}, posted: [] };
  return { stamps: saved.stamps || {}, posted: Array.isArray(saved.posted) ? saved.posted : [] };
}

function poolFromMirror(messages) {
  const latest = [...(messages || [])].reverse().map((row) => decodeMessage(row.message)).find((item) => item?.id === 'membership-fee-pool');
  if (!latest) return null;
  return {
    ...emptyPool(),
    inUsd: Number(latest.inUsd) || 0,
    outUsd: Number(latest.outUsd) || 0,
    sponsorsWaiting: Number(latest.offers) || 0
  };
}

async function loadPool(store, messages) {
  const saved = store ? await store.get(POOL_KEY) : memoryPool;
  const pool = saved && typeof saved === 'object' ? saved : emptyPool();
  const empty = !pool.inUsd && !pool.outUsd && !pool.sponsorsWaiting && !(pool.hashes || []).length;
  if (!empty) return pool;
  const mirrored = poolFromMirror(messages);
  return mirrored || pool;
}

async function savePool(store, pool) {
  memoryPool = pool;
  if (store) await store.set(POOL_KEY, pool);
}

export default async function handler(req, res) {
  const env = readEnv();
  const enabled = sharedListingsEnabled(env);
  const redis = redisRest(env);
  const store = redis.configured ? upstashStore(redis.url, redis.token) : null;
  if (req.method === 'GET') {
    if (!enabled) {
      return json(res, 503, {
        ok: false,
        enabled: false,
        network: 'testnet',
        topicId: LISTINGS_TOPIC,
        payer: LISTINGS_OPERATOR,
        listings: [],
        rules: OPERATOR_RULES,
        missing: ['SHARED_LISTINGS_TESTNET=on']
      });
    }
    const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${LISTINGS_TOPIC}/messages?limit=40&order=asc`);
    if (!response.ok) return json(res, 502, { ok: false, listings: [], error: 'The testnet mirror did not answer.' });
    const body = await response.json();
    const book = await bookOf(store);
    const pool = poolView(await loadPool(store, body.messages));
    const listings = (body.messages || []).map((row) => ({
      consensusTimestamp: row.consensus_timestamp,
      sequenceNumber: row.sequence_number,
      payer: row.payer_account_id || LISTINGS_OPERATOR,
      item: decodeMessage(row.message)
    })).filter((row) => row.item);
    return json(res, 200, {
      ok: true,
      enabled: true,
      network: 'testnet',
      topicId: LISTINGS_TOPIC,
      payer: LISTINGS_OPERATOR,
      listings,
      posted: book.posted,
      pool,
      rules: OPERATOR_RULES
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, `listings:${ip}`, Date.now(), 20);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  const payload = body.payload || {};
  if (POOL_ACTIONS.has(payload.action)) {
    const signed = await verifyDevice(body.publicJwk, payload, body.sig);
    if (!signed || payload.handle !== body.handle) return json(res, 401, { ok: false, error: 'The device signature was refused.' });
    if (String(payload.category || '').toLowerCase() !== 'exchange') {
      return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
    }
    if (!enabled) return json(res, 503, { ok: false, enabled: false, error: 'Shared listings are not on.' });
    let confirmation = null;
    if (payload.action === 'pool-lgme' && payload.reference) {
      confirmation = await findSetupPayment(payload.reference, { recipient: SETUP_ADDRESS, mint: SETUP_MINT, amount: payload.lgmeAmount, tolerance: 0.02 });
      if (!confirmation.ok) return json(res, 400, { ok: false, error: confirmation.error });
    }
    const book = await bookOf(store);
    const now = Date.now();
    const prior = store ? (book.stamps[payload.handle] || []) : (memoryStamps.get(payload.handle) || []);
    const gate = withinRate(prior, now, HOUR_LIMIT);
    if (!gate.ok) return json(res, 429, { ok: false, error: 'At most 10 listing messages an hour for each author.' });
    const mirror = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${LISTINGS_TOPIC}/messages?limit=40&order=asc`);
    const mirrored = mirror.ok ? await mirror.json() : { messages: [] };
    const current = await loadPool(store, mirrored.messages);
    const applied = await applyPoolAction(current, { ...payload, handle: payload.handle || body.handle }, confirmation);
    if (!applied.ok) return json(res, applied.status || 400, { ok: false, error: applied.error });
    const message = publicPoolMessage(applied.pool, applied.hash);
    let submitted = { ok: true, duplicate: true };
    if (!applied.duplicate) {
      try {
        submitted = await submitPaidListing(env, message);
      } catch (error) {
        return json(res, 502, { ok: false, error: error.public ? error.message : 'The testnet topic did not accept the listing.' });
      }
      if (!submitted.ok) return json(res, 503, submitted);
    }
    await savePool(store, applied.pool);
    const stamps = [...gate.recent, now].slice(-HOUR_LIMIT);
    memoryStamps.set(payload.handle, stamps);
    book.stamps[payload.handle] = stamps;
    book.posted = [...book.posted, {
      id: message.id,
      kind: message.kind,
      title: message.title,
      status: applied.pending ? 'pending' : 'recorded',
      transactionId: submitted.transactionId || '',
      sequenceNumber: submitted.sequenceNumber || '',
      hashscan: submitted.hashscan || '',
      payer: LISTINGS_OPERATOR,
      topicId: LISTINGS_TOPIC
    }].slice(-40);
    if (store) await store.set(BOOK, book);
    return json(res, 200, {
      ok: true,
      ...submitted,
      item: message,
      pool: applied.view,
      pending: applied.pending === true,
      note: applied.note || '',
      personal: false
    });
  }
  if (payload.action === 'receivable-paid' && payload.reference) {
    const found = await findSetupPayment(payload.reference, { recipient: SETUP_ADDRESS, mint: SETUP_MINT, amount: payload.lgmeAmount, tolerance: 0.02 });
    if (!found.ok) return json(res, 400, { ok: false, error: found.error });
    payload.signature = found.signature;
  }
  const fee = payload.action === 'receivable' || payload.action === 'receivable-paid';
  const built = fee
    ? publicSetupReceivable({ ...payload, handle: payload.handle || body.handle })
    : publicExchangeListing({ ...payload, handle: payload.handle || body.handle });
  if (!built.ok) return json(res, built.status || 400, { ok: false, viewOnly: built.viewOnly === true, error: built.error || VIEW_ONLY_MESSAGE });
  if (payload.action === 'receivable-paid' && payload.signature && !payload.reference) {
    const tx = await rpc('mainnet-beta', 'getTransaction', [payload.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
    const confirmed = tx.ok && tx.result
      ? confirmSetupTransfer(tx.result, { recipient: SETUP_ADDRESS, mint: SETUP_MINT, amount: built.body.lgmeAmount, signature: payload.signature, tolerance: 0.02 })
      : { ok: false, error: tx.error || 'The payment was not confirmed on Solana mainnet.' };
    if (!confirmed.ok) return json(res, 400, { ok: false, error: confirmed.error });
  }
  if (String(payload.category || '').toLowerCase() !== 'exchange') {
    return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
  }
  const signed = await verifyDevice(body.publicJwk, payload, body.sig);
  if (!signed || payload.handle !== body.handle) return json(res, 401, { ok: false, error: 'The device signature was refused.' });
  if (!enabled) return json(res, 503, { ok: false, enabled: false, error: 'Shared listings are not on.' });
  const book = await bookOf(store);
  const now = Date.now();
  const prior = store ? (book.stamps[payload.handle] || []) : (memoryStamps.get(payload.handle) || []);
  const gate = withinRate(prior, now, HOUR_LIMIT);
  if (!gate.ok) return json(res, 429, { ok: false, error: 'At most 10 listing messages an hour for each author.' });
  let submitted;
  try {
    submitted = await submitPaidListing(env, built.body);
  } catch (error) {
    return json(res, 502, { ok: false, error: error.public ? error.message : 'The testnet topic did not accept the listing.' });
  }
  if (!submitted.ok) return json(res, 503, submitted);
  const stamps = [...gate.recent, now].slice(-HOUR_LIMIT);
  memoryStamps.set(payload.handle, stamps);
  book.stamps[payload.handle] = stamps;
  book.posted = [...book.posted, {
    id: built.body.id,
    kind: built.body.kind,
    title: built.body.title,
    status: built.body.status,
    transactionId: submitted.transactionId,
    sequenceNumber: submitted.sequenceNumber,
    hashscan: submitted.hashscan,
    payer: LISTINGS_OPERATOR,
    topicId: LISTINGS_TOPIC
  }].slice(-40);
  if (store) await store.set(BOOK, book);
  return json(res, 200, { ok: true, ...submitted, item: built.body, personal: false });
}
