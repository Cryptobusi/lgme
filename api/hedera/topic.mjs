import { json, readEnv } from '../lib/http.mjs';
import { cronAllowed, protectedTopicTransaction, topicAdminReady } from '../../js/hedera-topic.mjs';
import { testnetOperatorKey } from '../../js/hedera-operator.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Use POST.' });
  const env = readEnv();
  if (!cronAllowed(req.headers || {}, env)) return json(res, 401, { ok: false, error: 'Topic creation is not open to the public.' });
  const ready = topicAdminReady(env);
  if (!ready.ok) return json(res, 403, { ok: false, created: false, error: ready.error });
  const sdk = await import('@hashgraph/sdk');
  let operator;
  try {
    operator = await testnetOperatorKey(sdk, env);
  } catch (error) {
    return json(res, 400, { ok: false, created: false, error: error.public ? error.message : 'The testnet operator key could not be used.' });
  }
  const client = sdk.Client.forTestnet();
  client.setOperator(sdk.AccountId.fromString(env.HEDERA_TESTNET_OPERATOR_ID), operator);
  const submitted = await protectedTopicTransaction(sdk, operator).execute(client);
  const receipt = await submitted.getReceipt(client);
  const topicId = receipt.topicId.toString();
  return json(res, 200, {
    ok: true,
    created: true,
    network: 'testnet',
    topicId,
    next: 'Set HEDERA_TESTNET_TOPIC_ID to this id. Topic 0.0.11397291 stays readable.'
  });
}
