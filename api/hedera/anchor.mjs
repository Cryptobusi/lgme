import { merkleRootOf } from '../../js/clearing.mjs';
import { anchorMessage, hashscanMessage, hederaReadiness, topicAllowed } from '../../js/hedera-anchor-core.mjs';
import { cronAllowed } from '../../js/hedera-topic.mjs';
import { testnetOperatorKey } from '../../js/hedera-operator.mjs';
import { guardRequest, json, readBody, readEnv } from '../lib/http.mjs';
import { check, fields } from '../../js/input-schema.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  if (!cronAllowed(req.headers || {}, env)) {
    return json(res, 401, { ok: false, error: 'This anchor is not open to the public.' });
  }
  const ready = hederaReadiness(env);
  if (!ready.enabled) {
    return json(res, 503, { ok: false, enabled: false, missing: ready.missing, wording: ready.wording });
  }
  const body = await readBody(req);
  if (guardRequest(req, res)) return;
  if (body.day) {
    const day = check(body.day, fields.day, 'day');
    if (!day.ok) return json(res, 400, { ok: false, error: day.error });
  }
  const sdk = await import('@hashgraph/sdk');
  const client = sdk.Client.forTestnet();
  let operator;
  try {
    operator = await testnetOperatorKey(sdk, env);
  } catch (error) {
    return json(res, 400, { ok: false, error: error.public ? error.message : 'The testnet operator key could not be used.' });
  }
  client.setOperator(sdk.AccountId.fromString(env.HEDERA_TESTNET_OPERATOR_ID), operator);
  const leaves = Array.isArray(body.leaves) ? body.leaves.map((leaf) => String(leaf || '').toLowerCase()) : [];
  if (!leaves.length || leaves.some((leaf) => !/^[0-9a-f]{64}$/.test(leaf))) {
    return json(res, 400, { ok: false, error: 'Send the tape leaf hashes.' });
  }
  const root = await merkleRootOf(leaves);
  if (body.root && String(body.root).toLowerCase() !== root) {
    return json(res, 400, { ok: false, error: 'The root does not match these leaves.' });
  }
  const topic = topicAllowed(env.HEDERA_TESTNET_TOPIC_ID);
  if (!topic.ok || topic.create) return json(res, 503, { ok: false, error: 'HEDERA_TESTNET_TOPIC_ID is not set. No topic was created.' });
  const topicId = topic.topicId;
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
