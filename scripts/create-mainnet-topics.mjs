import { mainnetTopicReady } from '../js/hedera-network.mjs';

// Built and switched off.
// This file does not run a transaction unless both flags are set:
//   HEDERA_NETWORK=mainnet
//   HEDERA_MAINNET_CONFIRM=create-topics
// Do not set those flags from a deploy, a preview, or a test.

const ready = mainnetTopicReady(process.env);
if (!ready.ok) {
  console.log(ready.error);
  process.exit(0);
}

const sdk = await import('@hashgraph/sdk');
const operator = sdk.PrivateKey.fromStringECDSA(String(process.env.HEDERA_MAINNET_OPERATOR_KEY || '').trim());
const client = sdk.Client.forMainnet();
client.setOperator(sdk.AccountId.fromString(process.env.HEDERA_MAINNET_OPERATOR_ID), operator);
const submitted = await new sdk.TopicCreateTransaction()
  .setTopicMemo('lgme mainnet tape root')
  .setAdminKey(operator.publicKey)
  .setSubmitKey(operator.publicKey)
  .execute(client);
const receipt = await submitted.getReceipt(client);
console.log(`Created topic ${receipt.topicId.toString()}.`);
