import { OPERATOR_RULES, sharedListingsEnabled, withinRate } from '../../js/shared-listings.mjs';
import { json, readBody, readEnv } from '../lib/http.mjs';
import { VIEW_ONLY_MESSAGE } from '../../js/view-only-api.mjs';
import { verifyDevice } from '../../js/device-sign.mjs';
import { HOUR_LIMIT, LISTINGS_OPERATOR, LISTINGS_TOPIC, publicExchangeListing } from '../../js/exchange-listing.mjs';
import { submitPaidListing } from '../../js/hedera-submit.mjs';
import { SETUP_ADDRESS, SETUP_MINT, confirmSetupTransfer, publicSetupReceivable } from '../../js/setup-fee.mjs';
import { rpc } from '../../js/solana-pay.mjs';
import { fetchSpotPrice, purchaseQuote } from '../../js/lgme-price.mjs';
import { redisRest } from '../../js/redis-env.mjs';
import { upstashStore } from '../lib/upstash.mjs';
import { allowRate } from '../../js/gym-kv.mjs';

const hits = new Map();
const memoryStamps = new Map();
const BOOK = 'listings:book';

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
      rules: OPERATOR_RULES
    });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const ip = String(req.headers?.['x-forwarded-for'] || 'local').split(',')[0].trim();
  const paced = allowRate(hits, `listings:${ip}`, Date.now(), 20);
  if (!paced.ok) return json(res, 429, paced);
  const body = await readBody(req);
  const payload = body.payload || {};
  const fee = payload.action === 'receivable' || payload.action === 'receivable-paid';
  const built = fee
    ? publicSetupReceivable({ ...payload, handle: payload.handle || body.handle })
    : publicExchangeListing({ ...payload, handle: payload.handle || body.handle });
  if (!built.ok) return json(res, built.status || 400, { ok: false, viewOnly: built.viewOnly === true, error: built.error || VIEW_ONLY_MESSAGE });
  if (payload.action === 'receivable-paid') {
    const tx = await rpc('mainnet-beta', 'getTransaction', [payload.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
    let purchaseAmount = 0;
    if (payload.buySignature) {
      const buy = await rpc('mainnet-beta', 'getTransaction', [payload.buySignature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0, commitment: 'finalized' }]);
      const sol = buy.ok ? await fetchSpotPrice({ mint: 'So11111111111111111111111111111111111111112' }) : { ok: false };
      const bought = buy.ok && buy.result ? purchaseQuote(buy.result, { solUsd: sol.ok ? sol.price : 0 }) : { ok: false, error: buy.error || 'The buy could not be read.' };
      if (!bought.ok) return json(res, 400, { ok: false, error: bought.error });
      purchaseAmount = bought.lgmeAmount;
    }
    const confirmed = tx.ok && tx.result
      ? confirmSetupTransfer(tx.result, { recipient: SETUP_ADDRESS, mint: SETUP_MINT, amount: built.body.lgmeAmount, purchaseAmount, signature: payload.signature, tolerance: 0.02 })
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
