import { merkleRootOf } from './clearing.mjs';
import { anchorMessage, hashscanMessage, hederaReadiness, topicAllowed } from './hedera-anchor-core.mjs';
import { testnetOperatorKey } from './hedera-operator.mjs';

const memory = [];

export function memoryQueue() {
  return memory;
}

export async function queueHash(store, item) {
  const hash = String(item.hash || '').toLowerCase();
  const day = String(item.day || '').slice(0, 10);
  if (!/^[0-9a-f]{64}$/.test(hash)) return { ok: false, error: 'Send a hash.' };
  const row = { hash, day, at: new Date().toISOString() };
  memory.push(row);
  if (store) {
    const prior = (await store.get('hedera:queue')) || [];
    await store.set('hedera:queue', [...prior, row].slice(-200));
  }
  return { ok: true, queued: true };
}

export async function pendingHashes(store) {
  const saved = store ? ((await store.get('hedera:queue')) || []) : [];
  const seen = new Set();
  const rows = [];
  for (const row of [...saved, ...memory]) {
    if (!row?.hash || seen.has(row.hash)) continue;
    seen.add(row.hash);
    rows.push(row);
  }
  return rows;
}

export async function markAnchored(store, hashes) {
  const done = new Set(hashes);
  for (let i = memory.length - 1; i >= 0; i -= 1) {
    if (done.has(memory[i].hash)) memory.splice(i, 1);
  }
  if (!store) return;
  const prior = (await store.get('hedera:queue')) || [];
  await store.set('hedera:queue', prior.filter((row) => !done.has(row.hash)));
}

export async function submitLeaves(env, leaves, day) {
  const ready = hederaReadiness(env);
  if (!ready.enabled) return { ok: false, enabled: false, wording: ready.wording };
  const clean = (leaves || []).map((leaf) => String(leaf || '').toLowerCase()).filter((leaf) => /^[0-9a-f]{64}$/.test(leaf));
  if (!clean.length) return { ok: false, error: 'Send the tape leaf hashes.' };
  const root = await merkleRootOf(clean);
  const topic = topicAllowed(env.HEDERA_TESTNET_TOPIC_ID);
  if (!topic.ok || topic.create) return { ok: false, error: 'The testnet topic is not set. No topic was created.' };
  const sdk = await import('@hashgraph/sdk');
  const client = sdk.Client.forTestnet();
  const operator = await testnetOperatorKey(sdk, env);
  client.setOperator(sdk.AccountId.fromString(env.HEDERA_TESTNET_OPERATOR_ID), operator);
  const submitted = await new sdk.TopicMessageSubmitTransaction({
    topicId: topic.topicId,
    message: anchorMessage({ root, day, leafCount: clean.length })
  }).execute(client);
  const record = await submitted.getRecord(client);
  const sequence = record.receipt.topicSequenceNumber.toString();
  return {
    ok: true,
    network: 'testnet',
    topicId: topic.topicId,
    sequenceNumber: sequence,
    consensusTimestamp: record.consensusTimestamp?.toString?.() || '',
    root,
    hashscan: hashscanMessage(topic.topicId, sequence)
  };
}
