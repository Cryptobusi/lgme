import { OPERATOR_RULES, listingMessage, sharedListingsEnabled, withinRate } from '../../js/shared-listings.mjs';
import { json, readBody, readEnv } from '../lib/http.mjs';

const stamps = new Map();

export default async function handler(req, res) {
  const env = readEnv();
  const enabled = sharedListingsEnabled(env);
  if (!enabled) {
    return json(res, 503, {
      ok: false,
      enabled: false,
      network: 'testnet',
      listings: [],
      rules: OPERATOR_RULES,
      missing: ['SHARED_LISTINGS_TESTNET=on']
    });
  }
  if (req.method === 'GET') {
    const topic = String(env.HEDERA_TESTNET_LISTINGS_TOPIC_ID || '');
    if (!topic) return json(res, 503, { ok: false, enabled: true, listings: [], error: 'HEDERA_TESTNET_LISTINGS_TOPIC_ID is not set.' });
    const response = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topic}/messages?limit=20&order=desc`);
    if (!response.ok) return json(res, 502, { ok: false, listings: [], error: 'The testnet mirror did not answer.' });
    const body = await response.json();
    const listings = (body.messages || []).map((row) => ({
      consensusTimestamp: row.consensus_timestamp,
      sequenceNumber: row.sequence_number,
      message: row.message
    })).sort((a, b) => String(a.consensusTimestamp).localeCompare(String(b.consensusTimestamp)));
    return json(res, 200, { ok: true, enabled: true, network: 'testnet', listings, rules: OPERATOR_RULES });
  }
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use GET or POST.' });
  const body = await readBody(req);
  const built = listingMessage(body.message || body);
  if (!built.ok) return json(res, 400, built);
  const author = JSON.stringify(built.body.author);
  const now = Date.now();
  const prior = stamps.get(author) || [];
  const rate = withinRate(prior, now);
  if (!rate.ok) return json(res, 429, { ok: false, error: 'That author has hit the testnet listing limit for this hour.' });
  const topic = String(env.HEDERA_TESTNET_LISTINGS_TOPIC_ID || '');
  if (!topic) {
    return json(res, 503, { ok: false, enabled: true, error: 'HEDERA_TESTNET_LISTINGS_TOPIC_ID is not set. No testnet message was sent.', rules: OPERATOR_RULES });
  }
  stamps.set(author, [...rate.recent, now]);
  const sdk = await import('@hashgraph/sdk');
  const client = sdk.Client.forTestnet();
  client.setOperator(sdk.AccountId.fromString(env.HEDERA_TESTNET_OPERATOR_ID), sdk.PrivateKey.fromString(env.HEDERA_TESTNET_OPERATOR_KEY));
  const submitted = await new sdk.TopicMessageSubmitTransaction({
    topicId: topic,
    message: JSON.stringify(built.body)
  }).execute(client);
  const record = await submitted.getRecord(client);
  const sequence = record.receipt.topicSequenceNumber.toString();
  return json(res, 200, {
    ok: true,
    network: 'testnet',
    topicId: topic,
    sequenceNumber: sequence,
    consensusTimestamp: record.consensusTimestamp?.toString?.() || '',
    rules: OPERATOR_RULES
  });
}
