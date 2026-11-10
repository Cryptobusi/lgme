import { merkleRootOf } from '../../js/clearing.mjs';
import { anchorMessage, hashscanMessage, hederaReadiness, topicAllowed } from '../../js/hedera-anchor-core.mjs';
import { json, readBody, readEnv } from '../lib/http.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  const ready = hederaReadiness(env);
  if (!ready.enabled) {
    return json(res, 503, { ok: false, enabled: false, missing: ready.missing, wording: ready.wording });
  }
  const body = await readBody(req);
  const leaves = Array.isArray(body.leaves) ? body.leaves.map((leaf) => String(leaf || '').toLowerCase()) : [];
  if (!leaves.length || leaves.some((leaf) => !/^[0-9a-f]{64}$/.test(leaf))) {
    return json(res, 400, { ok: false, error: 'Send the tape leaf hashes.' });
  }
  const root = await merkleRootOf(leaves);
  if (body.root && String(body.root).toLowerCase() !== root) {
    return json(res, 400, { ok: false, error: 'The root does not match these leaves.' });
  }
  const topic = topicAllowed(env.HEDERA_TESTNET_TOPIC_ID);
  if (!topic.ok) return json(res, 400, { ok: false, error: topic.error });
  const sdk = await import('@hashgraph/sdk');
  const client = sdk.Client.forTestnet();
  client.setOperator(sdk.AccountId.fromString(env.HEDERA_TESTNET_OPERATOR_ID), sdk.PrivateKey.fromString(env.HEDERA_TESTNET_OPERATOR_KEY));
  let topicId = topic.topicId || '';
  if (topic.create) {
    const created = await new sdk.TopicCreateTransaction().setTopicMemo('lgme testnet tape root').execute(client);
    const receipt = await created.getReceipt(client);
    topicId = receipt.topicId.toString();
    const check = topicAllowed(topicId);
    if (!check.ok) return json(res, 400, { ok: false, error: check.error });
  }
  const submitted = await new sdk.TopicMessageSubmitTransaction({
    topicId,
    message: anchorMessage({ root, day: body.day || '', leafCount: leaves.length })
  }).execute(client);
  const record = await submitted.getRecord(client);
  const sequence = record.receipt.topicSequenceNumber.toString();
  const consensusTimestamp = record.consensusTimestamp?.toString?.() || '';
  return json(res, 200, {
    ok: true,
    network: 'testnet',
    topicId,
    sequenceNumber: sequence,
    consensusTimestamp,
    root,
    hashscan: hashscanMessage(topicId, sequence)
  });
}
