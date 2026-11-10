import { topicAdminReady } from '../js/hedera-topic.mjs';
import { testnetOperatorKey } from '../js/hedera-operator.mjs';
import { protectedTopicTransaction } from '../js/hedera-topic.mjs';

// One command, off unless both flags are set:
//   HEDERA_TOPIC_ADMIN=on HEDERA_CREATE_TOPIC=yes node scripts/create-testnet-topic.mjs
// The new topic uses the operator key as adminKey and submitKey, so only this operator can post.
// Copy the printed id into HEDERA_TESTNET_TOPIC_ID.
// Topic 0.0.11397291 stays readable for roots that were already anchored.

const ready = topicAdminReady(process.env);
if (!ready.ok) {
  console.log(ready.error);
  console.log('Past roots stay readable on topic 0.0.11397291.');
  console.log('After creation, set HEDERA_TESTNET_TOPIC_ID to the new testnet topic id.');
  process.exit(0);
}

const sdk = await import('@hashgraph/sdk');
const operator = await testnetOperatorKey(sdk, process.env);
const client = sdk.Client.forTestnet();
client.setOperator(sdk.AccountId.fromString(process.env.HEDERA_TESTNET_OPERATOR_ID), operator);
const submitted = await protectedTopicTransaction(sdk, operator).execute(client);
const receipt = await submitted.getReceipt(client);
const topicId = receipt.topicId.toString();
console.log(`Created testnet topic ${topicId}.`);
console.log('Set HEDERA_TESTNET_TOPIC_ID to that id. Topic 0.0.11397291 stays readable.');
