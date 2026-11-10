import { OPERATOR_RULES, sharedListingsEnabled } from '../../js/shared-listings.mjs';
import { json, readEnv } from '../lib/http.mjs';
import { VIEW_ONLY_MESSAGE } from '../../js/view-only-api.mjs';

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
  return json(res, 403, { ok: false, viewOnly: true, error: VIEW_ONLY_MESSAGE });
}
